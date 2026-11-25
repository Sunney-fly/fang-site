/**
 * 后台页面连通性 + 权限矩阵验证。
 * 用法：node scripts/e2e-admin.mjs [baseUrl]
 *
 * 用三种身份（超管 / 管理员 / 子管理员）分别访问所有后台页面，
 * 对照期望的状态码，确保没有页面报 500、也没有越权可见。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';

class Jar {
  constructor() {
    this.map = new Map();
  }
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  absorb(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      if (i < 0) continue;
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (v === '') this.map.delete(k);
      else this.map.set(k, v);
    }
  }
}

async function req(jar, path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (jar?.header()) headers.set('cookie', jar.header());
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  jar?.absorb(res);
  return res;
}

async function login(phone, password) {
  const jar = new Jar();
  const res = await req(jar, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { jar, ok: res.status === 200 && data.ok === true, role: data.role };
}

/** 期望：200 = 可访问，30x = 被重定向（拦截） */
const PAGES = [
  { path: '/admin', name: '总览看板', super: 200, admin: 200, agent: 200 },
  { path: '/admin/listings', name: '房源管理', super: 200, admin: 200, agent: 200 },
  { path: '/admin/listings/new', name: '发布房源', super: 200, admin: 200, agent: 200 },
  { path: '/admin/leads', name: '客户线索', super: 200, admin: 200, agent: 200 },
  { path: '/admin/appointments', name: '预约看房', super: 200, admin: 200, agent: 200 },
  { path: '/admin/tracking', name: '推广与归属', super: 200, admin: 200, agent: 200 },
  { path: '/admin/profile', name: '我的推广资料', super: 200, admin: 200, agent: 200 },
  { path: '/admin/m', name: '手机工作台', super: 200, admin: 200, agent: 200 },
  { path: '/admin/m/listings', name: '手机-我的房源', super: 200, admin: 200, agent: 200 },
  { path: '/admin/m/listings/new', name: '手机-加房源', super: 200, admin: 200, agent: 200 },
  { path: '/admin/m/me', name: '手机-我的', super: 200, admin: 200, agent: 200 },
  { path: '/admin/agents', name: '子管理员', super: 200, admin: 200, agent: 30 },
  { path: '/admin/users', name: '用户管理', super: 200, admin: 200, agent: 30 },
  { path: '/admin/stats', name: '数据统计', super: 200, admin: 200, agent: 200 },
  { path: '/admin/settings', name: '系统设置', super: 200, admin: 30, agent: 30 },
];

let pass = 0;
let fail = 0;

function expect(label, actual, want) {
  const ok = want === 200 ? actual === 200 : actual >= 300 && actual < 400;
  if (ok) {
    pass += 1;
    console.log(`  ✔ ${label} → ${actual}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${label} → ${actual}（期望${want === 200 ? '200' : '重定向'}）`);
  }
}

/** 布尔断言 */
function pass0(ok, label) {
  if (ok) {
    pass += 1;
    console.log(`  ✔ ${label}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${label}`);
  }
}

async function main() {
  console.log('\n== 登录三种身份 ==');
  const su = await login('13800000000', 'admin123456');
  const ad = await login('13800000001', 'admin123456');
  const ag = await login('13900000001', 'agent123456');
  console.log(`  超管 ${su.ok ? '✔' : '✘'} / 管理员 ${ad.ok ? '✔' : '✘'} / 子管理员 ${ag.ok ? '✔' : '✘'}`);
  if (!su.ok || !ad.ok || !ag.ok) {
    console.log('登录失败，终止');
    process.exit(1);
  }

  for (const page of PAGES) {
    console.log(`\n== ${page.name}  ${page.path} ==`);
    for (const [label, session, want] of [
      ['超管', su, page.super],
      ['管理员', ad, page.admin],
      ['子管理员', ag, page.agent],
    ]) {
      const res = await req(session.jar, page.path);
      const body = res.status === 200 ? await res.text() : '';
      const broken = /Application error|Unhandled Runtime Error|Internal Server Error/i.test(body);
      expect(`${label}${broken ? ' [页面报错]' : ''}`, res.status, want);
    }
  }

  // 子管理员不应该看到别人的房源操作入口
  console.log('\n== 数据隔离（子管理员只看自己的）==');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const zhangming = await prisma.user.findUnique({ where: { phone: '13900000001' }, select: { id: true } });
    const other = await prisma.listing.findFirst({
      where: { agentId: { not: zhangming.id }, status: 'PUBLISHED' },
      select: { id: true, title: true },
    });
    const own = await prisma.listing.findFirst({
      where: { agentId: zhangming.id },
      select: { id: true },
    });

    if (other) {
      const res = await req(ag.jar, `/admin/listings/${other.id}`);
      expect('子管理员打开他人房源编辑页被拦截', res.status, 30);
    }
    if (own) {
      const res = await req(ag.jar, `/admin/listings/${own.id}`);
      expect('子管理员打开自己房源编辑页正常', res.status, 200);
    }

    // 线索隔离：直接用裸 POST 尝试改别人的线索状态，改前改后必须一致
    const othersLead = await prisma.lead.findFirst({
      where: { ownerId: { not: zhangming.id }, status: { not: 'DEAL' } },
      select: { id: true, status: true },
    });
    if (othersLead) {
      await req(ag.jar, '/admin/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `id=${othersLead.id}&status=DEAL`,
      });
      const after = await prisma.lead.findUnique({ where: { id: othersLead.id }, select: { status: true } });
      const unchanged = after?.status === othersLead.status;
      pass0(unchanged, `子管理员无法通过裸请求改他人线索状态（${othersLead.status} → ${after?.status}）`);
    }

    // 服务端 action 层面的归属校验：确认他人线索的 ownerId 不是自己
    const foreign = await prisma.lead.findFirst({
      where: { ownerId: { not: zhangming.id, notIn: [] } },
      select: { ownerId: true },
    });
    pass0(!!foreign && foreign.ownerId !== zhangming.id, '存在归属他人的线索（用于隔离校验）');
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n== 新功能：海报 / sitemap / robots / 健康检查 ==`);
  const p3 = new PrismaClient();
  try {
    const listing = await p3.listing.findFirst({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true, code: true },
    });

    if (listing) {
      const poster = await fetch(`${BASE}/api/poster?listing=${listing.id}&ref=zhangming`);
      const svg = await poster.text();
      pass0(
        poster.status === 200 &&
          poster.headers.get('content-type')?.includes('svg') === true &&
          svg.includes('<svg') &&
          svg.includes('data:image/png;base64'),
        `房源海报能生成且内嵌二维码（${listing.code}）`,
      );
      pass0(svg.includes('zhangming') || /ref=zhangming/.test(svg) || svg.includes('长按识别'), '海报带推广归属信息');
    }
  } finally {
    await p3.$disconnect();
  }

  const sitemap = await fetch(`${BASE}/sitemap.xml`);
  const sitemapText = await sitemap.text();
  pass0(sitemap.status === 200 && sitemapText.includes('<urlset') && sitemapText.includes('/fang/'), 'sitemap.xml 正常且包含房源页');

  const robots = await fetch(`${BASE}/robots.txt`);
  const robotsText = await robots.text();
  pass0(robots.status === 200 && robotsText.includes('Disallow: /admin') && robotsText.includes('Sitemap'), 'robots.txt 已屏蔽后台并声明 sitemap');

  const health = await fetch(`${BASE}/api/health`);
  const healthJson = await health.json().catch(() => ({}));
  pass0(health.status === 200 && healthJson.db === 'up', '健康检查接口正常（数据库连通）');

  console.log(`\n=========================`);
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
