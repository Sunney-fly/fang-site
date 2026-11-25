'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 访客埋点：页面打开时上报一次，客户端路由切换时再上报一次。
 * 服务端 /api/track 会做去重（同会话同路径 30 分钟内只记一条）、
 * 解析归属、并把员工访问排除在外，所以这里可以放心多发。
 */
export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    const send = () => {
      const payload = JSON.stringify({
        path: window.location.pathname + window.location.search,
        title: document.title,
        referrer: document.referrer || null,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
        } else {
          void fetch('/api/track', { method: 'POST', body: payload, keepalive: true });
        }
      } catch {
        /* 埋点失败静默 */
      }
    };

    send();
    window.addEventListener('popstate', send);
    return () => window.removeEventListener('popstate', send);
  }, [pathname]);

  return null;
}
