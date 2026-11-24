import { PrismaClient } from '@prisma/client';

// 开发环境热重载时避免重复创建连接池
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Prisma 的 Decimal 无法直接序列化给客户端组件，
 * 统一在 API 边界转成 number | null。
 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}
