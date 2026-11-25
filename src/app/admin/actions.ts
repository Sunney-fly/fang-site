'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRole, requireStaff, hashPassword } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import { audit, SETTING_KEYS, setSetting } from '@/lib/settings';
import { listingInputSchema } from '@/lib/validators';
import { randomCode } from '@/lib/attribution';
import { parseForm } from '@/lib/validators';
import { NOTIFY_KEYS, sendTestNotify } from '@/lib/notify';

export type ActionState = { ok?: boolean; error?: string; message?: string };

/** 「子管理员提交房源是否需要审核」的设置键 */
const SETTING_KEY_REVIEW = 'require_review';

/* ==================== 工具 ==================== */

/** 解析房源表单（FormData → 校验后的对象） */
function parseListingForm(fd: FormData) {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const n = (k: string) => {
    const v = s(k);
    if (v === undefined) return undefined;
    const num = Number(v);
    return Number.isFinite(num) ? num : undefined;
  };
  const b = (k: string) => {
    const v = fd.get(k);
    if (v === null) return undefined;
    return v === 'on' || v === 'true' || v === '1';
  };

  const images = (s('imageUrls') ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);

  const payload = {
    id: s('id'),
    title: s('title') ?? '',
    dealType: (s('dealType') === 'RENT' ? 'RENT' : 'SALE') as 'SALE' | 'RENT',
    community: s('community') ?? '',
    district: s('district'),
    businessArea: s('businessArea'),
    address: s('address'),
    priceWan: n('priceWan'),
    rentYuan: n('rentYuan'),
    area: n('area'),
    layout: s('layout'),
    rooms: n('rooms'),
    halls: n('halls'),
    bathrooms: n('bathrooms'),
    floor: n('floor'),
    totalFloors: n('totalFloors'),
    orientation: s('orientation'),
    decoration: s('decoration'),
    buildingType: s('buildingType'),
    hasElevator: b('hasElevator'),
    buildYear: n('buildYear'),
    ownership: s('ownership'),
    description: s('description'),
    highlights: s('highlights'),
    ownerName: s('ownerName'),
    ownerPhone: s('ownerPhone'),
    isFeatured: b('isFeatured'),
    images,
    submit: (s('submit') === 'draft' ? 'draft' : 'pending') as 'draft' | 'pending',
  };

  return parseForm(listingInputSchema, payload);
}

