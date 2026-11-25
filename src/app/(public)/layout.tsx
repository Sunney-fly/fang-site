import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import Tracker from '@/components/Tracker';

/**
 * 公开页布局。
 *
 * 这里刻意不读 Cookie / headers、也不写数据库：
 * Next 一旦在布局里读到请求上下文，整棵子树就只能是动态渲染，
 * 首页和房源详情页就没法做 ISR 缓存——那是这台 2 核机器上 14 页/秒
 * 的唯一原因。登录态交给 <UserMenu />，埋点交给客户端 <Tracker />。
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Tracker />
    </div>
  );
}
