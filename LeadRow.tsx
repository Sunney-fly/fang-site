'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  updateLeadStatus,
  addLeadFollowUp,
  toggleLeadPrivatized,
  reassignLead,
} from '@/app/admin/actions';

export type LeadRowData = {
  id: string;
  name: string | null;
  phone: string;
  wechat: string | null;
  message: string | null;
  source: string;
  status: string;
  privatized: boolean;
  followUps: string | null;
  followUpAt: string | null;
  createdAt: string;
  createdAgo: string;
  ownerName: string | null;
  ownerId: string | null;
  listing: { id: string; title: string; community: string } | null;
  sourceCodeName: string | null;
  visitedPages: number | null;
  device: string | null;
  refCode: string | null;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'NEW', label: '待跟进' },
  { value: 'CONTACTED', label: '已联系' },
  { value: 'FOLLOWING', label: '跟进中' },
  { value: 'VIEWED', label: '已带看' },
  { value: 'DEAL', label: '已成交' },
  { value: 'INVALID', label: '无效' },
];

const SOURCE_LABEL: Record<string, string> = {
  FORM: '留资表单',
  APPOINTMENT: '预约看房',
  PHONE_CLICK: '电话咨询',
  WECHAT_CLICK: '微信咨询',
  MANUAL: '后台代录',
};

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-rose-100 text-rose-700',
  CONTACTED: 'bg-amber-100 text-amber-700',
  FOLLOWING: 'bg-brand-100 text-brand-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  DEAL: 'bg-emerald-100 text-emerald-700',
  INVALID: 'bg-slate-100 text-slate-500',
};

export default function LeadRow({
  lead,
  canReassign,
  agents,
}: {
  lead: LeadRowData;
  canReassign: boolean;
  agents: Array<{ id: string; name: string; role: string }>;
}) {
  const [showFollow, setShowFollow] = useState(false);
  const [showReassign, setShowReassign] = useState(false);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{lead.name || '未留姓名'}</span>
            <a href={`tel:${lead.phone}`} className="text-sm font-medium text-brand-700 hover:underline">
              {lead.phone}
            </a>
            {lead.wechat && <span className="tag">微信 {lead.wechat}</span>}
            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${STATUS_STYLE[lead.status] ?? 'bg-slate-100'}`}>
              {STATUS_OPTIONS.find((s) => s.value === lead.status)?.label ?? lead.status}
            </span>
            {lead.privatized && <span className="tag bg-emerald-50 text-emerald-700">已加微信/私域</span>}
            {!lead.ownerId && <span className="tag bg-amber-100 text-amber-700">未分配</span>}
          </div>

          <p className="mt-1.5 text-xs text-slate-400">
            来源 {SOURCE_LABEL[lead.source] ?? lead.source}
            {lead.sourceCodeName ? ` · 渠道「${lead.sourceCodeName}」` : ''}
            {lead.ownerName ? ` · 归属 ${lead.ownerName}` : ''}
            {lead.visitedPages !== null ? ` · 客户看过 ${lead.visitedPages} 个页面` : ''}
            {lead.device === 'mobile' ? ' · 手机端' : ''}
            {' · '}
            {lead.createdAgo}
          </p>

          {lead.listing && (
            <p className="mt-1.5 text-sm text-slate-600">
              意向房源：
              <Link href={`/fang/${lead.listing.id}`} className="text-brand-700 hover:underline">
                {lead.listing.title}
              </Link>
              <span className="ml-1 text-xs text-slate-400">{lead.listing.community}</span>
            </p>
          )}

          {lead.message && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">「{lead.message}」</p>
          )}
        </div>

        <div className="shrink-0 text-right text-xs text-slate-400">
          <p>{lead.createdAt}</p>
          {lead.followUpAt && <p className="mt-1">最近跟进 {lead.followUpAt}</p>}
        </div>
      </div>

      {/* 跟进状态快捷切换 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">标记状态：</span>
        {STATUS_OPTIONS.map((s) => (
          <form action={updateLeadStatus} key={s.value}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="status" value={s.value} />
            <button
              type="submit"
              className={`rounded-md px-2 py-1 text-xs transition ${
                lead.status === s.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          </form>
        ))}

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button type="button" className="btn-ghost btn-sm" onClick={() => setShowFollow((v) => !v)}>
          写跟进
        </button>

        <form action={toggleLeadPrivatized}>
          <input type="hidden" name="id" value={lead.id} />
          <button type="submit" className="btn-ghost btn-sm">
            {lead.privatized ? '取消私域标记' : '标记已加微信'}
          </button>
        </form>

        {canReassign && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setShowReassign((v) => !v)}>
            改派归属
          </button>
        )}

        <a
          href={`sms:${lead.phone}`}
          className="btn-ghost btn-sm"
          title="用手机短信或复制号码联系客户"
        >
          发短信
        </a>
      </div>

      {showFollow && (
        <form action={addLeadFollowUp} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={lead.id} />
          <input
            name="text"
            className="input min-w-[16rem] flex-1"
            placeholder="例如：已电话沟通，客户预算 500 万以内，周末带看"
            maxLength={300}
            autoFocus
          />
          <button type="submit" className="btn-primary btn-sm">
            保存跟进
          </button>
        </form>
      )}

      {showReassign && canReassign && (
        <form action={reassignLead} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={lead.id} />
          <select name="ownerId" className="input w-52" defaultValue={lead.ownerId ?? ''}>
            <option value="">不分配（回到公共池）</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.role === 'AGENT' ? '（子管理员）' : a.role === 'ADMIN' ? '（管理员）' : '（超管）'}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary btn-sm">
            确认改派
          </button>
        </form>
      )}

      {lead.followUps && (
        <details className="mt-3 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
            查看跟进记录（{lead.followUps.split('\n').filter(Boolean).length} 条）
          </summary>
          <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            {lead.followUps
              .split('\n')
              .filter(Boolean)
              .map((line, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {line}
                </p>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
