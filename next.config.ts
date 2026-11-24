import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 部署在阿里云 ECS + Nginx 反代后面，产物尽量自包含
  output: 'standalone',
  // 明确工作区根目录，避免上层目录的 lockfile 让 Next 猜错
  outputFileTracingRoot: __dirname,
  images: {
    // 房源图片由本地上传目录 /uploads 提供，不再走 next/image 远程优化
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // 房源图片上传走 Server Action
      bodySizeLimit: '12mb',
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
