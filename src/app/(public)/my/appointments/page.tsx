import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatDate, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '待确认', cls: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: '已确认，经纪人会联系你', cls: 'bg-emerald-100 text-emerald-700' },
  DONE: { label: '已完成', cls: 'bg-slate-100 text-slate-600' },
  CANCELED: { label: '已取消', cls: 'bg-slate-100 text-slate-500' },
};

export default async function MyAppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // 预约表按手机号关联（游客留资时还没有账号）
  const rows = await prisma.appointment.findMany({
    where: { phone: user.phone },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: { select: { id: true, title: true, community: true, district: true } },
      owner: { select: { name: true, agentProfile: { select: { title: true, contactPhone: true } } } },
    },
  });

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">我的预约（{rows.length}）</h2>

      {rows.length === 0 ? (
        <div className="card mt-3 p-10 text-center text-sm text-slate-500">
          还没有预约记录。
          <Link href="/fang" className="ml-1 text-brand-700 hover:underline">
            找套房预约看房
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((a) => {
            const s = STATUS[a.status] ?? STATUS.PENDING!;
            return (
              <li key={a.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {a.listing ? (
                        <Link href={`/fang/${a.listing.id}`} className="hover:text-brand-700">
                          {a.listing.title}
                        </Link>
                      ) : (
                        '看房预约'
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {a.listing?.community}
                      {a.listing?.district ? ` · ${a.listing.district}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      期望时间：{a.expectAt ? formatDate(a.expectAt) : '未指定'}
                    </p>
                    {a.remark && <p className="mt-1 text-sm text-slate-500">备注：{a.remark}</p>}
                    {a.owner && (
                      <p className="mt-2 text-sm text-slate-600">
                        服务经纪人：{a.owner.name}
                        {a.owner.agentProfile?.contactPhone ? ` · ${a.owner.agentProfile.contactPhone}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
                    <p className="mt-2 text-xs text-slate-400">提交于 {timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
