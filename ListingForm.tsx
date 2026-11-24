'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import ImageUploader from './ImageUploader';
import { DISTRICTS, DECORATIONS, ORIENTATIONS } from '@/lib/filters';
import type { ActionState } from '@/app/admin/actions';

export type ListingFormValues = {
  id?: string;
  title?: string;
  dealType?: 'SALE' | 'RENT';
  community?: string;
  district?: string | null;
  businessArea?: string | null;
  address?: string | null;
  priceWan?: number | null;
  rentYuan?: number | null;
  area?: number | null;
  layout?: string | null;
  rooms?: number | null;
  halls?: number | null;
  bathrooms?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  orientation?: string | null;
  decoration?: string | null;
  buildingType?: string | null;
  hasElevator?: boolean | null;
  buildYear?: number | null;
  ownership?: string | null;
  description?: string | null;
  highlights?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  isFeatured?: boolean;
  images?: string[];
};

type Props = {
  mode: 'create' | 'edit';
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  values?: ListingFormValues;
  /** 编辑态下的状态横幅等额外内容 */
  extra?: React.ReactNode;
  code?: string | null;
};

const DEFAULT_LAYOUTS = ['1室1厅1卫', '2室1厅1卫', '2室2厅1卫', '3室2厅1卫', '3室2厅2卫', '4室2厅2卫', '5室2厅2卫'];
const OWNERSHIP_OPTIONS = ['满五唯一', '满五不唯一', '满二', '不满二', '不限'];
const BUILDING_TYPES = ['板楼', '塔楼', '板塔结合', '平房'];

