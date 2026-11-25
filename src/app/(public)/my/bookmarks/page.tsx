import Link from 'next/link';
import ListingCard from '@/components/ListingCard';
import { prisma, num } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MyBookmarksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const rows = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      listing: {
        select: {
          id: true,
          code: true,
          title: true,
          dealType: true,
          status: true,
          community: true,
          district: true,
          businessArea: true,
          priceWan: true,
          rentYuan: true,
          unitPrice: true,
          area: true,
          layout: true,
          rooms: true,
          floor: true,
          totalFloors: true,
          orientation: true,
          decoration: true,
          buildYear: true,
          isTop: true,
          isFeatured: true,
          viewCount: true,
          images: { select: { url: true }, orderBy: { sort: 'asc' }, take: 1 },
          agent: { select: { id: true, name: true } },
        },
      },
    },
  });

  const items = rows
    .filter((r) => r.listing.status === 'PUBLISHED')
    .map((r) => {
      const l = r.listing;
      return {
        id: l.id,
        code: l.code,
        title: l.title,
        dealType: l.dealType,
        community: l.community,
        district: l.district,
        businessArea: l.businessArea,
        priceWan: num(l.priceWan),
        rentYuan: num(l.rentYuan),
        unitPrice: num(l.unitPrice),
        area: num(l.area),
        layout: l.layout,
        rooms: l.rooms,
        floor: l.floor,
        totalFloors: l.totalFloors,
        orientation: l.orientation,
        decoration: l.decoration,
        buildYear: l.buildYear,
        isTop: l.isTop,
        isFeatured: l.isFeatured,
        viewCount: l.viewCount,
        cover: l.images[0]?.url ?? null,
        tags: [l.decoration, l.orientation].filter(Boolean) as string[],
        agentName: l.agent?.name ?? null,
        agentId: l.agent?.id ?? null,
      };
    });

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">我的收藏（{items.length}）</h2>

      {items.length === 0 ? (
        <div className="card mt-3 p-10 text-center text-sm text-slate-500">
          还没有收藏房源。
          <Link href="/fang" className="ml-1 text-brand-700 hover:underline">
            去挑几套喜欢的
          </Link>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} compact />
          ))}
        </div>
      )}
    </div>
  );
}
