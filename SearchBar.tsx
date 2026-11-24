'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DISTRICTS } from '@/lib/filters';

type Props = {
  defaultDealType?: 'SALE' | 'RENT';
  defaultKeyword?: string;
  defaultDistrict?: string;
  size?: 'lg' | 'sm';
};

export default function SearchBar({
  defaultDealType = 'SALE',
  defaultKeyword = '',
  defaultDistrict = '',
  size = 'lg',
}: Props) {
  const router = useRouter();
  const [dealType, setDealType] = useState<'SALE' | 'RENT'>(defaultDealType);
  const [q, setQ] = useState(defaultKeyword);
  const [district, setDistrict] = useState(defaultDistrict);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('dealType', dealType);
    if (q.trim()) params.set('q', q.trim());
    if (district) params.set('district', district);
    router.push(`/fang?${params.toString()}`);
  }

  const big = size === 'lg';

  return (
    <form
      onSubmit={submit}
      className={`flex w-full flex-col gap-2 rounded-xl bg-white p-2 shadow-lg sm:flex-row sm:items-center ${
        big ? '' : 'shadow-sm'
      }`}
    >
      <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-sm">
        {(['SALE', 'RENT'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDealType(t)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              dealType === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t === 'SALE' ? '买房' : '租房'}
          </button>
        ))}
      </div>

      <input
        className={`min-w-0 flex-1 ${big ? 'input' : 'input'}`}
        placeholder="小区名、区域或关键词，例如：朝阳 三居 满五唯一"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <select
        className="input sm:w-36"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        aria-label="选择区域"
      >
        <option value="">全部区域</option>
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <button type="submit" className={`btn-primary shrink-0 ${big ? 'px-8 py-2.5' : ''}`}>
        搜索房源
      </button>
    </form>
  );
}
