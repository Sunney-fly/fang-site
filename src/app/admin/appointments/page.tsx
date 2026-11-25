import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { updateAppointmentStatus } from '../actions';
import { requireStaff } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDate, formatDay, maskPhone, timeAgo } from '@/lib/format';
import { atLeast } from '@/lib/permissions';
import { EmptyState, PageHeader, StatCard, StatusBadge, TableWrap } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type ApptStatus = 'PENDING' | 'CONFIRMED' | 'DONE' | 'CANCELED';

const STATUS_VALUES: ApptStatus[] = ['PENDING', 'CONFIRMED', 'DONE', 'CANCELED'];

/** 预约状态 → 中文文案 + 颜色（PENDING 待确认 / CONFIRMED 已确认 / DONE 已完成 / CANCELED 已取消） */
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '待确认', cls: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: '已确认', cls: 'bg-emerald-100 text-emerald-700' },
  DONE: { label: '已完成', cls: 'bg-slate-100 text-slate-600' },
  CANCELED: { label: '已取消', cls: 'bg-slate-100 text-slate-500' },
};

const TABS: Array<{ value: '' | ApptStatus; label: string }> = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待确认' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'DONE', label: '已完成' },
  { value: 'CANCELED', label: '已取消' },
];

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;

  // ADMIN / SUPER_ADMIN 看全部，子管理员只看归属自己的预约
  const isAdmin = atLeast(user.role, 'ADMIN');
  const scope: Prisma.AppointmentWhereInput = isAdmin ? {} : { ownerId: user.id };

  const statusParam = sp.status ?? '';
  const status = STATUS_VALUES.find((s) => s === statusParam);
  const filter: Prisma.AppointmentWhereInput = status ? { ...scope, status } : scope;

  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7)); // 本周一 00:00

  // 一次 groupBy 拿到各状态数量，同时喂给筛选标签和顶部统计卡
  const [statusRows, todayNew, weekConfirmed, total, rows] = await Promise.all([
    prisma.appointment.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    prisma.appointment.count({ where: { ...scope, createdAt: { gte: dayStart } } }),
    prisma.appointment.count({ where: { ...scope, status: 'CONFIRMED', updatedAt: { gte: weekStart } } }),
    prisma.appointment.count({ where: filter }),
    prisma.appointment.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        wechat: true,
        expectAt: true,
        remark: true,
        status: true,
        createdAt: true,
        listing: { select: { id: true, title: true, community: true } },
        owner: { select: { id: true, name: true } },
      },
    }),
  ]);

  const statusCount = new Map<string, number>();
  for (const r of statusRows) statusCount.set(r.status, r._count._all);
  const countOf = (s: ApptStatus): number => statusCount.get(s) ?? 0;
  const totalAll = statusRows.reduce((sum, r) => sum + r._count._all, 0);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const usp = new URLSearchParams();
    if (status) usp.set('status', status);
    if (p > 1) usp.set('page', String(p));
    const q = usp.toString();
    return q ? `/admin/appointments?${q}` : '/admin/appointments';
  };

  return (
    <div>
      <PageHeader
        title="预约看房"
        desc="客户在线提交的看房预约，按时间倒序，点击可确认或标记完成"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="待确认" value={countOf('PENDING')} tone="brand" hint="建议 2 小时内联系客户" />
        <StatCard label="今日新增预约" value={todayNew} hint={formatDay(dayStart)} />
        <StatCard label="本周已确认" value={weekConfirmed} hint="本周一至今" />
        <StatCard label="累计完成" value={countOf('DONE')} tone="success" />
      </div>

      <div className="card mt-4 flex flex-wrap items-center gap-1.5 p-2">
        {TABS.map((t) => {
          const active = t.value === (status ?? '');
          const href = t.value ? `/admin/appointments?status=${t.value}` : '/admin/appointments';
          const c = t.value ? countOf(t.value) : totalAll;
          return (
            <Link
              key={t.label}
              href={href}
              className={`rounded-md px-2.5 py-1 text-xs transition ${
                active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
              <span className={`ml-1 ${active ? 'text-white/80' : 'text-slate-400'}`}>{c}</span>
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-slate-400">
          共 {total} 条 · 第 {page} / {pageCount} 页
        </span>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState
            title="暂无预约记录"
            hint={
              status
                ? '当前筛选条件下没有预约，换个状态看看。'
                : '客户在房源详情页提交看房预约后，会实时出现在这里。'
            }
          />
        ) : (
          <>
            <TableWrap>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">客户</th>
                  <th className="th">手机号</th>
                  <th className="th">意向房源</th>
                  <th className="th">期望看房时间</th>
                  <th className="th">归属经纪人</th>
                  <th className="th">状态</th>
                  <th className="th">提交时间</th>
                  <th className="th">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="td">
                      <p className="font-medium text-slate-900">{a.name}</p>
                      {a.wechat && <p className="mt-0.5 text-xs text-slate-500">微信：{a.wechat}</p>}
                      {a.remark && (
                        <p className="mt-0.5 max-w-[16rem] truncate text-xs text-slate-400" title={a.remark}>
                          {a.remark}
                        </p>
                      )}
                    </td>

                    <td className="td whitespace-nowrap">
                      <a href={`tel:${a.phone}`} className="text-brand-700 hover:underline">
                        {maskPhone(a.phone)}
                      </a>
                    </td>

                    <td className="td">
                      {a.listing ? (
                        <>
                          <Link href={`/fang/${a.listing.id}`} className="text-brand-700 hover:underline">
                            {a.listing.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-400">{a.listing.community}</p>
                        </>
                      ) : (
                        <span className="text-slate-400">未指定房源</span>
                      )}
                    </td>

                    <td className="td whitespace-nowrap">
                      {a.expectAt ? formatDate(a.expectAt) : <span className="text-slate-400">未指定</span>}
                    </td>

                    <td className="td whitespace-nowrap">
                      {a.owner ? a.owner.name : <span className="text-slate-400">未分配</span>}
                    </td>

                    <td className="td">
                      <StatusBadge status={a.status} map={STATUS_MAP} />
                    </td>

                    <td className="td whitespace-nowrap">
                      <p>{formatDate(a.createdAt)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{timeAgo(a.createdAt)}</p>
                    </td>

                    <td className="td">
                      {a.status === 'PENDING' && (
                        <form action={updateAppointmentStatus} className="flex flex-wrap gap-1.5">
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" name="status" value="CONFIRMED" className="btn-primary btn-sm">
                            确认
                          </button>
                          <button type="submit" name="status" value="CANCELED" className="btn-ghost btn-sm">
                            取消
                          </button>
                        </form>
                      )}
                      {a.status === 'CONFIRMED' && (
                        <form action={updateAppointmentStatus} className="flex flex-wrap gap-1.5">
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" name="status" value="DONE" className="btn-primary btn-sm">
                            已完成
                          </button>
                          <button type="submit" name="status" value="CANCELED" className="btn-ghost btn-sm">
                            取消
                          </button>
                        </form>
                      )}
                      {(a.status === 'DONE' || a.status === 'CANCELED') && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="btn-ghost btn-sm">
                    上一页
                  </Link>
                ) : (
                  <span className="btn-ghost btn-sm cursor-not-allowed opacity-50">上一页</span>
                )}

                <span className="text-xs text-slate-400">
                  第 {page} / {pageCount} 页
                </span>

                {page < pageCount ? (
                  <Link href={pageHref(page + 1)} className="btn-ghost btn-sm">
                    下一页
                  </Link>
                ) : (
                  <span className="btn-ghost btn-sm cursor-not-allowed opacity-50">下一页</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
