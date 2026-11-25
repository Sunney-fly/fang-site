import 'server-only';
import { cookies, headers } from 'next/headers';
import { prisma } from './db';
import { clientIp, readCodeFromCookies, readSid } from './attribution';
import { trackPageView } from './track';

/**
 * 服务端页面访问上报。挂在公开页面布局上，好处：
 *  - 不依赖浏览器 JS，微信内置浏览器/弱网也不会丢数据
 *  - 搜索引擎爬虫访问也照记，能反映真实曝光
 *  - 与客户端 sendBeacon 埋点共用去重逻辑，不会重复计数
 */
export async function recordPageView(opts: {
  path: string;
  title?: string | null;
  listingId?: string | null;
  userId?: string | null;
  /** 后台人员访问不计入，避免自己人刷数据 */
  skip?: boolean;
}): Promise<void> {
  if (opts.skip) return;

  try {
    const jar = await cookies();
    const h = await headers();

    const sid = readSid(jar);
    if (!sid) return; // 中间件没跑到（静态化等），交给客户端埋点兜底

    const code = readCodeFromCookies(jar);

    // 归属在首次带参访问时就写进 Cookie，这里只做解析
    let cookieRefUserId: string | null = null;
    if (code) {
      const sc = await prisma.sourceCode
        .findUnique({ where: { code }, select: { ownerId: true } })
        .catch(() => null);
      cookieRefUserId = sc?.ownerId ?? null;
      if (!cookieRefUserId) {
        const ap = await prisma.agentProfile
          .findUnique({ where: { refCode: code }, select: { userId: true } })
          .catch(() => null);
        cookieRefUserId = ap?.userId ?? null;
      }
    }

    await trackPageView({
      sid,
      path: opts.path,
      title: opts.title ?? null,
      referrer: h.get('referer'),
      refParam: code,
      listingId: opts.listingId ?? null,
      userAgent: h.get('user-agent'),
      ip: clientIp(h),
      userId: opts.userId ?? null,
      cookieRefUserId,
    });
  } catch (e) {
    console.error('[recordPageView]', e);
  }
}
