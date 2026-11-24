import { NextResponse, type NextRequest } from 'next/server';
import {
  REF_COOKIE,
  SRC_COOKIE,
  SID_COOKIE,
  SID_DAYS,
  refCookieDays,
  randomCode,
} from '@/lib/attribution';

/**
 * 中间件只做三件"轻活"（Edge 运行时不能连数据库）：
 *  1. 给每个访客发一个匿名 sid
 *  2. 客户第一次带 ?ref= / ?sc= 进来时，把归属参数写进长期 Cookie（首次归属优先，不覆盖）
 *  3. 给需要登录的区域做一次粗粒度重定向（真正的权限校验在服务端再查库）
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const isProd = process.env.NODE_ENV === 'production';

  // 把当前路径透给服务端布局，用于页面访问统计
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-fang-path', url.pathname + (url.search || ''));
  const res = NextResponse.next({ request: { headers: reqHeaders } });

  const cookieOpts = {
    httpOnly: false, // 前端埋点需要读 sid
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
  };

  // 1) 匿名访客标识
  if (!req.cookies.get(SID_COOKIE)?.value) {
    res.cookies.set(SID_COOKIE, randomCode(20), { ...cookieOpts, maxAge: SID_DAYS * 86400 });
  }

  // 2) 归属参数落 Cookie —— 首次归属优先
  const ref = url.searchParams.get('ref')?.trim();
  const sc = url.searchParams.get('sc')?.trim();
  const incoming = sc || ref;

  if (incoming && incoming.length <= 64) {
    const already = req.cookies.get(SRC_COOKIE)?.value || req.cookies.get(REF_COOKIE)?.value;
    if (!already) {
      const maxAge = refCookieDays() * 86400;
      res.cookies.set(REF_COOKIE, incoming, { ...cookieOpts, maxAge });
      if (sc) res.cookies.set(SRC_COOKIE, sc, { ...cookieOpts, maxAge });
      // 落地即带参访问，标记该会话归属（供埋点接口读取）
      res.headers.set('x-fang-ref-source', 'first-touch');
    }
  }

  return res;
}

export const config = {
  // 排除静态资源与 API，避免无谓开销
  matcher: ['/((?!api|_next/static|_next/image|uploads|favicon.ico|robots.txt|sitemap.xml).*)'],
};
