import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIp, readCodeFromCookies, readSid } from '@/lib/attribution';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { resolveCode } from '@/lib/track';
import { notifyLeadById } from '@/lib/notify';
import { appointmentSchema, zodMessage } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers) ?? 'unknown';
  const rl = rateLimit(`appt:${ip}`, 15, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json({ error: '提交过于频繁，请稍后再试' }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = appointmentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;

  const listing = input.listingId
    ? await prisma.listing.findUnique({
        where: { id: input.listingId },
        select: { id: true, agentId: true },
      })
    : null;

  // 归属：Cookie 归属码 > 房源所属子管理员
  const code = readCodeFromCookies(req.cookies);
  let ownerId: string | null = null;
  if (code) {
    const r = await resolveCode(code);
    ownerId = r.agentUserId;
  }
  ownerId = ownerId ?? listing?.agentId ?? null;

  const sid = readSid(req.cookies);
  const session = sid
    ? await prisma.visitSession.findUnique({ where: { sid }, select: { id: true } })
    : null;

  let expectAt: Date | null = null;
  if (input.expectAt) {
    const d = new Date(input.expectAt.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) expectAt = d;
  }

  const appt = await prisma.appointment.create({
    data: {
      name: input.name,
      phone: input.phone,
      wechat: input.wechat || null,
      expectAt,
      remark: input.remark || null,
      status: 'PENDING',
      ownerId,
      sessionId: session?.id ?? null,
      listingId: listing?.id ?? null,
    },
    select: { id: true },
  });

  // 预约同样是一条高意向线索，写进线索池，业务员只需盯一个列表
  const user = await getCurrentUser().catch(() => null);
  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      phone: input.phone,
      wechat: input.wechat || null,
      message: input.remark || (expectAt ? `预约看房时间：${expectAt.toLocaleString('zh-CN')}` : '预约看房'),
      source: 'APPOINTMENT',
      status: 'NEW',
      ownerId,
      sessionId: session?.id ?? null,
      listingId: listing?.id ?? null,
      listingAgentId: listing?.agentId ?? null,
      ip,
    },
    select: { id: true },
  });

  if (session?.id) {
    await prisma.visitSession.update({ where: { id: session.id }, data: { hasLead: true } }).catch(() => null);
  }
  if (listing?.id) {
    await prisma.listing.update({ where: { id: listing.id }, data: { leadCount: { increment: 1 } } }).catch(() => null);
  }

  // 客户抢着预约是最强的成交信号之一，立刻提醒
  void notifyLeadById(lead.id);

  return NextResponse.json({ ok: true, id: appt.id, assigned: Boolean(ownerId), registered: Boolean(user) });
}