export default function ListingForm({ mode, action, values = {}, extra, code }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const v = values;
  const isRent = v.dealType === 'RENT';

  return (
    <form action={formAction} className="space-y-4">
      {v.id && <input type="hidden" name="id" value={v.id} />}

      {extra}

      {state.error && (
        <div className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{state.error}</div>
      )}
      {state.ok && state.message && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{state.message}</div>
      )}

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">基础信息</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              房源标题 <span className="text-rose-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              className="input"
              defaultValue={v.title ?? ''}
              placeholder="例如：望京西园三区 3室2厅 精装修 满五唯一"
              required
              maxLength={80}
            />
            <p className="hint">建议包含小区名、户型和 1-2 个卖点，客户搜索时更容易命中</p>
          </div>

          <div>
            <label className="label" htmlFor="dealType">
              交易类型 <span className="text-rose-500">*</span>
            </label>
            <select id="dealType" name="dealType" className="input" defaultValue={v.dealType ?? 'SALE'}>
              <option value="SALE">出售</option>
              <option value="RENT">出租</option>
            </select>
            {code && <p className="hint">房源编号：{code}</p>}
          </div>

          <div>
            <label className="label" htmlFor="community">
              小区名称 <span className="text-rose-500">*</span>
            </label>
            <input
              id="community"
              name="community"
              className="input"
              defaultValue={v.community ?? ''}
              placeholder="例如：望京西园三区"
              required
              maxLength={50}
            />
          </div>

          <div>
            <label className="label" htmlFor="district">
              所在区域
            </label>
            <select id="district" name="district" className="input" defaultValue={v.district ?? ''}>
              <option value="">请选择</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="businessArea">
              商圈
            </label>
            <input
              id="businessArea"
              name="businessArea"
              className="input"
              defaultValue={v.businessArea ?? ''}
              placeholder="例如：望京 / 国贸"
              maxLength={30}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">
              详细地址
            </label>
            <input
              id="address"
              name="address"
              className="input"
              defaultValue={v.address ?? ''}
              placeholder="仅在后台展示，前台只显示到小区"
              maxLength={120}
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">价格与面积</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="priceWan">
              总价（万元）
            </label>
            <input
              id="priceWan"
              name="priceWan"
              type="number"
              step="0.1"
              min="0"
              className="input"
              defaultValue={v.priceWan ?? ''}
              placeholder={isRent ? '出租房源可不填' : '例如：560'}
            />
          </div>
          <div>
            <label className="label" htmlFor="rentYuan">
              月租（元）
            </label>
            <input
              id="rentYuan"
              name="rentYuan"
              type="number"
              step="1"
              min="0"
              className="input"
              defaultValue={v.rentYuan ?? ''}
              placeholder={isRent ? '例如：6500' : '出租房源才需要填'}
            />
          </div>
          <div>
            <label className="label" htmlFor="area">
              建筑面积（㎡）
            </label>
            <input
              id="area"
              name="area"
              type="number"
              step="0.1"
              min="0"
              className="input"
              defaultValue={v.area ?? ''}
              placeholder="例如：118.5"
            />
          </div>
          <div>
            <label className="label" htmlFor="layout">
              户型
            </label>
            <input
              id="layout"
              name="layout"
              className="input"
              list="layout-options"
              defaultValue={v.layout ?? ''}
              placeholder="例如：3室2厅1卫"
            />
            <datalist id="layout-options">
              {DEFAULT_LAYOUTS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div>
            <label className="label" htmlFor="rooms">
              室
            </label>
            <input id="rooms" name="rooms" type="number" min="0" max="20" className="input" defaultValue={v.rooms ?? ''} />
          </div>
          <div>
            <label className="label" htmlFor="halls">
              厅
            </label>
            <input id="halls" name="halls" type="number" min="0" max="20" className="input" defaultValue={v.halls ?? ''} />
          </div>
          <div>
            <label className="label" htmlFor="bathrooms">
              卫
            </label>
            <input
              id="bathrooms"
              name="bathrooms"
              type="number"
              min="0"
              max="20"
              className="input"
              defaultValue={v.bathrooms ?? ''}
            />
          </div>
          <div>
            <label className="label" htmlFor="floor">
              所在楼层
            </label>
            <input id="floor" name="floor" type="number" className="input" defaultValue={v.floor ?? ''} />
          </div>
          <div>
            <label className="label" htmlFor="totalFloors">
              总楼层
            </label>
            <input
              id="totalFloors"
              name="totalFloors"
              type="number"
              min="0"
              className="input"
              defaultValue={v.totalFloors ?? ''}
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">房屋属性</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="orientation">
              朝向
            </label>
            <input
              id="orientation"
              name="orientation"
              className="input"
              list="orientation-options"
              defaultValue={v.orientation ?? ''}
            />
            <datalist id="orientation-options">
              {ORIENTATIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="decoration">
              装修
            </label>
            <input
              id="decoration"
              name="decoration"
              className="input"
              list="decoration-options"
              defaultValue={v.decoration ?? ''}
            />
            <datalist id="decoration-options">
              {DECORATIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="buildingType">
              建筑类型
            </label>
            <input
              id="buildingType"
              name="buildingType"
              className="input"
              list="building-options"
              defaultValue={v.buildingType ?? ''}
            />
            <datalist id="building-options">
              {BUILDING_TYPES.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="buildYear">
              建成年代
            </label>
            <input
              id="buildYear"
              name="buildYear"
              type="number"
              min="1900"
              max="2100"
              className="input"
              defaultValue={v.buildYear ?? ''}
              placeholder="例如：2008"
            />
          </div>
          <div>
            <label className="label" htmlFor="ownership">
              产权情况
            </label>
            <input
              id="ownership"
              name="ownership"
              className="input"
              list="ownership-options"
              defaultValue={v.ownership ?? ''}
              placeholder="例如：满五唯一"
            />
            <datalist id="ownership-options">
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="hasElevator" defaultChecked={v.hasElevator ?? false} className="h-4 w-4" />
              有电梯
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isFeatured" defaultChecked={v.isFeatured ?? false} className="h-4 w-4" />
              设为精选
            </label>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">卖点与描述</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="highlights">
              房源卖点（一行一条）
            </label>
            <textarea
              id="highlights"
              name="highlights"
              className="input h-24 resize-y"
              defaultValue={v.highlights ?? ''}
              placeholder={'南北通透，全明格局\n满五唯一，税费低\n紧邻地铁 5 号线'}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              房源描述
            </label>
            <textarea
              id="description"
              name="description"
              className="input h-32 resize-y"
              defaultValue={v.description ?? ''}
              placeholder="介绍小区环境、户型亮点、周边配套、看房方式等"
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">房源图片</h2>
        <div className="mt-4">
          <ImageUploader initial={v.images ?? []} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-slate-900">业主信息（仅内部可见）</h2>
        <p className="hint mt-1">前台页面不会展示业主姓名与电话，只有归属子管理员和管理员能看到。</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ownerName">
              业主称呼
            </label>
            <input id="ownerName" name="ownerName" className="input" defaultValue={v.ownerName ?? ''} maxLength={20} />
          </div>
          <div>
            <label className="label" htmlFor="ownerPhone">
              业主电话
            </label>
            <input id="ownerPhone" name="ownerPhone" className="input" defaultValue={v.ownerPhone ?? ''} maxLength={20} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Link href="/admin/listings" className="btn-ghost">
          取消
        </Link>
        <button
          type="submit"
          name="submit"
          value="draft"
          className="btn-ghost"
          disabled={pending}
          formNoValidate
        >
          存为草稿
        </button>
        <button type="submit" name="submit" value="pending" className="btn-primary" disabled={pending}>
          {pending ? '保存中…' : mode === 'create' ? '提交并上架' : '保存修改'}
        </button>
      </div>

      <p className="pb-2 text-right text-xs text-slate-400">
        提交后，若系统开启了「子管理员房源需审核」，房源会先进入待审核状态，由管理员审核后上架。
      </p>
    </form>
  );
}
