/**
 * 站点设置键名常量。
 * 单独放一个文件，是因为客户端组件（设置表单）也要用到键名，
 * 而 lib/settings.ts 带 "server-only"，不能被客户端导入。
 */
export const SETTING_KEYS = {
  siteName: 'site_name',
  contactPhone: 'contact_phone',
  contactWechat: 'contact_wechat',
  icp: 'icp',
  companyName: 'company_name',
  /** 子管理员提交的房源是否需要审核 */
  requireReview: 'require_review',
  /** 归属规则：first=首次归属，last=最后一次点击覆盖 */
  refPolicy: 'ref_policy',
  /** 首页公告 */
  notice: 'notice',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
