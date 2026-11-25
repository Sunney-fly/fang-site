/**
 * 提醒通道自检。
 * 用法：node scripts/check-notify.mjs
 *
 * 读取数据库里已保存的配置，真实发一条消息，并明确告诉你：
 *   - 当前用的是哪个渠道
 *   - 每个接收人到底收到了没有（WxPusher 会逐个返回结果）
 *   - 如果失败，下一步该做什么
 *
 * 订阅了 WxPusher 之后随时跑这个，就能确认通道是否正常。
 */
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const mask = (s, head = 6) => (s ? `${s.slice(0, head)}…${s.slice(-4)}` : '(空)');

const rows = await prisma.setting.findMany();
const cfg = new Map(rows.map((r) => [r.key, r.value]));
await prisma.$disconnect();

const channel = cfg.get('notify_channel') || 'off';
console.log('\n=========== 客户提醒通道自检 ===========');
console.log(`当前渠道：${channel}`);

if (channel === 'off') {
  console.log('\n提示：提醒未开启。打开 http://localhost:3000/admin/settings');
  console.log('      在「客户提醒」里选择渠道并保存，客户留资后才会推送。');
  process.exit(0);
}

const stamp = new Date().toLocaleString('zh-CN');

if (channel === 'wxpusher') {
  const token = cfg.get('notify_wxpusher_token') || '';
  const uids = (cfg.get('notify_wxpusher_uids') || '').split(/[\s,，;；]+/).filter(Boolean);
  console.log(`App Token：${mask(token)}`);
  console.log(`接收人   ：${uids.length} 个 → ${uids.map((u) => mask(u, 8)).join(', ')}`);

  console.log('\n正在发送…');
  const res = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      appToken: token,
      content: ['## 🔔 自检消息', '', `这是一条自检消息，收到说明通道正常。`, '', `时间：${stamp}`].join('\n'),
      summary: '自检：提醒通道是否正常',
      contentType: 3,
      uids,
    }),
  });
  const text = await res.text();

  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* 忽略 */
  }

  const results = Array.isArray(parsed.data) ? parsed.data : [];
  const okList = results.filter((d) => d.code === 1000);
  const badList = results.filter((d) => d.code !== undefined && d.code !== 1000);

  console.log(`\n接口返回 code=${parsed.code} msg=${parsed.msg ?? ''}`);

  if (okList.length > 0) {
    console.log('\n✔ 投递成功：');
    for (const d of okList) console.log(`   ${mask(d.uid ?? '', 8)} → 已送达`);
  }
  if (badList.length > 0) {
    console.log('\n✘ 未送达：');
    for (const d of badList) console.log(`   ${mask(d.uid ?? '', 8)} → code=${d.code} ${d.status ?? ''}`);
  }

  if (badList.some((d) => /未订阅|需要用户订阅/.test(d.status ?? ''))) {
    console.log('\n👉 下一步（必须做，否则收不到任何提醒）：');
    console.log('   1. 打开 https://wxpusher.zjiecode.com/admin/ 微信扫码登录');
    console.log('   2. 进入「应用管理」→ 点开你创建的应用');
    console.log('   3. 找到「订阅二维码」或「订阅链接」，用你自己的微信扫码/点开并关注');
    console.log('   4. 关注后重新运行：node scripts/check-notify.mjs');
    console.log('\n   注意：订阅后 UID 不变，不用重新填写。');
  }

  process.exit(okList.length > 0 && badList.length === 0 ? 0 : 1);
}

if (channel === 'serverchan') {
  const key = cfg.get('notify_serverchan_key') || '';
  console.log(`SendKey：${mask(key)}`);
  const url = /^sctp/i.test(key)
    ? `https://push.ft07.com/send/${key}.send`
    : `https://sctapi.ftqq.com/${key}.send`;
  const form = new URLSearchParams({ title: '自检：提醒通道是否正常', desp: `收到说明通道正常。\n\n时间：${stamp}` });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const text = await res.text();
  console.log(`\nHTTP ${res.status} ${text.slice(0, 200)}`);
  const ok = res.ok && /"code"\s*:\s*0/.test(text);
  console.log(ok ? '\n✔ 已发送，请查看微信' : '\n✘ 发送失败，请检查 SendKey');
  process.exit(ok ? 0 : 1);
}

if (channel === 'pushplus') {
  const token = cfg.get('notify_pushplus_token') || '';
  const res = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token,
      title: '自检：提醒通道是否正常',
      content: `收到说明通道正常。<br>时间：${stamp}`,
      template: 'html',
    }),
  });
  const text = await res.text();
  console.log(`\nHTTP ${res.status} ${text.slice(0, 200)}`);
  const ok = res.ok && /"code"\s*:\s*200/.test(text);
  console.log(ok ? '\n✔ 已发送，请查看微信' : '\n✘ 发送失败，请检查 token');
  process.exit(ok ? 0 : 1);
}

if (channel === 'wecom') {
  const hook = cfg.get('notify_wecom_webhook') || '';
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: `自检：提醒通道正常\n时间：${stamp}` } }),
  });
  const text = await res.text();
  console.log(`\nHTTP ${res.status} ${text.slice(0, 200)}`);
  const ok = res.ok && /"errcode"\s*:\s*0/.test(text);
  console.log(ok ? '\n✔ 已发送，请在群里查看' : '\n✘ 发送失败，请检查 Webhook 地址');
  process.exit(ok ? 0 : 1);
}

if (channel === 'custom') {
  const hook = cfg.get('notify_custom_webhook') || '';
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '自检：提醒通道是否正常', content: `时间：${stamp}`, url: null, at: new Date().toISOString() }),
  });
  console.log(`\nHTTP ${res.status}`);
  console.log(res.ok ? '\n✔ 已推送，请检查你的接收端' : '\n✘ 推送失败，请检查地址');
  process.exit(res.ok ? 0 : 1);
}

console.log(`未知渠道：${channel}`);
process.exit(1);
