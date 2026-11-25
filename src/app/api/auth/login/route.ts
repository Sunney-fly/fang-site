import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, homeFor, verifyPassword } from '@/lib/auth';
import { loginSchema, zodMessage } from '@/lib/validators';
import { rateLimit, rateLimitReset } from '@/lib/rate-limit';
import { audit } from '@/lib/settings';
import { clientIp } from '@/lib/attribution';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers) ?? 'unknown';

  // 防爆破：同 IP 15 分钟内最多 10 次尝试
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `尝试过于频繁，请 ${rl.retryAfterSec} 秒后再试` },
      { status: 429 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const { phone, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, name: true, role: true, status: true, passwordHash: true },
  });

  // 统一的失败文案，避免暴露手机号是否注册过
  const bad = NextResponse.json({ error: '手机号或密码不正确' }, { status: 401 });

  if (!user) return bad;
  if (user.status !== 'ACTIVE') {
    return NextResponse.json({ error: '该账号已被禁用，请联系管理员' }, { status: 403 });
  }

  const okPwd = await verifyPassword(password, user.passwordHash);
  if (!okPwd) return bad;

  rateLimitReset(`login:${ip}`);

  await createSession({ uid: user.id, role: user.role, name: user.name });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: 'LOGIN', target: 'User', targetId: user.id, ip });

  return NextResponse.json({ ok: true, redirect: homeFor(user.role), role: user.role });
}
