import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';

// 经纪人列表变动很少，ISR 缓存 5 分钟
export const revalidate = 300;

export const metadata: Metadata = {
  title: '找经纪人',
  description: '平台认证房产经纪人列表，可按服务区域选择专属顾问，一对一跟进看房。',
};

export default async function AgentListPage() {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', status: 'ACTIVE', agentProfile: { isNot: null } },
    select: {
      id: true,
      name: true,
      agentProfile: { select: { refCode: true, title: true, area: true, remark: true } },
      _count: { select: { listings: { where: { status: 'PUBLISHED' } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-semibold text-slate-900">找经纪人</h1>
      <p className="mt-1 text-sm text-slate-500">
        每位经纪人有专属服务链接与二维码，点进任意一位的主页，你的咨询就会直接分配给他。
      </p>

      {agents.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-sm text-slate-500">
          还没有入驻经纪人。管理员可在后台「子管理员」中创建。
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700">
                  {a.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-500">
                    {a.agentProfile?.title || '房产顾问'} · 在售 {a._count.listings} 套
                  </p>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                {a.agentProfile?.remark || `服务区域：${a.agentProfile?.area || '全城'}`}
              </p>

              <Link
                href={`/agent/${a.agentProfile?.refCode ?? a.id}`}
                className="btn-ghost btn-sm mt-4 w-full"
              >
                查看 TA 的房源
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
