/**
 * 种子数据脚本
 * 用法：npx tsx prisma/seed.ts
 *
 * 会创建：
 *  - 1 个超级管理员、1 个管理员、4 个子管理员（每人一个专属推广码）
 *  - 3 个普通注册用户
 *  - 22 套已上架房源 + 2 套待审核 + 1 套草稿（演示状态流转）
 *  - 渠道码（名片码 / 海报码）
 *  - 近 21 天的模拟访问、留资、预约数据，让数据看板一打开就有东西看
 *
 * 全部使用 upsert / 固定手机号，可重复执行。
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

/** 演示密码统一，方便第一次登录体验 */
const PWD = {
  super: 'admin123456',
  admin: 'admin123456',
  agent: 'agent123456',
  user: 'user123456',
};

const COMMUNITY_POOL: Array<{
  name: string;
  district: string;
  area: string;
  pricePerSqm: number; // 参考单价 元/㎡
}> = [
  { name: '望京西园三区', district: '朝阳区', area: '望京', pricePerSqm: 72000 },
  { name: '建外SOHO', district: '朝阳区', area: '国贸', pricePerSqm: 88000 },
  { name: '金地名京', district: '朝阳区', area: '朝阳公园', pricePerSqm: 95000 },
  { name: '珠江帝景', district: '朝阳区', area: '大望路', pricePerSqm: 82000 },
  { name: '世纪城春荫园', district: '海淀区', area: '万柳', pricePerSqm: 118000 },
  { name: '长河湾', district: '海淀区', area: '上地', pricePerSqm: 96000 },
  { name: '华清嘉园', district: '海淀区', area: '五道口', pricePerSqm: 105000 },
  { name: '回龙观新村', district: '昌平区', area: '回龙观', pricePerSqm: 42000 },
  { name: '天通苑北一区', district: '昌平区', area: '天通苑', pricePerSqm: 36000 },
  { name: '西二旗智学苑', district: '海淀区', area: '西二旗', pricePerSqm: 78000 },
  { name: '富力城', district: '朝阳区', area: '双井', pricePerSqm: 92000 },
  { name: '太阳公元', district: '朝阳区', area: '太阳宫', pricePerSqm: 98000 },
  { name: '万科青青家园', district: '通州区', area: '梨园', pricePerSqm: 45000 },
  { name: 'K2海棠湾', district: '通州区', area: '果园', pricePerSqm: 48000 },
  { name: '首开常青藤', district: '大兴区', area: '亦庄', pricePerSqm: 52000 },
  { name: '金地格林小镇', district: '大兴区', area: '黄村', pricePerSqm: 40000 },
  { name: '中粮祥云国际', district: '顺义区', area: '后沙峪', pricePerSqm: 58000 },
  { name: '龙湖香醍漫步', district: '顺义区', area: '顺义城区', pricePerSqm: 38000 },
  { name: '远洋天著春秋', district: '石景山区', area: '古城', pricePerSqm: 62000 },
  { name: '中海国际公馆', district: '丰台区', area: '丽泽', pricePerSqm: 68000 },
  { name: '万年花城', district: '丰台区', area: '花乡', pricePerSqm: 55000 },
  { name: '万科城市花园', district: '房山区', area: '长阳', pricePerSqm: 32000 },
];

const LAYOUTS = [
  { layout: '1室1厅1卫', rooms: 1, halls: 1, baths: 1, area: [42, 58] },
  { layout: '2室1厅1卫', rooms: 2, halls: 1, baths: 1, area: [68, 92] },
  { layout: '2室2厅1卫', rooms: 2, halls: 2, baths: 1, area: [85, 105] },
  { layout: '3室2厅1卫', rooms: 3, halls: 2, baths: 1, area: [105, 128] },
  { layout: '3室2厅2卫', rooms: 3, halls: 2, baths: 2, area: [120, 145] },
  { layout: '4室2厅2卫', rooms: 4, halls: 2, baths: 2, area: [145, 190] },
];

const ORIENTATIONS = ['南北', '南', '东南', '西南', '东'];
const DECORATIONS = ['毛坯', '简装', '精装', '精装', '豪装'];
const BUILDING_TYPES = ['板楼', '塔楼', '板塔结合'];
const OWNERSHIPS = ['满五唯一', '满二', '满五不唯一', '不满二'];

