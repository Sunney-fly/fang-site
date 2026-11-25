'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { Role } from '@prisma/client';
import { ROLE_LABEL } from '@/lib/permissions';
import { createAgent, type ActionState } from '@/app/admin/actions';

type Parent = { id: string; name: string; role: Role };

type Props = {
  /** 只有超管能创建管理员账号 */
  canCreateAdmin: boolean;
  /** 可选的上级账号（决定谁管理这个账号） */
  parents: Parent[];
  /** 默认上级：当前操作人 */
  defaultParentId: string;
};

/**
 * 新建子管理员。创建成功后后台会自动生成专属推广码 + 一张名片渠道码，
 * 所以这里只收最基础的信息，推广码统一由系统发。
 */
export default function AgentCreateForm({ canCreateAdmin, parents, defaultParentId }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createAgent, {});
  const formRef = useRef<HTMLFormElement>(null);

  // 建号成功就清空表单，避免同一个手机号重复提交
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">新建子管理员</h2>
      <p className="mt-1 text-xs text-slate-500">
        手机号即登录账号；创建后系统会立即生成专属推广码，客户通过 TA 的链接留资就算 TA 的。
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="label">姓名</span>
          <input name="name" className="input" placeholder="如：王小美" maxLength={20} required />
        </label>

        <label className="block">
          <span className="label">手机号</span>
          <input
            name="phone"
            className="input"
            inputMode="numeric"
            maxLength={11}
            placeholder="11 位手机号"
            required
          />
        </label>

        <label className="block">
          <span className="label">初始密码</span>
          <input
            name="password"
            type="text"
            className="input font-mono"
            minLength={6}
            placeholder="至少 6 位"
            required
          />
        </label>

        <label className="block">
          <span className="label">对外称呼</span>
          <input name="title" className="input" maxLength={20} placeholder="如：王经理" />
          <span className="hint">留空默认为「房产顾问」</span>
        </label>

        <label className="block">
          <span className="label">服务区域</span>
          <input name="area" className="input" maxLength={40} placeholder="如：朝阳区、通州区" />
        </label>

        <label className="block">
          <span className="label">角色</span>
          <select name="role" className="input" defaultValue="AGENT">
            <option value="AGENT">子管理员（业务员）</option>
            {canCreateAdmin && <option value="ADMIN">管理员</option>}
          </select>
          <span className="hint">
            {canCreateAdmin ? '管理员可审核房源、管理用户' : '只有超级管理员能创建管理员账号'}
          </span>
        </label>

        <label className="block">
          <span className="label">归属上级</span>
          <select name="parentId" className="input" defaultValue={defaultParentId}>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{ROLE_LABEL[p.role]}）
              </option>
            ))}
            <option value="">不指定（默认挂在当前账号下）</option>
          </select>
          <span className="hint">上级决定谁能管理这个账号</span>
        </label>
      </div>

      {state.error && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</div>
      )}
      {state.message && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </div>
      )}

      <button type="submit" className="btn-primary btn-sm mt-4" disabled={pending}>
        {pending ? '创建中…' : '创建账号'}
      </button>
    </form>
  );
}
