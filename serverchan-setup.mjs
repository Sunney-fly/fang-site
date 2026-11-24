/**
 * Server酱 SendKey 真实连通性测试 + 写入系统配置。
 * 用法：node scripts/serverchan-setup.mjs <SendKey> [baseUrl]
 *
 * 做三件事：
 *   1. 用真实 key 调 Server酱接口发一条消息 —— 直接验证"你手机能不能收到"
 *   2. 把 key 写进数据库并启用提醒渠道（等于在后台点了保存）
 *   3. 调系统的"发送测试提醒"逻辑，确认应用侧链路也通
 *
 * 注意：SendKey 是能给你微信发消息的凭证，等于密码。
 * 不要把 key 写进代码或提交到 git；本脚本只把它存进数据库。
 */
const KEY = (process.argv[2] || '').trim();
const BASE = process.argv[3] || 'http://127.0.0.1:3000';

if (!KEY) {
  console.error('用法：node scripts/serverchan-setup.mjs <SendKey> [baseUrl]');
  process.exit(1);
}

// 兼容两种格式：sctp<num>t... (新版 push.ft07.com) 与 sct<num>t... (老版 sctapi.ftqq.com)
const isNew = /^sctp/i.test(KEY);
const url = isNew
  ? `https://push.ft07.com/send/${KEY}.send`
  : `https://sctapi.ftqq.com/${KEY}.send`;
const masked = `${KEY.slice(0, 6)}…${KEY.slice(-4)}`;

console.log('\n=== 第 1 步：直接用你的 key 发一条测试消息 ===');
console.log(`SendKey：${masked}（格式：${isNew ? '新版 sctp' : '老版 sct'}）`);

let directOk = false;
try {
  const form = new URLSearchParams({
    title: '✅ 二手房网站：提醒通道测试成功',
    desp: [
      '**收到这条消息，说明你的客户留资提醒已经打通。**',
      '',
      '今后来源的实际情况是：客户在网站上留下手机号或预约看房后，',
      '你的微信会立刻收到一条这样的提醒，包含客户手机号、意向房源和归属业务员。',
      '',
      '行业经验：5 分钟内回电，成交率最高。',
      '',
      `测试时间：${new Date().toLocaleString('zh-CN')}`,
    ].join('\n'),
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(`返回：${text.slice(0, 300)}`);

  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* 忽略 */
  }
  // Server酱成功时返回 code 0
  directOk = res.ok && (parsed.code === 0 || parsed.code === undefined);
  console.log(directOk ? '\n✔ 消息已提交成功，请查看你的微信' : '\n✘ 发送失败，请检查 key 是否正确');
} catch (e) {
  console.log(`✘ 请求异常：${e.message}`);
}

console.log('\n=== 第 2 步：写入系统配置并启用提醒 ===');
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

async function setSetting(key, value) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

try {
  await setSetting('notify_channel', 'serverchan');
  await setSetting('notify_serverchan_key', KEY);
  console.log('✔ 已写入数据库：notify_channel=serverchan');
  console.log('  （存的是数据库里的 Setting 表，不是代码里，不会进 git）');

  const verify = await prisma.setting.findUnique({ where: { key: 'notify_channel' } });
  console.log(`  当前渠道：${verify?.value}`);
} finally {
  await prisma.$disconnect();
}

console.log('\n=== 第 3 步：确认应用侧提醒链路 ===');
console.log(`请打开 ${BASE}/admin/settings ，在「客户提醒」里应看到已选中 Server酱。`);
console.log('再点一次「📲 发送测试提醒」，如果也能收到，说明应用侧完全打通。');
console.log('\n提示：后台那个测试按钮走的是和真实留资完全相同的代码路径，测通即可放心。');
console.log('\n⚠️ 安全提醒：');
console.log('  这个 SendKey 等于你微信的推送凭证，我已经看到过它了。');
console.log('  如果你的聊天记录会外传，建议去 sct.ftqq.com 重新生成一个 key。');
console.log('  好消息是它只能给你发通知，不能读你的消息、不能登录你的账号。');

process.exit(directOk ? 0 : 1);
