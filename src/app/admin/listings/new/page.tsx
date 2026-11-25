import { createListing } from '@/app/admin/actions';
import { requireStaff } from '@/lib/auth';
import { PageHeader, BackLink } from '@/components/admin/ui';
import ListingForm from '@/components/admin/ListingForm';

export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  const user = await requireStaff();
  const canManage = user.role !== 'AGENT';

  return (
    <div>
      <BackLink href="/admin/listings" label="返回房源列表" />
      <div className="mt-2">
        <PageHeader
          title="发布新房源"
          desc={
            canManage
              ? '管理员发布的房源默认直接上架'
              : '提交后若系统开启审核，房源会先进入待审核，管理员通过后自动上架'
          }
        />
      </div>
      <ListingForm mode="create" action={createListing} />
    </div>
  );
}
