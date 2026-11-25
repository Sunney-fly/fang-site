import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 轻量登录态接口：给静态化的公开页（顶栏、海报按钮）判断当前用户。
 * 绝不缓存，避免把某人的登录态发给别人。
 */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  const body = user
    ? { user: { name: user.name, role: user.role, refCode: user.refCode ?? null } }
    : { user: null };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  });
}
