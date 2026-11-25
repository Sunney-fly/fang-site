import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isStaff } from '@/lib/permissions';
import { LogoutButton } from '@/components/LogoutButton';

const NAV = [
  { href: '/my', label: '我的' },
  { href: '/my/bookmarks', label: '我的收藏' },
  { href: '/my/appointments', label: '我的预约' },
];

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/my');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{user.name}，你好</h1>
          <p className="text-sm text-slate-500">
            {user.phone}
            {isStaff(user.role) && (
              <>
                {' · '}
                <Link href="/admin" className="text-brand-700 hover:underline">
                  进入管理后台
                </Link>
              </>
            )}
          </p>
        </div>
        <LogoutButton />
      </div>

      <nav className="mt-5 flex gap-1 border-b border-slate-200 text-sm">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded-t-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5">{children}</div>
    </div>
  );
}
