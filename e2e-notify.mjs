/**
 * 客户提醒（webhook 推送）端到端验证。
 * 用法：node scripts/e2e-notify.mjs [baseUrl]
 *
 * 做法：在本机起一个假接收端，把系统设置里的提醒渠道指向它，
 * 然后模拟"客户带推广码留资"，检查是否真的推送出去了、内容对不对。
 * 这样不用真的注册 Server酱/企业微信也能验证整条链路。
 *
 * 注意：脚本结束时会把提醒配置恢复为「未开启」，避免留下测试配置。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const HOOK_PORT = 4789;

let pass = 0;
let fail = 0;
function check(label, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✔ ${label}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${label} ${extra}`);
  }
}

/** 假接收端：把收到的 JSON 存起来 */
const received = [];
const { createServer } = await import('node:http');

const hook = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      received.push(JSON.parse(body));
    } catch {
      received.push({ raw: body });
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
});

await new Promise((resolve) => hook.listen(HOOK_PORT, '127.0.0.1', resolve));
console.log(`假 webhook 接收端已启动：http://127.0.0.1:${HOOK_PORT}`);

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
  if (jar?.header()) headers.set('cookie', jar.header());
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  jar?.absorb(res);
  return res;
}

async function setSetting(key, value) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

async function restoreSettings() {
  await Promise.all([
    setSetting('notify_channel', 'off'),
    setSetting('notify_custom_webhook', ''),
    setSetting('notify_wecom_webhook', ''),
  ]);
}

try {
  console.log('\n== 1. 配置提醒渠道为自定义 webhook ==');
  await setSetting('notify_channel', 'custom');
  await setSetting('notify_custom_webhook', `http://127.0.0.1:${HOOK_PORT}/hook`);
  check('提醒配置已写入（channel=custom）', true);

  // 取一个业务员和一个在售房源
  const agent = await prisma.user.findFirst({
    where: { phone: '13900000003' },
    select: { id: true, name: true, agentProfile: { select: { refCode: true } } },
  });
  const listing = await prisma.listing.findFirst({
    where: { status: 'PUBLISHED', agentId: agent?.id },
    select: { id: true, title: true },
  });
  check('找到测试业务员与房源', !!agent && !!listing, `${agent?.name} / ${listing?.title}`);

  console.log('\n== 2. 模拟客户带推广码留资 ==');
  const jar = new Jar();
  const phone = `135${Date.now().toString().slice(-8)}`;

  // 带 ref 落地，写归属 Cookie
  await req(jar, `/fang?ref=${agent.agentProfile.refCode}`);
  const res = await req(jar, '/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: '提醒测试客户',
      phone,
      message: '想约周末看房',
      listingId: listing.id,
      source: 'FORM',
    }),
  });
  check('留资接口返回成功', res.status === 200, `status=${res.status}`);

  // 提醒是异步发的（不阻塞客户提交），给它一点时间
  for (let i = 0; i < 20 && received.length === 0; i += 1) {
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('\n== 3. 校验推送内容 ==');
  check('接收端收到了推送', received.length > 0, `收到 ${received.length} 条`);

  const msg = received[0] ?? {};
  const text = JSON.stringify(msg);
  check('推送标题包含「新客户」', /新客户/.test(msg.title ?? ''), `title=${msg.title}`);
  check('推送正文包含客户手机号', text.includes(phone), `phone=${phone}`);
  check('推送正文包含意向房源标题', text.includes(listing.title.slice(0, 8)), `期望含「${listing.title.slice(0, 8)}」`);
  check('推送正文标注了归属业务员', text.includes(agent.name), `期望含「${agent.name}」`);
  check('推送带了后台查看链接', typeof msg.url === 'string' && msg.url.includes('/admin/leads'), `url=${msg.url}`);
  check('推送内容包含行动建议（5 分钟内回电）', /5 分钟/.test(text));

  console.log('\n== 4. 提醒日志已记录 ==');
  const logRow = await prisma.setting.findUnique({ where: { key: 'notify_log' } });
  check('notify_log 里能查到这次推送', !!logRow?.value && logRow.value.includes(phone));

  console.log('\n== 5. 未开启提醒时不应推送 ==');
  await setSetting('notify_channel', 'off');
  received.length = 0;
  const phone2 = `136${Date.now().toString().slice(-8)}`;
  await req(new Jar(), '/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '静默测试', phone: phone2, listingId: listing.id }),
  });
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 300));
  check('关闭提醒后不再推送', received.length === 0, `却收到了 ${received.length} 条`);
} finally {
  await restoreSettings();
  await prisma.$disconnect();
  hook.close();
  console.log('\n提醒配置已恢复为「未开启」（如需启用请在后台系统设置里配置）');
}

console.log(`\n=========================`);
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
