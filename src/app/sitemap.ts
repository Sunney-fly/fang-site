import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { SITE_URL } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/**
 * 站点地图。
 * 让百度/微信搜一搜/谷歌能收录你的房源页 —— 自然流量要沉到自己的官网，
 * 前提是搜索引擎能爬到这些页面。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/fang`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/fang?dealType=RENT`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/agent`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const [listings, agents, districts] = await Promise.all([
      prisma.listing.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      }),
      prisma.agentProfile.findMany({
        select: { refCode: true, updatedAt: true },
        take: 500,
      }),
      prisma.listing.findMany({
        where: { status: 'PUBLISHED', district: { not: null } },
        select: { district: true },
        distinct: ['district'],
      }),
    ]);

    return [
      ...staticEntries,
      ...districts
        .filter((d) => d.district)
        .map((d) => ({
          url: `${SITE_URL}/fang?district=${encodeURIComponent(d.district as string)}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        })),
      ...listings.map((l) => ({
        url: `${SITE_URL}/fang/${l.id}`,
        lastModified: l.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...agents.map((a) => ({
        url: `${SITE_URL}/agent/${a.refCode}`,
        lastModified: a.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ];
  } catch (e) {
    // 数据库没就绪时不要让 sitemap 直接 500
    console.error('[sitemap]', e);
    return staticEntries;
  }
}
