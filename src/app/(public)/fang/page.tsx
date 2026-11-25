import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FilterBar from '@/components/FilterBar';
import ListingCard from '@/components/ListingCard';
import Pagination from '@/components/Pagination';
import SearchBar from '@/components/SearchBar';
import { searchListings } from '@/lib/listings';
import { listingQuerySchema } from '@/lib/validators';
import { CITY_NAME } from '@/lib/filters';
import { formatPrice } from '@/lib/format';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

function flatten(sp: SP): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === 'string' && val !== '') out[k] = val;
  }
  return out;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = flatten(await searchParams);
  const parts: string[] = [CITY_NAME];
  if (sp.district) parts.push(sp.district);
  if (sp.dealType === 'RENT') parts.push('租房');
  else parts.push('二手房');
  if (sp.rooms) parts.push(sp.rooms === '5' ? '五居及以上' : `${sp.rooms}居`);
  if (sp.q) parts.push(sp.q);
  const title = `${parts.join(' ')}房源`;
  return { title, description: `${title}列表，真实在售房源，支持在线预约看房。` };
}

export default async function ListingSearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = flatten(await searchParams);
  const parsed = listingQuerySchema.safeParse(raw);
  if (!parsed.success) notFound();
  const query = parsed.data;

  const { items, total, page, pageCount } = await searchListings(query);

  // 价格区间摘要，给用户和搜索引擎看
  const dealType = query.dealType ?? 'SALE';
  const priceText =
    query.minPrice !== undefined || query.maxPrice !== undefined
      ? ` · ${query.minPrice ?? 0}-${query.maxPrice ?? '不限'}${dealType === 'RENT' ? '元/月' : '万'}`
      : '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4">
        <SearchBar
          defaultDealType={dealType === 'RENT' ? 'RENT' : 'SALE'}
          defaultKeyword={query.q ?? ''}
          defaultDistrict={query.district ?? ''}
          size="sm"
        />
      </div>

      <FilterBar />

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-base font-semibold text-slate-900">
          {CITY_NAME}
          {query.district ? ` ${query.district}` : ''}
          {dealType === 'RENT' ? '租房' : '二手房'}
          {query.q ? ` · ${query.q}` : ''}
          <span className="ml-2 text-sm font-normal text-slate-500">
            共 {total} 套{priceText}
          </span>
        </h1>
        {total > 0 && (
          <p className="text-xs text-slate-400">
            第 {page} / {pageCount} 页
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card mt-4 p-12 text-center">
          <p className="text-sm text-slate-600">没有找到符合条件的房源</p>
          <p className="mt-2 text-xs text-slate-400">
            试着放宽区域或价格条件，也可以直接留下联系方式，让经纪人帮你找。
          </p>
          <Link href="/fang" className="btn-primary btn-sm mt-4">
            清空筛选条件
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} params={raw} basePath="/fang" />

      {/* 帮助搜索引擎理解页面主题，同时给客户一点引导 */}
      {page === 1 && items.length > 0 && (
        <section className="mt-10 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-400">
          <h2 className="mb-2 text-sm font-medium text-slate-600">关于{CITY_NAME}二手房</h2>
          <p>
            当前筛选条件下共有 {total} 套房源，价格区间从
            {' '}
            {formatPrice({
              dealType,
              priceWan: items.reduce<number | null>(
                (min, i) => (i.priceWan !== null && (min === null || i.priceWan < min) ? i.priceWan : min),
                null,
              ),
              rentYuan: items.reduce<number | null>(
                (min, i) => (i.rentYuan !== null && (min === null || i.rentYuan < min) ? i.rentYuan : min),
                null,
              ),
            })}
            {' '}起。房源信息由入驻经纪人与平台共同维护，看房前建议先在线预约，经纪人会提前与业主确认钥匙情况。
          </p>
        </section>
      )}
    </div>
  );
}
