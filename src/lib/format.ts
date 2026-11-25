export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || '安居二手房';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** 价格展示：出售显示"XX万"，出租显示"XXXX元/月" */
export function formatPrice(listing: {
  dealType?: string | null;
  priceWan?: number | string | null;
  rentYuan?: number | string | null;
}): string {
  const isRent = listing.dealType === 'RENT';
  const v = isRent ? listing.rentYuan : listing.priceWan;
  if (v === null || v === undefined || v === '') return '价格面议';
  const n = Number(v);
  if (!Number.isFinite(n)) return '价格面议';
  return isRent ? `${trimNum(n)} 元/月` : `${trimNum(n)} 万`;
}

/** 单价 元/㎡ */
export function formatUnitPrice(listing: {
  dealType?: string | null;
  unitPrice?: number | string | null;
  priceWan?: number | string | null;
  area?: number | string | null;
}): string | null {
  let unit = listing.unitPrice === null || listing.unitPrice === undefined ? null : Number(listing.unitPrice);
  if ((unit === null || !Number.isFinite(unit)) && listing.dealType === 'SALE') {
    const p = Number(listing.priceWan);
    const a = Number(listing.area);
    if (Number.isFinite(p) && Number.isFinite(a) && a > 0) unit = Math.round((p * 10000) / a);
  }
  if (unit === null || !Number.isFinite(unit)) return null;
  return `${Math.round(unit).toLocaleString('zh-CN')} 元/㎡`;
}

export function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export function formatArea(area: number | string | null | undefined): string {
  if (area === null || area === undefined || area === '') return '--';
  return `${trimNum(Number(area))}㎡`;
}

/** 楼层展示：中楼层/共18层 */
export function formatFloor(floor?: number | null, total?: number | null): string {
  if (floor === null || floor === undefined) return '--';
  if (!total) return `${floor}层`;
  const pos = floor <= Math.max(1, Math.floor(total / 3)) ? '低' : floor >= Math.ceil((total * 2) / 3) ? '高' : '中';
  return `${pos}楼层/共${total}层`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '--';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function formatDay(d: Date | string | null | undefined): string {
  if (!d) return '--';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** 相对时间：刚刚 / 5分钟前 / 3小时前 / 2天前 */
export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return '--';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  if (diff < 30 * 86400_000) return `${Math.floor(diff / 86400_000)}天前`;
  return formatDay(date);
}

/** 手机号脱敏 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || '--';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export const DEAL_TYPE_LABEL: Record<string, string> = { SALE: '出售', RENT: '出租' };

export const LISTING_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  PUBLISHED: '已上架',
  OFFLINE: '已下架',
  REJECTED: '已驳回',
  SOLD: '已成交',
};

export const LISTING_STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-100 text-amber-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  OFFLINE: 'bg-slate-200 text-slate-600',
  REJECTED: 'bg-rose-100 text-rose-700',
  SOLD: 'bg-brand-100 text-brand-700',
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: '待跟进',
  CONTACTED: '已联系',
  FOLLOWING: '跟进中',
  VIEWED: '已带看',
  DEAL: '已成交',
  INVALID: '无效',
};

export const LEAD_STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-rose-100 text-rose-700',
  CONTACTED: 'bg-amber-100 text-amber-700',
  FOLLOWING: 'bg-brand-100 text-brand-700',
  VIEWED: 'bg-indigo-100 text-indigo-700',
  DEAL: 'bg-emerald-100 text-emerald-700',
  INVALID: 'bg-slate-100 text-slate-500',
};

export const LEAD_SOURCE_LABEL: Record<string, string> = {
  FORM: '留资表单',
  APPOINTMENT: '预约看房',
  PHONE_CLICK: '电话咨询',
  WECHAT_CLICK: '微信咨询',
  MANUAL: '后台代录',
};

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  DONE: '已完成',
  CANCELED: '已取消',
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  AGENT_CARD: '业务员名片',
  POSTER: '房源海报',
  LANDING_PAGE: '落地页',
  ARTICLE: '文章/朋友圈',
  ADS: '广告投放',
};

/** 把相对路径补成绝对地址，用于生成二维码和分享链接 */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : '/' + path}`;
}
