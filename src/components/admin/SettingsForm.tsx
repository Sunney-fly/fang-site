'use client';

import { useActionState } from 'react';
import { saveSettings, type ActionState } from '@/app/admin/actions';
import { SETTING_KEYS } from '@/lib/setting-keys';

type Values = Record<string, string>;

export default function SettingsForm({ values, requireReview }: { values: Values; requireReview: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveSettings, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.ok && state.message && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{state.message}</div>
      )}
      {state.error && <div className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{state.error}</div>}

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">站点信息</h2>
        <p className="mt-1 text-sm text-slate-500">这些信息会展示在前台页脚与联系方式处。</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={SETTING_KEYS.siteName}>
              站点名称
            </label>
            <input
              id={SETTING_KEYS.siteName}
              name={SETTING_KEYS.siteName}
              className="input"
              defaultValue={values[SETTING_KEYS.siteName] ?? ''}
              maxLength={30}
            />
          </div>
          <div>
            <label className="label" htmlFor={SETTING_KEYS.companyName}>
              公司主体名称
            </label>
            <input
              id={SETTING_KEYS.companyName}
              name={SETTING_KEYS.companyName}
              className="input"
              defaultValue={values[SETTING_KEYS.companyName] ?? ''}
              maxLength={60}
            />
          </div>
          <div>
            <label className="label" htmlFor={SETTING_KEYS.contactPhone}>
              客服电话
            </label>
            <input
              id={SETTING_KEYS.contactPhone}
              name={SETTING_KEYS.contactPhone}
              className="input"
              defaultValue={values[SETTING_KEYS.contactPhone] ?? ''}
              maxLength={30}
            />
          </div>
          <div>
            <label className="label" htmlFor={SETTING_KEYS.contactWechat}>
              客服微信号
            </label>
            <input
              id={SETTING_KEYS.contactWechat}
              name={SETTING_KEYS.contactWechat}
              className="input"
              defaultValue={values[SETTING_KEYS.contactWechat] ?? ''}
              maxLength={40}
            />
          </div>
          <div>
            <label className="label" htmlFor={SETTING_KEYS.icp}>
              备案号
            </label>
            <input
              id={SETTING_KEYS.icp}
              name={SETTING_KEYS.icp}
              className="input"
              defaultValue={values[SETTING_KEYS.icp] ?? ''}
              maxLength={60}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor={SETTING_KEYS.notice}>
              首页公告
            </label>
            <textarea
              id={SETTING_KEYS.notice}
              name={SETTING_KEYS.notice}
              className="input h-20 resize-y"
              defaultValue={values[SETTING_KEYS.notice] ?? ''}
              maxLength={500}
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">房源审核与客户归属规则</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name={SETTING_KEYS.requireReview}
              defaultChecked={requireReview}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium">子管理员提交的房源需要审核</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                开启后，子管理员新建或修改的房源会先进入「待审核」，管理员在房源列表里审核通过才会上架前台。
                建议开启，避免业务员乱发房源。管理员自己发布的房源不受影响。
              </span>
            </span>
          </label>

          <div>
            <label className="label" htmlFor={SETTING_KEYS.refPolicy}>
              客户归属规则
            </label>
            <select
              id={SETTING_KEYS.refPolicy}
              name={SETTING_KEYS.refPolicy}
              className="input sm:w-80"
              defaultValue={values[SETTING_KEYS.refPolicy] ?? 'first'}
            >
              <option value="first">首次归属优先（推荐）：客户第一次通过谁的链接进来，就一直算谁</option>
              <option value="last">最后一次点击优先：客户最近一次通过谁的链接进来，就算谁</option>
            </select>
            <p className="hint">
              当前系统实现为首次归属优先并写 Cookie，切换此项需要重启服务生效（代码中 refPolicy 已预留）。
              修改归属 Cookie 有效期请调整 .env 里的 REF_COOKIE_DAYS。
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? '保存中…' : '保存设置'}
        </button>
      </div>
    </form>
  );
}
