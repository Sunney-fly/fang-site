import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

/** 收藏 / 取消收藏（登录用户） */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录后再收藏', needLogin: true }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { listingId?: string };
  const listingId = (body.listingId || '').trim();
  if (!listingId) return NextResponse.json({ error: '缺少房源 id' }, { status: 400 });

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!listing) return NextResponse.json({ error: '房源不存在或已下架' }, { status: 404 });

  const existing = await prisma.bookmark.findUnique({
    where: { userId_listingId: { userId: user.id, listingId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, bookmarked: false });
  }

  await prisma.bookmark.create({ data: { userId: user.id, listingId } });
  return NextResponse.json({ ok: true, bookmarked: true });
}
