'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string; icon: string; badge?: number };

/**
 * 业务员手机端底部导航。
 * 只在手机宽度显示，业务员一只手就能在四个最常用的页面之间切换。
 */
export default function MobileTabBar({ badges }: { badges?: { leads?: number; appointments?: number } }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: '/admin', label: '工作台', icon: '🏠' },
    { href: '/admin/m/listings', label: '我的房源', icon: '🏢' },
    { href: '/admin/leads', label: '客户', icon: '👤', badge: badges?.leads },
    { href: '/admin/m/me', label: '我的', icon: '🙋' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    if (href === '/admin/m/me') return pathname.startsWith('/admin/m/me') || pathname.startsWith('/admin/profile');
    if (href === '/admin/m/listings') {
      return pathname.startsWith('/admin/m/listings') || pathname.startsWith('/admin/listings');
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] transition ${
                  active ? 'text-brand-700' : 'text-slate-500'
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span className={active ? 'font-medium' : ''}>{t.label}</span>
                {!!t.badge && t.badge > 0 && (
                  <span className="absolute right-[22%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
                    {t.badge > 99 ? '99+' : t.badge}
                  </span>
                )}
                {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand-600" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
