import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { absoluteUrl } from '@/lib/format';
import ProfileForm from '@/components/admin/ProfileForm';
import ShareButton from '@/components/ShareButton';

export const dynamic = 'force-dynamic';

/**
 * 手机端「我的」：推广码 + 二维码 + 个人资料。
 * 业务员最常干的事——把二维码发给客户——放在最上面最大位置。
 */
export default async function MobileMePage() {
  const user = await requireStaff();

  const [profile, leadCount, dealCount, sessionCount, listings] = await Promise.all([
    prisma.agentProfile.findUnique({
      where: { userId: user.id },
      select: { refCode: true, title: true, area: true, contactPhone: true, wechatQr: true, remark: true },
    }),
    prisma.lead.count({ where: { ownerId: user.id } }),
    prisma.lead.count({ where: { ownerId: user.id, status: 'DEAL' } }),
    prisma.visitSession.count({ where: { refUserId: user.id } }),
    prisma.listing.count({ where: { agentId: user.id, status: 'PUBLISHED' } }),
  ]);

  const refCode = profile?.refCode ?? null;

  return (
    <div className="space-y-3">
      <h1 className="text-base font-semibold text-slate-900">我的</h1>

      {/* 推广二维码：最重要，放最大 */}
      {refCode ? (
        <section className="card p-4 text-center">
          <p className="text-sm font-medium text-slate-800">我的专属推广码</p>
          <p className="mt-0.5 text-xs text-slate-500">客户扫码进来后，他留的联系方式永久算你的</p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr?path=/agent/${refCode}&ref=${refCode}`}
            alt="我的推广二维码"
            className="mx-auto mt-3 h-44 w-44 rounded-lg border border-slate-200"
          />

          <p className="mt-2 font-mono text-lg font-semibold text-brand-700">{refCode}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <ShareButton
              path={`/agent/${refCode}`}
              refCode={refCode}
              label="分享给客户"
              className="btn-primary btn-sm justify-center"
              title="我的专属推广码"
            />
            <a
              href={`/api/qr?path=/agent/${refCode}&ref=${refCode}&download=1`}
              download={`我的推广码-${refCode}.png`}
              className="btn-ghost btn-sm justify-center"
            >
              保存二维码
            </a>
          </div>

          <p className="mt-2 break-all text-[11px] text-slate-400">{absoluteUrl(`/agent/${refCode}`)}</p>
        </section>
      ) : (
        <section className="card p-4 text-center text-sm text-slate-500">
          还没有推广码，填写下面的资料保存后会自动生成。
        </section>
      )}

      {/* 我的数据 */}
      <section className="card p-4">
        <p className="text-sm font-medium text-slate-800">我的成绩</p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xl font-semibold text-slate-900">{listings}</p>
            <p className="text-[11px] text-slate-400">在售房源</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-900">{sessionCount}</p>
            <p className="text-[11px] text-slate-400">带来访客</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-brand-700">{leadCount}</p>
            <p className="text-[11px] text-slate-400">名下客户</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-emerald-600">{dealCount}</p>
            <p className="text-[11px] text-slate-400">已成交</p>
          </div>
        </div>
        <Link href="/admin/tracking" className="btn-ghost btn-sm mt-3 w-full justify-center">
          查看详细推广数据
        </Link>
      </section>

      {/* 资料编辑 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">我的资料</h2>
        <ProfileForm
          refCode={refCode}
          title={profile?.title ?? ''}
          area={profile?.area ?? ''}
          contactPhone={profile?.contactPhone ?? user.phone}
          remark={profile?.remark ?? ''}
          wechatQr={profile?.wechatQr ?? ''}
        />
      </section>

      <p className="pb-2 text-center text-[11px] text-slate-400">
        微信号二维码建议上传个人微信收款码同款的加好友码，客户可以直接长按识别加你
      </p>
    </div>
  );
}
