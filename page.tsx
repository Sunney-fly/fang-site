import Link from 'next/link';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDay, timeAgo } from '@/lib/format';
import { EmptyState, PageHeader, RoleBadge, StatCard, StatusBadge, TableWrap } from '@/components/admin/ui';
import Pagination from '@/components/Pagination';
import { resetUserPassword, updateUser } from '../actions';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 20;

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: '正常', cls: 'bg-emerald-100 text-emerald-700' },
  DISABLED: { label: '已停用', cls: 'bg-slate-200 text-slate-500' },
};

/** updateUser / resetUserPassword 出错时会带 query 回跳 */
const ERR_LABEL: Record<string, string> = {
  forbidden: '权限不足：只有超级管理员可以管理管理员 / 超级管理员账号',
  shortpwd: '新密码至少 6 位',
  notfound: '账号不存在或已被删除',
};

/** 与 actions.ts 里的判断保持一致：管理员管不了 ADMIN 和 SUPER_ADMIN */
function canManage(meRole: Role, targetRole: Role): boolean {
  if (meRole === 'SUPER_ADMIN') return true;
  return targetRole !== 'ADMIN' && targetRole !== 'SUPER_ADMIN';
}

/**
 * 用户管理（ADMIN 及以上）：注册用户 + 员工账号。
 * 子管理员进不来：requireRole 会把权限不够的人送回 /admin。
 */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole('ADMIN');
  const sp = await searchParams;

  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 40) : '';
  const pageRaw = Number(typeof sp.page === 'string' ? sp.page : '1');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const errKey = typeof sp.err === 'string' ? sp.err : '';

  const where: Prisma.UserWhereInput = q
    ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
    : {};

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, userCount, staffCount, todayCount, matched, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.user.count({ where: { role: { in: ['AGENT', 'ADMIN', 'SUPER_ADMIN'] } } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { leadsOwned: true } },
      },
    }),
  ]);

  // 收藏表没有反向关系字段，单独聚合一次
  const bookmarkGroups =
    users.length > 0
      ? await prisma.bookmark.groupBy({
          by: ['userId'],
          where: { userId: { in: users.map((u) => u.id) } },
          _count: { _all: true },
        })
      : [];
  const bookmarkMap = new Map(bookmarkGroups.map((b) => [b.userId, b._count._all]));

  const pageCount = Math.max(1, Math.ceil(matched / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <PageHeader
        title="用户管理"
        desc="注册用户与员工账号。只有超级管理员可以管理管理员账号"
        action={
          <form method="get" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              className="input w-48 sm:w-56"
              placeholder="搜索姓名 / 手机号"
              maxLength={40}
            />
            <button type="submit" className="btn-ghost btn-sm">
              搜索
            </button>
            {q && (
              <Link href="/admin/users" className="text-xs text-slate-400 hover:text-brand-700">
                清空
              </Link>
            )}
          </form>
        }
      />

      {errKey && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {ERR_LABEL[errKey] ?? '操作未完成，请检查输入后重试'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="总用户数" value={total} hint="含游客注册与员工账号" />
        <StatCard label="普通用户数" value={userCount} />
        <StatCard label="员工数" value={staffCount} tone="brand" hint="子管理员 + 管理员 + 超管" />
        <StatCard label="今日新增注册" value={todayCount} tone="success" />
      </div>

      {q && (
        <p className="text-xs text-slate-500">
          匹配「{q}」共 {matched} 个账号
        </p>
      )}

      {users.length === 0 ? (
        <EmptyState
          title={q ? `没有匹配「${q}」的账号` : '还没有注册用户'}
          hint={q ? '试试换手机号后几位或姓名里的字。' : '前台用户注册后会出现在这里。'}
          action={
            q ? (
              <Link href="/admin/users" className="btn-ghost btn-sm">
                清空搜索
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <thead className="bg-slate-50">
            <tr>
              <th className="th">姓名</th>
              <th className="th">手机号</th>
              <th className="th">角色</th>
              <th className="th">状态</th>
              <th className="th">注册时间</th>
              <th className="th">最近登录</th>
              <th className="th">收藏</th>
              <th className="th">线索</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const manageable = canManage(me.role, u.role);
              const nextStatus = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

              return (
                <tr key={u.id} className="border-t border-slate-100 align-top">
                  <td className="td whitespace-nowrap font-medium text-slate-900">
                    {u.name}
                    {u.id === me.id && <span className="ml-1 text-xs text-brand-700">（我）</span>}
                  </td>

                  <td className="td whitespace-nowrap font-mono text-xs">{u.phone}</td>

                  <td className="td">
                    <RoleBadge role={u.role} />
                  </td>

                  <td className="td">
                    <StatusBadge status={u.status} map={STATUS_MAP} />
                  </td>

                  <td className="td whitespace-nowrap text-slate-600">{formatDay(u.createdAt)}</td>

                  <td className="td whitespace-nowrap text-slate-500">
                    {u.lastLoginAt ? timeAgo(u.lastLoginAt) : '从未登录'}
                  </td>

                  <td className="td whitespace-nowrap">{bookmarkMap.get(u.id) ?? 0}</td>

                  <td className="td whitespace-nowrap">{u._count.leadsOwned}</td>

                  <td className="td">
                    {manageable ? (
                      <div className="flex flex-col gap-2">
                        <form action={updateUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="status" value={nextStatus} />
                          <button
                            type="submit"
                            className={`btn-sm ${u.status === 'ACTIVE' ? 'btn-ghost text-rose-600' : 'btn-primary'}`}
                          >
                            {u.status === 'ACTIVE' ? '停用账号' : '启用账号'}
                          </button>
                        </form>

                        <form action={updateUser} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={u.id} />
                          <input
                            name="name"
                            defaultValue={u.name}
                            className="input w-24 px-2 py-1 text-xs"
                            maxLength={20}
                            aria-label="新姓名"
                            required
                          />
                          <button type="submit" className="btn-ghost btn-sm">
                            改名
                          </button>
                        </form>

                        <form action={resetUserPassword} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={u.id} />
                          <input
                            name="password"
                            type="text"
                            minLength={6}
                            required
                            className="input w-28 px-2 py-1 text-xs"
                            placeholder="新密码≥6位"
                            aria-label="新密码"
                          />
                          <button type="submit" className="btn-ghost btn-sm">
                            重置
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">仅超级管理员可管理</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        basePath="/admin/users"
        params={{ q: q || undefined }}
      />
    </div>
  );
}
