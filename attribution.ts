import type { Role } from '@prisma/client';

/** 归属 Cookie：记录"这个客户是谁带来的"，是客户归属追踪的核心 */
export const REF_COOKIE = 'fang_ref';
/** 渠道码 Cookie：记录客户来自哪张名片/海报/落地页 */
export const SRC_COOKIE = 'fang_src';
/** 访客会话 Cookie：匿名标识，用于把多次访问串成一条客户轨迹 */
export const SID_COOKIE = 'fang_sid';

/** 归属有效期（天），可用环境变量覆盖 */
export function refCookieDays(): number {
  const n = Number(process.env.REF_COOKIE_DAYS ?? 90);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3650) : 90;
}

/** 会话标识有效期（天），比归属短，仅用于行为统计 */
export const SID_DAYS = 180;

export type Attribution = {
  /** 归属子管理员 User.id */
  agentUserId: string | null;
  /** 命中的渠道码 id */
  sourceCodeId: string | null;
  /** 原始参数，排查归属问题用 */
  rawCode: string | null;
  /** 客户是否已经通过注册账号登录（用于把线索关联到账号） */
  viaRegistered: boolean;
};

/** 中间件与页面共用的 Cookie 读取接口（兼容 NextRequest.cookies 与 cookies()） */
export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function readCodeFromCookies(c: CookieReader): string | null {
  const src = c.get(SRC_COOKIE)?.value?.trim();
  if (src) return src;
  const ref = c.get(REF_COOKIE)?.value?.trim();
  return ref || null;
}

export function readSid(c: CookieReader): string | null {
  return c.get(SID_COOKIE)?.value?.trim() || null;
}

export function roleIsStaff(role?: Role | null): boolean {
  return role === 'AGENT' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/** 生成随机短码：归因参数用，避免用可猜测的连续 ID 暴露业务量 */
export function randomCode(len = 8): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'; // 去掉易混字符
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** 从请求头粗略识别设备，用于后台看"手机端占比" */
export function detectDevice(ua: string | null): { device: string; os: string; browser: string } {
  const s = (ua ?? '').toLowerCase();
  const device = /mobile|android|iphone|ipad|ipod|harmony/.test(s) ? 'mobile' : 'desktop';
  let os = 'unknown';
  if (/windows/.test(s)) os = 'Windows';
  else if (/iphone|ipad|ipod/.test(s)) os = 'iOS';
  else if (/android/.test(s)) os = 'Android';
  else if (/mac os/.test(s)) os = 'macOS';
  else if (/linux/.test(s)) os = 'Linux';
  let browser = 'unknown';
  if (/micromessenger/.test(s)) browser = '微信';
  else if (/edg\//.test(s)) browser = 'Edge';
  else if (/chrome\//.test(s)) browser = 'Chrome';
  else if (/safari\//.test(s) && !/chrome/.test(s)) browser = 'Safari';
  else if (/firefox\//.test(s)) browser = 'Firefox';
  return { device, os, browser };
}

export function clientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? null;
}

/** 把房源参数拼进推广链接，业务员分享用 */
export function withRef(url: string, code: string | null | undefined): string {
  if (!code) return url;
  const [base, hash] = url.split('#');
  const [path, query] = (base ?? '').split('?');
  const params = new URLSearchParams(query ?? '');
  params.set('ref', code);
  return `${path}?${params.toString()}${hash ? '#' + hash : ''}`;
}
