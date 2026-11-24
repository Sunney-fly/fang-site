/**
 * 端到端验证脚本：客户归属追踪是否真的生效。
 * 用法：node scripts/e2e-attribution.mjs [baseUrl]
 *
 * 会做的事：
 *  1. 以"游客"身份带 ?ref=chenhao 访问首页与房源页 → 应写入归属 Cookie
 *  2. 调用 /api/track 触发服务端埋点
 *  3. 用另一个客户身份提交留资 → 线索 ownerId 必须是陈浩
 *  4. 再验证：不带任何 ref 的客户留资 → 应归属该房源名下经纪人或为空，不能误归给陈浩
 *  5. 验证子管理员/超管登录、越权访问后台的拦截
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✔ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${name} ${extra}`);
  }
}

/** 极简 Cookie 容器，模拟一个浏览器 */
class Jar {
  constructor() {
    this.map = new Map();
  }
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  absorb(res) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      if (idx < 0) continue;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (v === '' ) this.map.delete(k);
      else this.map.set(k, v);
    }
    return raw;
  }
  get(name) {
    return this.map.get(name) ?? null;
  }
}

async function req(jar, path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (jar.header()) headers.set('cookie', jar.header());
  if (!headers.has('user-agent')) headers.set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) MicroMessenger/8.0');
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  jar.absorb(res);
  return res;
}

