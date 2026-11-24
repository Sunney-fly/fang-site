'use client';

import { useState } from 'react';
import { updateLeadStatus, toggleLeadPrivatized } from '@/app/admin/actions';

/**
 * 线索卡片上的快捷操作。
 * 业务员在外面跑，点一下就能标记状态，不用进详情页。
 */
export default function QuickStatusButtons({ leadId, status }: { leadId: string; status: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-ghost btn-sm w-full justify-center"
        onClick={() => setOpen((v) => !v)}
      >
        {status === 'NEW' ? '✓ 标记跟进' : '改状态'}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <form action={updateLeadStatus}>
            <input type="hidden" name="id" value={leadId} />
            <input type="hidden" name="status" value="CONTACTED" />
            <button type="submit" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100">
              已联系
            </button>
          </form>
          <form action={updateLeadStatus}>
            <input type="hidden" name="id" value={leadId} />
            <input type="hidden" name="status" value="FOLLOWING" />
            <button type="submit" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100">
              跟进中
            </button>
          </form>
          <form action={updateLeadStatus}>
            <input type="hidden" name="id" value={leadId} />
            <input type="hidden" name="status" value="VIEWED" />
            <button type="submit" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100">
              已带看
            </button>
          </form>
          <form action={updateLeadStatus}>
            <input type="hidden" name="id" value={leadId} />
            <input type="hidden" name="status" value="DEAL" />
            <button type="submit" className="w-full rounded px-2 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50">
              已成交 🎉
            </button>
          </form>
          <form action={toggleLeadPrivatized}>
            <input type="hidden" name="id" value={leadId} />
            <button type="submit" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100">
              标记已加微信
            </button>
          </form>
          <div className="mt-1 border-t border-slate-100 pt-1">
            <a href="/admin/leads" className="block rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
              去线索页看详情
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
