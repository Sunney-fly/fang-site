import type { Prisma } from '@prisma/client';
import { requireStaff } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LISTING_STATUS_LABEL, LISTING_STATUS_STYLE, formatDay } from '@/lib/format';
import { atLeast } from '@/lib/permissions';
import { Badge, EmptyState, PageHeader, StatCard, TableWrap } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const TREND_DAYS = 14;

const LISTING_STATUS_ORDER = ['DRAFT', 'PENDING', 'PUBLISHED', 'OFFLINE', 'REJECTED', 'SOLD'] as const;

/** 留资转化率：线索数 ÷ 会话数，保留 1 位小数 */
function rate(part: number, whole: number): string {
  if (whole <= 0) return '—';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/** 横向条形宽度：按最大值取百分比，0 或没有数据时不画条 */
function barWidth(n: number, max: number): string {
  if (n <= 0 || max <= 0) return '0%';
  return `${Math.max(4, Math.round((n / max) * 100))}%`;
}

function sumCount<T extends { _count: { _all: number } }>(rows: T[]): number {
  return rows.reduce((sum, r) => sum + r._count._all, 0);
}

/** groupBy 结果 → Map<归属 id, 数量>，跳过归属为空的记录 */
function countBy<T extends { _count: { _all: number } }>(
  rows: T[],
  pick: (row: T) => string | null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + row._count._all);
  }
  return map;
}

