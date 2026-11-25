import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma, num } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast } from '@/lib/permissions';
import { formatDate, LISTING_STATUS_LABEL, LISTING_STATUS_STYLE } from '@/lib/format';
import { PageHeader, BackLink, StatusBadge, Badge } from '@/components/admin/ui';
import ListingForm from '@/components/admin/ListingForm';
import { ReviewActions } from '@/components/admin/ListingRowActions';
import { updateListing } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const STATUS_MAP = Object.fromEntries(
  Object.keys(LISTING_STATUS_LABEL).map((k) => [
    k,
    { label: LISTING_STATUS_LABEL[k]!, cls: LISTING_STATUS_STYLE[k] ?? 'bg-slate-100 text-slate-600' },
  ]),
);

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireStaff();

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sort: 'asc' } },
      agent: { select: { id: true, name: true } },
    },
  });

  if (!listing) notFound();

  const isOwner = listing.agentId === user.id;
  const canManage = atLeast(user.role, 'ADMIN');
  if (user.role === 'AGENT' && !isOwner) redirect('/admin/listings?err=forbidden');

  return (
    <div>
      <BackLink href="/admin/listings" label="返回房源列表" />
      <div className="mt-2">
        <PageHeader
          title={`编辑房源 ${listing.code}`}
          desc={`归属子管理员：${listing.agent?.name ?? '平台'} · 创建于 ${formatDate(listing.createdAt)}`}
          action={
            <div className="flex items-center gap-2">
              <StatusBadge status={listing.status} map={STATUS_MAP} />
              <Link href={`/fang/${listing.id}`} className="btn-ghost btn-sm">
                前台预览
              </Link>
            </div>
          }
        />
      </div>

      {listing.status === 'REJECTED' && listing.rejectReason && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="font-medium">这套房源被驳回了</p>
          <p className="mt-1">原因：{listing.rejectReason}</p>
          <p className="mt-1 text-xs text-rose-500">修改后重新提交即可再次送审。</p>
        </div>
      )}

      {canManage && listing.status === 'PENDING' && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">这套房源正在等待审核</p>
          <p className="mt-1 text-xs text-amber-700">审核通过后会立刻在前台上架。</p>
          <div className="mt-3">
            <ReviewActions id={listing.id} />
          </div>
        </div>
      )}

      <ListingForm
        mode="edit"
        action={updateListing}
        code={listing.code}
        extra={
          sp.msg === 'created' ? (
            <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              房源创建成功，可以继续补充信息或图片。
            </div>
          ) : null
        }
        values={{
          id: listing.id,
          title: listing.title,
          dealType: listing.dealType,
          community: listing.community,
          district: listing.district,
          businessArea: listing.businessArea,
          address: listing.address,
          priceWan: num(listing.priceWan),
          rentYuan: num(listing.rentYuan),
          area: num(listing.area),
          layout: listing.layout,
          rooms: listing.rooms,
          halls: listing.halls,
          bathrooms: listing.bathrooms,
          floor: listing.floor,
          totalFloors: listing.totalFloors,
          orientation: listing.orientation,
          decoration: listing.decoration,
          buildingType: listing.buildingType,
          hasElevator: listing.hasElevator,
          buildYear: listing.buildYear,
          ownership: listing.ownership,
          description: listing.description,
          highlights: listing.highlights,
          ownerName: listing.ownerName,
          ownerPhone: listing.ownerPhone,
          isFeatured: listing.isFeatured,
          images: listing.images.map((i) => i.url),
        }}
      />

      {/* 房源相关的客户线索，方便业务员对着房源跟进 */}
      <ListingLeads listingId={listing.id} canSeeAll={canManage || isOwner} />
    </div>
  );
}

async function ListingLeads({ listingId, canSeeAll }: { listingId: string; canSeeAll: boolean }) {
  if (!canSeeAll) return null;

  const leads = await prisma.lead.findMany({
    where: { listingId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      createdAt: true,
      owner: { select: { name: true } },
      sourceCode: { select: { name: true } },
    },
  });

  if (leads.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-slate-900">这套房的咨询客户（{leads.length}）</h2>
      <div className="card mt-3 divide-y divide-slate-100">
        {leads.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm text-slate-800">
                {l.name || '未留姓名'} · <a href={`tel:${l.phone}`} className="text-brand-700 hover:underline">{l.phone}</a>
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDate(l.createdAt)}
                {l.owner ? ` · 归属 ${l.owner.name}` : ''}
                {l.sourceCode ? ` · 来自「${l.sourceCode.name}」` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge cls="bg-slate-100 text-slate-600">{l.status}</Badge>
              <Link href="/admin/leads" className="text-xs text-brand-700 hover:underline">
                去跟进 →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
