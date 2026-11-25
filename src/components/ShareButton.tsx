'use client';

import { useState } from 'react';

type Props = {
  /** 要分享的路径，如 /fang/abc123 */
  path: string;
  refCode?: string | null;
  label?: string;
  className?: string;
  /** 卡片标题，用于弹窗说明 */
  title?: string;
};

/**
 * 分享按钮：给子管理员/访客生成带归属参数的链接与二维码。
 * 带 refCode 时，客户扫码进来的留资会自动算到这个业务员名下。
 */
export default function ShareButton({
  path,
  refCode,
  label = '分享房源',
  className = 'btn-ghost btn-sm',
  title = '分享给客户',
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');

  // 详情页已静态化，服务端拿不到访客的归属 Cookie；这里在客户端兜底读取，
  // 保证游客点"分享"时仍带上把他带进来的那个业务员的推广码。
  const [cookieRef] = useState(() => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)fang_ref=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  });
  const effectiveRef = refCode ?? cookieRef;

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const refLink = effectiveRef ? `${origin}${path}?ref=${effectiveRef}` : `${origin}${path}`;
  const qrSrc = `/api/qr?path=${encodeURIComponent(path)}${effectiveRef ? `&ref=${encodeURIComponent(effectiveRef)}` : ''}`;

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('fail');
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setOpen(false)}
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              {/* 二维码由 /api/qr 生成，微信扫码可直接打开 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="推广二维码" className="h-44 w-44 rounded-lg border border-slate-200" />
            </div>

            {effectiveRef ? (
              <p className="mt-3 text-center text-xs text-slate-500">
                客户扫此码进入后，咨询与留资都会自动归到你的名下
              </p>
            ) : (
              <p className="mt-3 text-center text-xs text-slate-500">扫码即可在手机上打开这套房源</p>
            )}

            <div className="mt-4 space-y-2">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="break-all text-xs text-slate-600">{refLink}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-primary btn-sm" onClick={() => copy(refLink, 'link')}>
                  {copied === 'link' ? '已复制 ✓' : effectiveRef ? '复制我的专属链接' : '复制链接'}
                </button>
                <a
                  className="btn-ghost btn-sm"
                  href={`${qrSrc}&download=1`}
                  download={`qrcode-${effectiveRef || 'link'}.png`}
                >
                  下载二维码
                </a>
              </div>

              {copied === 'fail' && (
                <p className="text-xs text-rose-600">复制失败，请手动长按上方链接复制</p>
              )}

              <p className="text-[11px] leading-relaxed text-slate-400">
                微信里可以直接把链接或二维码图片发给客户；客户通过你的链接留资后，
                你会立刻在「客户线索」里看到。
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
