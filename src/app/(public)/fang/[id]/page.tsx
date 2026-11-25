import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Gallery from '@/components/Gallery';
import LeadForm from '@/components/LeadForm';
import ShareButton from '@/components/ShareButton';
import PhoneButton from '@/components/PhoneButton';
import StaffPoster from '@/components/StaffPoster';
import ListingCard from '@/components/ListingCard';
import { getListingDetail } from '@/lib/listings';
import { SITE_NAME, SITE_URL, formatArea, formatFloor, formatPrice, formatUnitPrice, maskPhone } from '@/lib/format';
import { prisma, num } from '@/lib/db';

// 房源详情页是流量入口，整页 ISR 缓存 60 秒。
// 为此这里不再读取 Cookie/登录态（页面因此对所有访客一致），
// 登录相关能力交给客户端组件：顶栏 <UserMenu/>、电话 <PhoneButton/>、海报 <StaffPoster/>。
export const revalidate = 60;

const ID_RE = /^[A-Za-z0-9_-]{5,64}$/;

/**
 * 生成 schema.org 结构化数据。
 * 二手房属于 RealEstateListing，成交方式分"出售/出租"。
 * 有意不编造 aggregateRating —— 虚假评分会被搜索引擎处罚。
 */
function buildJsonLd(input: {
  id: string;
  code: string;
  title: string;
  description: string;
  community: string;
  district: string | null;
  businessArea: string | null;
  dealType: string;
  priceWan: number | null;
  rentYuan: number | null;
  area: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  buildYear: number | null;
  images: string[];
  agentName: string | null;
}) {
  const url = `${SITE_URL}/fang/${input.id}`;
  const isRent = input.dealType === 'RENT';

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: input.title,
    description: input.description.slice(0, 500),
    url,
    sku: input.code,
    image: input.images.slice(0, 6).map((src) => (src.startsWith('http') ? src : `${SITE_URL}${src}`)),
    datePosted: new Date().toISOString().slice(0, 10),
    ...(input.area
      ? {
          floorSize: {
            '@type': 'QuantitativeValue',
            value: input.area,
            unitCode: 'MTK',
          },
        }
      : {}),
    ...(input.rooms
      ? {
          numberOfRooms: input.rooms,
          numberOfBathroomsTotal: input.bathrooms ?? undefined,
        }
      : {}),
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CN',
      addressRegion: input.district ?? undefined,
      addressLocality: input.businessArea ?? input.district ?? undefined,
      streetAddress: input.community,
    },
    ...(input.buildYear ? { yearBuilt: input.buildYear } : {}),
    ...(isRent
      ? {
          offers: {
            '@type': 'Offer',
            price: input.rentYuan ?? undefined,
            priceCurrency: 'CNY',
            availability: 'https://schema.org/InStock',
            businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
          },
        }
      : {
          offers: {
            '@type': 'Offer',
            price: input.priceWan ? input.priceWan * 10000 : undefined,
            priceCurrency: 'CNY',
            availability: 'https://schema.org/InStock',
            businessFunction: 'http://purl.org/goodrelations/v1#Sell',
          },
        }),
    ...(input.agentName
      ? {
          provider: {
            '@type': 'RealEstateAgent',
            name: input.agentName,
          },
        }
      : {}),
    ...(input.floor !== null && input.totalFloors
      ? {
          additionalProperty: [
            {
              '@type': 'PropertyValue',
              name: '楼层',
              value: `${input.floor}/${input.totalFloors} 层`,
            },
          ],
        }
      : {}),
  };
}

/**
 * 动态段路由必须显式给出 generateStaticParams，Next 才会把它注册成 ISR：
 * 构建时预渲染在售房源，之后每 60 秒后台再生；
 * 构建后新上架的房源会走 dynamicParams 兜底，首次访问渲染并同样缓存。
 */
