import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Role } from '@prisma/client';
import { prisma } from './db';
import { atLeast, isStaff } from './permissions';

export const SESSION_COOKIE = 'fang_session';
const SESSION_DAYS = 30;

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET 未配置或过短，请在 .env 中设置（至少 16 位随机字符串）');
  }
  return new TextEncoder().encode(s);
}

export type SessionPayload = {
  uid: string;
  role: Role;
  name: string;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.uid || !payload.role) return null;
    return { uid: String(payload.uid), role: payload.role as Role, name: String(payload.name ?? '') };
  } catch {
    return null;
  }
}

/** 登录成功后写入会话 Cookie */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export type CurrentUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  parentId: string | null;
  refCode: string | null;
  avatar: string | null;
};

/**
 * 读取当前登录用户。用 React cache 保证同一次请求内只查一次库。
 * 注意：被封禁的账号立即失效。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const payload = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      parentId: true,
      avatar: true,
      agentProfile: { select: { refCode: true } },
    },
  });
  if (!user || user.status !== 'ACTIVE') return null;

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    parentId: user.parentId,
    avatar: user.avatar,
    refCode: user.agentProfile?.refCode ?? null,
  };
});

/** 登录/注册后的落地路径，按角色分流 */
export function homeFor(role: Role): string {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'AGENT') return '/admin';
  return '/my';
}

/**
 * 后台操作守卫：未登录 → 去登录；权限不够 → 回自己的页面。
 * 用于 Server Action 的第一行，保证每个写操作都过一遍权限。
 */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (!isStaff(user.role)) redirect('/my');
  return user;
}

/** 需要指定级别的后台操作（如只有 ADMIN 以上能审核） */
export async function requireRole(min: Role) {
  const user = await requireStaff();
  if (!atLeast(user.role, min)) redirect('/admin?denied=1');
  return user;
}
