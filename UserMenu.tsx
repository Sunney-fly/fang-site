'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogoutButton } from './LogoutButton';

type Me = { name: string; role: string } | null;

const STAFF_ROLES = ['AGENT', 'ADMIN', 'SUPER_ADMIN'];

/**
 * 顶栏右侧的登录态区域。
 * 之所以放到客户端：公开页布局一旦读取 Cookie，Next 会把整页降级为动态渲染，
 * 首页/详情页就没法做静态缓存了（这正是之前单页 55ms、只能 14 页/秒的原因）。
 */
export default function UserMenu() {
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setMe(d?.user ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 首屏未拿到登录态时先占位，避免"登录/注册"闪一下再变
  if (!loaded) {
    return <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-100" aria-hidden />;
  }

  if (me) {
    const isStaff = STAFF_ROLES.includes(me.role);
    return (
      <>
        <Link
          href={isStaff ? '/admin' : '/my'}
          className="hidden text-sm text-slate-600 hover:text-brand-700 sm:block"
        >
          {isStaff ? '管理后台' : '我的'}
        </Link>
        <span className="hidden text-sm text-slate-400 sm:inline">|</span>
        <span className="max-w-[8rem] truncate text-sm font-medium text-slate-800">{me.name}</span>
        <LogoutButton />
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="btn-ghost btn-sm">
        登录
      </Link>
      <Link href="/login?mode=register" className="btn-primary btn-sm">
        注册
      </Link>
    </>
  );
}