export async function generateStaticParams() {
  const rows = await prisma.listing
    .findMany({ where: { status: 'PUBLISHED' }, select: { id: true }, take: 300 })
    .catch(() => []);
  return rows.map((r) => ({ id: r.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!ID_RE.test(id)) return { title: '房源不存在' };
  const data = await getListingDetail(id).catch(() => null);
  if (!data) return { title: '房源不存在' };
  const l = data.listing;
  const price = formatPrice({ dealType: l.dealType, priceWan: num(l.priceWan), rentYuan: num(l.rentYuan) });
  return {
    title: `${l.title} ${price}`,
    description: `${l.community} ${l.layout ?? ''} ${formatArea(num(l.area))} ${price}。${
      l.highlights?.slice(0, 60) ?? ''
    }`.slice(0, 150),
    openGraph: {
      title: `${l.title} ${price}`,
      images: l.images[0]?.url ? [l.images[0].url] : undefined,
    },
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();

  const data = await getListingDetail(id);
  if (!data) notFound();

  const { listing: l, similar } = data;
  // 未上架房源一律不出现在公开页（员工在后台 /admin/listings/[id] 里编辑预览）
  if (l.status !== 'PUBLISHED') notFound();

  const price = formatPrice({ dealType: l.dealType, priceWan: num(l.priceWan), rentYuan: num(l.rentYuan) });
  const unit = formatUnitPrice({
    dealType: l.dealType,
    unitPrice: num(l.unitPrice),
    priceWan: num(l.priceWan),
    area: num(l.area),
  });

  const highlights = (l.highlights ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const detailRows: Array<[string, string]> = [
    ['户型', l.layout ?? '--'],
    ['建筑面积', formatArea(num(l.area))],
    ['所在楼层', formatFloor(l.floor, l.totalFloors)],
    ['朝向', l.orientation ?? '--'],
    ['装修', l.decoration ?? '--'],
    ['建筑类型', l.buildingType ?? '--'],
    ['电梯', l.hasElevator === null ? '--' : l.hasElevator ? '有' : '无'],
    ['建成年代', l.buildYear ? `${l.buildYear} 年` : '--'],
    ['产权', l.ownership ?? '--'],
    ['所在区域', [l.district, l.businessArea].filter(Boolean).join(' · ') || '--'],
    ['小区', l.community],
  ];

  const agent = l.agent;
  const agentTitle = agent?.agentProfile?.title || '房产顾问';
  // 电话：游客看到脱敏号码，登录用户和员工看到完整号码
  const agentPhone = agent?.agentProfile?.contactPhone || agent?.phone || null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* 结构化数据：让搜索引擎把房源以"富摘要"形式展示（价格、户型、面积直接出现在搜索结果里） */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd({
          id: l.id,
          code: l.code,
          title: l.title,
          description: l.description ?? l.title,
          community: l.community,
          district: l.district,
          businessArea: l.businessArea,
          dealType: l.dealType,
          priceWan: num(l.priceWan),
          rentYuan: num(l.rentYuan),
          area: num(l.area),
          rooms: l.rooms,
          bathrooms: l.bathrooms,
          floor: l.floor,
          totalFloors: l.totalFloors,
          buildYear: l.buildYear,
          images: l.images.map((i) => i.url),
          agentName: agent?.name ?? null,
        })) }}
      />
      <nav className="mb-4 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-700">
          首页
        </Link>
        <span className="mx-1">/</span>
        <Link href={`/fang?dealType=${l.dealType}`} className="hover:text-brand-700">
          {l.dealType === 'RENT' ? '租房' : '二手房'}
        </Link>
        {l.district && (
          <>
            <span className="mx-1">/</span>
            <Link href={`/fang?district=${encodeURIComponent(l.district)}`} className="hover:text-brand-700">
              {l.district}
            </Link>
          </>
        )}
        <span className="mx-1">/</span>
        <span className="text-slate-400">{l.code}</span>
      </nav>

      {l.status !== 'PUBLISHED' && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          当前房源状态为「{l.status === 'PENDING' ? '待审核' : l.status === 'DRAFT' ? '草稿' : l.status === 'OFFLINE' ? '已下架' : l.status === 'SOLD' ? '已成交' : '已驳回'}」，
          仅你自己和管理员可见，客户看不到。
          {l.rejectReason ? `驳回原因：${l.rejectReason}` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* 左侧主体 */}
        <div>
          <Gallery images={l.images.map((i) => i.url)} alt={l.title} />

          <div className="card mt-4 p-5">
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{l.title}</h1>

            <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
              <span className="text-2xl font-bold text-rose-600">{price}</span>
              {unit && <span className="text-sm text-slate-500">{unit}</span>}
              <span className="tag-brand">{l.dealType === 'RENT' ? '出租' : '出售'}</span>
              {l.isFeatured && <span className="tag-brand">精选</span>}
              {l.ownership && <span className="tag">{l.ownership}</span>}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <span>{l.layout ?? '户型待补充'}</span>
              <span>{formatArea(num(l.area))}</span>
              <span>{formatFloor(l.floor, l.totalFloors)}</span>
              <span>{l.orientation ?? '朝向待补充'}</span>
              <span>{l.decoration ?? '装修待补充'}</span>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              房源编号 {l.code} · 浏览 {l.viewCount} 次 · 咨询 {l.leadCount} 次
            </div>
          </div>

          {highlights.length > 0 && (
            <div className="card mt-4 p-5">
              <h2 className="text-base font-semibold text-slate-900">房源卖点</h2>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 text-brand-600">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card mt-4 p-5">
            <h2 className="text-base font-semibold text-slate-900">房源详情</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {detailRows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="mt-0.5 text-sm text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>

            {l.description && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-medium text-slate-700">房源描述</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {l.description}
                </p>
              </div>
            )}

            {/* 业主姓名/电话属于内部信息，公开页（已静态缓存）一律不渲染，员工在后台查看 */}

            {l.address && (
              <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
                小区地址：{[l.district, l.businessArea, l.address].filter(Boolean).join(' ')}
              </p>
            )}
          </div>

          {similar.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-slate-900">相似房源</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {similar.map((s) => (
                  <ListingCard key={s.id} item={s} compact />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧转化栏 */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {agent ? (
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700">
                  {agent.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{agent.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {agentTitle}
                    {agent.agentProfile?.area ? ` · 服务 ${agent.agentProfile.area}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {agentPhone ? (
                  <PhoneButton listingId={l.id} masked={maskPhone(agentPhone)} />
                ) : (
                  <p className="text-sm text-slate-500">该经纪暂未填写联系电话</p>
                )}

                {agent.agentProfile?.refCode && (
                  <Link
                    href={`/agent/${agent.agentProfile.refCode}`}
                    className="btn-ghost w-full"
                  >
                    看 TA 的全部房源
                  </Link>
                )}

                <ShareButton
                  path={`/fang/${l.id}`}
                  refCode={agent.agentProfile?.refCode ?? null}
                  label="分享这套房给客户"
                  className="btn-ghost w-full"
                  title="分享房源"
                />

                <StaffPoster listingId={l.id} />
              </div>
            </div>
          ) : (
            <div className="card p-5 text-sm text-slate-500">该房源暂未分配经纪人</div>
          )}

          <LeadForm
            listingId={l.id}
            refCode={agent?.agentProfile?.refCode ?? null}
            title="预约看房"
            submitText="提交，安排看房"
            wechatQr={agent?.agentProfile?.wechatQr ?? null}
          />
        </aside>
      </div>
    </div>
  );
}
