import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isStaff, navFor, ROLE_LABEL } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { LogoutButton } from '@/components/LogoutButton';
import AdminNav from '@/components/admin/AdminNav';
import MobileTabBar from '@/components/admin/MobileTabBar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // 游客/普通用户一律挡在后台之外
  if (!user) redirect('/login?next=/admin');
  if (!isStaff(user.role)) redirect('/my');

  const nav = navFor(user.role);
  const isAgent = user.role === 'AGENT';

  // 手机端底部导航上的小红点：待跟进客户、待处理预约
  const [pendingLeads, pendingAppts] = await Promise.all([
    prisma.lead.count({ where: { ...(isAgent ? { ownerId: user.id } : {}), status: 'NEW' } }),
    prisma.appointment.count({
      where: { ...(isAgent ? { ownerId: user.id } : {}), status: 'PENDING' },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              安
            </span>
            <span className="hidden text-sm font-semibold text-slate-900 sm:block">
              {isAgent ? '经纪人工作台' : '管理后台'}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/" className="hidden text-slate-500 hover:text-brand-700 sm:block">
              查看前台
            </Link>
            <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 sm:inline">
              {ROLE_LABEL[user.role]}
            </span>
            <span className="max-w-[6rem] truncate font-medium text-slate-800 sm:max-w-[8rem]">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 lg:flex-row">
        <AdminNav items={nav} />
        {/* 手机端给底部导航留出空间 */}
        <main className="min-w-0 flex-1 pb-24 lg:pb-10">{children}</main>
      </div>

      <MobileTabBar badges={{ leads: pendingLeads, appointments: pendingAppts }} />
    </div>
  );
}
