'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/admin/ImageUploader';
import { createListingQuick } from '@/app/admin/actions';
import { DISTRICTS, DECORATIONS, ORIENTATIONS } from '@/lib/filters';

const LAYOUT_PRESETS = ['1室1厅1卫', '2室1厅1卫', '2室2厅1卫', '3室2厅1卫', '3室2厅2卫', '4室2厅2卫'];
const OWNERSHIP_PRESETS = ['满五唯一', '满五不唯一', '满二', '不满二'];

/**
 * 手机端极简"加房源"。
 * 业务员在小区里拍完照，用手机 30 秒就能把房源挂上去，不用回店里开电脑。
 */
export default function QuickListingForm({ defaultDealType = 'SALE' }: { defaultDealType?: 'SALE' | 'RENT' }) {
  const router = useRouter();
  const [dealType, setDealType] = useState<'SALE' | 'RENT'>(defaultDealType);
  const [community, setCommunity] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set('dealType', dealType);

    // 标题没填就按"小区 + 户型"自动生成，减少业务员输入
    const titleInput = String(fd.get('title') ?? '').trim();
    if (!titleInput) {
      const layout = String(fd.get('layout') ?? '').trim();
      fd.set('title', `${community}${layout ? ' ' + layout : ''}`.trim());
    }

    try {
      const res = await createListingQuick(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone({ id: res.id ?? '' });
      router.refresh();
    } catch {
      setError('提交失败，请检查网络后重试');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-5 text-center">
        <p className="text-3xl">✅</p>
        <p className="mt-2 text-base font-medium text-slate-900">房源已提交</p>
        <p className="mt-1 text-sm text-slate-500">
          如果系统开启了审核，房源会先进入待审核，管理员通过后自动上架前台。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost btn-sm justify-center" onClick={() => setDone(null)}>
            再发一套
          </button>
          <button
            type="button"
            className="btn-primary btn-sm justify-center"
            onClick={() => router.push('/admin/m/listings')}
          >
            看我的房源
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 pb-2">
      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* 交易类型 */}
      <div className="card p-3">
        <div className="grid grid-cols-2 gap-2">
          {(['SALE', 'RENT'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDealType(t)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                dealType === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t === 'SALE' ? '出售' : '出租'}
            </button>
          ))}
        </div>
      </div>

      {/* 照片放最前面：先拍照再填信息，符合业务员习惯 */}
      <div className="card p-3">
        <ImageUploader
          initial={[]}
          max={12}
          label="房源照片（必填，至少 1 张）"
          hint="第一张当封面。手机拍的原图会自动压缩，快很多。"
        />
      </div>

      <div className="card space-y-3 p-3">
        <div>
          <label className="label" htmlFor="community">
            小区名称 <span className="text-rose-500">*</span>
          </label>
          <input
            id="community"
            name="community"
            className="input"
            placeholder="例如：望京西园三区"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            required
            maxLength={50}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="district">
              区域
            </label>
            <select id="district" name="district" className="input" defaultValue="">
              <option value="">选择区域</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="layout">
              户型
            </label>
            <input id="layout" name="layout" className="input" list="quick-layouts" placeholder="3室2厅1卫" />
            <datalist id="quick-layouts">
              {LAYOUT_PRESETS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="area">
              建筑面积（㎡）<span className="text-rose-500">*</span>
            </label>
            <input
              id="area"
              name="area"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              className="input"
              placeholder="118.5"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor={dealType === 'SALE' ? 'priceWan' : 'rentYuan'}>
              {dealType === 'SALE' ? '总价（万元）' : '月租（元）'}
              <span className="text-rose-500">*</span>
            </label>
            <input
              id={dealType === 'SALE' ? 'priceWan' : 'rentYuan'}
              name={dealType === 'SALE' ? 'priceWan' : 'rentYuan'}
              type="number"
              inputMode="decimal"
              step={dealType === 'SALE' ? '0.1' : '1'}
              min="0"
              className="input"
              placeholder={dealType === 'SALE' ? '560' : '6500'}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="floor">
              楼层 / 总层
            </label>
            <div className="flex items-center gap-1">
              <input id="floor" name="floor" type="number" inputMode="numeric" className="input" placeholder="8" />
              <span className="text-slate-400">/</span>
              <input name="totalFloors" type="number" inputMode="numeric" className="input" placeholder="18" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="decoration">
              装修
            </label>
            <select id="decoration" name="decoration" className="input" defaultValue="">
              <option value="">未选择</option>
              {DECORATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="orientation">
              朝向
            </label>
            <select id="orientation" name="orientation" className="input" defaultValue="">
              <option value="">未选择</option>
              {ORIENTATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ownership">
              产权
            </label>
            <select id="ownership" name="ownership" className="input" defaultValue="">
              <option value="">未选择</option>
              {OWNERSHIP_PRESETS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="hasElevator" className="h-4 w-4" />
          有电梯
        </label>
      </div>

      {/* 可折叠的补充信息，默认收起，让主流程更短 */}
      <details className="card p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          补充信息（可选，填了客户更信任）
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="title">
              房源标题
            </label>
            <input id="title" name="title" className="input" placeholder="不填会自动按「小区 + 户型」生成" maxLength={80} />
          </div>
          <div>
            <label className="label" htmlFor="highlights">
              卖点（一行一条）
            </label>
            <textarea
              id="highlights"
              name="highlights"
              className="input h-20"
              placeholder={'南北通透\n满五唯一\n近地铁'}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              房源描述
            </label>
            <textarea id="description" name="description" className="input h-24" placeholder="小区环境、周边配套、看房方式…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="ownerName">
                业主称呼
              </label>
              <input id="ownerName" name="ownerName" className="input" placeholder="王先生" maxLength={20} />
            </div>
            <div>
              <label className="label" htmlFor="ownerPhone">
                业主电话
              </label>
              <input
                id="ownerPhone"
                name="ownerPhone"
                type="tel"
                inputMode="numeric"
                className="input"
                maxLength={20}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">业主信息只有你和管理员能看到，前台不会展示。</p>
        </div>
      </details>

      <div className="sticky bottom-16 z-20 lg:bottom-2">
        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={busy}>
          {busy ? '提交中…' : '提交房源'}
        </button>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        提交后：管理员已开启审核 → 待审核；未开启 → 直接上架前台
      </p>
    </form>
  );
}
