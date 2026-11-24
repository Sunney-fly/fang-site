'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  DECORATIONS,
  DISTRICTS,
  ROOM_OPTIONS,
  SORT_OPTIONS,
  priceRanges,
  priceUnit,
} from '@/lib/filters';

type Props = { basePath?: string };

/** 房源筛选条：面积/价格/户型/装修/排序，全部同步到 URL，便于分享和 SEO */
export default function FilterBar({ basePath = '/fang' }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const dealType = sp.get('dealType') === 'RENT' ? 'RENT' : 'SALE';
  const ranges = useMemo(() => priceRanges(dealType), [dealType]);
  const unit = priceUnit(dealType);

  const setParam = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v) params.delete(k);
        else params.set(k, v);
      }
      params.delete('page');
      router.push(`${basePath}?${params.toString()}`);
    },
    [basePath, router, sp],
  );

  const activeRange = `${sp.get('minPrice') ?? ''}-${sp.get('maxPrice') ?? ''}`;
  const rooms = sp.get('rooms') ?? '';
  const decoration = sp.get('decoration') ?? '';
  const sort = sp.get('sort') ?? 'new';
  const district = sp.get('district') ?? '';

  return (
    <div className="card divide-y divide-slate-100">
      <Row label="区域">
        <Chip active={!district} onClick={() => setParam({ district: undefined })}>
          不限
        </Chip>
        {DISTRICTS.map((d) => (
          <Chip key={d} active={district === d} onClick={() => setParam({ district: d })}>
            {d}
          </Chip>
        ))}
      </Row>

      <Row label={`价格(${unit})`}>
        <Chip active={!activeRange || activeRange === '-'} onClick={() => setParam({ minPrice: undefined, maxPrice: undefined })}>
          不限
        </Chip>
        {ranges.map((r) => {
          const key = `${r.min ?? ''}-${r.max ?? ''}`;
          return (
            <Chip
              key={r.label}
              active={activeRange === key}
              onClick={() =>
                setParam({
                  minPrice: r.min !== undefined ? String(r.min) : undefined,
                  maxPrice: r.max !== undefined ? String(r.max) : undefined,
                })
              }
            >
              {r.label}
            </Chip>
          );
        })}
      </Row>

      <Row label="户型">
        <Chip active={!rooms} onClick={() => setParam({ rooms: undefined })}>
          不限
        </Chip>
        {ROOM_OPTIONS.map((r) => (
          <Chip key={r.value} active={rooms === r.value} onClick={() => setParam({ rooms: r.value })}>
            {r.label}
          </Chip>
        ))}
      </Row>

      <Row label="装修">
        <Chip active={!decoration} onClick={() => setParam({ decoration: undefined })}>
          不限
        </Chip>
        {DECORATIONS.map((d) => (
          <Chip key={d} active={decoration === d} onClick={() => setParam({ decoration: d })}>
            {d}
          </Chip>
        ))}
      </Row>

      <Row label="排序">
        {SORT_OPTIONS.map((s) => (
          <Chip key={s.value} active={sort === s.value} onClick={() => setParam({ sort: s.value })}>
            {s.label}
          </Chip>
        ))}
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <span className="w-20 shrink-0 text-xs text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs transition ${
        active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}
