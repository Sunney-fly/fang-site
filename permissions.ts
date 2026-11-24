import type { Role } from '@prisma/client';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  AGENT: '子管理员',
  USER: '普通用户',
};

/** 数字越大权限越高，用于"至少某级别"的判断 */
export const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  AGENT: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const STAFF_ROLES: Role[] = ['AGENT', 'ADMIN', 'SUPER_ADMIN'];

export function isStaff(role?: Role | null): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function atLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** 后台可访问的导航项，按角色过滤 */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  minRole: Role;
};

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: '总览看板', icon: 'dashboard', minRole: 'AGENT' },
  { href: '/admin/listings', label: '房源管理', icon: 'home', minRole: 'AGENT' },
  { href: '/admin/leads', label: '客户线索', icon: 'users', minRole: 'AGENT' },
  { href: '/admin/appointments', label: '预约看房', icon: 'calendar', minRole: 'AGENT' },
  { href: '/admin/tracking', label: '推广与归属', icon: 'link', minRole: 'AGENT' },
  { href: '/admin/agents', label: '子管理员', icon: 'badge', minRole: 'ADMIN' },
  { href: '/admin/users', label: '用户管理', icon: 'user', minRole: 'ADMIN' },
  { href: '/admin/stats', label: '数据统计', icon: 'chart', minRole: 'ADMIN' },
  { href: '/admin/settings', label: '系统设置', icon: 'settings', minRole: 'SUPER_ADMIN' },
];

export function navFor(role: Role): NavItem[] {
  return ADMIN_NAV.filter((n) => atLeast(role, n.minRole));
}
