import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 按需返回经纪人电话（详情页静态化后，完整号码不能写在 HTML 里）。
 * 未登录一律 401，前端跳登录页。
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: '请先登录后查看电话' }, { status: 401 });
  }

  const id = (req.nextUrl.searchParams.get('id') || '').slice(0, 64);
  if (!id) return NextResponse.json({ error: '缺少房源 id' }, { status: 400 });

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      ownerPhone: true,
      ownerName: true,
      agent: {
        select: { phone: true, agentProfile: { select: { contactPhone: true } } },
      },
    },
  });
  if (!listing) return NextResponse.json({ error: '房源不存在' }, { status: 404 });

  const phone =
    listing.agent?.agentProfile?.contactPhone || listing.agent?.phone || null;

  return NextResponse.json(
    { phone },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}
