import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, hashPassword, homeFor } from '@/lib/auth';
import { registerSchema, zodMessage } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/attribution';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers) ?? 'unknown';
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `注册过于频繁，请 ${rl.retryAfterSec} 秒后再试` },
      { status: 429 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const { phone, password, name } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) {
    return NextResponse.json({ error: '该手机号已注册，请直接登录' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { phone, name, passwordHash, role: 'USER' },
    select: { id: true, name: true, role: true },
  });

  await createSession({ uid: user.id, role: user.role, name: user.name });

  return NextResponse.json({ ok: true, redirect: homeFor(user.role) });
}
