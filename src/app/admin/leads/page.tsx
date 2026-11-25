import Link from 'next/link';
import type { Prisma, LeadStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_STYLE,
  LEAD_SOURCE_LABEL,
  formatDate,
  timeAgo,
} from '@/lib/format';
import { PageHeader, StatCard, EmptyState, StatusBadge, Badge, TableWrap } from '@/components/admin/ui';
import LeadCards from '@/components/admin/LeadCards';
import LeadRow from '@/components/admin/LeadRow';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const STATUS_MAP = Object.fromEntries(
  Object.keys(LEAD_STATUS_LABEL).map((k) => [
    k,
    { label: LEAD_STATUS_LABEL[k]!, cls: LEAD_STATUS_STYLE[k] ?? 'bg-slate-100 text-slate-600' },
  ]),
);

const ERR_TEXT: Record<string, string> = {
  forbidden: '这条线索不属于你，无法操作',
};

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; q?: string; page?: string; err?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const isAgent = user.role === 'AGENT';
  const canManage = atLeast(user.role, 'ADMIN');

  const status = Object.keys(LEAD_STATUS_LABEL).includes(sp.status ?? '') ? (sp.status as LeadStatus) : undefined;
  const source = Object.keys(LEAD_SOURCE_LABEL).includes(sp.source ?? '') ? sp.source : undefined;
  const q = (sp.q ?? '').trim().slice(0, 30);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const baseWhere: Prisma.LeadWhereInput = {
    ...(isAgent ? { ownerId: user.id } : {}),
    ...(source ? { source: source as 'FORM' } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { message: { contains: q } }] } : {}),
  };

  const where: Prisma.LeadWhereInput = { ...baseWhere, ...(status ? { status } : {}) };

  const [total, rows, statusCounts, unassigned, weekCount] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        wechat: true,
        message: true,
        source: true,
        status: true,
        privatized: true,
        followUps: true,
        followUpAt: true,
        createdAt: true,
        ownerId: true,
        owner: { select: { name: true } },
        listing: { select: { id: true, title: true, community: true } },
        listingAgentId: true,
        sourceCode: { select: { name: true, type: true } },
        session: { select: { pageViews: true, device: true, refCode: true } },
      },
    }),
    prisma.lead.groupBy({
      by: ['status'],
      where: isAgent ? { ownerId: user.id } : {},
      _count: { _all: true },
    }),
    canManage ? prisma.lead.count({ where: { ownerId: null } }) : Promise.resolve(0),
    prisma.lead.count({
      where: { ...(isAgent ? { ownerId: user.id } : {}), createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    }),
  ]);

  const countMap = new Map(statusCounts.map((c) => [c.status, c._count._all]));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    params.delete('page');
    const s = params.toString();
    return `/admin/leads${s ? `?${s}` : ''}`;
  };

  // 改派用的经纪人列表
  const agents = canManage
    ? await prisma.user.findMany({
        where: { role: { in: ['AGENT', 'ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      })
    : [];

  // 手机端卡片所需的数据形状
  const leadRows = rows.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    wechat: l.wechat,
    message: l.message,
    source: l.source,
    status: l.status,
    privatized: l.privatized,
    followUps: l.followUps,
    followUpAt: l.followUpAt ? formatDate(l.followUpAt) : null,
    createdAt: formatDate(l.createdAt),
    createdAgo: timeAgo(l.createdAt),
    ownerName: l.owner?.name ?? null,
    ownerId: l.ownerId,
    listing: l.listing ? { id: l.listing.id, title: l.listing.title, community: l.listing.community } : null,
    sourceCodeName: l.sourceCode?.name ?? null,
    visitedPages: l.session?.pageViews ?? null,
    device: l.session?.device ?? null,
    refCode: l.session?.refCode ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="客户线索"
        desc={
          isAgent
            ? '通过你的专属链接、海报来的客户都会出现在这里。跟进状态变化会立刻保存。'
            : '全站客户线索。管理员可以把线索改派给其他子管理员。'
        }
      />

      {sp.err && ERR_TEXT[sp.err] && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{ERR_TEXT[sp.err]}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="待跟进" value={countMap.get('NEW') ?? 0} tone="danger" />
        <StatCard label="跟进中" value={(countMap.get('CONTACTED') ?? 0) + (countMap.get('FOLLOWING') ?? 0)} tone="brand" />
        <StatCard label="已成交" value={countMap.get('DEAL') ?? 0} tone="success" />
        <StatCard label="本周新增" value={weekCount} hint={canManage ? `未分配 ${unassigned} 条` : undefined} />
      </div>

      <form method="get" className="card mt-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="q">
            搜索
          </label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="客户姓名、手机号、留言内容" />
        </div>
        <div>
          <label className="label" htmlFor="status">
            跟进状态
          </label>
          <select id="status" name="status" className="input w-32" defaultValue={status ?? ''}>
            <option value="">全部</option>
            {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="source">
            来源
          </label>
          <select id="source" name="source" className="input w-32" defaultValue={source ?? ''}>
            <option value="">全部</option>
            {Object.entries(LEAD_SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          筛选
        </button>
        <Link href="/admin/leads" className="btn-ghost">
          重置
        </Link>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">快速筛选：</span>
        {Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => (
          <Link
            key={k}
            href={buildHref({ status: k })}
            className={`tag hover:bg-slate-200 ${status === k ? 'bg-brand-100 text-brand-700' : ''}`}
          >
            {v} {countMap.get(k as LeadStatus) ?? 0}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="还没有客户线索"
            hint="客户在前台留资、预约看房，或点击微信/电话咨询后，会立刻出现在这里"
            action={
              <Link href="/admin/tracking" className="btn-ghost btn-sm">
                生成我的推广链接
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* 手机端：卡片 + 大按钮（打电话/发短信/标记跟进） */}
          <LeadCards rows={leadRows} canReassign={canManage} agents={agents} />

          {/* 电脑端：紧凑表格 */}
          <div className="hidden lg:block">
            <TableWrap>
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">客户</th>
                  <th className="th">联系方式</th>
                  <th className="th">意向房源</th>
                  <th className="th">来源 / 渠道</th>
                  <th className="th">归属</th>
                  <th className="th">状态</th>
                  <th className="th">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="td">
                      <p className="font-medium text-slate-800">{l.name || '未留姓名'}</p>
                      {l.privatized && <span className="tag bg-emerald-50 text-emerald-700">已加微信</span>}
                    </td>
                    <td className="td whitespace-nowrap">
                      <a href={`tel:${l.phone}`} className="text-brand-700 hover:underline">
                        {l.phone}
                      </a>
                      {l.wechat && <p className="text-xs text-slate-400">微信 {l.wechat}</p>}
                    </td>
                    <td className="td max-w-[14rem]">
                      {l.listing ? (
                        <Link href={`/fang/${l.listing.id}`} className="line-clamp-1 hover:text-brand-700">
                          {l.listing.title}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {l.message && <p className="line-clamp-1 text-xs text-slate-400">「{l.message}」</p>}
                    </td>
                    <td className="td whitespace-nowrap text-xs text-slate-500">
                      {LEAD_SOURCE_LABEL[l.source] ?? l.source}
                      {l.sourceCode ? <p className="text-slate-400">{l.sourceCode.name}</p> : null}
                    </td>
                    <td className="td whitespace-nowrap text-xs">{l.owner?.name ?? '未分配'}</td>
                    <td className="td">
                      <StatusBadge status={l.status} map={STATUS_MAP} />
                    </td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{timeAgo(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`${buildHref({})}${buildHref({}).includes('?') ? '&' : '?'}page=${page - 1}`}
              className="btn-ghost btn-sm"
            >
              上一页
            </Link>
          )}
          <span className="text-slate-500">
            第 {page} / {pageCount} 页，共 {total} 条
          </span>
          {page < pageCount && (
            <Link
              href={`${buildHref({})}${buildHref({}).includes('?') ? '&' : '?'}page=${page + 1}`}
              className="btn-ghost btn-sm"
            >
              下一页
            </Link>
          )}
        </nav>
      )}

      <p className="mt-4 text-xs text-slate-400">
        提示：客户来源里显示的「渠道」是他第一次点击你分享的链接时记录的，之后不管他什么时候留资，都算你的客户。
      </p>
    </div>
  );
}
