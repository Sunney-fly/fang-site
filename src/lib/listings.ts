import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { num } from './db';
import type { ListingQuery } from './validators';

export const PAGE_SIZE = 12;

export type ListingCardData = {
  id: string;
  code: string;
  title: string;
  dealType: 'SALE' | 'RENT';
  community: string;
  district: string | null;
  businessArea: string | null;
  priceWan: number | null;
  rentYuan: number | null;
  unitPrice: number | null;
  area: number | null;
  layout: string | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  orientation: string | null;
  decoration: string | null;
  buildYear: number | null;
  isTop: boolean;
  isFeatured: boolean;
  viewCount: number;
  cover: string | null;
  tags: string[];
  agentName: string | null;
  agentId: string | null;
};

function buildWhere(q: ListingQuery): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = { status: 'PUBLISHED' };

  if (q.dealType) where.dealType = q.dealType;
  if (q.district) where.district = q.district;
  if (q.decoration) where.decoration = q.decoration;

  if (q.rooms) {
    const r = Number(q.rooms);
    if (Number.isFinite(r)) where.rooms = r >= 5 ? { gte: 5 } : r;
  }

  if (q.minArea !== undefined || q.maxArea !== undefined) {
    where.area = {
      ...(q.minArea !== undefined ? { gte: q.minArea } : {}),
      ...(q.maxArea !== undefined ? { lte: q.maxArea } : {}),
    };
  }

  // 价格字段出租/出售不同
  const priceField = q.dealType === 'RENT' ? 'rentYuan' : 'priceWan';
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    where[priceField] = {
      ...(q.minPrice !== undefined ? { gte: q.minPrice } : {}),
      ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
    } as Prisma.ListingWhereInput['priceWan'];
  }

  if (q.q) {
    const kw = q.q.slice(0, 30);
    where.OR = [
      { title: { contains: kw } },
      { community: { contains: kw } },
      { businessArea: { contains: kw } },
      { address: { contains: kw } },
      { highlights: { contains: kw } },
      { description: { contains: kw } },
    ];
  }

  return where;
}

function buildOrderBy(sort: ListingQuery['sort']): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case 'priceAsc':
      return [{ priceWan: 'asc' }, { rentYuan: 'asc' }, { publishedAt: 'desc' }];
    case 'priceDesc':
      return [{ priceWan: 'desc' }, { rentYuan: 'desc' }, { publishedAt: 'desc' }];
    case 'areaDesc':
      return [{ area: 'desc' }, { publishedAt: 'desc' }];
    case 'hot':
      return [{ viewCount: 'desc' }, { publishedAt: 'desc' }];
    default:
      return [{ isTop: 'desc' }, { publishedAt: 'desc' }];
  }
}

const SELECT = {
  id: true,
  code: true,
  title: true,
  dealType: true,
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
  ownership: true,
  buildYear: true,
  isTop: true,
  isFeatured: true,
  viewCount: true,
  images: { select: { url: true }, orderBy: { sort: 'asc' as const }, take: 1 },
  agent: { select: { id: true, name: true } },
} satisfies Prisma.ListingSelect;

type RawRow = Prisma.ListingGetPayload<{ select: typeof SELECT }>;

function toCard(r: RawRow): ListingCardData {
  const tags: string[] = [];
  if (r.isFeatured) tags.push('精选');
  if (r.ownership) tags.push(r.ownership);
  if (r.decoration) tags.push(r.decoration);
  if (r.orientation) tags.push(r.orientation);

  return {
    id: r.id,
    code: r.code,
    title: r.title,
    dealType: r.dealType,
    community: r.community,
    district: r.district,
    businessArea: r.businessArea,
    priceWan: num(r.priceWan),
    rentYuan: num(r.rentYuan),
    unitPrice: num(r.unitPrice),
    area: num(r.area),
    layout: r.layout,
    rooms: r.rooms,
    floor: r.floor,
    totalFloors: r.totalFloors,
    orientation: r.orientation,
    decoration: r.decoration,
    buildYear: r.buildYear,
    isTop: r.isTop,
    isFeatured: r.isFeatured,
    viewCount: r.viewCount,
    cover: r.images[0]?.url ?? null,
    tags: tags.slice(0, 4),
    agentName: r.agent?.name ?? null,
    agentId: r.agent?.id ?? null,
  };
}

/**
 * 列表页查询（带总数与分页）。
 *
 * 包了一层 30 秒数据缓存：列表页带筛选参数，天生没法整页静态化（每次仍要 SSR），
 * 但那两次 count + findMany 是每请求都重复的，缓存后能把单页成本压下来。
 * 代价：新上架房源最多延迟 30 秒出现在列表里；客户点进详情页时按详情页自己的
 * ISR 逻辑取数，不受影响。
 */
const searchListingsCached = unstable_cache(
  async (q: ListingQuery) => {
    const page = q.page && q.page > 0 ? q.page : 1;
    const where = buildWhere(q);

    const [total, rows] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        select: SELECT,
        orderBy: buildOrderBy(q.sort),
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return {
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      items: rows.map(toCard),
    };
  },
  ['search-listings'],
  { revalidate: 30, tags: ['listings'] },
);

export async function searchListings(q: ListingQuery) {
  return searchListingsCached(q);
}

/** 首页精选 / 最新房源 */
export async function featuredListings(limit = 8): Promise<ListingCardData[]> {
  const rows = await prisma.listing.findMany({
    where: { status: 'PUBLISHED' },
    select: SELECT,
    orderBy: [{ isTop: 'desc' }, { isFeatured: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
  });
  return rows.map(toCard);
}

/** 各区域在售数量，用于首页区域入口 */
export async function districtCounts(): Promise<Array<{ district: string; count: number }>> {
  const rows = await prisma.listing.groupBy({
    by: ['district'],
    where: { status: 'PUBLISHED', district: { not: null } },
    _count: { _all: true },
  });
  return rows
    .filter((r) => r.district)
    .map((r) => ({ district: r.district as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function platformStats() {
  const [published, agents, districts] = await Promise.all([
    prisma.listing.count({ where: { status: 'PUBLISHED' } }),
    prisma.agentProfile.count(),
    prisma.listing.findMany({
      where: { status: 'PUBLISHED', district: { not: null } },
      select: { district: true },
      distinct: ['district'],
    }),
  ]);
  return { published, agents, districts: districts.length };
}

/** 详情页数据 */
export async function getListingDetail(id: string) {
  const l = await prisma.listing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sort: 'asc' } },
      agent: {
        select: {
          id: true,
          name: true,
          phone: true,
          agentProfile: {
            select: { refCode: true, title: true, area: true, contactPhone: true, wechatQr: true },
          },
        },
      },
    },
  });
  if (!l) return null;

  const similar = await prisma.listing.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: l.id },
      dealType: l.dealType,
      OR: [
        { district: l.district ?? undefined },
        { community: l.community },
      ],
    },
    select: SELECT,
    orderBy: { publishedAt: 'desc' },
    take: 4,
  });

  return { listing: l, similar: similar.map(toCard) };
}
