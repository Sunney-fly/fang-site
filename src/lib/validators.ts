import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^1[3-9]\d{9}$/, '请输入正确的 11 位手机号');

export const passwordSchema = z
  .string()
  .min(6, '密码至少 6 位')
  .max(64, '密码最多 64 位');

export const nameSchema = z.string().trim().min(1, '请填写姓名').max(20, '姓名最多 20 字');

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, '请输入密码'),
});

export const registerSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  name: nameSchema,
});

/** 房源筛选参数（从 URL query 解析） */
export const listingQuerySchema = z.object({
  q: z.string().trim().max(50).optional(),
  dealType: z.enum(['SALE', 'RENT']).optional(),
  district: z.string().trim().max(30).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  rooms: z.string().trim().max(10).optional(),
  minArea: z.coerce.number().nonnegative().optional(),
  maxArea: z.coerce.number().nonnegative().optional(),
  decoration: z.string().trim().max(20).optional(),
  sort: z.enum(['new', 'priceAsc', 'priceDesc', 'areaDesc', 'hot']).optional(),
  page: z.coerce.number().int().positive().max(500).optional(),
  ref: z.string().trim().max(64).optional(),
});

export type ListingQuery = z.infer<typeof listingQuerySchema>;

/** 留资表单 */
export const leadSchema = z.object({
  name: z.string().trim().max(20).optional().or(z.literal('')),
  phone: phoneSchema,
  wechat: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().max(500).optional().or(z.literal('')),
  listingId: z.string().trim().max(64).optional().or(z.literal('')),
  source: z.enum(['FORM', 'APPOINTMENT', 'PHONE_CLICK', 'WECHAT_CLICK', 'MANUAL']).optional(),
});

/** 预约看房 */
export const appointmentSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  wechat: z.string().trim().max(40).optional().or(z.literal('')),
  expectAt: z.string().trim().max(40).optional().or(z.literal('')),
  remark: z.string().trim().max(500).optional().or(z.literal('')),
  listingId: z.string().trim().max(64).optional().or(z.literal('')),
});

/** 房源新增/编辑 */
export const listingInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(4, '标题至少 4 个字').max(80, '标题最多 80 字'),
  dealType: z.enum(['SALE', 'RENT']),
  community: z.string().trim().min(1, '请填写小区名称').max(50),
  district: z.string().trim().max(30).optional().or(z.literal('')),
  businessArea: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(120).optional().or(z.literal('')),
  priceWan: z.coerce.number().nonnegative().max(100000).optional(),
  rentYuan: z.coerce.number().nonnegative().max(1000000).optional(),
  area: z.coerce.number().nonnegative().max(100000).optional(),
  layout: z.string().trim().max(30).optional().or(z.literal('')),
  rooms: z.coerce.number().int().nonnegative().max(20).optional(),
  halls: z.coerce.number().int().nonnegative().max(20).optional(),
  bathrooms: z.coerce.number().int().nonnegative().max(20).optional(),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  totalFloors: z.coerce.number().int().nonnegative().max(200).optional(),
  orientation: z.string().trim().max(20).optional().or(z.literal('')),
  decoration: z.string().trim().max(20).optional().or(z.literal('')),
  buildingType: z.string().trim().max(20).optional().or(z.literal('')),
  hasElevator: z.coerce.boolean().optional(),
  buildYear: z.coerce.number().int().min(1900).max(2100).optional(),
  ownership: z.string().trim().max(30).optional().or(z.literal('')),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  highlights: z.string().trim().max(1000).optional().or(z.literal('')),
  ownerName: z.string().trim().max(20).optional().or(z.literal('')),
  ownerPhone: z.string().trim().max(20).optional().or(z.literal('')),
  isFeatured: z.coerce.boolean().optional(),
  images: z.array(z.string().trim().max(300)).max(20).optional(),
  submit: z.enum(['draft', 'pending']).optional(),
});

export type ListingInput = z.infer<typeof listingInputSchema>;

/** 把 zod 错误压成"字段: 提示"的可读信息 */
export function zodMessage(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '参数'}: ${i.message}`)
    .join('；');
}

export function parseForm<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true as const, data: r.data as z.infer<T> };
  return { ok: false as const, error: zodMessage(r.error) };
}
