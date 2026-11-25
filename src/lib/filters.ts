/** 城市/区域配置。换城市只改这里。 */
export const CITY_NAME = process.env.NEXT_PUBLIC_CITY || '北京';

export const DISTRICTS = [
  '东城区',
  '西城区',
  '朝阳区',
  '海淀区',
  '丰台区',
  '石景山区',
  '通州区',
  '昌平区',
  '大兴区',
  '顺义区',
  '房山区',
  '门头沟区',
  '亦庄开发区',
];

export const DECORATIONS = ['毛坯', '简装', '精装', '豪装'];

export const ORIENTATIONS = ['南', '南北', '东南', '西南', '东', '西', '北'];

export const ROOM_OPTIONS = [
  { label: '一居', value: '1' },
  { label: '两居', value: '2' },
  { label: '三居', value: '3' },
  { label: '四居', value: '4' },
  { label: '五居及以上', value: '5' },
];

export const SORT_OPTIONS = [
  { label: '最新发布', value: 'new' },
  { label: '总价从低到高', value: 'priceAsc' },
  { label: '总价从高到低', value: 'priceDesc' },
  { label: '面积从大到小', value: 'areaDesc' },
  { label: '人气最高', value: 'hot' },
];

export const SALE_PRICE_RANGES = [
  { label: '200万以下', min: 0, max: 200 },
  { label: '200-400万', min: 200, max: 400 },
  { label: '400-600万', min: 400, max: 600 },
  { label: '600-900万', min: 600, max: 900 },
  { label: '900-1500万', min: 900, max: 1500 },
  { label: '1500万以上', min: 1500, max: undefined },
];

export const RENT_PRICE_RANGES = [
  { label: '3000元以下', min: 0, max: 3000 },
  { label: '3000-5000元', min: 3000, max: 5000 },
  { label: '5000-8000元', min: 5000, max: 8000 },
  { label: '8000-12000元', min: 8000, max: 12000 },
  { label: '12000元以上', min: 12000, max: undefined },
];

export function priceRanges(dealType?: string) {
  return dealType === 'RENT' ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
}

export function priceUnit(dealType?: string) {
  return dealType === 'RENT' ? '元/月' : '万';
}
