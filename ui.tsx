import Link from 'next/link';
import type { Role } from '@prisma/client';

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'brand' | 'danger' | 'success';
}) {
  const toneCls =
    tone === 'brand'
      ? 'text-brand-700'
      : tone === 'danger'
        ? 'text-rose-600'
        : tone === 'success'
          ? 'text-emerald-600'
          : 'text-slate-900';
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Badge({ children, cls = 'bg-slate-100 text-slate-600' }: { children: React.ReactNode; cls?: string }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <Badge cls={s.cls}>{s.label}</Badge>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-sm text-slate-600">{title}</p>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, { label: string; cls: string }> = {
    SUPER_ADMIN: { label: '超级管理员', cls: 'bg-rose-100 text-rose-700' },
    ADMIN: { label: '管理员', cls: 'bg-brand-100 text-brand-700' },
    AGENT: { label: '子管理员', cls: 'bg-emerald-100 text-emerald-700' },
    USER: { label: '普通用户', cls: 'bg-slate-100 text-slate-600' },
  };
  const m = map[role];
  return <Badge cls={m.cls}>{m.label}</Badge>;
}

/** 表格外框，自带横向滚动，手机上也能看 */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">{children}</table>
      </div>
    </div>
  );
}

export function BackLink({ href, label = '返回' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="text-sm text-slate-500 hover:text-brand-700">
      ← {label}
    </Link>
  );
}
