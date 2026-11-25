import Link from 'next/link';
import { prisma, num } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import { formatPrice, maskPhone, timeAgo, LISTING_STATUS_LABEL, LEAD_STATUS_LABEL, LEAD_STATUS_STYLE } from '@/lib/format';
import SourceCodeCreateForm from '@/components/admin/SourceCodeCreateForm';
import ShareButton from '@/components/ShareButton';
import QuickStatusButtons from '@/components/admin/QuickStatusButtons';

export const dynamic = 'force-dynamic';

/**
 * 业务员手机工作台。
 * 设计目标：一只手、一屏内看到"今天该干什么"，两下点击完成一次跟进。
 * 电脑端会提示去完整后台，但这里同样可用。
 */
export default async function AgentWorkbench() {
  const user = await requireStaff();
  const isAgent = user.role === 'AGENT';
  const scope = isAgent ? { ownerId: user.id } : {};

  const profile = await prisma.agentProfile.findUnique({
    where: { userId: user.id },
    select: { refCode: true },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    newLeads,
    todayLeads,
    todayViews,
    totalLeads,
    dealCount,
    myListings,
    recentLeads,
    todayAppts,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...scope, status: 'NEW' } }),
    prisma.lead.count({ where: { ...scope, createdAt: { gte: startOfToday } } }),
    prisma.visitSession.count({
      where: {
        ...(isAgent ? { refUserId: user.id } : {}),
        firstSeenAt: { gte: startOfToday },
      },
    }),
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, status: 'DEAL' } }),
    prisma.listing.findMany({
      where: { ...(isAgent ? { agentId: user.id } : {}), status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: {
        id: true,
        title: true,
        dealType: true,
        priceWan: true,
        rentYuan: true,
        status: true,
        viewCount: true,
        leadCount: true,
        images: { select: { url: true }, orderBy: { sort: 'asc' }, take: 1 },
      },
    }),
    prisma.lead.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
        message: true,
        listing: { select: { title: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { ...scope, status: { in: ['PENDING', 'CONFIRMED'] } },
      orderBy: { expectAt: 'asc' },
      take: 3,
      select: { id: true, name: true, phone: true, expectAt: true, status: true, listing: { select: { title: true } } },
    }),
  ]);

  return (
    <div className="space-y-4">
      {/* 今日概况 */}
      <section className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 p-4 text-white">
        <p className="text-sm text-brand-50/90">
          {user.name}，{greeting()}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-semibold">{todayViews}</p>
            <p className="mt-0.5 text-[11px] text-brand-50/80">今日访客</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{todayLeads}</p>
            <p className="mt-0.5 text-[11px] text-brand-50/80">今日留资</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-200">{newLeads}</p>
            <p className="mt-0.5 text-[11px] text-brand-50/80">待跟进</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-brand-50/80">
          累计客户 {totalLeads} 位 · 已成交 {dealCount} 单
        </p>
      </section>

      {/* 待跟进客户：最重要，放最上面 */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">待跟进客户</h2>
          <Link href="/admin/leads" className="text-sm text-brand-700">
            全部 →
          </Link>
        </div>

        {recentLeads.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            还没有客户。把下面「我的推广」里的链接或二维码发到微信群试试。
          </div>
        ) : (
          <ul className="space-y-2">
            {recentLeads.map((l) => (
              <li key={l.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-slate-900">{l.name || '未留姓名'}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] ${
                          LEAD_STATUS_STYLE[l.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {LEAD_STATUS_LABEL[l.status]}
                      </span>
                      <span className="text-[11px] text-slate-400">{timeAgo(l.createdAt)}</span>
                    </p>
                    {l.listing && (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">意向：{l.listing.title}</p>
                    )}
                    {l.message && (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-400">「{l.message}」</p>
                    )}
                  </div>
                </div>

                {/* 一屏内完成联系：打电话 / 加微信 / 标记已联系 */}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <a href={`tel:${l.phone}`} className="btn-primary btn-sm justify-center">
                    📞 打电话
                  </a>
                  <a
                    href={`sms:${l.phone}`}
                    className="btn-ghost btn-sm justify-center"
                  >
                    💬 发短信
                  </a>
                  <QuickStatusButtons leadId={l.id} status={l.status} />
                </div>
                <p className="mt-1.5 text-center text-[11px] text-slate-400">{maskPhone(l.phone)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 今天的看房安排 */}
      {todayAppts.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">看房安排</h2>
            <Link href="/admin/appointments" className="text-sm text-brand-700">
              全部 →
            </Link>
          </div>
          <ul className="card divide-y divide-slate-100">
            {todayAppts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">
                    {a.name} · {maskPhone(a.phone)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{a.listing?.title ?? '未指定房源'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-slate-700">
                    {a.expectAt ? `${a.expectAt.getMonth() + 1}/${a.expectAt.getDate()} ${String(a.expectAt.getHours()).padStart(2, '0')}:${String(a.expectAt.getMinutes()).padStart(2, '0')}` : '待定'}
                  </p>
                  <a href={`tel:${a.phone}`} className="mt-1 inline-block text-xs text-brand-700">
                    拨打 →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 我的推广 */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-900">我的推广</h2>
        {profile?.refCode ? (
          <div className="card p-3">
            <p className="text-xs text-slate-500">把链接或二维码发给客户，他留的联系方式就永久算你的</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ShareButton
                path={`/agent/${profile.refCode}`}
                refCode={profile.refCode}
                label="分享我的主页"
                className="btn-primary btn-sm justify-center"
                title="我的专属推广码"
              />
              <ShareButton
                path="/fang"
                refCode={profile.refCode}
                label="分享房源列表"
                className="btn-ghost btn-sm justify-center"
                title="分享房源列表"
              />
            </div>
            <p className="mt-2 break-all font-mono text-[11px] text-slate-400">推广码：{profile.refCode}</p>
          </div>
        ) : (
          <div className="card p-3 text-sm text-slate-500">
            还没有推广码，
            <Link href="/admin/m/me" className="text-brand-700">
              去设置
            </Link>
          </div>
        )}
      </section>

      {/* 快捷发房源 */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-900">快速操作</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/admin/m/listings/new" className="card flex items-center justify-center gap-2 p-4 text-sm font-medium text-brand-700">
            ➕ 发布房源
          </Link>
          <Link href="/admin/m/me" className="card flex items-center justify-center gap-2 p-4 text-sm font-medium text-slate-700">
            ⚙️ 我的资料
          </Link>
        </div>
      </section>

      {/* 我的房源（最近 4 套） */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">我的房源</h2>
          <Link href="/admin/m/listings" className="text-sm text-brand-700">
            全部 →
          </Link>
        </div>

        {myListings.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            还没有房源，
            <Link href="/admin/m/listings/new" className="text-brand-700">
              发布第一套
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {myListings.map((l) => (
              <li key={l.id} className="card flex gap-3 p-3">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.images[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-[10px] text-slate-400">无图</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/fang/${l.id}`} className="line-clamp-1 text-sm font-medium text-slate-800">
                    {l.title}
                  </Link>
                  <p className="mt-0.5 text-sm font-semibold text-rose-600">
                    {formatPrice({ dealType: l.dealType, priceWan: num(l.priceWan), rentYuan: num(l.rentYuan) })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {LISTING_STATUS_LABEL[l.status]} · 浏览 {l.viewCount} · 线索 {l.leadCount}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {atLeast(user.role, 'ADMIN') && (
        <section className="pb-2">
          <h2 className="mb-2 text-base font-semibold text-slate-900">新建推广渠道码</h2>
          <SourceCodeCreateForm agents={[]} listings={[]} isAdmin selfId={user.id} />
        </section>
      )}

      <p className="pb-2 text-center text-[11px] text-slate-400">
        手机上用底部导航切换页面 · 电脑上功能更全（表格、批量操作、数据看板）
      </p>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '早点休息，注意身体';
  if (h < 11) return '早上好，今天也要加油';
  if (h < 14) return '中午好，记得吃饭';
  if (h < 18) return '下午好，趁热打铁';
  return '晚上好，及时回访今天的新客户';
}
