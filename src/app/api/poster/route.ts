import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { prisma, num } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isStaff } from '@/lib/permissions';
import { absoluteUrl, formatArea, formatFloor, formatPrice } from '@/lib/format';
import { SITE_NAME } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 一键生成房源海报（SVG，浏览器可直接下载/长按保存）。
 *
 * 为什么生成 SVG 而不是 PNG：不依赖任何图像处理库，服务器开销极小，
 * 微信、手机相册都能正常保存和显示。海报由上层 nginx / 浏览器渲染。
 *
 * 用法：
 *   /api/poster?listing=<id>&ref=<业务员推广码>
 *   不带 ref 时用当前登录业务员自己的推广码。
 */
const W = 1080;
const H = 1440;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 按字符宽度折行（中文按 1 个字宽算） */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    cur += ch;
    if (cur.length >= maxChars) {
      lines.push(cur);
      cur = '';
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && text.length > lines.join('').length) {
    lines[maxLines - 1] = lines[maxLines - 1]!.slice(0, maxChars - 1) + '…';
  }
  return lines;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const listingId = (sp.get('listing') || '').trim();
  let refCode = (sp.get('ref') || '').trim().slice(0, 64);
  const download = sp.get('download') === '1';

  if (!listingId) {
    return NextResponse.json({ error: '缺少 listing 参数' }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      images: { orderBy: { sort: 'asc' }, take: 1 },
      agent: {
        select: { name: true, phone: true, agentProfile: { select: { refCode: true, title: true, contactPhone: true } } },
      },
    },
  });

  if (!listing) return NextResponse.json({ error: '房源不存在' }, { status: 404 });
  if (listing.status !== 'PUBLISHED') {
    return NextResponse.json({ error: '该房源尚未上架，不能生成海报' }, { status: 400 });
  }

  // 没指定推广码时，用当前登录业务员自己的
  if (!refCode) {
    const user = await getCurrentUser();
    if (user && isStaff(user.role)) {
      const p = await prisma.agentProfile.findUnique({
        where: { userId: user.id },
        select: { refCode: true },
      });
      refCode = p?.refCode ?? '';
    }
  }

  const price = formatPrice({
    dealType: listing.dealType,
    priceWan: num(listing.priceWan),
    rentYuan: num(listing.rentYuan),
  });

  // 扫码/点击进入的链接（带归属参数）
  const target = refCode ? `${absoluteUrl(`/fang/${listing.id}`)}?ref=${encodeURIComponent(refCode)}` : absoluteUrl(`/fang/${listing.id}`);
  const qrDataUrl = await QRCode.toDataURL(target, {
    width: 480,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#111827', light: '#ffffff' },
  });

  const agent = listing.agent;
  const agentName = agent?.name ?? SITE_NAME;
  const agentTitle = agent?.agentProfile?.title ?? '房产顾问';
  const agentPhone = agent?.agentProfile?.contactPhone || agent?.phone || '';
  const isRent = listing.dealType === 'RENT';

  const specs = [
    listing.layout,
    listing.area ? formatArea(num(listing.area)) : null,
    listing.floor !== null ? formatFloor(listing.floor, listing.totalFloors) : null,
    listing.orientation,
    listing.decoration,
    listing.ownership,
  ]
    .filter(Boolean)
    .slice(0, 3) as string[];

  const highlights = (listing.highlights ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const titleLines = wrap(listing.title, 16, 2);
  const cover = listing.images[0]?.url ?? null;
  const coverHref = cover ? absoluteUrl(cover) : null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <clipPath id="coverClip"><rect x="0" y="0" width="${W}" height="620" rx="0"/></clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- 封面图 -->
  ${
    coverHref
      ? `<image xlink:href="${esc(coverHref)}" x="0" y="0" width="${W}" height="620" preserveAspectRatio="xMidYMid slice" clip-path="url(#coverClip)"/>`
      : `<rect x="0" y="0" width="${W}" height="620" fill="#e2e8f0"/>
         <text x="${W / 2}" y="320" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="40" fill="#94a3b8">房源实拍图</text>`
  }
  <rect x="0" y="540" width="${W}" height="80" fill="rgba(15,23,42,0.55)"/>

  <!-- 封面上的价格 -->
  <text x="56" y="600" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="72" font-weight="bold" fill="#ffffff">${esc(price)}</text>
  <text x="56" y="500" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="28" fill="#ffffff" opacity="0.9">${isRent ? '出租' : '出售'} · ${esc(listing.district ?? '')}${listing.businessArea ? ' · ' + esc(listing.businessArea) : ''}</text>

  <!-- 标题 -->
  ${titleLines
    .map(
      (line, i) =>
        `<text x="56" y="${700 + i * 56}" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="44" font-weight="bold" fill="#0f172a">${esc(line)}</text>`,
    )
    .join('\n  ')}

  <!-- 参数 -->
  ${specs
    .map(
      (s, i) =>
        `<g>
          <rect x="${56 + i * 300}" y="800" width="280" height="76" rx="14" fill="#eff6ff"/>
          <text x="${56 + i * 300 + 140}" y="848" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="32" fill="#1d4ed8">${esc(s)}</text>
        </g>`,
    )
    .join('\n  ')}

  <!-- 卖点 -->
  ${highlights
    .map(
      (h, i) =>
        `<text x="56" y="${940 + i * 46}" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="30" fill="#475569">· ${esc(h.slice(0, 24))}</text>`,
    )
    .join('\n  ')}

  <!-- 底部：二维码 + 经纪人 -->
  <rect x="0" y="1090" width="${W}" height="350" fill="#ffffff"/>
  <line x1="56" y1="1090" x2="${W - 56}" y2="1090" stroke="#e2e8f0" stroke-width="2"/>

  <image xlink:href="${qrDataUrl}" x="56" y="1150" width="240" height="240"/>
  <text x="56" y="1430" text-anchor="start" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" fill="#64748b">长按识别 · 查看房源详情</text>

  <text x="350" y="1200" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="40" font-weight="bold" fill="#0f172a">${esc(agentName)}</text>
  <text x="350" y="1252" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="30" fill="#64748b">${esc(agentTitle)}</text>
  ${
    agentPhone
      ? `<text x="350" y="1320" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="38" font-weight="bold" fill="#e11d48">${esc(agentPhone)}</text>
         <text x="350" y="1372" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="26" fill="#94a3b8">电话 / 微信同号</text>`
      : ''
  }
  <text x="350" y="1420" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" fill="#94a3b8">${esc(SITE_NAME)} · ${esc(listing.code)}</text>
</svg>`;

  const headers: Record<string, string> = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    // 房源或经纪人信息可能变，缓存短一点
    'Cache-Control': 'public, max-age=300',
  };
  if (download) {
    headers['Content-Disposition'] = `attachment; filename="poster-${listing.code}.svg"`;
  }

  return new NextResponse(svg, { status: 200, headers });
}
