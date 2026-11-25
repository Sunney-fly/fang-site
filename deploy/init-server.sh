#!/usr/bin/env bash
# 阿里云 ECS（Ubuntu 22.04 / 24.04）服务器初始化脚本
# 作用：装 Node 22 + Nginx + Git，安装 PM2，创建部署目录，配置防火墙与 SWAP
#
# 用法：
#   scp deploy/init-server.sh root@你的服务器IP:/root/
#   ssh root@你的服务器IP
#   bash /root/init-server.sh
#
# 注意：脚本只做环境准备，不会自动拉代码、不会写你的密钥。

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

DEPLOY_DIR="${DEPLOY_DIR:-/www/fang-site}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

# ---------- 1. 基础软件 ----------
log "更新 apt 软件源并安装基础工具（git / curl / nginx / build-essential）"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git nginx openssl build-essential ufw
ok "基础软件安装完成"

# ---------- 2. Node.js 22 ----------
if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -c2-3)" -ge 20 ]]; then
  ok "已存在 Node $(node -v)，跳过安装"
else
  log "安装 Node.js 22 LTS（NodeSource 源）"
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
  ok "Node $(node -v) / npm $(npm -v) 安装完成"
fi

# 国内服务器建议用淘宝镜像加速依赖安装（不影响运行）
if [[ ! -f /root/.npmrc ]]; then
  cat > /root/.npmrc <<'EOF'
registry=https://registry.npmmirror.com
EOF
  ok "已配置 npm 国内镜像（/root/.npmrc）"
fi

# ---------- 3. PM2 ----------
if ! command -v pm2 >/dev/null 2>&1; then
  log "安装 PM2 进程守护工具"
  npm install -g pm2
  pm2 startup systemd -u root --hp /root | tail -n 1 > /tmp/pm2-startup.sh || true
  ok "PM2 安装完成（首次部署后执行：pm2 save）"
else
  ok "PM2 已安装"
fi

# ---------- 4. 部署目录 ----------
log "创建部署目录 ${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}/public/uploads"
ok "部署目录就绪"

# ---------- 5. SWAP（2G 内存的机器编译容易 OOM）----------
if [[ ! -f /swapfile ]]; then
  log "创建 ${SWAP_SIZE} SWAP，避免构建时内存不足被杀"
  fallocate -l "${SWAP_SIZE}" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "SWAP 已启用（$(free -h | awk '/Swap/{print $2}')）"
else
  ok "SWAP 已存在，跳过"
fi

# ---------- 6. 防火墙 ----------
log "配置 ufw：放行 22 / 80 / 443，其余拒绝"
ufw allow 22/tcp   >/dev/null
ufw allow 80/tcp   >/dev/null
ufw allow 443/tcp  >/dev/null
ufw --force enable  >/dev/null
ok "防火墙已启用（数据库 3306 不对公网开放）"

# ---------- 7. Nginx 站点 ----------
if [[ ! -f /etc/nginx/conf.d/fang.conf ]]; then
  warn "还没有 /etc/nginx/conf.d/fang.conf"
  warn "请把项目里的 deploy/nginx.conf 复制过去，并改掉域名与 uploads 路径，然后执行：nginx -t && systemctl reload nginx"
fi

systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx || true

# ---------- 8. 完成提示 ----------
cat <<EOF

$(echo -e "${GREEN}服务器环境准备完成 ✔${NC}")

接下来在服务器上执行：

  cd ${DEPLOY_DIR}
  # 1) 上传或 clone 代码到该目录（例如用 git clone，或用宝塔/FileZilla 上传）
  # 2) 创建并修改环境变量
  cp .env.example .env && vi .env

  # 3) 安装依赖并构建
  npm install
  npx prisma generate
  npx prisma db push          # 建表（数据库已就绪时）
  npm run build

  # 4) 启动
  pm2 start npm --name fang-site -- start
  pm2 save

  # 5) 配置 Nginx 反向代理（见 deploy/nginx.conf）
  cp deploy/nginx.conf /etc/nginx/conf.d/fang.conf
  vi /etc/nginx/conf.d/fang.conf        # 改域名和 uploads 路径
  nginx -t && systemctl reload nginx

  # 6) 申请 HTTPS 证书
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d www.你的域名.com -d 你的域名.com

  # 7) 健康检查
  curl http://127.0.0.1:3000/api/health

EOF