const HIGHLIGHT_POOL = [
  '南北通透，全明格局，采光充足',
  '业主诚心出售，价格可谈',
  '紧邻地铁站，步行 5 分钟',
  '小区中间楼层，不临街安静',
  '学区未占用，可落户',
  '满五唯一，税费低',
  '精装修，家电家具齐全，可拎包入住',
  '小区绿化率高，物业管理规范',
  '电梯房，出行方便',
  '周边配套成熟，商超医院齐全',
  '户型方正，无浪费面积',
  '带独立阳台，视野开阔',
];

// 用确定性伪随机，保证每次 seed 出来的演示数据一致，便于截图和讲解
let seedState = 20251008;
function rnd(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}
function randInt(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

/** 生成一张演示用的房源配图（SVG，无外部依赖），避免 seed 依赖网络 */
const PALETTES = [
  ['#dbeafe', '#93c5fd', '#1d4ed8'],
  ['#fef3c7', '#fcd34d', '#b45309'],
  ['#dcfce7', '#86efac', '#15803d'],
  ['#ffe4e6', '#fda4af', '#be123c'],
  ['#ede9fe', '#c4b5fd', '#6d28d9'],
  ['#cffafe', '#67e8f9', '#0e7490'],
  ['#f1f5f9', '#cbd5e1', '#334155'],
  ['#ffedd5', '#fdba74', '#c2410c'],
];

async function ensureDemoImage(index: number, label: string): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'demo');
  await mkdir(dir, { recursive: true });
  const file = `demo-${index}.svg`;
  const [bg, mid, fg] = PALETTES[index % PALETTES.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${mid}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <g fill="${fg}" opacity="0.85">
    <rect x="140" y="250" width="300" height="380" rx="12"/>
    <rect x="470" y="180" width="260" height="450" rx="12"/>
    <rect x="760" y="300" width="300" height="330" rx="12"/>
    <rect x="180" y="300" width="90" height="90" rx="8" fill="${bg}"/>
    <rect x="320" y="300" width="90" height="90" rx="8" fill="${bg}"/>
    <rect x="180" y="430" width="90" height="90" rx="8" fill="${bg}"/>
    <rect x="320" y="430" width="90" height="90" rx="8" fill="${bg}"/>
    <rect x="500" y="230" width="80" height="80" rx="8" fill="${bg}"/>
    <rect x="610" y="230" width="80" height="80" rx="8" fill="${bg}"/>
    <rect x="500" y="350" width="80" height="80" rx="8" fill="${bg}"/>
    <rect x="610" y="350" width="80" height="80" rx="8" fill="${bg}"/>
    <rect x="500" y="470" width="80" height="80" rx="8" fill="${bg}"/>
    <rect x="610" y="470" width="80" height="80" rx="8" fill="${bg}"/>
    <rect x="800" y="360" width="100" height="100" rx="8" fill="${bg}"/>
    <rect x="930" y="360" width="100" height="100" rx="8" fill="${bg}"/>
    <rect x="800" y="500" width="100" height="100" rx="8" fill="${bg}"/>
    <rect x="930" y="500" width="100" height="100" rx="8" fill="${bg}"/>
  </g>
  <text x="600" y="720" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="34" fill="${fg}" opacity="0.75">${label} · 演示配图</text>
</svg>`;
  await writeFile(path.join(dir, file), svg, 'utf8');
  return `/uploads/demo/${file}`;
}

async function upsertUser(input: {
  phone: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'AGENT' | 'USER';
  password: string;
  parentId?: string | null;
  email?: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      name: input.name,
      role: input.role,
      passwordHash,
      parentId: input.parentId ?? null,
      email: input.email ?? null,
    },
    update: {
      name: input.name,
      role: input.role,
      passwordHash,
      parentId: input.parentId ?? null,
    },
  });
  return user;
}

async function main() {
  console.log('开始写入种子数据…');

  // ---------- 1. 用户与分级 ----------
  const superAdmin = await upsertUser({
    phone: '13800000000',
    name: '王总（超级管理员）',
    role: 'SUPER_ADMIN',
    password: PWD.super,
  });

  const admin = await upsertUser({
    phone: '13800000001',
    name: '李店长（管理员）',
    role: 'ADMIN',
    password: PWD.admin,
    parentId: superAdmin.id,
  });

  const agentSeeds = [
    { phone: '13900000001', name: '张明', refCode: 'zhangming', title: '金牌经纪人', area: '朝阳区 · 国贸 / 双井' },
    { phone: '13900000002', name: '刘婷', refCode: 'liuting', title: '资深顾问', area: '海淀区 · 万柳 / 五道口' },
    { phone: '13900000003', name: '陈浩', refCode: 'chenhao', title: '房产顾问', area: '昌平区 · 回龙观 / 天通苑' },
    { phone: '13900000004', name: '赵雪', refCode: 'zhaoxue', title: '新房二手房顾问', area: '通州区 · 大兴区' },
  ];

  const agents = [];
  for (const a of agentSeeds) {
    const user = await upsertUser({
      phone: a.phone,
      name: a.name,
      role: 'AGENT',
      password: PWD.agent,
      parentId: admin.id,
    });

    await prisma.agentProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        refCode: a.refCode,
        title: a.title,
        area: a.area,
        contactPhone: a.phone,
        remark: `专注 ${a.area} 二手房，从业 5 年以上，熟悉小区户型与业主心理价位。`,
      },
      update: { refCode: a.refCode, title: a.title, area: a.area, contactPhone: a.phone },
    });

    // 每个业务员一张"名片码"，这就是客户归属追踪的入口
    await prisma.sourceCode.upsert({
      where: { code: a.refCode },
      create: {
        code: a.refCode,
        name: `${a.name}的名片码`,
        type: 'AGENT_CARD',
        ownerId: user.id,
        createdBy: admin.id,
        remark: '业务员专属推广链接/二维码，客户通过它进入即归属该业务员',
      },
      update: { ownerId: user.id, name: `${a.name}的名片码`, enabled: true },
    });

    agents.push({ user, refCode: a.refCode });
  }

  // 额外两张"海报码"，用于演示同一业务员多渠道统计
  await prisma.sourceCode.upsert({
    where: { code: 'haibao-zhangming-01' },
    create: {
      code: 'haibao-zhangming-01',
      name: '张明·朋友圈海报1期',
      type: 'POSTER',
      ownerId: agents[0]!.user.id,
      createdBy: admin.id,
    },
    update: { ownerId: agents[0]!.user.id, enabled: true },
  });
  await prisma.sourceCode.upsert({
    where: { code: 'haibao-liuting-01' },
    create: {
      code: 'haibao-liuting-01',
      name: '刘婷·学区房专题海报',
      type: 'POSTER',
      ownerId: agents[1]!.user.id,
      createdBy: admin.id,
    },
    update: { ownerId: agents[1]!.user.id, enabled: true },
  });

  // 普通注册用户
  const users = [];
  for (const u of [
    { phone: '13700000001', name: '陈先生' },
    { phone: '13700000002', name: '林女士' },
    { phone: '13700000003', name: '周先生' },
  ]) {
    users.push(await upsertUser({ phone: u.phone, name: u.name, role: 'USER', password: PWD.user }));
  }

  // ---------- 2. 房源 ----------
  const now = Date.now();
  let listingIndex = 0;
  const createdListings: Array<{ id: string; agentId: string | null; dealType: 'SALE' | 'RENT' }> = [];

  for (let i = 0; i < COMMUNITY_POOL.length; i += 1) {
    const c = COMMUNITY_POOL[i]!;
    const agent = agents[i % agents.length]!;
    const shape = LAYOUTS[i % LAYOUTS.length]!;
    const area = randInt(shape.area[0]!, shape.area[1]!);
    const unitPrice = Math.round(c.pricePerSqm * (0.92 + rnd() * 0.18));
    const priceWan = Number(((area * unitPrice) / 10000).toFixed(1));
    const totalFloors = pick([6, 11, 18, 24, 33]);
    const floor = randInt(1, totalFloors);
    const buildYear = randInt(1998, 2021);
    const highlights = Array.from(new Set([pick(HIGHLIGHT_POOL), pick(HIGHLIGHT_POOL), pick(HIGHLIGHT_POOL)]));

    const code = `FY${new Date().getFullYear()}${String(i + 1).padStart(4, '0')}`;
    const coverIndex = i % 8;
    const cover = await ensureDemoImage(coverIndex, c.name);
    await ensureDemoImage((coverIndex + 3) % 8, c.name);

    const data: Prisma.ListingUncheckedCreateInput = {
      code,
      title: `${c.name} ${shape.layout} ${pick(DECORATIONS)}`,
      dealType: 'SALE',
      status: 'PUBLISHED',
      agentId: agent.user.id,
      priceWan,
      unitPrice,
      community: c.name,
      district: c.district,
      businessArea: c.area,
      address: `${c.district}${c.area}${c.name}`,
      longitude: 116.3 + rnd() * 0.3,
      latitude: 39.85 + rnd() * 0.25,
      area,
      rooms: shape.rooms,
      halls: shape.halls,
      bathrooms: shape.baths,
      layout: shape.layout,
      floor,
      totalFloors,
      orientation: pick(ORIENTATIONS),
      decoration: pick(DECORATIONS),
      buildingType: pick(BUILDING_TYPES),
      hasElevator: totalFloors > 6,
      buildYear,
      ownership: pick(OWNERSHIPS),
      description:
        `${c.name}位于${c.district}${c.area}，${shape.layout}，建筑面积约 ${area}㎡，${buildYear} 年建成。\n` +
        `本房源由平台经纪人实地核实，户型方正、采光良好。业主诚心出售，看房请提前预约。\n` +
        `小区周边生活配套完善，交通便利，适合自住与改善型需求。`,
      highlights: highlights.join('\n'),
      ownerName: `${pick(['刘', '孙', '马', '吴', '郑'])}先生`,
      ownerPhone: `136${randInt(10000000, 99999999)}`,
      viewCount: randInt(30, 420),
      leadCount: 0,
      isFeatured: i % 5 === 0,
      isTop: i % 7 === 0,
      publishedAt: new Date(now - randInt(1, 40) * 86400000),
    };

    const listing = await prisma.listing.upsert({
      where: { code },
      create: data,
      update: { ...data, status: 'PUBLISHED' },
      select: { id: true, agentId: true, dealType: true },
    });

    createdListings.push(listing);

    // 图片：每套 2 张（封面 + 一张同风格图）
    await prisma.listingImage.deleteMany({ where: { listingId: listing.id } });
    await prisma.listingImage.createMany({
      data: [
        { listingId: listing.id, url: cover, sort: 0, isCover: true },
        { listingId: listing.id, url: `/uploads/demo/demo-${(coverIndex + 3) % 8}.svg`, sort: 1, isCover: false },
      ],
    });

    listingIndex += 1;
  }

  // 出租房源 4 套
  for (let i = 0; i < 4; i += 1) {
    const c = COMMUNITY_POOL[i * 3]!;
    const agent = agents[i % agents.length]!;
    const shape = LAYOUTS[i % 3]!;
    const area = randInt(shape.area[0]!, shape.area[1]!);
    const rent = Math.round((area * (c.pricePerSqm / 1000) * 0.9) / 100) * 100;
    const code = `FY${new Date().getFullYear()}R${String(i + 1).padStart(3, '0')}`;

    const listing = await prisma.listing.upsert({
      where: { code },
      create: {
        code,
        title: `${c.name} ${shape.layout} 整租 精装`,
        dealType: 'RENT',
        status: 'PUBLISHED',
        agentId: agent.user.id,
        rentYuan: rent,
        community: c.name,
        district: c.district,
        businessArea: c.area,
        area,
        rooms: shape.rooms,
        halls: shape.halls,
        bathrooms: shape.baths,
        layout: shape.layout,
        floor: randInt(3, 18),
        totalFloors: 18,
        orientation: pick(ORIENTATIONS),
        decoration: '精装',
        hasElevator: true,
        buildYear: randInt(2000, 2018),
        description: '整租，家电家具齐全，可拎包入住。业主接受长租，看房随时。',
        highlights: '整租\n家电家具齐全\n地铁沿线',
        viewCount: randInt(20, 200),
        publishedAt: new Date(now - randInt(1, 20) * 86400000),
      },
      update: { status: 'PUBLISHED' },
      select: { id: true, agentId: true, dealType: true },
    });
    createdListings.push(listing);
    await prisma.listingImage.deleteMany({ where: { listingId: listing.id } });
    await prisma.listingImage.createMany({
      data: [{ listingId: listing.id, url: await ensureDemoImage((i + 2) % 8, c.name), sort: 0, isCover: true }],
    });
  }

  // 待审核 2 套 + 草稿 1 套（演示审核流程）
  for (let i = 0; i < 3; i += 1) {
    const c = COMMUNITY_POOL[20 + i] ?? COMMUNITY_POOL[i]!;
    const agent = agents[(i + 1) % agents.length]!;
    const code = `FY${new Date().getFullYear()}P${String(i + 1).padStart(3, '0')}`;
    await prisma.listing.upsert({
      where: { code },
      create: {
        code,
        title: `${c.name} 新收房源 待审核`,
        dealType: 'SALE',
        status: i === 2 ? 'DRAFT' : 'PENDING',
        agentId: agent.user.id,
        priceWan: randInt(300, 900),
        community: c.name,
        district: c.district,
        businessArea: c.area,
        area: randInt(80, 140),
        layout: '3室2厅1卫',
        rooms: 3,
        halls: 2,
        bathrooms: 1,
        decoration: '简装',
        buildYear: 2008,
        highlights: '新收房源\n等待审核',
        description: '经纪人刚录入的房源，等待管理员审核后上架。',
      },
      update: { status: i === 2 ? 'DRAFT' : 'PENDING' },
    });
  }

  // ---------- 3. 访问 / 线索 / 预约（近 21 天） ----------
  const existingSessions = await prisma.visitSession.count();
  if (existingSessions < 20) {
    console.log('生成近 21 天演示流量与线索…');
    const devices = ['mobile', 'mobile', 'mobile', 'desktop'];
    const browsers = ['微信', '微信', 'Chrome', 'Safari'];
    const oses = ['iOS', 'Android', 'Windows', 'macOS'];
    const surnames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙'];
    const messages = [
      '这套房现在还能看吗？',
      '首付大概多少？可以贷款吗？',
      '满五唯一吗？税费怎么算？',
      '周末方便看房吗？',
      '价格还能谈多少？',
      '小区物业费多少？',
      '房子有抵押吗？',
    ];

    for (let day = 20; day >= 0; day -= 1) {
      const dayStart = now - day * 86400000;
      // 周末流量高一点
      const weekday = new Date(dayStart).getDay();
      const base = weekday === 0 || weekday === 6 ? 14 : 9;
      const sessionCount = base + randInt(-3, 5);

      for (let s = 0; s < sessionCount; s += 1) {
        // 70% 的访客带归属（业务员渠道来的），30% 自然流量
        const hasRef = rnd() < 0.7;
        const agentPick = hasRef ? pick(agents) : null;
        const listingPick = pick(createdListings);
        const sid = `seed-${day}-${s}-${randInt(1000, 9999)}`;
        const firstSeen = new Date(dayStart + randInt(0, 20) * 3600000 + randInt(0, 59) * 60000);
        const userAgent = 'seed';
        const device = pick(devices);
        const idx = devices.indexOf(device);

        const session = await prisma.visitSession.create({
          data: {
            sid,
            refUserId: agentPick?.user.id ?? null,
            refCode: agentPick?.refCode ?? null,
            landedPath: rnd() < 0.5 ? `/agent/${agentPick?.refCode ?? ''}` : `/fang`,
            device,
            os: pick(oses),
            browser: browsers[idx] ?? '微信',
            ip: `11.22.${randInt(1, 254)}.${randInt(1, 254)}`,
            userAgent,
            hasLead: false,
            firstSeenAt: firstSeen,
            lastSeenAt: new Date(firstSeen.getTime() + randInt(1, 40) * 60000),
            pageViews: 0,
          },
        });

        // 每个会话 1~4 次页面浏览
        const views = randInt(1, 4);
        let pv = 0;
        for (let v = 0; v < views; v += 1) {
          const target = rnd() < 0.6 ? pick(createdListings) : listingPick;
          await prisma.pageView.create({
            data: {
              sessionId: session.id,
              refUserId: agentPick?.user.id ?? null,
              listingId: target.id,
              path: rnd() < 0.6 ? `/fang/${target.id}` : '/fang',
              title: '房源详情',
              device,
              ip: session.ip,
              refParam: agentPick?.refCode ?? null,
              createdAt: new Date(firstSeen.getTime() + v * randInt(1, 8) * 60000),
            },
          });
          pv += 1;
        }
        await prisma.visitSession.update({ where: { id: session.id }, data: { pageViews: pv } });

        // 约 22% 的会话留下线索
        if (rnd() < 0.22) {
          const phone = `1${pick([3, 5, 7, 8])}${randInt(100000000, 999999999)}`.slice(0, 11);
          const statusRoll = rnd();
          const status =
            statusRoll < 0.34 ? 'NEW' : statusRoll < 0.6 ? 'CONTACTED' : statusRoll < 0.82 ? 'FOLLOWING' : statusRoll < 0.94 ? 'VIEWED' : 'DEAL';
          const lead = await prisma.lead.create({
            data: {
              name: `${pick(surnames)}${pick(['先生', '女士'])}`,
              phone,
              wechat: rnd() < 0.4 ? `wx_${randInt(10000, 99999)}` : null,
              message: pick(messages),
              source: rnd() < 0.25 ? 'APPOINTMENT' : 'FORM',
              status,
              ownerId: agentPick?.user.id ?? listingPick.agentId,
              sessionId: session.id,
              listingId: listingPick.id,
              listingAgentId: listingPick.agentId,
              ip: session.ip,
              privatized: rnd() < 0.5,
              followUpAt: status === 'NEW' ? null : new Date(firstSeen.getTime() + randInt(1, 48) * 3600000),
              followUps:
                status === 'NEW'
                  ? null
                  : `[${new Date(firstSeen.getTime() + 3600000).toLocaleString('zh-CN')}] 已电话联系，客户想周末看房\n` +
                    `[${new Date(firstSeen.getTime() + 7200000).toLocaleString('zh-CN')}] 已加微信，发了 3 套房源对比`,
              createdAt: firstSeen,
            },
            select: { id: true, listingId: true, status: true },
          });

          // 预约看房
          if (rnd() < 0.4) {
            await prisma.appointment.create({
              data: {
                name: `${pick(surnames)}${pick(['先生', '女士'])}`,
                phone,
                expectAt: new Date(firstSeen.getTime() + randInt(1, 5) * 86400000),
                remark: pick(['希望周六下午', '工作日下午都行', '想带家人一起看']),
                status: pick(['PENDING', 'CONFIRMED', 'DONE', 'CANCELED']),
                ownerId: agentPick?.user.id ?? listingPick.agentId,
                sessionId: session.id,
                listingId: lead.listingId,
                createdAt: firstSeen,
              },
            });
          }

          await prisma.visitSession.update({ where: { id: session.id }, data: { hasLead: true } });
        }
      }
    }

    // 同步房源的线索计数与浏览量（与上面生成的明细对齐）
    const allListings = await prisma.listing.findMany({ select: { id: true } });
    for (const l of allListings) {
      const [pvCount, leadCount] = await Promise.all([
        prisma.pageView.count({ where: { listingId: l.id } }),
        prisma.lead.count({ where: { listingId: l.id } }),
      ]);
      await prisma.listing.update({
        where: { id: l.id },
        data: { viewCount: Math.max(pvCount, 1), leadCount },
      });
    }
  } else {
    console.log('已存在访问数据，跳过流量生成');
  }

  // ---------- 4. 收藏与站点设置 ----------
  for (const u of users) {
    const pick3 = [createdListings[randInt(0, createdListings.length - 1)]!, createdListings[randInt(0, createdListings.length - 1)]!];
    for (const l of pick3) {
      await prisma.bookmark
        .create({ data: { userId: u.id, listingId: l.id } })
        .catch(() => undefined);
    }
  }

  const settings: Array<[string, string]> = [
    ['site_name', '安居二手房'],
    ['company_name', '安居房地产经纪有限公司'],
    ['contact_phone', '400-000-0000'],
    ['contact_wechat', 'anjufang001'],
    ['icp', '京ICP备00000000号-1'],
    ['require_review', '1'],
    ['ref_policy', 'first'],
    ['notice', '平台所有房源均由入驻经纪人实地核实，看房不收取任何费用。'],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  // ---------- 汇总 ----------
  const [uCount, lCount, sCount, leadCount, apptCount] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.visitSession.count(),
    prisma.lead.count(),
    prisma.appointment.count(),
  ]);

  console.log('\n种子数据写入完成 ✔');
  console.log(`  用户 ${uCount}（超管1 / 管理员1 / 子管理员4 / 普通用户3）`);
  console.log(`  房源 ${lCount}（含出租 4、待审核 2、草稿 1）`);
  console.log(`  访客会话 ${sCount}，客户线索 ${leadCount}，预约 ${apptCount}`);
  console.log('\n登录账号（首次登录请及时改密码）：');
  console.log('  超级管理员  13800000000 / admin123456');
  console.log('  管理员      13800000001 / admin123456');
  console.log('  子管理员    13900000001 / agent123456   （张明，推广码 zhangming）');
  console.log('  子管理员    13900000002 / agent123456   （刘婷，推广码 liuting）');
  console.log('  子管理员    13900000003 / agent123456   （陈浩，推广码 chenhao）');
  console.log('  子管理员    13900000004 / agent123456   （赵雪，推广码 zhaoxue）');
  console.log('  普通用户    13700000001 / user123456');
  console.log('\n归属追踪测试：浏览器打开  /fang?ref=zhangming  然后留资，线索会归到张明名下。');
}

main()
  .catch((e) => {
    console.error('种子数据写入失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
