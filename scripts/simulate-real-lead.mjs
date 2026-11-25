/**
 * 模拟真实客户留资，触发真实的微信提醒。
 * 用法：node scripts/simulate-real-lead.mjs [baseUrl]
 *
 * 做的事与真实客户完全一致：
 *   1. 带业务员推广码落地（写归属 Cookie）
 *   2. 在房源详情页提交留资表单
 *   3. 系统按归属分配给业务员，并推送微信提醒
 * 结束后会删除这条演示线索，不污染数据。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

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
  if (jar.header()) headers.set('cookie', jar.header());
  if (!headers.has('user-agent')) {
    headers.set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) MicroMessenger/8.0.49');
  }
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  jar.absorb(res);
  return res;
}

let leadId = null;

try {
  // 取一个业务员 + 他名下的在售房源
  const agent = await prisma.user.findFirst({
    where: { phone: '13900000001' },
    select: { id: true, name: true, agentProfile: { select: { refCode: true } } },
  });
  const listing = await prisma.listing.findFirst({
    where: { status: 'PUBLISHED', agentId: agent.id },
    select: { id: true, title: true },
  });

  console.log(`业务员：${agent.name}（推广码 ${agent.agentProfile.refCode}）`);
  console.log(`意向房源：${listing.title}\n`);

  const jar = new Jar();

  // 1. 客户点业务员分享的链接进来
  const landing = await req(jar, `/fang?ref=${agent.agentProfile.refCode}`);
  console.log(`1) 客户通过推广链接落地：HTTP ${landing.status}`);
  console.log(`   写入归属 Cookie：${jar.map.get('fang_ref') ? '✔ ' + jar.map.get('fang_ref') : '✘ 无'}`);

  // 2. 客户看这套房
  const detail = await req(jar, `/fang/${listing.id}`);
  console.log(`2) 客户查看房源详情：HTTP ${detail.status}`);

  // 3. 客户留资
  const phone = `139${Date.now().toString().slice(-8)}`;
  const leadRes = await req(jar, '/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: '王女士（演示）',
      phone,
      message: '这套房周六下午方便看吗？想了解一下首付大概多少。',
      listingId: listing.id,
      source: 'FORM',
    }),
  });
  const data = await leadRes.json().catch(() => ({}));
  leadId = data.leadId ?? null;
  console.log(`3) 客户提交留资：HTTP ${leadRes.status}，线索已${data.assigned ? '自动分配' : '未分配'}`);

  // 4. 核对归属
  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId }, select: { ownerId: true, sourceCodeId: true } })
    : null;
  console.log(
    `4) 归属核对：${lead?.ownerId === agent.id ? '✔ 正确落到 ' + agent.name + ' 名下' : '✘ 归属异常'}`,
  );

  console.log('\n微信提醒已异步发出，请查看手机。');
  console.log('如果没收到，请打开 http://127.0.0.1:3000/admin/settings 点一次「发送测试提醒」看报错。');
} finally {
  // 清理演示线索，避免污染数据统计
  if (leadId) {
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
    console.log('\n（演示线索已清理，不影响你的数据统计）');
  }
  await prisma.$disconnect();
}
