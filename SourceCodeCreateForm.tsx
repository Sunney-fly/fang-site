'use client';

import { useActionState, useState } from 'react';
import { createSourceCode, type ActionState } from '@/app/admin/actions';
import { SOURCE_TYPE_LABEL } from '@/lib/format';

export default function SourceCodeCreateForm({
  agents,
  listings,
  isAdmin,
  selfId,
}: {
  agents: Array<{ id: string; name: string }>;
  listings: Array<{ id: string; title: string; code: string }>;
  isAdmin: boolean;
  selfId: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createSourceCode, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">新建推广渠道码</p>
          <p className="mt-0.5 text-xs text-slate-500">
            例如「朋友圈海报 3 月」「小区传单」，用不同渠道码就能分区统计效果
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? '收起' : '+ 新建渠道码'}
        </button>
      </div>

      {state.ok && state.message && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</div>
      )}
      {state.error && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</div>
      )}

      {open && (
        <form action={formAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sc-name">
              渠道名称 <span className="text-rose-500">*</span>
            </label>
            <input id="sc-name" name="name" className="input" placeholder="例如：张明·朋友圈海报1期" required maxLength={40} />
          </div>

          <div>
            <label className="label" htmlFor="sc-type">
              渠道类型
            </label>
            <select id="sc-type" name="type" className="input" defaultValue="POSTER">
              {Object.entries(SOURCE_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="sc-code">
              自定义推广码（可留空自动生成）
            </label>
            <input
              id="sc-code"
              name="code"
              className="input font-mono"
              placeholder="留空则由系统随机生成"
              maxLength={32}
            />
            <p className="hint">只能用字母、数字、下划线、中划线</p>
          </div>

          <div>
            <label className="label" htmlFor="sc-owner">
              归属子管理员
            </label>
            {isAdmin ? (
              <select id="sc-owner" name="ownerId" className="input" defaultValue={selfId}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input bg-slate-50" value="我自己" readOnly disabled />
            )}
            <p className="hint">客户通过这个码进来，就归属到这位子管理员名下</p>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="sc-listing">
              落地房源（选填）
            </label>
            <select id="sc-listing" name="landingListingId" className="input" defaultValue="">
              <option value="">不指定（落地到房源列表）</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.title}
                </option>
              ))}
            </select>
            <p className="hint">指定后，客户扫码会直接打开这套房源，适合做单套房源的海报</p>
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? '创建中…' : '创建渠道码'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
