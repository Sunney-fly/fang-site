import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 健康检查接口：给 Docker healthcheck / 阿里云 SLB / 监控用。
 * 会真的查一次数据库，避免"进程活着但数据库连不上"还返回 200。
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      db: 'up',
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        db: 'down',
        error: e instanceof Error ? e.message : 'unknown',
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
