import Link from 'next/link';
import type { ListingCardData } from '@/lib/listings';
import { formatArea, formatFloor, formatPrice, formatUnitPrice } from '@/lib/format';

export default function ListingCard({ item, compact = false }: { item: ListingCardData; compact?: boolean }) {
  const unit = formatUnitPrice(item);

  return (
    <Link
      href={`/fang/${item.id}`}
      className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className={`relative bg-slate-100 ${compact ? 'h-36' : 'h-44'}`}>
        {item.cover ? (
          // 房源图片由本地上传目录提供，用原生 img 即可（已关闭 next/image 优化）
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.cover}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-400">暂无图片</div>
        )}

        <div className="absolute left-2 top-2 flex gap-1">
          {item.isTop && (
            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
              置顶
            </span>
          )}
          {item.isFeatured && (
            <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
              精选
            </span>
          )}
        </div>

        <span className="absolute bottom-2 right-2 rounded bg-slate-900/70 px-1.5 py-0.5 text-[11px] text-white">
          {item.dealType === 'RENT' ? '出租' : '出售'}
        </span>
      </div>

      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-medium text-slate-900 group-hover:text-brand-700">
          {item.title}
        </h3>

        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
          {item.community}
          {item.district ? ` · ${item.district}` : ''}
          {item.businessArea ? ` · ${item.businessArea}` : ''}
        </p>

        <p className="mt-2 line-clamp-1 text-xs text-slate-500">
          {item.layout || '户型待补充'}
          {item.area ? ` | ${formatArea(item.area)}` : ''}
          {item.floor !== null ? ` | ${formatFloor(item.floor, item.totalFloors)}` : ''}
        </p>

        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="text-lg font-semibold text-rose-600">{formatPrice(item)}</span>
          {unit && <span className="text-xs text-slate-400">{unit}</span>}
        </div>

        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}

        {item.agentName && (
          <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
            经纪人 {item.agentName} · 浏览 {item.viewCount}
          </p>
        )}
      </div>
    </Link>
  );
}
