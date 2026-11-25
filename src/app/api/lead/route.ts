import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIp, readCodeFromCookies, readSid } from '@/lib/attribution';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { resolveCode } from '@/lib/track';
import { notifyLeadById } from '@/lib/notify';
import { zodMessage } from '@/lib/validators';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().max(20).optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号'),
  wechat: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().max(500).optional().or(z.literal('')),
  listingId: z.string().trim().max(64).optional().or(z.literal('')),
  refCode: z.string().trim().max(64).optional().or(z.literal('')),
  source: z.enum(['FORM', 'APPOINTMENT', 'PHONE_CLICK', 'WECHAT_CLICK', 'MANUAL']).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers) ?? 'unknown';

  // 防刷：同 IP 1 小时最多 20 条留资
  const rl = rateLimit(`lead:${ip}`, 20, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json({ error: '提交过于频繁，请稍后再试' }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;

  // 房源校验
  const listing = input.listingId
    ? await prisma.listing.findUnique({
        where: { id: input.listingId },
        select: { id: true, agentId: true, status: true },
      })
    : null;

  // ==== 归属判定链条（越靠前优先级越高）====
  // 1) 表单显式带的推广码（业务员自己转发的链接）
  // 2) 本次 Cookie 里的归属码（客户第一次落地时写入）
  // 3) 请求体里的 refCode
  // 4) 房源所属子管理员
  const cookieCode = readCodeFromCookies(req.cookies);
  const bodyCode = input.refCode || null;

  let ownerId: string | null = null;
  let sourceCodeId: string | null = null;

  for (const code of [cookieCode, bodyCode]) {
    if (!code) continue;
    const r = await resolveCode(code);
    if (r.agentUserId || r.sourceCodeId) {
      ownerId = r.agentUserId;
      sourceCodeId = r.sourceCodeId;
      break;
    }
  }

  if (!ownerId) {
    // Cookie 里可能存的是渠道码但没解析出人，退回房源归属
    ownerId = listing?.agentId ?? null;
  }

  const sid = readSid(req.cookies);
  const session = sid
    ? await prisma.visitSession.findUnique({ where: { sid }, select: { id: true } })
    : null;

  const user = await getCurrentUser().catch(() => null);

  const lead = await prisma.lead.create({
    data: {
      name: input.name || null,
      phone: input.phone,
      wechat: input.wechat || null,
      message: input.message || null,
      source: input.source ?? 'FORM',
      status: 'NEW',
      ownerId,
      sessionId: session?.id ?? null,
      listingId: listing?.id ?? null,
      listingAgentId: listing?.agentId ?? null,
      sourceCodeId,
      ip,
      userAgent: req.headers.get('user-agent'),
    },
    select: { id: true },
  });

  // 会话标记为已留资 + 线索计数
  await Promise.all([
    session?.id
      ? prisma.visitSession.update({ where: { id: session.id }, data: { hasLead: true } }).catch(() => null)
      : null,
    listing?.id
      ? prisma.listing.update({ where: { id: listing.id }, data: { leadCount: { increment: 1 } } }).catch(() => null)
      : null,
  ]);

  // 实时提醒业务员（不等结果，避免拖慢客户提交体验）
  void notifyLeadById(lead.id);

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    // 告知前端线索被分给了谁（不暴露手机号）
    assigned: Boolean(ownerId),
    registered: Boolean(user),
  });
}
