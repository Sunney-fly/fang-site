'use client';

import { useState } from 'react';

type Props = {
  listingId?: string;
  /** 归属子管理员的推广码，随表单一起提交，确保线索落到正确的人 */
  refCode?: string | null;
  /** 紧凑模式：嵌在卡片里 */
  compact?: boolean;
  title?: string;
  submitText?: string;
  /** 提交成功后是否展示微信二维码引导 */
  wechatQr?: string | null;
};

const PHONE_RE = /^1[3-9]\d{9}$/;

export default function LeadForm({
  listingId,
  refCode,
  compact = false,
  title = '预约看房 / 咨询',
  submitText = '免费咨询，马上联系我',
  wechatQr,
}: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wechat, setWechat] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // 详情页已静态化，服务端拿不到访客归属 Cookie，这里客户端兜底读取，
  // 保证留资时仍能落到把客户带进来的那个业务员名下。
  const [cookieRef] = useState(() => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)fang_ref=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  });
  const effectiveRef = refCode ?? cookieRef ?? '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!PHONE_RE.test(phone.trim())) {
      setError('请输入正确的 11 位手机号');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          wechat: wechat.trim(),
          message: message.trim(),
          listingId: listingId ?? '',
          refCode: effectiveRef,
          source: 'FORM',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || '提交失败，请稍后重试');
        return;
      }
      setDone(true);
    } catch {
      setError('网络异常，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={`card ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            ✓
          </span>
          <div>
            <p className="font-medium text-slate-900">提交成功，我们马上联系你</p>
            <p className="mt-1 text-sm text-slate-500">
              专属经纪会尽快与你电话联系，请留意陌生来电。你的号码仅用于本次房源咨询。
            </p>
            {wechatQr && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={wechatQr} alt="经纪人微信" className="h-32 w-32 rounded-lg border border-slate-200" />
                <p className="mt-1 text-xs text-slate-500">也可以直接扫码加微信</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`card ${compact ? 'p-4' : 'p-5'}`}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">留下手机号，经纪人会尽快与你联系（不收取任何费用）</p>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            placeholder="怎么称呼"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="微信号（选填）"
            maxLength={40}
            value={wechat}
            onChange={(e) => setWechat(e.target.value)}
          />
        </div>

        <input
          className="input"
          inputMode="numeric"
          placeholder="手机号（必填）"
          maxLength={11}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          required
        />

        <textarea
          className="input h-20 resize-none"
          placeholder="想了解什么？（选填）例如：这套房能看吗？首付大概多少？"
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? '提交中…' : submitText}
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        提交即表示同意平台将你的联系方式提供给该房源的服务经纪人，仅用于房源咨询与看房安排。
      </p>
    </form>
  );
}