async function main() {
  console.log(`\n== 1. 游客带推广码进入（?ref=chenhao）==`);
  const visitor = new Jar();
  const home = await req(visitor, '/fang?ref=chenhao');
  check('落地页可访问', home.status === 200, `status=${home.status}`);
  check('写入了访客 sid Cookie', !!visitor.get('fang_sid'), `sid=${visitor.get('fang_sid')}`);
  check('写入了归属 Cookie fang_ref=chenhao', visitor.get('fang_ref') === 'chenhao', `ref=${visitor.get('fang_ref')}`);

  // 找一套在售房源
  const listRes = await req(visitor, '/fang');
  const html = await listRes.text();
  const idMatch = /href="\/fang\/([A-Za-z0-9_-]{10,})"/.exec(html);
  const listingId = idMatch?.[1] ?? null;
  check('列表页能解析出房源 id', !!listingId, `id=${listingId}`);

  if (listingId) {
    const detail = await req(visitor, `/fang/${listingId}`);
    check('房源详情页可访问', detail.status === 200, `status=${detail.status}`);
  }

  // 客户端埋点（模拟 Tracker）
  const trackRes = await req(visitor, '/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: `/fang/${listingId ?? ''}`, title: '房源详情', referrer: '' }),
  });
  check('埋点接口返回 204', trackRes.status === 204, `status=${trackRes.status}`);

  console.log(`\n== 2. 该游客留资，线索应归属陈浩 ==`);
  const phone1 = '13511110001';
  const leadRes = await req(visitor, '/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: '归属测试客户',
      phone: phone1,
      message: '请问这套还能看吗',
      listingId: listingId ?? '',
      source: 'FORM',
    }),
  });
  const leadData = await leadRes.json().catch(() => ({}));
  check('留资接口返回成功', leadRes.status === 200 && leadData.ok === true, JSON.stringify(leadData));
  check('接口标记已分配归属', leadData.assigned === true, JSON.stringify(leadData));

  // 数据库核对（直连 MySQL，用 Prisma 客户端）
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const chenhao = await prisma.user.findUnique({
      where: { phone: '13900000003' },
      select: { id: true, name: true },
    });
    const lead = await prisma.lead.findFirst({
      where: { phone: phone1 },
      orderBy: { createdAt: 'desc' },
      select: { id: true, ownerId: true, sourceCodeId: true, sessionId: true, listingAgentId: true },
    });
    check('数据库里有这条线索', !!lead);
    check(
      '线索归属 = 陈浩（推广码 chenhao 的主人）',
      !!lead && lead.ownerId === chenhao?.id,
      `ownerId=${lead?.ownerId} 期望=${chenhao?.id}`,
    );
    check('线索关联了访客会话（可回看客户看过哪些房）', !!lead?.sessionId);

    const session = lead?.sessionId
      ? await prisma.visitSession.findUnique({ where: { id: lead.sessionId }, select: { refUserId: true, hasLead: true, pageViews: true, device: true } })
      : null;
    check('会话被标记为已留资', session?.hasLead === true);
    check('会话记录了归属人', session?.refUserId === chenhao?.id);
    check('会话累计了页面浏览量', (session?.pageViews ?? 0) > 0, `pv=${session?.pageViews}`);
    check('识别为手机端访客（微信）', session?.device === 'mobile', `device=${session?.device}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n== 3. 另一个不带推广码的客户留资，不得误归到陈浩 ==`);
  const clean = new Jar();
  await req(clean, '/fang');
  const phone2 = '13511110002';
  const res2 = await req(clean, '/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '自然流量客户', phone: phone2, listingId: listingId ?? '', source: 'FORM' }),
  });
  check('自然流量留资成功', res2.status === 200, `status=${res2.status}`);

  const prisma2 = new PrismaClient();
  try {
    const l2 = await prisma2.lead.findFirst({
      where: { phone: phone2 },
      orderBy: { createdAt: 'desc' },
      select: { ownerId: true, listingAgentId: true },
    });
    const listing = listingId
      ? await prisma2.listing.findUnique({ where: { id: listingId }, select: { agentId: true } })
      : null;
    check(
      '自然流量归属 = 房源所属经纪人（不是陈浩）',
      !!l2 && l2.ownerId === listing?.agentId,
      `ownerId=${l2?.ownerId} 房源经纪人=${listing?.agentId}`,
    );
  } finally {
    await prisma2.$disconnect();
  }

  console.log(`\n== 4. 登录与权限 ==`);
  const agentJar = new Jar();
  const loginAgent = await req(agentJar, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13900000003', password: 'agent123456' }),
  });
  const agentLogin = await loginAgent.json().catch(() => ({}));
  check('子管理员登录成功', loginAgent.status === 200 && agentLogin.ok === true, JSON.stringify(agentLogin));
  check('登录后跳后台', agentLogin.redirect === '/admin', `redirect=${agentLogin.redirect}`);

  const adminPage = await req(agentJar, '/admin');
  check('子管理员能打开后台', adminPage.status === 200, `status=${adminPage.status}`);

  const settingsPage = await req(agentJar, '/admin/settings');
  check(
    '子管理员访问"系统设置"被拦截（重定向）',
    settingsPage.status === 307 || settingsPage.status === 302,
    `status=${settingsPage.status}`,
  );

  const userJar = new Jar();
  const loginUser = await req(userJar, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13700000001', password: 'user123456' }),
  });
  const userLogin = await loginUser.json().catch(() => ({}));
  check('普通用户登录成功', loginUser.status === 200 && userLogin.ok === true);
  check('普通用户跳"我的"', userLogin.redirect === '/my', `redirect=${userLogin.redirect}`);

  const userAdmin = await req(userJar, '/admin');
  check('普通用户访问后台被拦截', userAdmin.status === 307 || userAdmin.status === 302, `status=${userAdmin.status}`);

  const anon = new Jar();
  const anonAdmin = await req(anon, '/admin');
  check('游客访问后台被拦截到登录页', anonAdmin.status === 307 || anonAdmin.status === 302, `status=${anonAdmin.status}`);

  const wrongPwd = await req(new Jar(), '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13900000003', password: 'wrong-password' }),
  });
  check('错误密码被拒绝', wrongPwd.status === 401, `status=${wrongPwd.status}`);

  console.log(`\n== 5. 房源上架状态与游客可见性 ==`);
  const p2 = new PrismaClient();
  try {
    const draft = await p2.listing.findFirst({ where: { status: { in: ['DRAFT', 'PENDING'] } }, select: { id: true, status: true } });
    if (draft) {
      const r = await req(new Jar(), `/fang/${draft.id}`);
      check(`未上架房源(${draft.status})对游客不可见`, r.status === 404, `status=${r.status}`);
    } else {
      check('存在未上架房源用于测试', false, '没有找到 DRAFT/PENDING 房源');
    }
  } finally {
    await p2.$disconnect();
  }

  console.log(`\n== 6. 二维码接口 ==`);
  const qr = await fetch(`${BASE}/api/qr?path=/fang&ref=chenhao`);
  check('二维码接口返回 PNG', qr.status === 200 && qr.headers.get('content-type') === 'image/png', `status=${qr.status} ct=${qr.headers.get('content-type')}`);
  const qrBuf = Buffer.from(await qr.arrayBuffer());
  check('二维码是有效图片数据', qrBuf.length > 500 && qrBuf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', `bytes=${qrBuf.length}`);

  console.log(`\n=========================`);
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('验证脚本异常：', e);
  process.exit(1);
});
