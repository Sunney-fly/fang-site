import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDay } from '@/lib/format';
import { Badge, EmptyState, PageHeader, RoleBadge, StatCard, TableWrap } from '@/components/admin/ui';
import ShareButton from '@/components/ShareButton';
import AgentCreateForm from '@/components/admin/AgentCreateForm';
import { resetUserPassword, updateAgentProfile } from '../actions';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

/** updateAgentProfile / resetUserPassword 出错时会带 query 回跳，这里翻译成人话 */
const ERR_LABEL: Record<string, string> = {
  badcode: '推广码只能是 3-32 位字母、数字、下划线或中划线',
  codeused: '这个推广码已经被别人占用了，换一个试试',
  forbidden: '没有权限操作这个账号',
  shortpwd: '新密码至少 6 位',
  notfound: '账号不存在或已被删除',
};

/**
 * 子管理员管理（ADMIN 及以上）。
 * 子管理员进不来：requireRole 会把权限不够的人送回 /admin。
 */
export default async function AdminAgentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole('ADMIN');
  const sp = await searchParams;
  const errKey = typeof sp.err === 'string' ? sp.err : '';

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agents = await prisma.user.findMany({
    where: { role: { in: ['AGENT', 'ADMIN'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      agentProfile: {
        select: { refCode: true, title: true, area: true, contactPhone: true, remark: true },
      },
      _count: {
        select: {
          listings: { where: { status: 'PUBLISHED' } },
          leadsOwned: true,
        },
      },
    },
  });

  const agentIds = agents.map((a) => a.id);

  // 本月新增线索：按归属人聚合一次，避免每行都查库
  const [monthLeads, codeCount] = await Promise.all([
    agentIds.length > 0
      ? prisma.lead.groupBy({
          by: ['ownerId'],
          where: { ownerId: { in: agentIds }, createdAt: { gte: monthStart } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { ownerId: string | null; _count: { _all: number } }[]),
    prisma.sourceCode.count({ where: { type: 'AGENT_CARD', enabled: true } }),
  ]);

  const monthLeadMap = new Map<string, number>();
  for (const g of monthLeads) {
    if (g.ownerId) monthLeadMap.set(g.ownerId, g._count._all);
  }
  const monthLeadTotal = monthLeads.reduce((sum, g) => sum + g._count._all, 0);
  const activeCount = agents.filter((a) => a.status === 'ACTIVE').length;

  // 新建账号的上级候选：超管可以挂到任意管理员下面，其他人只能挂自己
  const parentRows: { id: string; name: string; role: Role }[] =
    me.role === 'SUPER_ADMIN'
      ? await prisma.user.findMany({
          where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, role: true },
        })
      : [{ id: me.id, name: me.name, role: me.role }];

  const canCreateAdmin = me.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-4">
      <PageHeader
        title="子管理员"
        desc="每位子管理员的专属推广码决定了客户归属，客户通过谁的链接进来的，留资就归谁"
      />

      {errKey && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {ERR_LABEL[errKey] ?? '操作未完成，请检查输入后重试'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="子管理员总数" value={agents.length} hint="含管理员账号" />
        <StatCard label="在职" value={activeCount} tone="success" hint="状态为正常" />
        <StatCard label="本月新增线索" value={monthLeadTotal} tone="brand" hint="名下线索当月新增之和" />
        <StatCard label="推广码数量" value={codeCount} hint="启用中的业务员名片码" />
      </div>

      <AgentCreateForm canCreateAdmin={canCreateAdmin} parents={parentRows} defaultParentId={me.id} />

      {agents.length === 0 ? (
        <EmptyState
          title="还没有子管理员账号"
          hint="用上面的表单建一个业务员账号，系统会自动给 TA 发一个专属推广码。"
        />
      ) : (
        <TableWrap>
          <thead className="bg-slate-50">
            <tr>
              <th className="th">姓名</th>
              <th className="th">手机号</th>
              <th className="th">角色</th>
              <th className="th">推广码</th>
              <th className="th">服务区域</th>
              <th className="th">状态</th>
              <th className="th">已发布房源</th>
              <th className="th">名下线索</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const p = a.agentProfile;
              const refCode = p?.refCode ?? null;
              const month = monthLeadMap.get(a.id) ?? 0;

              return (
                <tr key={a.id} className="border-t border-slate-100 align-top">
                  <td className="td whitespace-nowrap font-medium text-slate-900">
                    {a.name}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {formatDay(a.createdAt)} 加入
                    </span>
                  </td>

                  <td className="td whitespace-nowrap font-mono text-xs">{a.phone}</td>

                  <td className="td">
                    <RoleBadge role={a.role} />
                  </td>

                  <td className="td">
                    {refCode ? (
                      <div className="min-w-[12rem]">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                            {refCode}
                          </code>
                          <ShareButton
                            path={`/agent/${refCode}`}
                            refCode={refCode}
                            label="推广"
                            title="分享 TA 的主页"
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          点「推广」可复制链接、下载二维码
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">/agent/{refCode}</p>
                      </div>
                    ) : (
                      <Badge cls="bg-amber-100 text-amber-700">未生成推广码</Badge>
                    )}
                  </td>

                  <td className="td whitespace-nowrap text-slate-600">{p?.area || '未填写'}</td>

                  <td className="td whitespace-nowrap">
                    <Badge
                      cls={
                        a.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-500'
                      }
                    >
                      {a.status === 'ACTIVE' ? '在职' : '已停用'}
                    </Badge>
                  </td>

                  <td className="td whitespace-nowrap">{a._count.listings} 套</td>

                  <td className="td whitespace-nowrap">
                    {a._count.leadsOwned} 条
                    {month > 0 && <span className="ml-1 text-xs text-emerald-600">本月 +{month}</span>}
                  </td>

                  <td className="td">
                    <div className="flex flex-col gap-2">
                      {p ? (
                        <details>
                          <summary className="btn-ghost btn-sm w-fit cursor-pointer list-none">
                            编辑资料
                          </summary>
                          <form
                            action={updateAgentProfile}
                            className="mt-2 w-64 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            <input type="hidden" name="userId" value={a.id} />

                            <label className="block">
                              <span className="label text-xs">推广码</span>
                              <input
                                name="refCode"
                                defaultValue={refCode ?? ''}
                                className="input font-mono"
                                placeholder="3-32 位字母数字"
                              />
                              <span className="hint">改动后旧链接失效，请谨慎</span>
                            </label>

                            <label className="block">
                              <span className="label text-xs">对外称呼</span>
                              <input
                                name="title"
                                defaultValue={p.title ?? ''}
                                className="input"
                                placeholder="如：王经理"
                              />
                            </label>

                            <label className="block">
                              <span className="label text-xs">服务区域</span>
                              <input
                                name="area"
                                defaultValue={p.area ?? ''}
                                className="input"
                                placeholder="如：朝阳区、通州区"
                              />
                            </label>

                            <label className="block">
                              <span className="label text-xs">对外电话</span>
                              <input
                                name="contactPhone"
                                defaultValue={p.contactPhone ?? ''}
                                className="input"
                                inputMode="numeric"
                                maxLength={20}
                              />
                            </label>

                            <label className="block">
                              <span className="label text-xs">备注</span>
                              <textarea
                                name="remark"
                                defaultValue={p.remark ?? ''}
                                className="input h-16 resize-none"
                                maxLength={500}
                                placeholder="内部备注，仅后台可见"
                              />
                            </label>

                            <button type="submit" className="btn-primary btn-sm w-full">
                              保存资料
                            </button>
                          </form>
                        </details>
                      ) : (
                        <p className="max-w-[13rem] text-xs text-slate-400">
                          管理员账号没有推广资料，本人可在「我的推广资料」里创建
                        </p>
                      )}

                      <details>
                        <summary className="btn-ghost btn-sm w-fit cursor-pointer list-none">
                          重置密码
                        </summary>
                        <form
                          action={resetUserPassword}
                          className="mt-2 w-64 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <input type="hidden" name="id" value={a.id} />
                          <label className="block">
                            <span className="label text-xs">新密码</span>
                            <input
                              name="password"
                              type="password"
                              minLength={6}
                              required
                              className="input"
                              placeholder="至少 6 位"
                            />
                          </label>
                          <button type="submit" className="btn-danger btn-sm w-full">
                            确认重置
                          </button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
