import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { absoluteUrl } from '@/lib/format';

export const runtime = 'nodejs';

/**
 * 生成二维码图片（PNG）。
 * 用法：
 *   /api/qr?text=https://example.com/fang/xxx?ref=abcd
 *   /api/qr?path=/fang/xxx&ref=abcd          ← 内部会自动拼成绝对地址
 *   /api/qr?path=/fang/xxx&ref=abcd&download=1
 * 业务员在微信里发房源卡片，就是扫这个码。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ref = (sp.get('ref') || '').trim().slice(0, 64);

  let text = (sp.get('text') || '').trim();
  if (!text) {
    const path = (sp.get('path') || '/').trim();
    const base = absoluteUrl(path.startsWith('/') ? path : `/${path}`);
    if (ref) {
      const sep = base.includes('?') ? '&' : '?';
      text = `${base}${sep}ref=${encodeURIComponent(ref)}`;
    } else {
      text = base;
    }
  }
  if (!/^https?:\/\//i.test(text)) {
    return NextResponse.json({ error: '二维码内容必须是 http(s) 地址' }, { status: 400 });
  }

  const png = await QRCode.toBuffer(text, {
    type: 'png',
    width: 480,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#111827', light: '#ffffff' },
  });

  const download = sp.get('download') === '1';
  const headers: Record<string, string> = {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=3600',
  };
  if (download) {
    headers['Content-Disposition'] = `attachment; filename="qrcode-${ref || 'link'}.png"`;
  }

  return new NextResponse(new Uint8Array(png), { status: 200, headers });
}
