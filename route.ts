import { NextResponse, type NextRequest } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getCurrentUser } from '@/lib/auth';
import { isStaff } from '@/lib/permissions';
import { randomCode } from '@/lib/attribution';
import { rateLimit } from '@/lib/rate-limit';
import { compressImage } from '@/lib/image';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 单张 8MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * 图片上传：存到 public/uploads/<用户id>/ 下，返回可直接访问的 URL。
 * 单机部署足够；将来换 OSS 只需改这一个文件。
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: '请先登录员工账号' }, { status: 401 });
  }

  const rl = rateLimit(`upload:${user.id}`, 200, 60 * 60);
  if (!rl.ok) return NextResponse.json({ error: '上传过于频繁' }, { status: 429 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: '请求格式错误' }, { status: 400 });

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  const single = form.get('file');
  if (single instanceof File) files.push(single);
  if (files.length === 0) return NextResponse.json({ error: '没有收到文件' }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: '一次最多上传 20 张' }, { status: 400 });

  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', ym);
  await mkdir(dir, { recursive: true });

  const urls: string[] = [];
  let savedBytes = 0;
  let originalBytes = 0;

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `不支持的图片格式：${file.type || '未知'}` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `图片 ${file.name} 超过 8MB` }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    // 手机拍的照片先压缩，能显著加快客户在微信里的打开速度
    const img = await compressImage(raw, file.type);
    originalBytes += img.originalSize;
    savedBytes += img.originalSize - img.size;

    const name = `${Date.now().toString(36)}-${randomCode(6)}.${img.ext}`;
    await writeFile(path.join(dir, name), img.buffer);
    urls.push(`/uploads/${ym}/${name}`);
  }

  return NextResponse.json({
    ok: true,
    urls,
    // 让前端/后台能看到压缩效果
    savedKB: Math.round(savedBytes / 1024),
    originalKB: Math.round(originalBytes / 1024),
  });
}
