import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { atLeast, ROLE_LABEL } from '@/lib/permissions';
import { absoluteUrl } from '@/lib/format';
import { PageHeader, StatCard } from '@/components/admin/ui';
import ShareButton from '@/components/ShareButton';
import ProfileForm from '@/components/admin/ProfileForm';

export const dynamic = 'force-dynamic';

/**
 * 我的推广资料：业务员自己看自己用。
 * 推广码 / 专属主页 / 二维码 / 归属客户统计，都在这一页。
 */
export default async function AdminProfilePage() {
  const me = await requireStaff();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [profile, leadTotal, leadMonth, sessionCount, dealCount] = await Promise.all([
    prisma.agentProfile.findUnique({
      where: { userId: me.id },
      select: {
        refCode: true,
        title: true,
        area: true,
        contactPhone: true,
        wechatQr: true,
        remark: true,
      },
    }),
    prisma.lead.count({ where: { ownerId: me.id } }),
    prisma.lead.count({ where: { ownerId: me.id, createdAt: { gte: monthStart } } }),
    prisma.visitSession.count({ where: { refUserId: me.id } }),
    prisma.lead.count({ where: { ownerId: me.id, status: 'DEAL' } }),
  ]);

  const refCode = profile?.refCode ?? null;
  const homePath = refCode ? `/agent/${refCode}` : null;
  const homeUrl = homePath ? absoluteUrl(homePath) : null;
  const qrSrc = homePath
    ? `/api/qr?path=${encodeURIComponent(homePath)}${refCode ? `&ref=${encodeURIComponent(refCode)}` : ''}`
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="我的推广资料"
        desc="把专属链接或二维码发给客户，客户通过它留资后，线索自动归到你名下"
      />

      {!profile && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          你是{ROLE_LABEL[me.role]}账号，可先到
          {atLeast(me.role, 'ADMIN') ? (
            <Link href="/admin/agents" className="mx-1 font-medium underline">
              子管理员页面
            </Link>
          ) : (
            '「子管理员」页面'
          )}
          创建业务员账号；也可以直接保存下面的资料，系统会为你自动生成一份推广资料。
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="名下线索数" value={leadTotal} tone="brand" hint="累计归属到你的客户" />
        <StatCard label="本月新增线索" value={leadMonth} tone="success" />
        <StatCard label="访客会话数" value={sessionCount} hint="带上你推广码进来的访客" />
        <StatCard label="成交数" value={dealCount} hint="线索状态为已成交" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <section className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">我的推广码</h2>

          {refCode ? (
            <>
              <p className="mt-2 break-all font-mono text-2xl font-semibold tracking-wide text-brand-700">
                {refCode}
              </p>

              <div className="mt-4">
                <span className="label">我的专属主页</span>
                <p className="break-all rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-600">
                  {homeUrl}
                </p>
                <p className="hint">复制这个链接发朋友圈或客户群，客户留资就算你的客户。</p>
              </div>

              {qrSrc && (
                <div className="mt-4 flex flex-col items-center">
                  {/* 二维码由 /api/qr 生成，微信扫码可直接打开你的主页并打上归属 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt="我的专属二维码"
                    className="h-40 w-40 rounded-lg border border-slate-200"
                  />
                  <p className="mt-2 text-xs text-slate-500">客户扫码进来即自动归属到你</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <ShareButton
                  path={homePath!}
                  refCode={refCode}
                  label="分享 / 复制链接"
                  className="btn-primary btn-sm"
                  title="分享我的主页"
                />
                <a className="btn-ghost btn-sm" href={`${qrSrc}&download=1`} download={`qrcode-${refCode}.png`}>
                  下载二维码
                </a>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              你还没有推广码。保存右边的资料后系统会自动生成，之后就能分享专属链接和二维码了。
            </p>
          )}

          <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
            归属规则：客户第一次带 <code className="font-mono">ref</code> 参数进来时记录归属，
            之后在有效期内再次访问仍然算你的客户，平台不会把 TA 转给其他经纪人。
          </div>
        </section>

        <ProfileForm
          refCode={refCode}
          title={profile?.title ?? null}
          area={profile?.area ?? null}
          contactPhone={profile?.contactPhone ?? null}
          wechatQr={profile?.wechatQr ?? null}
          remark={profile?.remark ?? null}
        />
      </div>
    </div>
  );
}
