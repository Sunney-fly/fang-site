'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 电话咨询按钮。
 * 原先服务端根据登录态直接渲染完整号码；现在详情页是静态缓存的，
 * HTML 里只能有脱敏号码，点一下才按需向后端要完整号码（未登录跳登录页）。
 */
export default function PhoneButton({ listingId, masked }: { listingId: string; masked: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onClick() {
    if (phone) {
      window.location.href = `tel:${phone}`;
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/listing-phone?id=${encodeURIComponent(listingId)}`, {
        cache: 'no-store',
      });
      if (r.status === 401) {
        router.push('/login');
        return;
      }
      const d = await r.json().catch(() => null);
      if (d?.phone) {
        setPhone(d.phone);
        window.location.href = `tel:${d.phone}`;
      }
    } catch {
      /* 忽略，用户可再点一次 */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className="btn-primary w-full">
      {phone ? `电话咨询 ${phone}` : `电话咨询 ${masked} · 点击查看`}
    </button>
  );
}
