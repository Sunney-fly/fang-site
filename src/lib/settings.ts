import 'server-only';
import { prisma } from './db';
import type { AuditAction } from '@prisma/client';
import { SETTING_KEYS } from './setting-keys';

export { SETTING_KEYS };

/** 写一条后台操作日志。失败不影响主流程。 */
export async function audit(params: {
  actorId?: string | null;
  action: AuditAction;
  target?: string | null;
  targetId?: string | null;
  detail?: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        target: params.target ?? null,
        targetId: params.targetId ?? null,
        detail: params.detail?.slice(0, 2000) ?? null,
        ip: params.ip ?? null,
      },
    });
  } catch (e) {
    console.error('[audit] 写入失败', e);
  }
}

/** 设置项读取（带默认值） */
export async function getSetting(key: string, fallback = ''): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
