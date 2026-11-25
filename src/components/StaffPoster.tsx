'use client';

import { useEffect, useState } from 'react';
import PosterButton from './admin/PosterButton';

const STAFF_ROLES = ['AGENT', 'ADMIN', 'SUPER_ADMIN'];

/**
 * 房源海报按钮：只有员工能看到（详情页已静态化，登录态改为客户端判断）。
 */
export default function StaffPoster({ listingId }: { listingId: string }) {
  const [refCode, setRefCode] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.user) return;
        if (STAFF_ROLES.includes(d.user.role)) {
          setStaff(true);
          setRefCode(d.user.refCode ?? null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!staff) return null;

  return (
    <PosterButton
      listingId={listingId}
      refCode={refCode}
      label="生成房源海报"
      className="btn-ghost w-full"
      title="房源海报"
    />
  );
}
