import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/format';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/fang', '/agent'],
        // 后台、接口、上传目录不需要被收录
        disallow: ['/admin', '/my', '/api/', '/uploads/'],
      },
      // 常见的中文搜索引擎爬虫
      { userAgent: 'Baiduspider', allow: ['/', '/fang', '/agent'], disallow: ['/admin', '/my', '/api/'] },
      { userAgent: 'Sogou web spider', allow: ['/', '/fang', '/agent'], disallow: ['/admin', '/my', '/api/'] },
      { userAgent: '360Spider', allow: ['/', '/fang', '/agent'], disallow: ['/admin', '/my', '/api/'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
