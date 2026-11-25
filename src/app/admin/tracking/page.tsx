import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import { SOURCE_TYPE_LABEL, formatDate, formatDay, maskPhone, timeAgo } from '@/lib/format';
import { absoluteUrl } from '@/lib/format';
import { PageHeader, StatCard, EmptyState, Badge, TableWrap } from '@/components/admin/ui';
import { toggleSourceCode } from '@/app/admin/actions';
import ShareButton from '@/components/ShareButton';
import SourceCodeCreateForm from '@/components/admin/SourceCodeCreateForm';

export const dynamic = 'force-dynamic';

const ERR_TEXT: Record<string, string> = {
  forbidden: '这个渠道码不属于你，无法修改',
};

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requireStaff();
  const sp = await searchParams;
  const isAgent = user.role === 'AGENT';
  const canManage = atLeast(user.role, 'ADMIN');

  const profile = await prisma.agentProfile.findUnique({
    where: { userId: user.id },
    select: { refCode: true, title: true, contactPhone: true },
  });

  const since30 = new Date(Date.now() - 30 * 86400000);

  // 渠道码列表
  const codes = await prisma.sourceCode.findMany({
    where: isAgent ? { ownerId: user.id } : {},
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { name: true } } },
  });

  // 每个渠道码的统计数据
  const codeStats = await Promise.all(
    codes.map(async (c) => {
      const [sessions, leads, deals] = await Promise.all([
        prisma.visitSession.count({ where: { sourceCodeId: c.id } }),
        prisma.lead.count({ where: { sourceCodeId: c.id } }),
        prisma.lead.count({ where: { sourceCodeId: c.id, status: 'DEAL' } }),
      ]);
      return { code: c, sessions, leads, deals };
    }),
  );

  // 子管理员整体归属数据
  const [mySessions30, myLeads30, myTotalLeads, myDeals] = await Promise.all([
    isAgent
      ? prisma.visitSession.count({ where: { refUserId: user.id, firstSeenAt: { gte: since30 } } })
      : prisma.visitSession.count({ where: { firstSeenAt: { gte: since30 } } }),
    isAgent
      ? prisma.lead.count({ where: { ownerId: user.id, createdAt: { gte: since30 } } })
      : prisma.lead.count({ where: { createdAt: { gte: since30 } } }),
    isAgent ? prisma.lead.count({ where: { ownerId: user.id } }) : prisma.lead.count(),
    isAgent ? prisma.lead.count({ where: { ownerId: user.id, status: 'DEAL' } }) : prisma.lead.count({ where: { status: 'DEAL' } }),
  ]);

  const conversion = mySessions30 > 0 ? ((myLeads30 / mySessions30) * 100).toFixed(1) : '0.0';

  // 最近通过推广链接进来的客户
  const recentVisitors = await prisma.visitSession.findMany({
    where: isAgent ? { refUserId: user.id } : { refUserId: { not: null } },
    orderBy: { firstSeenAt: 'desc' },
    take: 10,
    select: {
      id: true,
      sid: true,
      refUserId: true,
      refCode: true,
      landedPath: true,
      device: true,
      pageViews: true,
      hasLead: true,
      firstSeenAt: true,
      refUser: { select: { name: true } },
      sourceCode: { select: { name: true, code: true } },
      leads: { select: { phone: true, status: true, name: true }, take: 1 },
    },
  });

  // 管理员看全站排行
  const leaderboard = canManage
    ? await prisma.user.findMany({
        where: { role: 'AGENT', status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          agentProfile: { select: { refCode: true } },
        },
        orderBy: { name: 'asc' },
      })
    : [];

  const leaderRows = await Promise.all(
    leaderboard.map(async (a) => {
      const [sessions, leads, deals] = await Promise.all([
        prisma.visitSession.count({ where: { refUserId: a.id } }),
        prisma.lead.count({ where: { ownerId: a.id } }),
        prisma.lead.count({ where: { ownerId: a.id, status: 'DEAL' } }),
      ]);
      return { agent: a, sessions, leads, deals };
    }),
  );
  leaderRows.sort((x, y) => y.leads - x.leads || y.sessions - x.sessions);

  // 房源下拉，供创建"海报码"时选择直达房源
  const listingOptions = await prisma.listing.findMany({
    where: { ...(isAgent ? { agentId: user.id } : {}), status: 'PUBLISHED' },
    select: { id: true, title: true, code: true },
    orderBy: { publishedAt: 'desc' },
    take: 200,
  });

  const agentOptions = canManage
    ? await prisma.user.findMany({
        where: { role: { in: ['AGENT', 'ADMIN'] }, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="推广与客户归属"
        desc="把下面的专属链接或二维码发给客户，客户通过它进来后留下的联系方式，就永久算你的客户。"
      />

      {sp.err && ERR_TEXT[sp.err] && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{ERR_TEXT[sp.err]}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="近 30 天访客" value={mySessions30} hint="通过推广链接进入的独立访客" tone="brand" />
        <StatCard label="近 30 天留资" value={myLeads30} hint={`转化率 ${conversion}%`} />
        <StatCard label="累计客户" value={myTotalLeads} />
        <StatCard label="累计成交" value={myDeals} tone="success" />
      </div>

      {/* 我的专属推广入口 */}
      <section className="card mt-4 p-5">
        <h2 className="text-base font-semibold text-slate-900">我的专属推广链接</h2>
        {profile?.refCode ? (
          <>
            <p className="mt-1 text-sm text-slate-500">
              推广码：<span className="font-mono text-base font-semibold text-brand-700">{profile.refCode}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="min-w-[18rem] flex-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                {absoluteUrl(`/agent/${profile.refCode}`)}
              </div>
              <ShareButton
                path={`/agent/${profile.refCode}`}
                refCode={profile.refCode}
                label="分享我的主页"
                className="btn-primary btn-sm"
                title="我的专属推广码"
              />
              <ShareButton
                path="/fang"
                refCode={profile.refCode}
                label="分享房源列表"
                className="btn-ghost btn-sm"
                title="分享房源列表"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              客户扫码或点开链接后，系统会在他的浏览器里记录 90 天归属（可在系统设置里调整）。
              这期间他任何一次留资、预约，都会自动分到你名下，并出现在「客户线索」里。
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            你的账号还没有推广码。
            <Link href="/admin/profile" className="ml-1 text-brand-700 hover:underline">
              去「我的推广资料」完善并生成
            </Link>
          </p>
        )}
      </section>

      {/* 渠道码管理 */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">推广渠道码</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              一个业务员可以有多张名片、多张海报，用不同的码就能看出哪个渠道带来的客户最多。
            </p>
          </div>
        </div>

        <SourceCodeCreateForm
          agents={agentOptions}
          listings={listingOptions}
          isAdmin={canManage}
          selfId={user.id}
        />

        {codeStats.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="还没有推广渠道码" hint="先创建一个名片码或海报码，把链接和二维码发给客户" />
          </div>
        ) : (
          <div className="mt-3">
            <TableWrap>
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">渠道名称</th>
                  <th className="th">推广码</th>
                  <th className="th">类型</th>
                  {!isAgent && <th className="th">归属子管理员</th>}
                  <th className="th">访客</th>
                  <th className="th">留资</th>
                  <th className="th">成交</th>
                  <th className="th">转化率</th>
                  <th className="th">状态</th>
                  <th className="th">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codeStats.map(({ code: c, sessions, leads, deals }) => (
                  <tr key={c.id}>
                    <td className="td">
                      <p className="font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">创建于 {formatDay(c.createdAt)}</p>
                    </td>
                    <td className="td">
                      <span className="font-mono text-xs text-slate-600">{c.code}</span>
                    </td>
                    <td className="td">
                      <Badge cls="bg-slate-100 text-slate-600">{SOURCE_TYPE_LABEL[c.type] ?? c.type}</Badge>
                    </td>
                    {!isAgent && <td className="td whitespace-nowrap">{c.owner?.name ?? '—'}</td>}
                    <td className="td">{sessions}</td>
                    <td className="td font-medium text-brand-700">{leads}</td>
                    <td className="td font-medium text-emerald-700">{deals}</td>
                    <td className="td">{sessions > 0 ? `${((leads / sessions) * 100).toFixed(1)}%` : '—'}</td>
                    <td className="td">
                      {c.enabled ? (
                        <Badge cls="bg-emerald-100 text-emerald-700">启用</Badge>
                      ) : (
                        <Badge cls="bg-slate-200 text-slate-500">已停用</Badge>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1">
                        <ShareButton
                          path={c.landingListingId ? `/fang/${c.landingListingId}` : '/fang'}
                          refCode={c.code}
                          label="分享"
                          className="btn-ghost btn-sm"
                          title={c.name}
                        />
                        <form action={toggleSourceCode}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="btn-ghost btn-sm">
                            {c.enabled ? '停用' : '启用'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        )}
      </section>

      {/* 最近访客轨迹 */}
      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-900">最近通过推广链接进来的访客</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          这些客户已经带着归属标记，还没留资的可以主动跟进（访客身份为匿名，留资后才会显示手机号）。
        </p>

        {recentVisitors.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="暂时还没有访客" hint="把推广链接发到朋友圈、微信群，或直接发给意向客户试试" />
          </div>
        ) : (
          <div className="mt-3">
            <TableWrap>
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">访客标识</th>
                  {!isAgent && <th className="th">归属子管理员</th>}
                  <th className="th">来自渠道</th>
                  <th className="th">落地页</th>
                  <th className="th">浏览页数</th>
                  <th className="th">是否留资</th>
                  <th className="th">首次到访</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentVisitors.map((v) => (
                  <tr key={v.id}>
                    <td className="td font-mono text-xs text-slate-500">{v.sid.slice(0, 12)}…</td>
                    {!isAgent && <td className="td whitespace-nowrap">{v.refUser?.name ?? '—'}</td>}
                    <td className="td text-xs text-slate-500">
                      {v.sourceCode?.name ?? v.refCode ?? '直接访问'}
                    </td>
                    <td className="td max-w-[14rem] truncate text-xs text-slate-500">{v.landedPath ?? '—'}</td>
                    <td className="td">{v.pageViews}</td>
                    <td className="td">
                      {v.hasLead ? (
                        <span className="text-xs text-emerald-700">
                          已留资 {v.leads[0]?.phone ? maskPhone(v.leads[0].phone) : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">未留资</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-xs text-slate-400" title={formatDate(v.firstSeenAt)}>
                      {timeAgo(v.firstSeenAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        )}
      </section>

      {/* 排行榜（管理员） */}
      {canManage && leaderRows.length > 0 && (
        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-900">子管理员获客排行</h2>
          <p className="mt-0.5 text-sm text-slate-500">按留资数排序，用于考核与分配推广资源。</p>
          <div className="mt-3">
            <TableWrap>
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">排名</th>
                  <th className="th">子管理员</th>
                  <th className="th">推广码</th>
                  <th className="th">带来访客</th>
                  <th className="th">留资客户</th>
                  <th className="th">成交</th>
                  <th className="th">转化率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderRows.map((r, i) => (
                  <tr key={r.agent.id}>
                    <td className="td">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="td font-medium text-slate-800">
                      <Link href={`/agent/${r.agent.agentProfile?.refCode ?? ''}`} className="hover:text-brand-700">
                        {r.agent.name}
                      </Link>
                    </td>
                    <td className="td font-mono text-xs text-slate-500">{r.agent.agentProfile?.refCode ?? '—'}</td>
                    <td className="td">{r.sessions}</td>
                    <td className="td font-medium text-brand-700">{r.leads}</td>
                    <td className="td font-medium text-emerald-700">{r.deals}</td>
                    <td className="td">{r.sessions > 0 ? `${((r.leads / r.sessions) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </section>
      )}
    </div>
  );
}
