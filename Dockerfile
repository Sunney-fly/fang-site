# syntax=docker/dockerfile:1
# ===== 二手房网站生产镜像 =====
# 多阶段构建：builder 装依赖并编译，runner 只保留运行所需文件，镜像更小。
# 说明：项目启用了 output: 'standalone'，运行阶段用 .next/standalone/server.js 启动。

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
# 国内网络：npm 走 npmmirror；apt 换阿里云镜像（bookworm 用 deb822 格式的 debian.sources）
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
# Prisma 的查询引擎默认从 binaries.prisma.sh 下载，国内经常超时/失败，换 npmmirror 镜像
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' \
      /etc/apt/sources.list.d/debian.sources 2>/dev/null || true
WORKDIR /app

# ---------- 依赖 ----------
FROM base AS deps
# Prisma 需要 openssl 才能正常运行引擎
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------- 构建 ----------
FROM base AS builder
# 2G 内存的小机器上构建：限制 V8 堆，避免 OOM 被 kill
ENV NODE_OPTIONS=--max-old-space-size=768
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 首页/经纪人页改成了 ISR，构建时会把它们预渲染成静态页——那一步要连数据库。
# 连接串通过 BuildKit secret 传进来，不写进镜像层、不出现在镜像历史里。
# NEXT_PUBLIC_* 是构建期内联的，必须在这里传入，改域名要重新构建
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ARG NEXT_PUBLIC_SITE_NAME="安居二手房"
ARG NEXT_PUBLIC_CITY="北京"
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_SITE_NAME=${NEXT_PUBLIC_SITE_NAME} \
    NEXT_PUBLIC_CITY=${NEXT_PUBLIC_CITY}
RUN --mount=type=secret,id=dburl,required=false \
    set -eu; \
    if [ -f /run/secrets/dburl ]; then DATABASE_URL="$(cat /run/secrets/dburl)"; export DATABASE_URL; fi; \
    npx prisma generate && npm run build

# ---------- 运行 ----------
FROM base AS runner
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/*

# 非 root 用户运行，降低风险
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 产物 + 静态资源 + public 目录
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema 与迁移（容器内可执行 db push / migrate deploy）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 上传目录：用 volume 挂出来，重建容器不丢房源图片
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
