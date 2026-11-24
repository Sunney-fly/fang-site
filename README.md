# 二手房房源网站

一个面向二手房经纪的**获客 + 私域转化**系统。核心解决的问题是：
把微信客户、线下客户、自然流量都沉到自己的私域池里，并且能精确回答
「**这个客户是谁带来的**」。

---

## 一、它有什么

### 五种角色（管理员分级）

| 角色 | 能做什么 |
| --- | --- |
| **游客** | 浏览房源、筛选搜索、看详情、留资咨询、预约看房（无需登录） |
| **用户**（注册客户） | 收藏房源、查看自己的预约与咨询记录 |
| **子管理员**（业务员/经纪人） | 发布与上下架**自己的**房源、查看**自己的**客户线索、生成专属推广链接与二维码 |
| **管理员** | 审核子管理员提交的房源、管理子管理员与用户、查看全站数据统计 |
| **超级管理员** | 以上全部 + 系统设置、创建管理员账号 |

### 客户归属追踪（这套系统的核心）

```
业务员生成专属链接/二维码
        ↓  客户在微信里点开 /fang?ref=zhangming
浏览器写入 90 天归属 Cookie（首次归属优先，不被后来的链接覆盖）
        ↓
客户浏览房源 → 系统记录他的全部轨迹（看了哪些房、几次、手机还是电脑）
        ↓
客户留资 / 预约看房
        ↓
线索自动落到该业务员的「客户线索」里，并标记来自哪张海报/哪个码
        ↓
后台按子管理员统计：带来多少访客、留下多少线索、转化率、成交几单
```

支持三层追踪参数：

- `?ref=zhangming` —— 业务员的个人推广码（一人一码）
- `?sc=haibao-zhangming-01` —— 具体渠道码（同一业务员的名片 / 海报 / 落地页 / 广告分别统计）
- 房源海报码 —— 直接落到某一套房源

归属优先级：**表单显式带的码 → 浏览器归属 Cookie → 房源所属业务员**。
所以即使客户先看了 A 业务员分享的房源、三个月后才留资，也依然算 A 的客户。

### 主要功能清单

**游客端**
- 首页：区域入口、精选房源、经纪人墙、转化引导
- 房源列表：区域 / 价格 / 户型 / 装修 / 排序多维筛选，URL 可分享、可被搜索引擎收录
- 房源详情：图片相册、卖点、参数表、相似房源、经纪人卡片、留资表单、预约看房、一键分享（带归属参数）

**用户端**：注册登录、收藏、我的预约、我的咨询

**子管理员端**
- **手机工作台**（业务员主力入口，`/admin/m`）：底部四个 Tab，一屏看到今天该干什么；线索卡片上直接「打电话 / 发短信 / 标记跟进」
- 手机号"加房源"极简表单（`/admin/m/listings/new`）：拍照上传 → 填小区价格面积 → 提交，30 秒挂一套房
- 发布 / 编辑 / 上下架自己的房源（图片上传、封面排序、卖点、业主信息）
- **一键生成房源海报**：房源实拍图 + 价格 + 参数 + 业务员二维码，可发朋友圈/微信群
- 客户线索池：状态流转、写跟进记录、标记已加微信（私域转化）、一键拨号
- 预约看房处理
- 推广与归属：专属链接与二维码、多渠道码管理、访客轨迹、个人获客数据

**管理后台**
- 总览看板：房源状态分布、近 30 天访客与转化、待跟进线索、待处理预约、热门房源
- 房源管理：筛选、审核、置顶、精选、上下架、标记成交、删除
- 客户线索：全站线索、改派归属、筛选搜索
- 子管理员管理：创建账号、设置推广码、服务区域、重置密码
- 用户管理：启用停用、改名、重置密码
- 数据统计：获客排行、近 14 天趋势、转化率
- **客户提醒**：客户一留资，立刻推到业务员手机（见下）
- 系统设置：站点信息、备案号、**子管理员房源是否需审核**、归属规则

