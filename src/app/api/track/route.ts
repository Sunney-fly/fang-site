import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { clientIp, readCodeFromCookies, SID_COOKIE, randomCode } from '@/lib/attribution';
import { getCurrentUser } from '@/lib/auth';
import { isStaff } from '@/lib/permissions';
import { trackPageView } from '@/lib/track';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { path?: string; title?: string; referrer?: string | null };

/**
 * 埋点接口：记录页面访问、维护访客会话。
 * 客户端用 sendBeacon 调用，永远返回 204，绝不打断页面渲染。
 */
export async function POST(req: NextRequest) {
  // 先保证有 sid，即使后面的写库失败，访客身份也已经捏在 Cookie 里
  let sid = req.cookies.get(SID_COOKIE)?.value ?? null;
  let freshSid = false;
  if (!sid) {
    sid = randomCode(20);
    freshSid = true;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const path = (body.path || '/').slice(0, 190);

    // 后台页面不计入访客统计，避免自己人刷数据
    if (!path.startsWith('/admin')) {
      const headers = req.headers;
      const user = await getCurrentUser().catch(() => null);
      // 员工浏览前台也不计入统计（原先由服务端布局判断，现改到这里统一处理）
      if (user && isStaff(user.role)) {
        return new NextResponse(null, { status: 204 });
      }
      const code = readCodeFromCookies(req.cookies);

      // Cookie 里的归属（第一次带 ref 进来时写入的）→ 解析成子管理员
      let cookieRefUserId: string | null = null;
      if (code) {
        const sc = await prisma.sourceCode
          .findUnique({ where: { code }, select: { ownerId: true } })
          .catch(() => null);
        if (sc?.ownerId) cookieRefUserId = sc.ownerId;
        else {
          const ap = await prisma.agentProfile
            .findUnique({ where: { refCode: code }, select: { userId: true } })
            .catch(() => null);
          cookieRefUserId = ap?.userId ?? null;
        }
      }

      // /fang/<id> 形式的路径，顺手记下浏览的是哪套房
      const maybeId = /^\/fang\/([A-Za-z0-9_-]{5,64})/.exec(path)?.[1] ?? null;
      const listingId = maybeId
        ? (await prisma.listing.findUnique({ where: { id: maybeId }, select: { id: true } }).catch(() => null))?.id ??
          null
        : null;

      await trackPageView({
        sid,
        path,
        title: body.title ?? null,
        referrer: body.referrer ?? null,
        refParam: code,
        listingId,
        userAgent: headers.get('user-agent'),
        ip: clientIp(headers),
        userId: user?.id ?? null,
        cookieRefUserId,
      });
    }
  } catch (e) {
    console.error('[api/track]', e);
  }

  const res = new NextResponse(null, { status: 204 });
  if (freshSid) {
    res.cookies.set(SID_COOKIE, sid!, {
      path: '/',
      maxAge: 180 * 86400,
      sameSite: 'lax',
      httpOnly: false,
    });
  }
  return res;
}
