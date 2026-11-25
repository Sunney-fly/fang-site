import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma, num } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import { formatPrice, timeAgo, LISTING_STATUS_LABEL, LISTING_STATUS_STYLE, DEAL_TYPE_LABEL } from '@/lib/format';
import { PageHeader, StatCard, EmptyState, TableWrap, StatusBadge, Badge } from '@/components/admin/ui';
import ListingRowActions from '@/components/admin/ListingRowActions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = ['PUBLISHED', 'PENDING', 'DRAFT', 'OFFLINE', 'REJECTED', 'SOLD'] as const;

const STATUS_MAP = Object.fromEntries(
  Object.keys(LISTING_STATUS_LABEL).map((k) => [
    k,
    { label: LISTING_STATUS_LABEL[k]!, cls: LISTING_STATUS_STYLE[k] ?? 'bg-slate-100 text-slate-600' },
  ]),
);

const ERR_TEXT: Record<string, string> = {
  forbidden: '你不能操作不属于你的房源',
  notfound: '房源不存在',
  pending: '待审核的房源需要管理员审核后才能上架',
  deleted: '房源已删除',
};

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; dealType?: string; page?: string; msg?: string; err?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const isAgent = user.role === 'AGENT';
  const canManage = atLeast(user.role, 'ADMIN');

  const q = (sp.q ?? '').trim().slice(0, 30);
  const status = STATUS_OPTIONS.includes(sp.status as (typeof STATUS_OPTIONS)[number]) ? sp.status : undefined;
  const dealType = sp.dealType === 'RENT' || sp.dealType === 'SALE' ? sp.dealType : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where: Prisma.ListingWhereInput = {
    ...(isAgent ? { agentId: user.id } : {}),
    ...(status ? { status: status as 'PUBLISHED' } : {}),
    ...(dealType ? { dealType } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { community: { contains: q } },
            { code: { contains: q } },
            { address: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, rows, counts] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: [{ isTop: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        title: true,
        dealType: true,
        status: true,
        priceWan: true,
        rentYuan: true,
        community: true,
        district: true,
        viewCount: true,
        leadCount: true,
        isTop: true,
        isFeatured: true,
        updatedAt: true,
        agentId: true,
        agent: { select: { name: true } },
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
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (dealType) params.set('dealType', dealType);
    if (page > 1) params.set('page', String(page));
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    params.delete('page');
    const s = params.toString();
    return `/admin/listings${s ? `?${s}` : ''}`;
  };

  return (
    <div>
      <PageHeader
        title="房源管理"
        desc={isAgent ? '你可以发布、编辑、上下架自己的房源' : '全站房源管理，可审核、置顶、精选与下架'}
        action={
          <Link href="/admin/listings/new" className="btn-primary btn-sm">
            + 发布房源
          </Link>
        }
      />

      {sp.msg === 'deleted' && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">房源已删除</div>
      )}
      {sp.msg === 'created' && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          房源已创建。若为待审核状态，会在管理员审核后上架。
        </div>
      )}
      {sp.err && ERR_TEXT[sp.err] && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{ERR_TEXT[sp.err]}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="已上架" value={countMap.get('PUBLISHED') ?? 0} tone="brand" />
        <StatCard label="待审核" value={countMap.get('PENDING') ?? 0} />
        <StatCard label="已下架 / 成交" value={(countMap.get('OFFLINE') ?? 0) + (countMap.get('SOLD') ?? 0)} />
        <StatCard label="草稿 / 驳回" value={(countMap.get('DRAFT') ?? 0) + (countMap.get('REJECTED') ?? 0)} />
      </div>

      <form method="get" className="card mt-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="q">
            关键词
          </label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="房源编号、标题、小区名" />
        </div>
        <div>
          <label className="label" htmlFor="status">
            状态
          </label>
          <select id="status" name="status" className="input w-32" defaultValue={status ?? ''}>
            <option value="">全部</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {LISTING_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dealType">
            类型
          </label>
          <select id="dealType" name="dealType" className="input w-28" defaultValue={dealType ?? ''}>
            <option value="">全部</option>
            <option value="SALE">出售</option>
            <option value="RENT">出租</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">
          筛选
        </button>
        <Link href="/admin/listings" className="btn-ghost">
          重置
        </Link>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">快速筛选：</span>
        <Link href={buildHref({ status: undefined })} className="tag hover:bg-slate-200">
          全部 {counts.reduce((s, c) => s + c._count._all, 0)}
        </Link>
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            className={`tag hover:bg-slate-200 ${status === s ? 'bg-brand-100 text-brand-700' : ''}`}
          >
            {LISTING_STATUS_LABEL[s]} {countMap.get(s) ?? 0}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="没有符合条件的房源"
            hint="换个筛选条件，或者直接发布一套新房源"
            action={
              <Link href="/admin/listings/new" className="btn-primary btn-sm">
                发布房源
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="th">房源</th>
                <th className="th">价格</th>
                <th className="th">状态</th>
                <th className="th">数据</th>
                {!isAgent && <th className="th">归属子管理员</th>}
                <th className="th">更新时间</th>
                <th className="th">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="td">
                    <div className="flex gap-3">
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        {l.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.images[0].url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-[10px] text-slate-400">无图</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/fang/${l.id}`}
                          className="line-clamp-1 max-w-[18rem] text-sm font-medium text-slate-800 hover:text-brand-700"
                        >
                          {l.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {l.code} · {l.district ?? '未填区域'} · {DEAL_TYPE_LABEL[l.dealType]}
                        </p>
                        <div className="mt-1 flex gap-1">
                          {l.isTop && <Badge cls="bg-rose-100 text-rose-700">置顶</Badge>}
                          {l.isFeatured && <Badge cls="bg-brand-100 text-brand-700">精选</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="td whitespace-nowrap font-medium text-rose-600">
                    {formatPrice({ dealType: l.dealType, priceWan: num(l.priceWan), rentYuan: num(l.rentYuan) })}
                  </td>
                  <td className="td">
                    <StatusBadge status={l.status} map={STATUS_MAP} />
                  </td>
                  <td className="td whitespace-nowrap text-xs text-slate-500">
                    <p>浏览 {l.viewCount}</p>
                    <p>线索 {l.leadCount}</p>
                  </td>
                  {!isAgent && <td className="td whitespace-nowrap text-sm">{l.agent?.name ?? '平台'}</td>}
                  <td className="td whitespace-nowrap text-xs text-slate-400">{timeAgo(l.updatedAt)}</td>
                  <td className="td">
                    <ListingRowActions
                      id={l.id}
                      status={l.status}
                      canManage={canManage}
                      isOwner={l.agentId === user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`${buildHref({})}${buildHref({}).includes('?') ? '&' : '?'}page=${page - 1}`} className="btn-ghost btn-sm">
              上一页
            </Link>
          )}
          <span className="text-slate-500">
            第 {page} / {pageCount} 页，共 {total} 套
          </span>
          {page < pageCount && (
            <Link href={`${buildHref({})}${buildHref({}).includes('?') ? '&' : '?'}page=${page + 1}`} className="btn-ghost btn-sm">
              下一页
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
