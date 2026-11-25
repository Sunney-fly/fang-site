import Link from 'next/link';
import { prisma, num } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import { formatPrice, timeAgo, maskPhone } from '@/lib/format';
import { PageHeader, StatCard, StatusBadge, EmptyState, Badge, TableWrap } from '@/components/admin/ui';
import { LEAD_STATUS_LABEL, LEAD_STATUS_STYLE, LISTING_STATUS_LABEL, LISTING_STATUS_STYLE } from '@/lib/format';

export const dynamic = 'force-dynamic';

const ROLE_HINT: Record<string, string> = {
  SUPER_ADMIN: '你可以管理全部房源、员工账号与系统设置。',
  ADMIN: '你可以审核房源、管理子管理员与查看全站数据。',
  AGENT: '你看到的是自己名下的房源与客户线索。',
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const isAgent = user.role === 'AGENT';
  const canReview = atLeast(user.role, 'ADMIN');
  const scope = isAgent ? { agentId: user.id } : {};

  const since7 = new Date(Date.now() - 7 * 86400000);
  const since30 = new Date(Date.now() - 30 * 86400000);

  const [
    statusGroups,
    publishedCount,
    viewSum,
    sessionCount,
    leadCount,
    dealCount,
    pendingReview,
    recentLeads,
    pendingAppointments,
    myListings,
    weekLeads,
  ] = await Promise.all([
    prisma.listing.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    prisma.listing.count({ where: { ...scope, status: 'PUBLISHED' } }),
    prisma.listing.aggregate({ where: scope, _sum: { viewCount: true } }),
    prisma.visitSession.count({
      where: isAgent ? { refUserId: user.id, firstSeenAt: { gte: since30 } } : { firstSeenAt: { gte: since30 } },
    }),
    prisma.lead.count({ where: { ...(isAgent ? { ownerId: user.id } : {}), createdAt: { gte: since30 } } }),
    prisma.lead.count({ where: { ...(isAgent ? { ownerId: user.id } : {}), status: 'DEAL' } }),
    canReview ? prisma.listing.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    prisma.lead.findMany({
      where: isAgent ? { ownerId: user.id } : {},
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        source: true,
        createdAt: true,
        listing: { select: { id: true, title: true } },
        owner: { select: { name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        ...(isAgent ? { ownerId: user.id } : {}),
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { expectAt: 'asc' },
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
        expectAt: true,
        status: true,
        listing: { select: { id: true, title: true } },
      },
    }),
    prisma.listing.findMany({
      where: { ...scope, status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      take: 5,
      select: {
        id: true,
        code: true,
        title: true,
        dealType: true,
        priceWan: true,
        rentYuan: true,
        viewCount: true,
        leadCount: true,
        status: true,
      },
    }),
    prisma.lead.count({ where: { ...(isAgent ? { ownerId: user.id } : {}), createdAt: { gte: since7 } } }),
  ]);

  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const newLeads = await prisma.lead.count({
    where: { ...(isAgent ? { ownerId: user.id } : {}), status: 'NEW' },
  });

  const conversion = sessionCount > 0 ? ((leadCount / sessionCount) * 100).toFixed(1) : '0.0';

  return (
    <div>
      <PageHeader
        title={`${user.name}，欢迎回来`}
        desc={ROLE_HINT[user.role]}
        action={
          <div className="flex gap-2">
            <Link href="/admin/listings/new" className="btn-primary btn-sm">
              + 发布房源
            </Link>
            {canReview && pendingReview > 0 && (
              <Link href="/admin/listings?status=PENDING" className="btn-ghost btn-sm">
                待审核 {pendingReview}
              </Link>
            )}
          </div>
        }
      />

      {sp.denied === '1' && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          该功能需要更高权限，你当前的角色是「{user.role === 'AGENT' ? '子管理员' : user.role}」。
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="已上架房源" value={publishedCount} hint={`待审核 ${statusMap.get('PENDING') ?? 0} 套`} tone="brand" />
        <StatCard label="近 30 天访客" value={sessionCount} hint={`留资 ${leadCount} 条 · 转化 ${conversion}%`} />
        <StatCard label="待跟进线索" value={newLeads} hint={`本周新增 ${weekLeads} 条`} tone={newLeads > 0 ? 'danger' : 'default'} />
        <StatCard label="累计成交" value={dealCount} hint={`房源总浏览 ${viewSum._sum.viewCount ?? 0} 次`} tone="success" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 最新线索 */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">最新客户线索</h2>
            <Link href="/admin/leads" className="text-sm text-brand-700 hover:underline">
              全部线索 →
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <EmptyState
              title="还没有客户线索"
              hint="客户在前台留资或预约看房后，会立刻出现在这里"
              action={
                <Link href="/admin/tracking" className="btn-ghost btn-sm">
                  去生成推广链接
                </Link>
              }
            />
          ) : (
            <TableWrap>
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">客户</th>
                  <th className="th">手机号</th>
                  <th className="th">意向房源</th>
                  <th className="th">状态</th>
                  <th className="th">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLeads.map((l) => (
                  <tr key={l.id}>
                    <td className="td">
                      <span className="font-medium text-slate-800">{l.name || '未留姓名'}</span>
                      {!isAgent && l.owner && (
                        <span className="ml-1 text-xs text-slate-400">→ {l.owner.name}</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap">
                      <a href={`tel:${l.phone}`} className="text-brand-700 hover:underline">
                        {maskPhone(l.phone)}
                      </a>
                    </td>
                    <td className="td max-w-[12rem] truncate">
                      {l.listing ? (
                        <Link href={`/fang/${l.listing.id}`} className="hover:text-brand-700">
                          {l.listing.title}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="td">
                      <StatusBadge
                        status={l.status}
                        map={Object.fromEntries(
                          Object.keys(LEAD_STATUS_LABEL).map((k) => [
                            k,
                            { label: LEAD_STATUS_LABEL[k]!, cls: LEAD_STATUS_STYLE[k] ?? 'bg-slate-100 text-slate-600' },
                          ]),
                        )}
                      />
                    </td>
                    <td className="td whitespace-nowrap text-xs text-slate-400">{timeAgo(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </section>

        {/* 待办预约 */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">待处理预约</h2>
            <Link href="/admin/appointments" className="text-sm text-brand-700 hover:underline">
              全部预约 →
            </Link>
          </div>

          {pendingAppointments.length === 0 ? (
            <EmptyState title="暂无待处理的看房预约" hint="客户在房源详情页预约看房后会出现在这里" />
          ) : (
            <ul className="card divide-y divide-slate-100">
              {pendingAppointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">
                      {a.name} · {maskPhone(a.phone)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {a.listing ? a.listing.title : '未指定房源'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge cls={a.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                      {a.status === 'CONFIRMED' ? '已确认' : '待确认'}
                    </Badge>
                    <p className="mt-1 text-xs text-slate-400">
                      {a.expectAt ? `${a.expectAt.getMonth() + 1}/${a.expectAt.getDate()} 看房` : '时间待定'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 房源状态分布 + 热门房源 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-base font-semibold text-slate-900">房源状态分布</h2>
          <ul className="mt-3 space-y-2">
            {(['PUBLISHED', 'PENDING', 'DRAFT', 'OFFLINE', 'REJECTED', 'SOLD'] as const).map((s) => {
              const count = statusMap.get(s) ?? 0;
              const total = statusGroups.reduce((sum, g) => sum + g._count._all, 0) || 1;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-slate-500">{LISTING_STATUS_LABEL[s]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.round((count / total) * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs text-slate-500">{count}</span>
                </li>
              );
            })}
          </ul>
          <Link href="/admin/listings" className="btn-ghost btn-sm mt-4 w-full">
            管理全部房源
          </Link>
        </section>

        <section className="card p-4">
          <h2 className="text-base font-semibold text-slate-900">浏览最多的房源</h2>
          {myListings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              还没有已上架房源。
              <Link href="/admin/listings/new" className="ml-1 text-brand-700 hover:underline">
                发布第一套
              </Link>
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {myListings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/fang/${l.id}`} className="line-clamp-1 text-sm text-slate-800 hover:text-brand-700">
                      {l.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatPrice({ dealType: l.dealType, priceWan: num(l.priceWan), rentYuan: num(l.rentYuan) })} ·{' '}
                      {l.code}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-400">
                    <p>浏览 {l.viewCount}</p>
                    <p>线索 {l.leadCount}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
