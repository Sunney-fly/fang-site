import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ListingCard from '@/components/ListingCard';
import LeadForm from '@/components/LeadForm';
import ShareButton from '@/components/ShareButton';
import { prisma, num } from '@/lib/db';
import { recordPageView } from '@/lib/page-track';
import { getCurrentUser } from '@/lib/auth';
import { isStaff } from '@/lib/permissions';
import { maskPhone } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * 经纪人主页，是"客户归属追踪"的落地页之一：
 * 业务员把 /agent/<自己的推广码> 发给客户，客户在这里留资就必然算到他头上。
 */
async function loadAgent(key: string) {
  const byCode = await prisma.agentProfile.findUnique({
    where: { refCode: key },
    select: { userId: true },
  });
  const userId = byCode?.userId ?? key;

  return prisma.user.findFirst({
    where: {
      id: userId,
      status: 'ACTIVE',
      role: { in: ['AGENT', 'ADMIN', 'SUPER_ADMIN'] },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      createdAt: true,
      agentProfile: {
        select: {
          refCode: true,
          title: true,
          area: true,
          contactPhone: true,
          wechatQr: true,
          remark: true,
        },
      },
      listings: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ isTop: 'desc' }, { publishedAt: 'desc' }],
        take: 12,
        select: {
          id: true,
          code: true,
          title: true,
          dealType: true,
          community: true,
          district: true,
          businessArea: true,
          priceWan: true,
          rentYuan: true,
          unitPrice: true,
          area: true,
          layout: true,
          rooms: true,
          floor: true,
          totalFloors: true,
          orientation: true,
          decoration: true,
          buildYear: true,
          isTop: true,
          isFeatured: true,
          viewCount: true,
          images: { select: { url: true }, orderBy: { sort: 'asc' }, take: 1 },
          agent: { select: { id: true, name: true } },
        },
      },
      _count: { select: { listings: { where: { status: 'PUBLISHED' } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const agent = await loadAgent(decodeURIComponent(code)).catch(() => null);
  if (!agent) return { title: '经纪人不存在' };
  return {
    title: `${agent.name} - 认证房产经纪人`,
    description: `${agent.name}${agent.agentProfile?.title ? `（${agent.agentProfile.title}）` : ''}，服务区域：${
      agent.agentProfile?.area ?? '全城'
    }，在售房源 ${agent._count.listings} 套。`,
  };
}

export default async function AgentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const key = decodeURIComponent(code);
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(key)) notFound();

  const agent = await loadAgent(key);
  if (!agent) notFound();

  const user = await getCurrentUser();
  const staff = isStaff(user?.role);

  await recordPageView({
    path: `/agent/${key}`,
    title: `${agent.name} 的主页`,
    userId: user?.id,
    skip: staff,
  });

  const refCode = agent.agentProfile?.refCode ?? null;
  const phone = agent.agentProfile?.contactPhone || agent.phone;
  const showFullPhone = !!user || staff;

  const items = agent.listings.map((l) => ({
    id: l.id,
    code: l.code,
    title: l.title,
    dealType: l.dealType,
    community: l.community,
    district: l.district,
    businessArea: l.businessArea,
    priceWan: num(l.priceWan),
    rentYuan: num(l.rentYuan),
    unitPrice: num(l.unitPrice),
    area: num(l.area),
    layout: l.layout,
    rooms: l.rooms,
    floor: l.floor,
    totalFloors: l.totalFloors,
    orientation: l.orientation,
    decoration: l.decoration,
    buildYear: l.buildYear,
    isTop: l.isTop,
    isFeatured: l.isFeatured,
    viewCount: l.viewCount,
    cover: l.images[0]?.url ?? null,
    tags: [l.decoration, l.orientation].filter(Boolean) as string[],
    agentName: l.agent?.name ?? null,
    agentId: l.agent?.id ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-700">
              {agent.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-slate-900">
                {agent.name}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {agent.agentProfile?.title || '房产顾问'}
                </span>
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                服务区域：{agent.agentProfile?.area || '全城'} · 在售 {agent._count.listings} 套
              </p>
              {agent.agentProfile?.remark && (
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{agent.agentProfile.remark}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {phone && (
                <a href={showFullPhone ? `tel:${phone}` : '/login'} className="btn-primary btn-sm">
                  {showFullPhone ? `电话 ${phone}` : `登录看电话 ${maskPhone(phone)}`}
                </a>
              )}
              {refCode && (
                <ShareButton
                  path={`/agent/${refCode}`}
                  refCode={refCode}
                  label="分享我的主页"
                  className="btn-ghost btn-sm"
                  title="分享经纪人主页"
                />
              )}
            </div>
          </div>

          <h2 className="mt-6 text-base font-semibold text-slate-900">
            TA 的在售房源（{agent._count.listings}）
          </h2>

          {items.length === 0 ? (
            <div className="card mt-3 p-10 text-center text-sm text-slate-500">
              这位经纪人暂时没有在售房源，
              <Link href="/fang" className="text-brand-700 hover:underline">
                看看全站房源
              </Link>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ListingCard key={item.id} item={item} compact />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <LeadForm
            refCode={refCode}
            title={`联系 ${agent.name}`}
            submitText="让 TA 联系我"
            wechatQr={agent.agentProfile?.wechatQr ?? null}
          />

          <div className="card p-5 text-xs leading-relaxed text-slate-500">
            <p className="font-medium text-slate-700">为什么显示这位经纪人？</p>
            <p className="mt-2">
              你通过专属链接进入了 {agent.name} 的主页，因此咨询会直接分配给 TA。
              平台不会把你的联系方式转给其他经纪人。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
