'use client';

import { useActionState } from 'react';
import ImageUploader from '@/components/admin/ImageUploader';
import { saveMyProfile, type ActionState } from '@/app/admin/actions';

type Props = {
  refCode?: string | null;
  title?: string | null;
  area?: string | null;
  contactPhone?: string | null;
  wechatQr?: string | null;
  remark?: string | null;
};

/**
 * 业务员自己维护对外展示的资料。
 * 首次保存时后台会自动 upsert 一份 AgentProfile（并生成推广码）。
 */
export default function ProfileForm({ refCode, title, area, contactPhone, wechatQr, remark }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveMyProfile, {});

  return (
    <form action={formAction} className="card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">对外展示资料</h2>
      <p className="mt-1 text-xs text-slate-500">
        {refCode ? (
          <>
            这些信息会显示在你的专属主页 <code className="font-mono">/agent/{refCode}</code> 上，客户留资后会立刻通知你。
          </>
        ) : (
          '保存后系统会自动为你生成推广码和专属主页。'
        )}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">对外称呼</span>
          <input name="title" className="input" maxLength={20} defaultValue={title ?? ''} placeholder="如：王经理" />
        </label>

        <label className="block">
          <span className="label">联系电话</span>
          <input
            name="contactPhone"
            className="input"
            inputMode="numeric"
            maxLength={20}
            defaultValue={contactPhone ?? ''}
            placeholder="客户点「电话咨询」时拨出的号码"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="label">服务区域</span>
          <input
            name="area"
            className="input"
            maxLength={40}
            defaultValue={area ?? ''}
            placeholder="如：朝阳区、通州区"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="label">个人简介 / 备注</span>
          <textarea
            name="remark"
            className="input h-24 resize-none"
            maxLength={500}
            defaultValue={remark ?? ''}
            placeholder="如：深耕朝阳二手房 6 年，熟悉学区房与置换流程。"
          />
        </label>

        <div className="sm:col-span-2">
          <ImageUploader
            name="wechatQr"
            initial={wechatQr ? [wechatQr] : []}
            max={1}
            label="微信二维码"
            hint="上传你的微信/企业微信二维码，客户留资后可直接扫码加你。建议方形图，最多 1 张。"
          />
        </div>
      </div>

      {state.error && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</div>
      )}
      {state.message && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </div>
      )}

      <button type="submit" className="btn-primary btn-sm mt-4" disabled={pending}>
        {pending ? '保存中…' : '保存资料'}
      </button>
    </form>
  );
}
