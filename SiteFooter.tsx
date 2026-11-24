import Link from 'next/link';
import { SITE_NAME } from '@/lib/format';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-medium text-slate-700">{SITE_NAME}</span>
          <Link href="/fang" className="hover:text-brand-700">
            在售房源
          </Link>
          <Link href="/agent" className="hover:text-brand-700">
            找经纪人
          </Link>
          <Link href="/login" className="hover:text-brand-700">
            登录 / 注册
          </Link>
          <Link href="/admin" className="hover:text-brand-700">
            员工入口
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          本站房源信息由入驻经纪人与平台共同维护，价格为业主委托报价，实际以签约合同为准。
          平台不向购房者收取任何费用。 © {year} {SITE_NAME}
        </p>
      </div>
    </footer>
  );
}
