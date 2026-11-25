import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import ListingCard from '@/components/ListingCard';
import { districtCounts, featuredListings, platformStats } from '@/lib/listings';
import { CITY_NAME } from '@/lib/filters';
import { prisma } from '@/lib/db';
import { SITE_NAME } from '@/lib/format';

// 首页整页 ISR 缓存：60 秒内的访问直接命中静态产物，
// 单次渲染成本从约 55ms 降到个位数，是这台机器上提升承载最直接的一刀。
export const revalidate = 60;

export default async function HomePage() {
  const [list, districts, stats, agents] = await Promise.all([
    featuredListings(8),
    districtCounts(),
    platformStats(),
    prisma.user.findMany({
      where: { role: { in: ['AGENT', 'ADMIN'] }, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        agentProfile: { select: { refCode: true, title: true, area: true } },
        _count: { select: { listings: { where: { status: 'PUBLISHED' } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 6,
    }),
  ]);

  return (
    <div>
      {/* 顶部搜索区 */}
      <section className="bg-gradient-to-b from-brand-700 to-brand-600 pb-12 pt-10 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-2xl font-semibold sm:text-3xl">
            {CITY_NAME}真实二手房源，经纪人一对一服务
          </h1>
          <p className="mt-2 text-sm text-brand-50/90 sm:text-base">
            在售 {stats.published} 套房源 · 覆盖 {stats.districts} 个区域 · {stats.agents} 位认证经纪人
          </p>
          <div className="mt-6">
            <SearchBar />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-brand-50/80">
            <span>✓ 房源信息人工核实</span>
            <span>✓ 不向购房者收费</span>
            <span>✓ 支持在线预约看房</span>
          </div>
        </div>
      </section>

      {/* 区域入口 */}
      {districts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-900">按区域找房</h2>
            <Link href="/fang" className="text-sm text-brand-700 hover:underline">
              查看全部房源 →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {districts.slice(0, 8).map((d) => (
              <Link
                key={d.district}
                href={`/fang?district=${encodeURIComponent(d.district)}`}
                className="card flex items-center justify-between px-4 py-3 transition hover:border-brand-300 hover:shadow-md"
              >
                <span className="font-medium text-slate-800">{d.district}</span>
                <span className="text-sm text-slate-400">{d.count} 套</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 精选房源 */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900">精选房源</h2>
          <Link href="/fang?sort=hot" className="text-sm text-brand-700 hover:underline">
            更多热门房源 →
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="card mt-4 p-10 text-center text-sm text-slate-500">
            还没有已上架的房源。如果你是管理员，请到
            <Link href="/admin/listings/new" className="mx-1 text-brand-700 hover:underline">
              后台发布第一套房源
            </Link>
            。
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* 经纪人 */}
      {agents.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-lg font-semibold text-slate-900">专业经纪人</h2>
          <p className="mt-1 text-sm text-slate-500">每位经纪人有专属服务链接，点进去看到的咨询都会对接给他本人</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/agent/${a.agentProfile?.refCode ?? a.id}`}
                className="card flex flex-col items-center gap-2 p-4 text-center transition hover:shadow-md"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700">
                  {a.name.slice(0, 1)}
                </span>
                <span className="text-sm font-medium text-slate-800">{a.name}</span>
                <span className="text-xs text-slate-400">
                  {a.agentProfile?.title || '房产顾问'} · {a._count.listings} 套
                </span>
                {a.agentProfile?.area && (
                  <span className="line-clamp-1 text-[11px] text-slate-400">{a.agentProfile.area}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 转化区 */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="card flex flex-col items-start gap-4 bg-gradient-to-r from-brand-50 to-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              想看房？留下联系方式，{SITE_NAME}经纪人 10 分钟内联系你
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              我们不会把你的号码给第三方，仅用于房源咨询与看房安排。
            </p>
          </div>
          <Link href="/fang" className="btn-primary shrink-0">
            浏览房源并预约
          </Link>
        </div>
      </section>
    </div>
  );
}
