import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatDate, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MyHomePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [bookmarks, appointments, leads] = await Promise.all([
    prisma.bookmark.count({ where: { userId: user.id } }),
    prisma.appointment.findMany({
      where: { phone: user.phone },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, status: true, expectAt: true, createdAt: true, listing: { select: { id: true, title: true } } },
    }),
    prisma.lead.findMany({
      where: { phone: user.phone },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, status: true, createdAt: true, listing: { select: { id: true, title: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="收藏房源" value={bookmarks} href="/my/bookmarks" />
        <Stat label="我的预约" value={appointments.length} href="/my/appointments" />
        <Stat label="咨询记录" value={leads.length} />
      </div>

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">最近的预约</h2>
          <Link href="/my/appointments" className="text-sm text-brand-700 hover:underline">
            全部 →
          </Link>
        </div>
        {appointments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            还没有预约记录。
            <Link href="/fang" className="ml-1 text-brand-700 hover:underline">
              去看看房源
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm text-slate-800">
                    {a.listing ? (
                      <Link href={`/fang/${a.listing.id}`} className="hover:text-brand-700">
                        {a.listing.title}
                      </Link>
                    ) : (
                      '看房预约'
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.expectAt ? `期望 ${formatDate(a.expectAt)}` : `提交于 ${timeAgo(a.createdAt)}`}
                  </p>
                </div>
                <ApptStatus status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">我咨询过的房源</h2>
        </div>
        {leads.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">还没有咨询记录。</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                <p className="line-clamp-1 text-sm text-slate-800">
                  {l.listing ? (
                    <Link href={`/fang/${l.listing.id}`} className="hover:text-brand-700">
                      {l.listing.title}
                    </Link>
                  ) : (
                    '房源咨询'
                  )}
                </p>
                <span className="text-xs text-slate-400">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card bg-brand-50/60 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-800">想尽快看房？</p>
        <p className="mt-1">
          直接在房源详情页点「预约看房」留个电话，专属经纪人会和你确认时间，
          平台不向购房者收取任何费用。
        </p>
        <Link href="/fang" className="btn-primary btn-sm mt-3">
          浏览在售房源
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <div className="card p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ApptStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: '待确认', cls: 'bg-amber-100 text-amber-700' },
    CONFIRMED: { label: '已确认', cls: 'bg-emerald-100 text-emerald-700' },
    DONE: { label: '已完成', cls: 'bg-slate-100 text-slate-600' },
    CANCELED: { label: '已取消', cls: 'bg-slate-100 text-slate-500' },
  };
  const s = map[status] ?? map.PENDING!;
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>;
}
