'use client';

import { useActionState, useState } from 'react';
import { saveNotifySettings, testNotifyAction, type ActionState } from '@/app/admin/actions';

/** 与 lib/notify.ts 的 NOTIFY_KEYS.notifyAdmin 保持一致（客户端不能 import server-only 模块） */
const NOTIFY_ADMIN_KEY = 'notify_admin';

const CHANNELS = [
  {
    value: 'wxpusher',
    label: 'WxPusher（推荐：有独立 App，消息不会被微信折叠）',
    hint: '打开 wxpusher.zjiecode.com 登录 → 创建应用拿到 App Token（AT_ 开头）；关注应用后拿到自己的 UID（UID_ 开头）。两个都填到下面。',
  },
  {
    value: 'serverchan',
    label: 'Server酱（关注公众号即可）',
    hint: '打开 sct.ftqq.com 用微信扫码登录，复制 SendKey 填到下面。',
  },
  {
    value: 'pushplus',
    label: 'PushPlus（备选）',
    hint: '打开 pushplus.plus 微信扫码登录，复制 token 填到下面。',
  },
  {
    value: 'wecom',
    label: '企业微信群机器人（如果以后有企业微信）',
    hint: '在企业微信群 → 群设置 → 群机器人 → 添加，复制 Webhook 地址填到下面。',
  },
  {
    value: 'custom',
    label: '自定义 Webhook（钉钉/飞书/自建服务）',
    hint: '系统会向该地址 POST 一段 JSON：{ title, content, url, at }。',
  },
  { value: 'off', label: '暂不开启', hint: '客户留资后只在后台线索列表里显示，不推送。' },
] as const;

type Values = {
  channel: string;
  wxpusherToken: string;
  wxpusherUids: string;
  wecomWebhook: string;
  serverchanKey: string;
  pushplusToken: string;
  customWebhook: string;
  notifyAdmin: boolean;
  adminPhone: string;
};

export default function NotifySettingsForm({ values, log }: { values: Values; log: string[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveNotifySettings, {});
  const [testState, testAction, testing] = useActionState<ActionState, FormData>(testNotifyAction, {});
  const [channel, setChannel] = useState(values.channel);

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold text-slate-900">客户提醒（推荐开启）</h2>
      <p className="mt-1 text-sm text-slate-500">
        客户留资或预约看房后，<strong>立刻</strong>推送到业务员手机上。
        行业经验是 5 分钟内回电成交率最高，靠人工刷后台很容易错过客户。
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        <div className="space-y-2">
          {CHANNELS.map((c) => (
            <label
              key={c.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                channel === c.value ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="channel"
                value={c.value}
                checked={channel === c.value}
                onChange={() => setChannel(c.value)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{c.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {channel === 'wxpusher' && (
          <>
            <div>
              <label className="label" htmlFor="wxpusherToken">
                WxPusher App Token
              </label>
              <input
                id="wxpusherToken"
                name="wxpusherToken"
                className="input font-mono"
                defaultValue={values.wxpusherToken}
                placeholder="AT_xxxxxxxxxxxxxxxx"
              />
              <p className="hint">在 wxpusher.zjiecode.com 管理后台 → 应用管理里查看</p>
            </div>
            <div>
              <label className="label" htmlFor="wxpusherUids">
                接收人 UID
              </label>
              <input
                id="wxpusherUids"
                name="wxpusherUids"
                className="input font-mono"
                defaultValue={values.wxpusherUids}
                placeholder="UID_xxxxxxxxxxxxxxxx"
              />
              <p className="hint">
                填你自己的 UID 就能收到所有提醒。多个接收人用逗号分隔（例如给老板也发一份）。
                关注应用后可在 WxPusher 后台「用户管理」里看到 UID。
              </p>
            </div>
          </>
        )}

        {channel === 'serverchan' && (
          <div>
            <label className="label" htmlFor="serverchanKey">
              Server酱 SendKey
            </label>
            <input
              id="serverchanKey"
              name="serverchanKey"
              className="input font-mono"
              defaultValue={values.serverchanKey}
              placeholder="SCTxxxxxxxxxxxxxxxx"
            />
          </div>
        )}

        {channel === 'pushplus' && (
          <div>
            <label className="label" htmlFor="pushplusToken">
              PushPlus token
            </label>
            <input
              id="pushplusToken"
              name="pushplusToken"
              className="input font-mono"
              defaultValue={values.pushplusToken}
              placeholder="32 位 token"
            />
          </div>
        )}

        {channel === 'wecom' && (
          <div>
            <label className="label" htmlFor="wecomWebhook">
              企业微信群机器人 Webhook
            </label>
            <input
              id="wecomWebhook"
              name="wecomWebhook"
              className="input font-mono text-xs"
              defaultValue={values.wecomWebhook}
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
            />
          </div>
        )}

        {channel === 'custom' && (
          <div>
            <label className="label" htmlFor="customWebhook">
              自定义 Webhook 地址
            </label>
            <input
              id="customWebhook"
              name="customWebhook"
              className="input font-mono text-xs"
              defaultValue={values.customWebhook}
              placeholder="https://..."
            />
          </div>
        )}

        {/* 非当前渠道的配置用隐藏字段原样带回，切换渠道时不会把已填的密钥清空 */}
        {channel !== 'wxpusher' && <input type="hidden" name="wxpusherToken" value={values.wxpusherToken} />}
        {channel !== 'wxpusher' && <input type="hidden" name="wxpusherUids" value={values.wxpusherUids} />}
        {channel !== 'wecom' && <input type="hidden" name="wecomWebhook" value={values.wecomWebhook} />}
        {channel !== 'serverchan' && <input type="hidden" name="serverchanKey" value={values.serverchanKey} />}
        {channel !== 'pushplus' && <input type="hidden" name="pushplusToken" value={values.pushplusToken} />}
        {channel !== 'custom' && <input type="hidden" name="customWebhook" value={values.customWebhook} />}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name={NOTIFY_ADMIN_KEY}
              defaultChecked={values.notifyAdmin}
              className="h-4 w-4"
            />
            管理员也收到每一条客户提醒
          </label>
          <div>
            <label className="label" htmlFor="adminPhone">
              负责人手机号（仅记录，便于团队交接）
            </label>
            <input
              id="adminPhone"
              name="adminPhone"
              className="input"
              defaultValue={values.adminPhone}
              maxLength={20}
            />
          </div>
        </div>

        {state.ok && state.message && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</div>
        )}
        {state.error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</div>}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? '保存中…' : '保存提醒配置'}
          </button>
        </div>
      </form>

      {/* 测试按钮：独立表单，避免和保存混在一起 */}
      <form action={testAction} className="mt-4 border-t border-slate-100 pt-4">
        {testState.ok && testState.message && (
          <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{testState.message}</div>
        )}
        {testState.error && (
          <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{testState.error}</div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-ghost" disabled={testing}>
            {testing ? '发送中…' : '📲 发送测试提醒'}
          </button>
          <span className="text-xs text-slate-400">
            会按<strong>当前已保存</strong>的配置发送一条消息到你的手机，用完就知道通不通。
          </span>
        </div>
      </form>

      {log.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">最近的提醒记录</p>
          <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            {log.map((line, i) => (
              <li key={i} className="line-clamp-2 break-all">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
