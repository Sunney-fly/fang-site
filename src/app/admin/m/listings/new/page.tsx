import { requireStaff } from '@/lib/auth';
import QuickListingForm from '@/components/admin/QuickListingForm';
import { BackLink } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function QuickNewListingPage() {
  const user = await requireStaff();
  const autoPublish = user.role !== 'AGENT';

  return (
    <div className="space-y-3">
      <BackLink href="/admin/m/listings" label="返回我的房源" />
      <div>
        <h1 className="text-base font-semibold text-slate-900">加房源</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          带 <span className="text-rose-500">*</span> 的是必填，其他可以之后补。
          {autoPublish ? '你是管理员，提交后直接上架。' : '提交后由管理员审核上架。'}
        </p>
      </div>
      <QuickListingForm />
    </div>
  );
}
