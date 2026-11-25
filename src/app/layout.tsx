import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE_NAME, SITE_URL } from '@/lib/format';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - 真实房源，专业经纪人一对一服务`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    '二手房、租房房源信息平台。真实在售房源、专业经纪人一对一服务，支持在线留资、预约看房。',
  keywords: ['二手房', '买房', '卖房', '租房', '房源', '经纪人', '房产中介'],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'zh_CN',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2f86f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