export default async function AdminStatsPage() {
  const user = await requireStaff();

  // ADMIN / SUPER_ADMIN 看全站，子管理员只看归属自己的数据
  const isAdmin = atLeast(user.role, 'ADMIN');
  const listingScope: Prisma.ListingWhereInput = isAdmin ? {} : { agentId: user.id };
  const sessionScope: Prisma.VisitSessionWhereInput = isAdmin ? {} : { refUserId: user.id };
  const leadScope: Prisma.LeadWhereInput = isAdmin ? {} : { ownerId: user.id };
  const viewScope: Prisma.PageViewWhereInput = isAdmin ? {} : { refUserId: user.id };
  const apptScope: Prisma.AppointmentWhereInput = isAdmin ? {} : { ownerId: user.id };
  const agentWhere: Prisma.UserWhereInput = { role: 'AGENT' };
  if (!isAdmin) agentWhere.id = user.id;

  // 近 14 天（含今天）的日期刻度
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const since = new Date(dayStart);
  since.setDate(dayStart.getDate() - (TREND_DAYS - 1));
  const days: string[] = [];
  for (let i = 0; i < TREND_DAYS; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    days.push(formatDay(d));
  }

  const [
    listingGroups,
    sessionGroups,
    leadGroups,
    dealGroups,
    listingStatusGroups,
    agents,
    viewCount,
    appointmentCount,
    viewRows,
    leadRows,
  ] = await Promise.all([
    // 房源数 / 会话数 / 线索数 / 成交数：一次 groupBy 聚合后合并，避免 N+1
    prisma.listing.groupBy({
      by: ['agentId'],
      where: { ...listingScope, status: 'PUBLISHED' },
      _count: { _all: true },
    }),
    prisma.visitSession.groupBy({ by: ['refUserId'], where: sessionScope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['ownerId'], where: leadScope, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['ownerId'], where: { ...leadScope, status: 'DEAL' }, _count: { _all: true } }),
    prisma.listing.groupBy({ by: ['status'], where: listingScope, _count: { _all: true } }),
    prisma.user.findMany({
      where: agentWhere,
      select: { id: true, name: true, agentProfile: { select: { title: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.pageView.count({ where: viewScope }),
    prisma.appointment.count({ where: apptScope }),
    // 明细量小，直接取 createdAt 在内存里按天归并（MySQL 按天 groupBy 不便）
    prisma.pageView.findMany({
      where: { ...viewScope, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.lead.findMany({
      where: { ...leadScope, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const publishedListings = sumCount(listingGroups);
  const totalSessions = sumCount(sessionGroups);
  const totalLeads = sumCount(leadGroups);
  const totalDeals = sumCount(dealGroups);

  const listingByAgent = countBy(listingGroups, (r) => r.agentId);
  const sessionByAgent = countBy(sessionGroups, (r) => r.refUserId);
  const leadByAgent = countBy(leadGroups, (r) => r.ownerId);
  const dealByAgent = countBy(dealGroups, (r) => r.ownerId);

  const ranking = agents
    .map((a) => {
      const sessions = sessionByAgent.get(a.id) ?? 0;
      const leads = leadByAgent.get(a.id) ?? 0;
      return {
        id: a.id,
        name: a.name,
        title: a.agentProfile?.title ?? null,
        listings: listingByAgent.get(a.id) ?? 0,
        sessions,
        leads,
        deals: dealByAgent.get(a.id) ?? 0,
        conversion: rate(leads, sessions),
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.leads - a.leads || a.name.localeCompare(b.name));

  const listingStatusCount = new Map<string, number>();
  for (const r of listingStatusGroups) listingStatusCount.set(r.status, r._count._all);
  const maxStatusCount = Math.max(1, ...LISTING_STATUS_ORDER.map((s) => listingStatusCount.get(s) ?? 0));

  const viewByDay = new Map<string, number>();
  for (const r of viewRows) {
    const key = formatDay(r.createdAt);
    viewByDay.set(key, (viewByDay.get(key) ?? 0) + 1);
  }
  const leadByDay = new Map<string, number>();
  for (const r of leadRows) {
    const key = formatDay(r.createdAt);
    leadByDay.set(key, (leadByDay.get(key) ?? 0) + 1);
  }
  const trend = days.map((day) => ({
    day,
    views: viewByDay.get(day) ?? 0,
    leads: leadByDay.get(day) ?? 0,
  }));
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.views, t.leads)));

  return (
    <div>
      <PageHeader
        title="数据统计"
        desc="房源、客户、转化的整体情况。管理员可见全站，子管理员只看自己的数据"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="已上架房源"
          value={publishedListings}
          hint={isAdmin ? '全站已上架' : '我名下的已上架房源'}
        />
        <StatCard label="总浏览量" value={viewCount} hint="PageView 记录数" />
        <StatCard label="访客会话数" value={totalSessions} hint="去重后的访客会话" />
        <StatCard label="客户线索数" value={totalLeads} />
        <StatCard label="预约数" value={appointmentCount} />
        <StatCard label="成交数" value={totalDeals} tone="success" hint="线索状态为已成交" />
        <StatCard
          label="留资转化率"
          value={rate(totalLeads, totalSessions)}
          tone="brand"
          hint="线索数 ÷ 会话数"
        />
      </div>

      <div className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900">按子管理员排行</h2>
        <p className="mt-1 text-xs text-slate-400">
          {isAdmin ? '按会话数从高到低排序，可对比每个人的获客效率' : '子管理员只能看到自己的数据'}
        </p>

        <div className="mt-3">
          {ranking.length === 0 ? (
            <EmptyState title="暂无子管理员数据" hint="还没有子管理员账号，或暂时没有可用于统计的访客记录。" />
          ) : (
            <TableWrap>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">经纪人</th>
                  <th className="th">已上架房源数</th>
                  <th className="th">访客会话数</th>
                  <th className="th">线索数</th>
                  <th className="th">成交数</th>
                  <th className="th">留资转化率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.map((r) => (
                  <tr key={r.id}>
                    <td className="td">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      {r.title && <p className="mt-0.5 text-xs text-slate-400">{r.title}</p>}
                    </td>
                    <td className="td">{r.listings}</td>
                    <td className="td">{r.sessions}</td>
                    <td className="td">{r.leads}</td>
                    <td className="td">{r.deals}</td>
                    <td className="td">{r.conversion}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-slate-900">近 14 天访客与线索趋势</h2>
          <p className="mt-1 text-xs text-slate-400">
            蓝色为访客浏览量（PageView），绿色为客户留资（Lead），按天统计
          </p>

          <div className="mt-3 space-y-2">
            {trend.map((t) => (
              <div key={t.day} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs text-slate-400">{t.day.slice(5)}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-2 rounded bg-brand-500" style={{ width: barWidth(t.views, maxTrend) }} />
                  <div className="h-2 rounded bg-emerald-500" style={{ width: barWidth(t.leads, maxTrend) }} />
                </div>
                <span className="w-28 shrink-0 text-right text-xs text-slate-500">
                  访客 {t.views} · 线索 {t.leads}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="text-sm font-semibold text-slate-900">房源状态分布</h2>
          <p className="mt-1 text-xs text-slate-400">
            {isAdmin ? '全站房源按状态汇总' : '我名下的房源按状态汇总'}
          </p>

          <ul className="mt-3 space-y-2.5">
            {LISTING_STATUS_ORDER.map((s) => {
              const c = listingStatusCount.get(s) ?? 0;
              return (
                <li key={s} className="flex items-center gap-3">
                  <Badge cls={LISTING_STATUS_STYLE[s] ?? 'bg-slate-100 text-slate-600'}>
                    {LISTING_STATUS_LABEL[s] ?? s}
                  </Badge>
                  <div className="h-2 min-w-0 flex-1 rounded bg-slate-100">
                    <div className="h-2 rounded bg-brand-500" style={{ width: barWidth(c, maxStatusCount) }} />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm text-slate-600">{c} 套</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
