'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavItem } from '@/lib/permissions';

export default function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const list = (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2 text-sm transition ${
              isActive(item.href)
                ? 'bg-brand-600 font-medium text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* 手机端折叠菜单 */}
      <div className="lg:hidden">
        <button
          type="button"
          className="btn-ghost w-full justify-between"
          onClick={() => setOpen((v) => !v)}
        >
          <span>功能菜单</span>
          <span className="text-slate-400">{open ? '收起 ▲' : '展开 ▼'}</span>
        </button>
        {open && <nav className="card mt-2 p-2">{list}</nav>}
      </div>

      {/* 桌面端侧边栏 */}
      <nav className="hidden w-44 shrink-0 lg:block">
        <div className="card sticky top-20 p-2">{list}</div>
      </nav>
    </>
  );
}
