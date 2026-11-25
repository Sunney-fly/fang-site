import Link from 'next/link';

type Props = {
  page: number;
  pageCount: number;
  /** 当前查询参数（不含 page） */
  params: Record<string, string | undefined>;
  basePath?: string;
};

export default function Pagination({ page, pageCount, params, basePath = '/fang' }: Props) {
  if (pageCount <= 1) return null;

  const href = (p: number) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
    if (p > 1) usp.set('page', String(p));
    const q = usp.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  // 页码窗口：当前页前后各 2 页
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn-ghost btn-sm">
          上一页
        </Link>
      )}

      {start > 1 && (
        <>
          <Link href={href(1)} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
            1
          </Link>
          {start > 2 && <span className="px-1 text-slate-400">…</span>}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          className={`rounded-md px-3 py-1.5 ${
            p === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {p}
        </Link>
      ))}

      {end < pageCount && (
        <>
          {end < pageCount - 1 && <span className="px-1 text-slate-400">…</span>}
          <Link href={href(pageCount)} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
            {pageCount}
          </Link>
        </>
      )}

      {page < pageCount && (
        <Link href={href(page + 1)} className="btn-ghost btn-sm">
          下一页
        </Link>
      )}
    </nav>
  );
}
