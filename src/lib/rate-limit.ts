/**
 * 极简内存限流。单机部署够用；将来多实例可换 Redis。
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export type RateResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowSec: number): RateResult {
  const now = Date.now();
  const b = store.get(key);

  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, retryAfterSec: 0 };
  }

  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function rateLimitReset(key: string): void {
  store.delete(key);
}

/** 定期清理过期桶，避免内存无限增长 */
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }, 5 * 60 * 1000);
  // 不要因为这个定时器阻止 Node 退出
  if (typeof timer === 'object' && 'unref' in timer) (timer as { unref: () => void }).unref();
}
