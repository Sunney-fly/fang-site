'use client';

'use client';

import { useState } from 'react';

type Props = {
  name?: string;
  initial?: string[];
  max?: number;
  label?: string;
  hint?: string;
};

/**
 * 房源图片上传。先上传拿到 URL，再把 URL 列表塞进隐藏字段随表单一起提交。
 * 支持多选、删除、设封面（第一张即封面）。
 */
export default function ImageUploader({
  name = 'imageUrls',
  initial = [],
  max = 20,
  label = '房源图片',
  hint = '第一张作为封面图。建议横图，单张不超过 8MB，最多 20 张。',
}: Props) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');

    const remain = max - urls.length;
    if (remain <= 0) {
      setError(`最多上传 ${max} 张`);
      return;
    }

    const picked = Array.from(files).slice(0, remain);
    const fd = new FormData();
    for (const f of picked) fd.append('files', f);

    setBusy(true);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as { urls?: string[]; error?: string };
      if (!res.ok || !data.urls) {
        setError(data.error || '上传失败');
        return;
      }
      setUrls((prev) => [...prev, ...data.urls!].slice(0, max));
    } catch {
      setError('上传失败，请检查网络');
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    setUrls((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div>
      <span className="label">{label}</span>

      {/* 提交时带上图片列表 */}
      <input type="hidden" name={name} value={urls.join('\n')} />

      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="group relative h-24 w-32 overflow-hidden rounded-lg border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`图片${i + 1}`} className="h-full w-full object-cover" />

            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-brand-600 px-1 py-0.5 text-[10px] text-white">
                封面
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-slate-900/70 px-1 py-0.5 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                className="text-[11px] text-white disabled:opacity-40"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                前移
              </button>
              <button
                type="button"
                className="text-[11px] text-rose-300"
                onClick={() => setUrls((prev) => prev.filter((_, idx) => idx !== i))}
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {urls.length < max && (
          <label className="grid h-24 w-32 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-brand-400 hover:text-brand-600">
            {busy ? '上传中…' : '+ 添加图片'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                void onPick(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <p className="hint">{hint}</p>
    </div>
  );
}