### 客户留资实时提醒（重要）

行业经验：**客户留资后 5 分钟内回电，成交率最高**。靠人工刷后台一定会漏客户，
所以系统内置了推送。考虑到多数中小中介没有企业微信/公众号，提供几种零门槛渠道：

| 渠道 | 适合谁 | 怎么配 |
| --- | --- | --- |
| **WxPusher**（推荐） | 要独立 App、消息不被折叠 | 见下方三步 |
| **Server酱** | 只想用微信收 | 打开 sct.ftqq.com 微信扫码登录 → 复制 SendKey |
| **PushPlus** | 同上，另一种选择 | 打开 pushplus.plus 扫码登录 → 复制 token |
| **企业微信群机器人** | 以后有企业微信 | 群设置 → 群机器人 → 复制 Webhook |
| **自定义 Webhook** | 想接钉钉/飞书/自建 | 系统会 POST `{ title, content, url, at }` |

#### WxPusher 配置三步（有个坑必须避开）

1. 打开 [wxpusher.zjiecode.com/admin](https://wxpusher.zjiecode.com/admin/) 微信扫码登录
2. **创建应用**，拿到 **App Token**（`AT_` 开头）；在应用详情里复制 **订阅二维码 / 订阅链接**
3. ⚠️ **必须用你自己的微信扫码订阅这个应用**，否则推送会返回
   `code: 1001 用户UID=[...]未订阅应用` —— 这是最常见的坑。订阅后在「用户管理」里能看到自己的
   **UID**（`UID_` 开头）

把 App Token 和 UID 填到 **后台 → 系统设置 → 客户提醒**（多个接收人用逗号分隔，例如把老板也加上），
选 WxPusher 保存，再点「📲 发送测试提醒」。

> 系统的成功判定看的是**每个接收人的投递结果**，不是接口的 HTTP 200。
> WxPusher 顶层返回 `code: 1000` 只代表"任务已接受"；若某人没订阅，页面会直接告诉你
> "有 N 个接收人未订阅该应用"并给出解决办法，不会假装成功。

页面下方能看到最近的提醒记录，便于排查。

### 其他工程细节

- **图片自动压缩**：业务员用手机拍的 5-6MB 照片，服务端自动转 WebP 并压到长边 1600px，
  实测 5.8MB → 0.79MB（真实照片通常 150-300KB），客户在微信里打开明显更快
- **SEO**：`/sitemap.xml`、`/robots.txt`，房源详情内嵌 schema.org `RealEstateListing` 结构化数据，
  客户在搜索引擎里能直接看到价格、户型、面积；分享到微信有自动生成的卡片图
- **防刷**：留资/注册/登录/上传都有基于 IP 的频率限制

---

## 二、技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 15（App Router，全栈，含 SEO 服务端渲染） |
| 语言 | TypeScript |
| 数据库 | PostgreSQL 16 + Prisma 6 |
| 样式 | Tailwind CSS 3 |
| 认证 | 自研 JWT 会话（jose）+ bcryptjs，HttpOnly Cookie |
| 图片 | 本地上传目录（现网由入口代理直出 `/uploads/*`，见「上线」一节） |
| 二维码 | qrcode（服务端生成 PNG） |

没有引入图表库、组件库、状态管理库，依赖很少，好维护、好部署。

---

## 三、快速开始（本地开发）

### 1. 准备 PostgreSQL

任选一种：

**方式 A：本机已装 PostgreSQL 16**
```sql
CREATE DATABASE fang_site;
CREATE USER fang WITH PASSWORD 'fang123456';
GRANT ALL PRIVILEGES ON DATABASE fang_site TO fang;
ALTER DATABASE fang_site OWNER TO fang;
```

**方式 B：已有 Docker（推荐，最省事）**
```bash
docker run -d --name fang-postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=fang123456 \
  -e POSTGRES_USER=fang \
  -e POSTGRES_DB=fang_site \
  -e TZ=Asia/Shanghai postgres:16
```

### 2. 配置环境变量

```bash
cp env.example .env
```
按需修改 `.env`，至少确认这三项：
- `DATABASE_URL` 数据库连接串
- `SESSION_SECRET` 会话密钥（`openssl rand -base64 48` 生成）
- `NEXT_PUBLIC_SITE_URL` 对外访问地址（**推广二维码和分享链接基于它生成，上线前必须改成正式域名**）

### 3. 安装依赖、建表、灌入演示数据

```bash
npm install
npx prisma generate
npx prisma db push            # 建表
npm run db:seed               # 写入演示数据（25 套房、4 个业务员、近 21 天流量）
```

### 4. 启动

```bash
npm run dev
```
打开 http://localhost:3000

先确保本地 PostgreSQL 已启动（`docker compose up -d postgres` 或本机 PostgreSQL 服务），再 `npm run dev`。

### 5. 演示账号

| 角色 | 手机号 | 密码 |
| --- | --- | --- |
| 超级管理员 | 13800000000 | admin123456 |
| 管理员 | 13800000001 | admin123456 |
| 子管理员（张明，码 `zhangming`） | 13900000001 | agent123456 |
| 子管理员（刘婷，码 `liuting`） | 13900000002 | agent123456 |
| 子管理员（陈浩，码 `chenhao`） | 13900000003 | agent123456 |
| 子管理员（赵雪，码 `zhaoxue`） | 13900000004 | agent123456 |
| 普通用户 | 13700000001 | user123456 |

> ⚠️ 上线前务必到「后台 → 用户管理」修改所有演示账号密码。

### 6. 亲眼看一遍归属追踪

1. 浏览器（建议无痕窗口）打开 `http://localhost:3000/fang?ref=zhangming`
2. 随便点进一套房源，在右侧表单留下手机号
3. 用 `13900000001 / agent123456` 登录，进「客户线索」
4. 刚才那条线索的主人就是**张明**，并且能看到客户看过哪些页面

---

## 四、常用命令

```bash
npm run dev            # 开发服务器
npm run build          # 生产构建（内含 prisma generate；首页是 ISR，构建时要能连数据库）
npm start              # 启动生产服务
npm run typecheck      # TypeScript 全量类型检查
npm run db:push        # 按 schema 同步表结构（开发）
npm run db:deploy      # 执行迁移（生产；需先用 prisma migrate dev 生成迁移文件）
npm run db:seed        # 写入演示数据
npm run db:reset-demo  # 清空业务数据（保留账号）
npm run db:studio      # 可视化查看数据库
node scripts/e2e-attribution.mjs   # 归属追踪端到端验证（29 项断言）
node scripts/e2e-admin.mjs         # 后台页面、权限矩阵、海报/SEO/健康检查（54 项断言）
node scripts/e2e-notify.mjs        # 客户留资提醒推送验证（12 项断言，自带假接收端）
node scripts/e2e-image.mjs         # 图片压缩验证（9 项断言，跑完自动清理测试图）
```

> 这三个脚本需要开发服务器已在运行（`npm run dev`）。`e2e-notify.mjs` 会在结束时
> 把提醒配置恢复为「未开启」，不会留下测试配置。

### 本地数据库

用 Docker 起最省事：

```bash
docker compose up -d postgres
```

---

## 五、上线到阿里云服务器

> **现网状态：部署于单台 ECS，宿主机 Nginx 按 Host 反代到 `127.0.0.1:3100`。**
> 具体步骤与踩坑见 **[部署手册.md](./部署手册.md)** 的「现网部署实况」一节。

通用的两条路线（Docker 一键 / 传统 PM2+Nginx）也在 **[部署手册.md](./部署手册.md)** 里，
包含服务器初始化脚本、Nginx 配置、HTTPS 证书、备份与排错。

### 部署这件事上的两个硬性注意点

1. **`NEXT_PUBLIC_SITE_URL` 是构建期内联的**：推广二维码、分享链接、`sitemap.xml`
   都用它。改域名必须重新构建镜像，改运行期环境变量没用。
2. **Next 生产模式对 `public/` 是启动时快照**：运行时新上传的图片，直接由 Next
   提供会 404（重启进程才可见）。本项目已让入口代理直接从 Docker 卷
   `fang-site_uploads` 直出 `/uploads/*` 绕开该问题；若改用 Nginx，请把
   `location /uploads/` 指向该卷目录。

---

## 六、目录结构

```
fang-site/
├── prisma/
│   ├── schema.prisma        数据模型（用户分级、房源、线索、归属追踪）
│   ├── seed.ts              演示数据
│   └── reset.ts             清空业务数据
├── public/uploads/          房源图片与二维码（生产环境由 Nginx 直接服务）
├── scripts/
│   ├── e2e-attribution.mjs  归属追踪端到端验证
│   └── e2e-admin.mjs        后台权限矩阵验证
├── deploy/
│   ├── nginx.conf           反向代理配置
│   └── init-server.sh       阿里云 ECS 初始化脚本
├── src/
│   ├── app/
│   │   ├── (public)/        游客端 + 用户端（/、/fang、/agent、/login、/my）
│   │   ├── admin/           管理后台（含 actions.ts 全部写操作与权限校验）
│   │   ├── api/             登录注册、埋点、留资、预约、收藏、上传、二维码、健康检查
│   │   └── layout.tsx
│   ├── components/          前台组件 + admin/ 后台组件
│   ├── lib/
│   │   ├── attribution.ts   归属 Cookie 与参数解析（Edge 安全，无数据库依赖）
│   │   ├── track.ts         埋点写库与归属码解析
│   │   ├── listings.ts      房源查询
│   │   ├── auth.ts          会话、密码、权限守卫
│   │   ├── permissions.ts   角色分级与后台导航
│   │   └── validators.ts    zod 校验
│   └── middleware.ts        发放访客标识 + 写入归属 Cookie
├── Dockerfile
├── docker-compose.yml
```

---

## 七、二次开发提示

- **换城市**：改 `src/lib/filters.ts` 里的 `DISTRICTS` 和 `.env` 的 `NEXT_PUBLIC_CITY`
- **换品牌色**：改 `tailwind.config.ts` 里的 `brand` 色板
- **加房源字段**：改 `prisma/schema.prisma` → `npx prisma db push` → 在 `ListingForm.tsx` 加输入项 → 在 `Listings` 详情页加展示
- **图片改存 OSS**：只需重写 `src/app/api/upload/route.ts`，其它代码不用动
- **接入微信登录 / 企业微信**：`src/lib/auth.ts` 的 `createSession` 是统一入口，加一个 OAuth 回调写会话即可
- **归属规则改成"最后点击优先"**：`src/middleware.ts` 里存在归属 Cookie 时改为覆盖写入

---

## 八、安全说明

已实现的防护：

- 密码 bcrypt 加盐哈希，登录失败文案不区分「手机号不存在」和「密码错误」
- 会话为 HttpOnly + SameSite=Lax Cookie，生产环境自动加 Secure
- 登录 / 注册 / 留资 / 上传都有基于 IP 的频率限制（内存版，多实例部署建议换 Redis）
- 所有后台写操作都在 Server Action 首行做角色校验，子管理员只能操作自己的房源与线索
- 未被审核 / 已下架的房源对游客返回 404，不泄露内部房源
- 后台操作全部写入 `AuditLog`，可追溯谁改了什么
- 业主电话、客户手机号在列表中脱敏，仅归属人和管理员可见

上线时请务必：

1. 修改所有演示账号密码
2. 设置强随机的 `SESSION_SECRET`
3. 数据库不要对公网开放端口（部署包已默认只监听 127.0.0.1）
4. 配置 HTTPS，并把 `NEXT_PUBLIC_SITE_URL` 改成 https 域名
5. 定期备份数据库与 `public/uploads` 目录