'use client';

import { useState } from 'react';

/**
 * 一键生成房源海报。
 * 业务员在手机点开 → 长按图片保存 → 发朋友圈/微信群，
 * 海报上的二维码带着他的推广码，客户扫码进来就永久算他的客户。
 */
export default function PosterButton({
  listingId,
  refCode,
  label = '生成海报',
  className = 'btn-ghost btn-sm justify-center',
  title = '房源海报',
}: {
  listingId: string;
  refCode?: string | null;
  label?: string;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const src = `/api/poster?listing=${encodeURIComponent(listingId)}${
    refCode ? `&ref=${encodeURIComponent(refCode)}` : ''
  }`;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        🖼 {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-3" onClick={() => setOpen(false)}>
          <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <button type="button" className="text-slate-400" onClick={() => setOpen(false)} aria-label="关闭">
                ✕
              </button>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              手机上<strong>长按图片</strong>即可保存到相册，然后发到朋友圈或微信群。
            </p>

            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {/* 海报由服务端渲染成图片，自带业务员二维码 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="房源海报" className="w-full" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={`${src}&download=1`}
                download={`房源海报.svg`}
                className="btn-primary btn-sm justify-center"
                onClick={() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
              >
                {copied ? '已开始下载 ✓' : '下载海报'}
              </a>
              <a href={src} target="_blank" rel="noreferrer" className="btn-ghost btn-sm justify-center">
                新窗口打开
              </a>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              海报右下角是你的专属二维码，客户扫码查看房源后，留资会直接分到你名下。
              如果下载后微信里看不到图，可以在「新窗口打开」页面长按保存。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
