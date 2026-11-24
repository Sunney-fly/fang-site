import 'server-only';
import { prisma } from './db';
import { detectDevice } from './attribution';

export type TrackInput = {
  sid: string | null;
  path: string;
  title?: string | null;
  referrer?: string | null;
  refParam?: string | null;
  listingId?: string | null;
  userAgent: string | null;
  ip: string | null;
  /** 已登录用户 id（可选） */
  userId?: string | null;
  /** Cookie 里带过来的归属，优先于本次参数 */
  cookieRefUserId?: string | null;
};

/**
 * 记录一次页面访问并维护访客会话。
 * 设计原则：埋点失败绝不影响页面，所有异常都吞掉只打日志。
 */
export async function trackPageView(input: TrackInput): Promise<void> {
  try {
    const { device, os, browser } = detectDevice(input.userAgent);
    const now = new Date();

    // 1) 找到或创建访客会话（以 sid Cookie 为准）
    let sessionId: string | null = null;
    let refUserId = input.cookieRefUserId ?? null;
    let sourceCodeId: string | null = null;

    if (input.sid) {
      let session = await prisma.visitSession.findUnique({
        where: { sid: input.sid },
        select: { id: true, refUserId: true, sourceCodeId: true },
      });
      if (!session) {
        // 首次落地：如果带着 ref/sc 参数，解析出归属
        const resolved = await resolveCode(input.refParam ?? null);
        try {
          session = await prisma.visitSession.create({
            data: {
              sid: input.sid,
              refUserId: resolved.agentUserId ?? input.userId ?? null,
              sourceCodeId: resolved.sourceCodeId,
              refCode: input.refParam ?? null,
              landedPath: input.path.slice(0, 190),
              device,
              os,
              browser,
              ip: input.ip,
              userAgent: input.userAgent,
              lastSeenAt: now,
              pageViews: 0,
            },
            select: { id: true, refUserId: true, sourceCodeId: true },
          });
        } catch (e) {
          // 同一个访客并发打开多个页面时，两个请求可能同时判断"会话不存在"，
          // 触发 sid 唯一约束冲突。此时直接复用已存在的那条即可。
          if ((e as { code?: string }).code === 'P2002') {
            session = await prisma.visitSession.findUnique({
              where: { sid: input.sid },
              select: { id: true, refUserId: true, sourceCodeId: true },
            });
          } else {
            throw e;
          }
        }
      } else {
        await prisma.visitSession.update({
          where: { id: session.id },
          data: { lastSeenAt: now, device, ip: input.ip ?? undefined },
        });
      }
      if (session) {
        sessionId = session.id;
        refUserId = refUserId ?? session.refUserId ?? null;
        sourceCodeId = session.sourceCodeId ?? null;
      }
    }

    // 2) 记录页面访问。
    //    服务端页面渲染时也会调用本函数，客户端埋点还会再调一次，
    //    所以这里做去重：同一会话 + 同一路径 30 分钟内只记一条。
    const dedupeSince = new Date(now.getTime() - 30 * 60 * 1000);
    const dup = sessionId
      ? await prisma.pageView.findFirst({
          where: { sessionId, path: input.path.slice(0, 190), createdAt: { gte: dedupeSince } },
          select: { id: true },
        })
      : null;

    if (!dup) {
      await prisma.pageView.create({
        data: {
          sessionId,
          refUserId,
          listingId: input.listingId ?? null,
          path: input.path.slice(0, 190),
          title: input.title?.slice(0, 190) ?? null,
          referrer: input.referrer?.slice(0, 500) ?? null,
          refParam: input.refParam ?? null,
          device,
          ip: input.ip,
          createdAt: now,
        },
      });

      if (sessionId) {
        await prisma.visitSession.update({
          where: { id: sessionId },
          data: { pageViews: { increment: 1 } },
        });
      }

      // 3) 房源浏览量 +1
      if (input.listingId) {
        await prisma.listing
          .update({ where: { id: input.listingId }, data: { viewCount: { increment: 1 } } })
          .catch(() => undefined);
      }
    }
  } catch (e) {
    console.error('[track] 埋点写入失败', e);
  }
}

export type ResolvedCode = { agentUserId: string | null; sourceCodeId: string | null };

/**
 * 把推广参数解析成"归属子管理员 + 渠道码"。
 * 参数既可以是渠道码(SourceCode.code)，也可以是子管理员自己的 refCode(AgentProfile.refCode)，
 * 这样业务员不用记两套码。
 */
export async function resolveCode(code: string | null): Promise<ResolvedCode> {
  const clean = (code ?? '').trim().slice(0, 64);
  if (!clean) return { agentUserId: null, sourceCodeId: null };

  const sc = await prisma.sourceCode.findUnique({
    where: { code: clean },
    select: { id: true, ownerId: true, enabled: true, type: true },
  });
  if (sc && sc.enabled) {
    if (sc.type === 'AGENT_CARD' && sc.ownerId) {
      // 业务员主码：既算渠道码也算人
      return { agentUserId: sc.ownerId, sourceCodeId: sc.id };
    }
    return { agentUserId: sc.ownerId ?? null, sourceCodeId: sc.id };
  }

  const agent = await prisma.agentProfile.findUnique({
    where: { refCode: clean },
    select: { userId: true },
  });
  if (agent) return { agentUserId: agent.userId, sourceCodeId: null };

  return { agentUserId: null, sourceCodeId: null };
}