/** 生成房源编号 FY + 年份 + 4 位序号 */
async function nextListingCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FY${year}`;
  const last = await prisma.listing.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  let seq = 1;
  if (last) {
    const parsed = Number(last.code.slice(prefix.length));
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  for (let i = 0; i < 5; i += 1) {
    const candidate = `${prefix}${String(seq + i).padStart(4, '0')}`;
    const exists = await prisma.listing.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

/** 校验当前用户能否操作这套房源 */
async function assertListingAccess(listingId: string) {
  const user = await requireStaff();
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, agentId: true, title: true, status: true },
  });
  if (!listing) redirect('/admin/listings?err=notfound');
  const isOwner = listing.agentId === user.id;
  if (user.role === 'AGENT' && !isOwner) redirect('/admin/listings?err=forbidden');
  return { user, listing, isOwner };
}

/** 子管理员的房源是否直接上架（可用系统设置控制） */
async function autoPublish(user: { role: string }): Promise<boolean> {
  if (user.role !== 'AGENT') return true;
  const requireReview = await prisma.setting.findUnique({ where: { key: SETTING_KEY_REVIEW } });
  return requireReview?.value === '0';
}

/* ==================== 房源：手机端极简发布 ==================== */

/**
 * 业务员在手机上用的一步到位发布。
 * 只要求填最少的几项（标题/小区/价格/面积/户型/图片），
 * 编号、单价、上下架状态等全部自动推导，减少外面的业务员填表负担。
 */
export async function createListingQuick(
  fd: FormData,
): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const user = await requireStaff();

  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const n = (k: string) => {
    const v = s(k);
    if (v === undefined) return undefined;
    const num = Number(v);
    return Number.isFinite(num) ? num : undefined;
  };

  const title = s('title');
  const community = s('community');
  const dealType = s('dealType') === 'RENT' ? 'RENT' : 'SALE';
  const priceWan = n('priceWan');
  const rentYuan = n('rentYuan');
  const area = n('area');
  const images = (s('imageUrls') ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (!community) return { error: '请填写小区名称' };
  if (!title) return { error: '请填写房源标题' };
  if (dealType === 'SALE' && !priceWan) return { error: '请填写总价（万元）' };
  if (dealType === 'RENT' && !rentYuan) return { error: '请填写月租（元）' };
  if (!area) return { error: '请填写建筑面积' };
  if (images.length === 0) return { error: '请至少上传 1 张房源照片' };

  const layout = s('layout');
  // 从"3室2厅1卫"里解析出室/厅/卫，减少输入项
  let rooms: number | undefined;
  let halls: number | undefined;
  let bathrooms: number | undefined;
  if (layout) {
    const m = /(\d+)\s*室\s*(\d+)\s*厅(?:\s*(\d+)\s*卫)?/.exec(layout);
    if (m) {
      rooms = Number(m[1]);
      halls = Number(m[2]);
      bathrooms = m[3] ? Number(m[3]) : undefined;
    }
  }

  const code = await nextListingCode();
  const canAutoPublish = await autoPublish(user);
  const status = canAutoPublish ? 'PUBLISHED' : 'PENDING';

  const created = await prisma.listing.create({
    data: {
      code,
      title,
      dealType,
      status,
      agentId: user.id,
      priceWan: dealType === 'SALE' ? priceWan ?? null : null,
      rentYuan: dealType === 'RENT' ? rentYuan ?? null : null,
      unitPrice:
        dealType === 'SALE' && priceWan && area ? Number(((priceWan * 10000) / area).toFixed(2)) : null,
      community,
      district: s('district') ?? null,
      businessArea: s('businessArea') ?? null,
      address: s('address') ?? null,
      area,
      layout: layout ?? null,
      rooms: rooms ?? null,
      halls: halls ?? null,
      bathrooms: bathrooms ?? null,
      floor: n('floor') ?? null,
      totalFloors: n('totalFloors') ?? null,
      orientation: s('orientation') ?? null,
      decoration: s('decoration') ?? null,
      hasElevator: fd.get('hasElevator') ? true : null,
      ownership: s('ownership') ?? null,
      description: s('description') ?? null,
      highlights: s('highlights') ?? null,
      ownerName: s('ownerName') ?? null,
      ownerPhone: s('ownerPhone') ?? null,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
    select: { id: true, code: true, title: true },
  });

  await prisma.listingImage.createMany({
    data: images.map((url, i) => ({ listingId: created.id, url, sort: i, isCover: i === 0 })),
  });

  await audit({
    actorId: user.id,
    action: 'CREATE',
    target: 'Listing',
    targetId: created.id,
    detail: `手机端快速发布 ${created.code} ${created.title}（${status === 'PUBLISHED' ? '已上架' : '待审核'}）`,
  });

  revalidatePath('/admin/m/listings');
  revalidatePath('/admin/listings');
  revalidatePath('/fang');

  return { ok: true, id: created.id };
}

/* ==================== 房源：增删改 + 上下架 ==================== */

export async function createListing(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = parseListingForm(fd);
  if (!parsed.ok) return { error: parsed.error };

  const v = parsed.data;
  const code = await nextListingCode();
  const canAutoPublish = await autoPublish(user);
  const wantPending = v.submit !== 'draft';

  const status = !wantPending
    ? 'DRAFT'
    : canAutoPublish
      ? 'PUBLISHED'
      : 'PENDING';

  const created = await prisma.listing.create({
    data: {
      code,
      title: v.title,
      dealType: v.dealType,
      status,
      agentId: user.id,
      priceWan: v.dealType === 'SALE' ? v.priceWan ?? null : null,
      rentYuan: v.dealType === 'RENT' ? v.rentYuan ?? null : null,
      unitPrice: v.dealType === 'SALE' && v.priceWan && v.area ? Number(((v.priceWan * 10000) / v.area).toFixed(2)) : null,
      community: v.community,
      district: v.district ?? null,
      businessArea: v.businessArea ?? null,
      address: v.address ?? null,
      area: v.area ?? null,
      rooms: v.rooms ?? null,
      halls: v.halls ?? null,
      bathrooms: v.bathrooms ?? null,
      layout: v.layout ?? null,
      floor: v.floor ?? null,
      totalFloors: v.totalFloors ?? null,
      orientation: v.orientation ?? null,
      decoration: v.decoration ?? null,
      buildingType: v.buildingType ?? null,
      hasElevator: v.hasElevator ?? null,
      buildYear: v.buildYear ?? null,
      ownership: v.ownership ?? null,
      description: v.description ?? null,
      highlights: v.highlights ?? null,
      ownerName: v.ownerName ?? null,
      ownerPhone: v.ownerPhone ?? null,
      isFeatured: v.isFeatured ?? false,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
    select: { id: true, code: true },
  });

  if (v.images && v.images.length > 0) {
    await prisma.listingImage.createMany({
      data: v.images.map((url, i) => ({
        listingId: created.id,
        url,
        sort: i,
        isCover: i === 0,
      })),
    });
  }

  await audit({
    actorId: user.id,
    action: 'CREATE',
    target: 'Listing',
    targetId: created.id,
    detail: `新建房源 ${created.code} ${v.title}，状态 ${status}`,
  });

  revalidatePath('/admin/listings');
  revalidatePath('/fang');
  redirect(`/admin/listings/${created.id}?msg=created`);
}

export async function updateListing(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get('id') ?? '');
  if (!id) return { error: '缺少房源 id' };
  const { user, listing } = await assertListingAccess(id);

  const parsed = parseListingForm(fd);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.data;

  // 已上架房源被编辑后，子管理员需要重新送审
  let nextStatus = listing.status;
  if (v.submit === 'draft') {
    nextStatus = 'DRAFT';
  } else if (listing.status === 'DRAFT' || listing.status === 'REJECTED') {
    nextStatus = (await autoPublish(user)) ? 'PUBLISHED' : 'PENDING';
  } else if (listing.status === 'PUBLISHED' && user.role === 'AGENT') {
    const requireReview = await prisma.setting.findUnique({ where: { key: SETTING_KEY_REVIEW } });
    if (requireReview?.value !== '0') nextStatus = 'PENDING';
  }

  await prisma.listing.update({
    where: { id },
    data: {
      title: v.title,
      dealType: v.dealType,
      status: nextStatus,
      priceWan: v.dealType === 'SALE' ? v.priceWan ?? null : null,
      rentYuan: v.dealType === 'RENT' ? v.rentYuan ?? null : null,
      unitPrice: v.dealType === 'SALE' && v.priceWan && v.area ? Number(((v.priceWan * 10000) / v.area).toFixed(2)) : null,
      community: v.community,
      district: v.district ?? null,
      businessArea: v.businessArea ?? null,
      address: v.address ?? null,
      area: v.area ?? null,
      rooms: v.rooms ?? null,
      halls: v.halls ?? null,
      bathrooms: v.bathrooms ?? null,
      layout: v.layout ?? null,
      floor: v.floor ?? null,
      totalFloors: v.totalFloors ?? null,
      orientation: v.orientation ?? null,
      decoration: v.decoration ?? null,
      buildingType: v.buildingType ?? null,
      hasElevator: v.hasElevator ?? null,
      buildYear: v.buildYear ?? null,
      ownership: v.ownership ?? null,
      description: v.description ?? null,
      highlights: v.highlights ?? null,
      ownerName: v.ownerName ?? null,
      ownerPhone: v.ownerPhone ?? null,
      isFeatured: v.isFeatured ?? false,
      publishedAt: nextStatus === 'PUBLISHED' ? new Date() : undefined,
      rejectReason: nextStatus === 'PENDING' ? null : undefined,
    },
  });

  // 图片全量替换（保持顺序）
  const images = v.images ?? [];
  await prisma.listingImage.deleteMany({ where: { listingId: id } });
  if (images.length > 0) {
    await prisma.listingImage.createMany({
      data: images.map((url, i) => ({ listingId: id, url, sort: i, isCover: i === 0 })),
    });
  }

  await audit({
    actorId: user.id,
    action: 'UPDATE',
    target: 'Listing',
    targetId: id,
    detail: `编辑房源 ${v.title}，状态 ${nextStatus}`,
  });

  revalidatePath('/admin/listings');
  revalidatePath(`/admin/listings/${id}`);
  revalidatePath('/fang');
  return { ok: true, message: nextStatus === 'PUBLISHED' ? '已保存并上架' : '已保存' };
}

/** 上架 / 下架 / 标记成交 */
export async function setListingStatus(fd: FormData): Promise<void> {
  const id = String(fd.get('id') ?? '');
  const action = String(fd.get('action') ?? '');
  if (!id) return;
  const { user, listing } = await assertListingAccess(id);

  const map: Record<string, { status: 'PUBLISHED' | 'OFFLINE' | 'SOLD'; audit: 'PUBLISH' | 'OFFLINE' | 'MARK_SOLD'; label: string }> = {
    publish: { status: 'PUBLISHED', audit: 'PUBLISH', label: '上架' },
    offline: { status: 'OFFLINE', audit: 'OFFLINE', label: '下架' },
    sold: { status: 'SOLD', audit: 'MARK_SOLD', label: '标记成交' },
  };
  const target = map[action];
  if (!target) return;

  // 子管理员不能自己把待审核房源直接上架
  if (action === 'publish' && listing.status === 'PENDING' && user.role === 'AGENT') {
    redirect('/admin/listings?err=pending');
  }

  await prisma.listing.update({
    where: { id },
    data: {
      status: target.status,
      publishedAt: target.status === 'PUBLISHED' ? new Date() : undefined,
      soldAt: target.status === 'SOLD' ? new Date() : undefined,
    },
  });

  await audit({
    actorId: user.id,
    action: target.audit,
    target: 'Listing',
    targetId: id,
    detail: `${target.label}：${listing.title}`,
  });

  revalidatePath('/admin/listings');
  revalidatePath(`/admin/listings/${id}`);
  revalidatePath('/fang');
}

/** 审核通过 / 驳回（ADMIN 及以上） */
export async function reviewListing(fd: FormData): Promise<void> {
  const user = await requireRole('ADMIN');
  const id = String(fd.get('id') ?? '');
  const decision = String(fd.get('decision') ?? '');
  const reason = String(fd.get('reason') ?? '').slice(0, 500);
  if (!id) return;

  const listing = await prisma.listing.findUnique({ where: { id }, select: { title: true } });
  if (!listing) return;

  if (decision === 'approve') {
    await prisma.listing.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), rejectReason: null },
    });
    await audit({ actorId: user.id, action: 'APPROVE', target: 'Listing', targetId: id, detail: `审核通过：${listing.title}` });
  } else {
    await prisma.listing.update({
      where: { id },
      data: { status: 'REJECTED', rejectReason: reason || '信息不完整，请补充后重新提交' },
    });
    await audit({ actorId: user.id, action: 'REJECT', target: 'Listing', targetId: id, detail: `驳回：${listing.title}｜${reason}` });
  }

  revalidatePath('/admin/review');
  revalidatePath('/admin/listings');
  revalidatePath('/fang');
}

export async function deleteListing(fd: FormData): Promise<void> {
  const id = String(fd.get('id') ?? '');
  if (!id) return;
  const { user, listing } = await assertListingAccess(id);
  await prisma.listing.delete({ where: { id } });
  await audit({ actorId: user.id, action: 'DELETE', target: 'Listing', targetId: id, detail: `删除房源：${listing.title}` });
  revalidatePath('/admin/listings');
  redirect('/admin/listings?msg=deleted');
}

/** 置顶 / 精选开关（ADMIN 及以上） */
export async function toggleListingFlag(fd: FormData): Promise<void> {
  const user = await requireRole('ADMIN');
  const id = String(fd.get('id') ?? '');
  const field = String(fd.get('field') ?? '');
  if (!id || (field !== 'isTop' && field !== 'isFeatured')) return;

  const cur = await prisma.listing.findUnique({
    where: { id },
    select: { isTop: true, isFeatured: true, title: true },
  });
  if (!cur) return;

  const next = field === 'isTop' ? !cur.isTop : !cur.isFeatured;
  await prisma.listing.update({ where: { id }, data: { [field]: next } });
  await audit({
    actorId: user.id,
    action: 'UPDATE',
    target: 'Listing',
    targetId: id,
    detail: `${field === 'isTop' ? '置顶' : '精选'} ${next ? '开启' : '关闭'}：${cur.title}`,
  });
  revalidatePath('/admin/listings');
  revalidatePath('/fang');
}

/* ==================== 客户线索 ==================== */

export async function updateLeadStatus(fd: FormData): Promise<void> {
  const user = await requireStaff();
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  const allowed = ['NEW', 'CONTACTED', 'FOLLOWING', 'VIEWED', 'DEAL', 'INVALID'];
  if (!id || !allowed.includes(status)) return;

  const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerId: true, phone: true } });
  if (!lead) return;
  // 子管理员只能动自己的线索
  if (user.role === 'AGENT' && lead.ownerId !== user.id) redirect('/admin/leads?err=forbidden');

  await prisma.lead.update({
    where: { id },
    data: {
      status: status as 'NEW' | 'CONTACTED' | 'FOLLOWING' | 'VIEWED' | 'DEAL' | 'INVALID',
      followUpAt: new Date(),
    },
  });
  await audit({ actorId: user.id, action: 'UPDATE', target: 'Lead', targetId: id, detail: `线索状态改为 ${status}` });
  revalidatePath('/admin/leads');
}

/** 追加一条跟进记录 */
export async function addLeadFollowUp(fd: FormData): Promise<void> {
  const user = await requireStaff();
  const id = String(fd.get('id') ?? '');
  const text = String(fd.get('text') ?? '').trim().slice(0, 500);
  if (!id || !text) return;

  const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerId: true, followUps: true } });
  if (!lead) return;
  if (user.role === 'AGENT' && lead.ownerId !== user.id) redirect('/admin/leads?err=forbidden');

  const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
  const line = `[${stamp}] ${user.name}：${text}`;
  await prisma.lead.update({
    where: { id },
    data: {
      followUps: lead.followUps ? `${lead.followUps}\n${line}` : line,
      followUpAt: new Date(),
    },
  });
  revalidatePath('/admin/leads');
}

/** 标记已加微信/进私域 */
export async function toggleLeadPrivatized(fd: FormData): Promise<void> {
  const user = await requireStaff();
  const id = String(fd.get('id') ?? '');
  if (!id) return;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerId: true, privatized: true } });
  if (!lead) return;
  if (user.role === 'AGENT' && lead.ownerId !== user.id) redirect('/admin/leads?err=forbidden');
  await prisma.lead.update({ where: { id }, data: { privatized: !lead.privatized } });
  revalidatePath('/admin/leads');
}

/** 改派线索归属（ADMIN 及以上） */
export async function reassignLead(fd: FormData): Promise<void> {
  const user = await requireRole('ADMIN');
  const id = String(fd.get('id') ?? '');
  const ownerId = String(fd.get('ownerId') ?? '');
  if (!id) return;
  await prisma.lead.update({ where: { id }, data: { ownerId: ownerId || null } });
  await audit({ actorId: user.id, action: 'UPDATE', target: 'Lead', targetId: id, detail: `改派归属为 ${ownerId || '未分配'}` });
  revalidatePath('/admin/leads');
}

/* ==================== 预约 ==================== */

export async function updateAppointmentStatus(fd: FormData): Promise<void> {
  const user = await requireStaff();
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  const allowed = ['PENDING', 'CONFIRMED', 'DONE', 'CANCELED'];
  if (!id || !allowed.includes(status)) return;

  const appt = await prisma.appointment.findUnique({ where: { id }, select: { ownerId: true } });
  if (!appt) return;
  if (user.role === 'AGENT' && appt.ownerId !== user.id) redirect('/admin/appointments?err=forbidden');

  await prisma.appointment.update({
    where: { id },
    data: { status: status as 'PENDING' | 'CONFIRMED' | 'DONE' | 'CANCELED' },
  });
  revalidatePath('/admin/appointments');
}

/* ==================== 子管理员与用户 ==================== */

export async function createAgent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const operator = await requireRole('ADMIN');

  const name = String(fd.get('name') ?? '').trim();
  const phone = String(fd.get('phone') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  const title = String(fd.get('title') ?? '').trim();
  const area = String(fd.get('area') ?? '').trim();
  const parentId = String(fd.get('parentId') ?? '').trim();
  const role = String(fd.get('role') ?? 'AGENT') as 'AGENT' | 'ADMIN';

  if (!name) return { error: '请填写姓名' };
  if (!/^1[3-9]\d{9}$/.test(phone)) return { error: '手机号格式不正确' };
  if (password.length < 6) return { error: '初始密码至少 6 位' };
  if (role === 'ADMIN' && operator.role !== 'SUPER_ADMIN') {
    return { error: '只有超级管理员能创建管理员账号' };
  }

  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) return { error: '该手机号已被使用' };

  const passwordHash = await hashPassword(password);
  const created = await prisma.user.create({
    data: {
      name,
      phone,
      passwordHash,
      role,
      parentId: parentId || operator.id,
    },
    select: { id: true },
  });

  if (role === 'AGENT') {
    // 生成一个不易猜的推广码
    let refCode = randomCode(8);
    for (let i = 0; i < 5; i += 1) {
      const dup = await prisma.agentProfile.findUnique({ where: { refCode }, select: { id: true } });
      if (!dup) break;
      refCode = randomCode(8);
    }
    await prisma.agentProfile.create({
      data: { userId: created.id, refCode, title: title || '房产顾问', area: area || null, contactPhone: phone },
    });
    await prisma.sourceCode.create({
      data: {
        code: refCode,
        name: `${name}的名片码`,
        type: 'AGENT_CARD',
        ownerId: created.id,
        createdBy: operator.id,
      },
    });
  }

  await audit({
    actorId: operator.id,
    action: 'CREATE_USER',
    target: 'User',
    targetId: created.id,
    detail: `新建${role === 'ADMIN' ? '管理员' : '子管理员'}：${name} ${phone}`,
  });

  revalidatePath('/admin/agents');
  return { ok: true, message: `已创建 ${name}，初始密码 ${password}，请提醒本人首次登录后修改` };
}

export async function updateUser(fd: FormData): Promise<void> {
  const operator = await requireRole('ADMIN');
  const id = String(fd.get('id') ?? '');
  const name = String(fd.get('name') ?? '').trim();
  const status = String(fd.get('status') ?? '');
  if (!id) return;

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!target) return;
  // 管理员不能改动超管；也不能改同级管理员
  if (target.role === 'SUPER_ADMIN' && operator.role !== 'SUPER_ADMIN') redirect('/admin/users?err=forbidden');
  if (target.role === 'ADMIN' && operator.role !== 'SUPER_ADMIN') redirect('/admin/users?err=forbidden');

  await prisma.user.update({
    where: { id },
    data: {
      name: name || undefined,
      status: status === 'DISABLED' || status === 'ACTIVE' ? status : undefined,
    },
  });
  await audit({ actorId: operator.id, action: 'UPDATE_USER', target: 'User', targetId: id, detail: `更新资料：${target.name}` });
  revalidatePath('/admin/users');
  revalidatePath('/admin/agents');
}

export async function resetUserPassword(fd: FormData): Promise<void> {
  const operator = await requireRole('ADMIN');
  const id = String(fd.get('id') ?? '');
  const password = String(fd.get('password') ?? '');
  if (!id) return;
  if (password.length < 6) redirect('/admin/users?err=shortpwd');

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!target) return;
  if ((target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') && operator.role !== 'SUPER_ADMIN') {
    redirect('/admin/users?err=forbidden');
  }

  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  await audit({ actorId: operator.id, action: 'RESET_PASSWORD', target: 'User', targetId: id, detail: `重置密码：${target.name}` });
  revalidatePath('/admin/users');
}

/** 更新子管理员资料与推广码 */
export async function updateAgentProfile(fd: FormData): Promise<void> {
  const operator = await requireRole('ADMIN');
  const userId = String(fd.get('userId') ?? '');
  const refCode = String(fd.get('refCode') ?? '').trim();
  const title = String(fd.get('title') ?? '').trim();
  const area = String(fd.get('area') ?? '').trim();
  const contactPhone = String(fd.get('contactPhone') ?? '').trim();
  const remark = String(fd.get('remark') ?? '').trim();
  if (!userId) return;

  if (refCode && !/^[A-Za-z0-9_-]{3,32}$/.test(refCode)) {
    redirect('/admin/agents?err=badcode');
  }

  if (refCode) {
    const dup = await prisma.agentProfile.findUnique({ where: { refCode }, select: { userId: true } });
    if (dup && dup.userId !== userId) redirect('/admin/agents?err=codeused');
  }

  await prisma.agentProfile.update({
    where: { userId },
    data: {
      refCode: refCode || undefined,
      title: title || null,
      area: area || null,
      contactPhone: contactPhone || null,
      remark: remark || null,
    },
  });

  // 名片码跟随 refCode 变化
  if (refCode) {
    await prisma.sourceCode.upsert({
      where: { code: refCode },
      create: { code: refCode, name: `${refCode} 名片码`, type: 'AGENT_CARD', ownerId: userId, createdBy: operator.id },
      update: { ownerId: userId, enabled: true },
    });
  }

  await audit({ actorId: operator.id, action: 'UPDATE_USER', target: 'AgentProfile', targetId: userId, detail: `更新推广资料，推广码 ${refCode}` });
  revalidatePath('/admin/agents');
  revalidatePath('/admin/tracking');
}

/* ==================== 推广渠道码 ==================== */

export async function createSourceCode(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const operator = await requireStaff();
  const name = String(fd.get('name') ?? '').trim();
  const type = String(fd.get('type') ?? 'POSTER') as 'AGENT_CARD' | 'POSTER' | 'LANDING_PAGE' | 'ARTICLE' | 'ADS';
  const ownerId = String(fd.get('ownerId') ?? '').trim();
  const codeInput = String(fd.get('code') ?? '').trim();
  const landingListingId = String(fd.get('landingListingId') ?? '').trim();

  if (!name) return { error: '请填写渠道名称' };

  // 子管理员只能给自己建码
  let finalOwner = ownerId || operator.id;
  if (operator.role === 'AGENT') finalOwner = operator.id;

  let code = codeInput || randomCode(8);
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(code)) return { error: '渠道码只能是 3-64 位字母、数字、下划线或中划线' };

  const dup = await prisma.sourceCode.findUnique({ where: { code }, select: { id: true } });
  if (dup) return { error: '该渠道码已被占用，请换一个' };

  const created = await prisma.sourceCode.create({
    data: {
      code,
      name,
      type,
      ownerId: finalOwner,
      landingListingId: landingListingId || null,
      createdBy: operator.id,
    },
    select: { id: true, code: true },
  });

  await audit({
    actorId: operator.id,
    action: 'CREATE',
    target: 'SourceCode',
    targetId: created.id,
    detail: `新建推广渠道「${name}」，码 ${code}`,
  });

  revalidatePath('/admin/tracking');
  return { ok: true, message: `推广码已创建：${created.code}` };
}

export async function toggleSourceCode(fd: FormData): Promise<void> {
  const operator = await requireStaff();
  const id = String(fd.get('id') ?? '');
  if (!id) return;
  const sc = await prisma.sourceCode.findUnique({ where: { id }, select: { enabled: true, ownerId: true } });
  if (!sc) return;
  if (operator.role === 'AGENT' && sc.ownerId !== operator.id) redirect('/admin/tracking?err=forbidden');
  await prisma.sourceCode.update({ where: { id }, data: { enabled: !sc.enabled } });
  revalidatePath('/admin/tracking');
}

/* ==================== 客户提醒（线索实时通知） ==================== */

const NOTIFY_CHANNELS = ['off', 'wxpusher', 'wecom', 'serverchan', 'pushplus', 'custom'] as const;

/** 保存提醒渠道配置 */
export async function saveNotifySettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const operator = await requireRole('SUPER_ADMIN');

  const channelInput = String(fd.get('channel') ?? 'off');
  const channel = (NOTIFY_CHANNELS as readonly string[]).includes(channelInput) ? channelInput : 'off';

  await Promise.all([
    setSetting(NOTIFY_KEYS.channel, channel),
    setSetting(NOTIFY_KEYS.wxpusherToken, String(fd.get('wxpusherToken') ?? '').trim().slice(0, 200)),
    setSetting(NOTIFY_KEYS.wxpusherUids, String(fd.get('wxpusherUids') ?? '').trim().slice(0, 1000)),
    setSetting(NOTIFY_KEYS.wecomWebhook, String(fd.get('wecomWebhook') ?? '').slice(0, 500)),
    setSetting(NOTIFY_KEYS.serverchanKey, String(fd.get('serverchanKey') ?? '').slice(0, 200)),
    setSetting(NOTIFY_KEYS.pushplusToken, String(fd.get('pushplusToken') ?? '').slice(0, 200)),
    setSetting(NOTIFY_KEYS.customWebhook, String(fd.get('customWebhook') ?? '').slice(0, 500)),
    setSetting(NOTIFY_KEYS.notifyAdmin, fd.get(NOTIFY_KEYS.notifyAdmin) ? '1' : '0'),
    setSetting(NOTIFY_KEYS.adminPhone, String(fd.get('adminPhone') ?? '').slice(0, 20)),
  ]);

  await audit({
    actorId: operator.id,
    action: 'SETTING_UPDATE',
    target: 'Setting',
    detail: `更新客户提醒配置，渠道 ${channel}`,
  });

  revalidatePath('/admin/settings');
  return { ok: true, message: `提醒配置已保存（当前渠道：${channel === 'off' ? '未开启' : channel}）。建议点一下「发送测试」确认能收到。` };
}

/** 发送一条测试提醒，把真实结果返回给管理员看 */
export async function testNotifyAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireRole('SUPER_ADMIN');
  const result = await sendTestNotify();
  if (result.ok) {
    return { ok: true, message: `测试消息已发送成功（渠道 ${result.channel}）。请查看你的手机。` };
  }
  return {
    error: `发送失败（渠道 ${result.channel}）：${result.detail}。请检查密钥/地址是否填写正确。`,
  };
}

/* ==================== 站点设置 ==================== */

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const operator = await requireRole('SUPER_ADMIN');

  const keys = Object.values(SETTING_KEYS);
  for (const key of keys) {
    const v = fd.get(key);
    if (typeof v === 'string') await setSetting(key, v.slice(0, 2000));
  }
  // 复选框：未勾选时表单里没有这个字段
  await setSetting(SETTING_KEYS.requireReview, fd.get(SETTING_KEYS.requireReview) ? '1' : '0');

  await audit({ actorId: operator.id, action: 'SETTING_UPDATE', target: 'Setting', detail: '更新站点设置' });
  revalidatePath('/admin/settings');
  return { ok: true, message: '设置已保存' };
}

/** 子管理员修改自己的联系方式與微信二维码 */
export async function saveMyProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const title = String(fd.get('title') ?? '').trim();
  const area = String(fd.get('area') ?? '').trim();
  const contactPhone = String(fd.get('contactPhone') ?? '').trim();
  const wechatQr = String(fd.get('wechatQr') ?? '').trim();
  const remark = String(fd.get('remark') ?? '').trim();

  await prisma.agentProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      refCode: randomCode(8),
      title: title || null,
      area: area || null,
      contactPhone: contactPhone || null,
      wechatQr: wechatQr || null,
      remark: remark || null,
    },
    update: {
      title: title || null,
      area: area || null,
      contactPhone: contactPhone || null,
      wechatQr: wechatQr || null,
      remark: remark || null,
    },
  });

  revalidatePath('/admin/profile');
  return { ok: true, message: '资料已保存' };
}
