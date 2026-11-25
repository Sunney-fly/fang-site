import Link from 'next/link';
import { prisma, num } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import { LISTING_STATUS_LABEL, LISTING_STATUS_STYLE, formatPrice } from '@/lib/format';
import { setListingStatus } from '@/app/admin/actions';
import PosterButton from '@/components/admin/PosterButton';

export const dynamic = 'force-dynamic';

const STATUS_ORDER = ['PUBLISHED', 'PENDING', 'OFFLINE', 'DRAFT', 'REJECTED', 'SOLD'] as const;

/**
 * 业务员的「我的房源」手机版。
 * 相比电脑版的表格，这里用卡片 + 大按钮，上下架一键完成。
 */
export default async function MobileListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const isAgent = user.role === 'AGENT';
  const status = STATUS_ORDER.includes(sp.status as (typeof STATUS_ORDER)[number]) ? sp.status : undefined;

  const where = {
    ...(isAgent ? { agentId: user.id } : {}),
    ...(status ? { status: status as 'PUBLISHED' } : {}),
  };

  const [rows, counts] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 60,
      select: {
        id: true,
        code: true,
        title: true,
        dealType: true,
        status: true,
        priceWan: true,
        rentYuan: true,
        community: true,
        viewCount: true,
        leadCount: true,
        rejectReason: true,
        images: { select: { url: true }, orderBy: { sort: 'asc' }, take: 1 },
      },
    }),
    prisma.listing.groupBy({
      by: ['status'],
      where: isAgent ? { agentId: user.id } : {},
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-slate-900">我的房源</h1>
        <Link href="/admin/m/listings/new" className="btn-primary btn-sm">
          + 发布
        </Link>
      </div>

      {/* 状态筛选：横向可滑动的胶囊 */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link
          href="/admin/m/listings"
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
            !status ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'
          }`}
        >
          全部 {total}
        </Link>
        {STATUS_ORDER.map((s) => (
          <Link
            key={s}
            href={`/admin/m/listings?status=${s}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
              status === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'
            }`}
          >
            {LISTING_STATUS_LABEL[s]} {countMap.get(s) ?? 0}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          这里还没有房源，
          <Link href="/admin/m/listings/new" className="text-brand-700">
            发布第一套
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => (
            <li key={l.id} className="card overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-[10px] text-slate-400">无图</div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link href={`/fang/${l.id}`} className="line-clamp-2 text-sm font-medium text-slate-800">
                    {l.title}
                  </Link>
                  <p className="mt-1 text-base font-semibold text-rose-600">
                    {formatPrice({ dealType: l.dealType, priceWan: num(l.priceWan), rentYuan: num(l.rentYuan) })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    <span className={`mr-1 rounded px-1 py-0.5 ${LISTING_STATUS_STYLE[l.status] ?? ''}`}>
                      {LISTING_STATUS_LABEL[l.status]}
                    </span>
                    浏览 {l.viewCount} · 线索 {l.leadCount}
                  </p>
                </div>
              </div>

              {l.status === 'REJECTED' && l.rejectReason && (
                <p className="mx-3 mb-2 rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                  驳回原因：{l.rejectReason}
                </p>
              )}

              {/* 大按钮：海报 + 编辑 + 上下架 */}
              <div className="flex gap-2 border-t border-slate-100 p-2">
                <PosterButton
                  listingId={l.id}
                  refCode={user.refCode}
                  label="海报"
                  className="btn-primary btn-sm flex-1 justify-center"
                />
                <Link href={`/admin/listings/${l.id}`} className="btn-ghost btn-sm flex-1 justify-center">
                  编辑
                </Link>

                {l.status === 'PUBLISHED' ? (
                  <form action={setListingStatus} className="flex-1">
                    <input type="hidden" name="id" value={l.id} />
                    <button name="action" value="offline" className="btn-ghost btn-sm w-full justify-center" type="submit">
                      下架
                    </button>
                  </form>
                ) : l.status === 'PENDING' ? (
                  <span className="flex-1 pt-1.5 text-center text-[11px] text-amber-700">等审核</span>
                ) : l.status === 'SOLD' ? (
                  <span className="flex-1 pt-1.5 text-center text-[11px] text-slate-400">已成交</span>
                ) : (
                  <form action={setListingStatus} className="flex-1">
                    <input type="hidden" name="id" value={l.id} />
                    <button
                      name="action"
                      value="publish"
                      className="btn-primary btn-sm w-full justify-center"
                      type="submit"
                    >
                      上架
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {atLeast(user.role, 'ADMIN') && (
        <p className="pt-2 text-center text-[11px] text-slate-400">
          你是管理员，这里显示全站房源的前 60 条。完整筛选与审核请用电脑端「房源管理」。
        </p>
      )}
    </div>
  );
}
