'use client';

import { useState } from 'react';
import { setListingStatus, deleteListing, reviewListing, toggleListingFlag } from '@/app/admin/actions';

type Props = {
  id: string;
  status: string;
  /** 当前用户是否为管理员及以上（决定能不能审核/置顶） */
  canManage: boolean;
  isOwner: boolean;
};

/**
 * 房源行内操作：上架 / 下架 / 标记成交 / 删除。
 * 每个按钮是独立表单，直接调用 server action，不需要额外 JS。
 */
export default function ListingRowActions({ id, status, canManage, isOwner }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <a href={`/admin/listings/${id}`} className="btn-ghost btn-sm">
        编辑
      </a>

      {status !== 'PUBLISHED' && status !== 'SOLD' && (
        <form action={setListingStatus}>
          <input type="hidden" name="id" value={id} />
          <button name="action" value="publish" className="btn-ghost btn-sm text-emerald-700" type="submit">
            上架
          </button>
        </form>
      )}

      {status === 'PUBLISHED' && (
        <>
          <form action={setListingStatus}>
            <input type="hidden" name="id" value={id} />
            <button name="action" value="offline" className="btn-ghost btn-sm" type="submit">
              下架
            </button>
          </form>
          <form action={setListingStatus}>
            <input type="hidden" name="id" value={id} />
            <button name="action" value="sold" className="btn-ghost btn-sm" type="submit">
              已成交
            </button>
          </form>
        </>
      )}

      {canManage && (
        <>
          <form action={toggleListingFlag}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="field" value="isTop" />
            <button className="btn-ghost btn-sm" type="submit">
              置顶切换
            </button>
          </form>
          <form action={toggleListingFlag}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="field" value="isFeatured" />
            <button className="btn-ghost btn-sm" type="submit">
              精选切换
            </button>
          </form>
        </>
      )}

      {(canManage || isOwner) && (
        <button type="button" className="btn-ghost btn-sm text-rose-600" onClick={() => setOpen((v) => !v)}>
          删除
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-sm p-5">
            <h3 className="text-base font-semibold text-slate-900">确认删除这套房源？</h3>
            <p className="mt-2 text-sm text-slate-500">
              删除后房源及其图片、浏览记录都会消失，已收集的客户线索会保留但不再关联房源。此操作不可恢复。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
                取消
              </button>
              <form action={deleteListing}>
                <input type="hidden" name="id" value={id} />
                <button className="btn-danger btn-sm" type="submit">
                  确认删除
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 管理员在列表里直接审核通过 / 驳回 */
export function ReviewActions({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <a href={`/admin/listings/${id}`} className="btn-ghost btn-sm">
        查看
      </a>
      <form action={reviewListing}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="approve" />
        <button className="btn-primary btn-sm" type="submit">
          通过并上架
        </button>
      </form>
      <button type="button" className="btn-ghost btn-sm text-rose-600" onClick={() => setRejecting((v) => !v)}>
        驳回
      </button>

      {rejecting && (
        <form action={reviewListing} className="mt-2 flex w-full items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <input name="reason" className="input" placeholder="驳回原因，例如：缺少实勘照片" maxLength={200} />
          <button className="btn-danger btn-sm shrink-0" type="submit">
            确认驳回
          </button>
        </form>
      )}
    </div>
  );
}
