import Link from 'next/link';
import { SITE_NAME } from '@/lib/format';
import UserMenu from './UserMenu';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            安
          </span>
          <span className="text-base font-semibold text-slate-900">{SITE_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-slate-600 sm:flex">
          <Link href="/fang" className="rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
            在售房源
          </Link>
          <Link href="/fang?dealType=RENT" className="rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
            租房
          </Link>
          <Link href="/agent" className="rounded-md px-3 py-1.5 hover:bg-slate-100 hover:text-slate-900">
            找经纪人
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
