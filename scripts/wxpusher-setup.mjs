/**
 * WxPusher 配置 + 真实连通性测试。
 * 用法：node scripts/wxpusher-setup.mjs <AppToken> <UID[,UID2...]>
 *
 * 做三件事：
 *   1. 直接调 WxPusher 接口发一条测试消息 —— 验证 Token 和 UID 是否有效
 *   2. 把 Token / UID 写进数据库并启用 wxpusher 渠道
 *   3. 打印后续验证方式
 *
 * 安全说明：AppToken 是密钥，只写入数据库（Setting 表），不写进代码、不进 git。
 */
const TOKEN = (process.argv[2] || '').trim();
const UIDS = (process.argv[3] || '').trim();

if (!TOKEN || !UIDS) {
  console.error('用法：node scripts/wxpusher-setup.mjs <AppToken> <UID[,UID2...]>');
  process.exit(1);
}

const uidList = UIDS.split(/[\s,，;；]+/).filter(Boolean);
const mask = (s, head = 6) => `${s.slice(0, head)}…${s.slice(-4)}`;

console.log('\n=== 第 1 步：直接调 WxPusher 发送测试消息 ===');
console.log(`App Token：${mask(TOKEN)}（长度 ${TOKEN.length}）`);
console.log(`接收 UID ：${uidList.map((u) => mask(u, 8)).join(', ')}（共 ${uidList.length} 个）`);

let directOk = false;
let detail = '';

try {
  const content = [
    '## ✅ 二手房网站：提醒通道测试成功',
    '',
    '**收到这条消息，说明客户留资提醒已经打通。**',
    '',
    '今后客户在网站上留手机号或预约看房时，你会立刻收到一条这样的提醒，包含：',
    '',
    '- 客户姓名与手机号（可直接拨打）',
    '- 意向房源',
    '- 归属业务员',
    '- 客户留言与设备来源',
    '',
    '> 行业经验：5 分钟内回电，成交率最高。',
    '',
    `测试时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n');

  const res = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      appToken: TOKEN,
      content,
      summary: '二手房网站 · 提醒通道测试',
      contentType: 3, // Markdown
      uids: uidList,
    }),
  });

  const text = await res.text();
  console.log(`\nHTTP ${res.status}`);
  console.log(`返回：${text.slice(0, 400)}`);

  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* 忽略 */
  }

  detail = String(parsed.msg ?? '');

  // 关键：顶层 code=1000 只代表"任务已接受"，
  // 每个接收人的真实投递结果在 data[].code，1000 才是成功。
  const topOk = res.ok && parsed.code === 1000;
  const results = Array.isArray(parsed.data) ? parsed.data : [];
  const delivered = results.filter((d) => d.code === 1000);
  const failed = results.filter((d) => d.code !== undefined && d.code !== 1000);

  directOk = topOk && delivered.length > 0 && failed.length === 0;

  if (directOk) {
    console.log('\n✔ 投递成功，请查看 WxPusher App / 微信');
    console.log(`  成功接收人：${delivered.map((d) => mask(d.uid ?? '', 8)).join(', ')}`);
  } else if (topOk && failed.length > 0) {
    console.log('\n✘ 接口接受了任务，但投递失败：');
    for (const f of failed) {
      console.log(`  · ${f.uid}：code=${f.code}`);
      console.log(`    ${f.status ?? ''}`);
    }
    if (failed.some((f) => /未订阅|需要用户订阅/.test(f.status ?? ''))) {
      console.log('\n👉 解决方法（30 秒）：');
      console.log('   1. 打开 WxPusher 后台 https://wxpusher.zjiecode.com/admin/');
      console.log('   2. 进入「应用管理」→ 点开你创建的这个应用');
      console.log('   3. 页面里有「订阅二维码」和「订阅链接」，用你自己的微信扫码/点开');
      console.log('   4. 关注后回到这里重新运行本脚本，就会成功');
    }
  } else {
    console.log('\n✘ 发送失败');
    if (parsed.code === 1002) console.log('  原因：AppToken 不正确');
    else if (parsed.code === 1001) console.log('  原因：内容超长或参数不合法');
    else console.log(`  原因：${parsed.msg || '未知'}`);
  }
} catch (e) {
  console.log(`\n✘ 请求异常：${e.message}`);
}

console.log('\n=== 第 2 步：写入系统配置并启用 ===');
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

async function setSetting(key, value) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

try {
  await setSetting('notify_channel', 'wxpusher');
  await setSetting('notify_wxpusher_token', TOKEN);
  await setSetting('notify_wxpusher_uids', uidList.join(','));

  const [ch, tk, ud] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'notify_channel' } }),
    prisma.setting.findUnique({ where: { key: 'notify_wxpusher_token' } }),
    prisma.setting.findUnique({ where: { key: 'notify_wxpusher_uids' } }),
  ]);
  console.log(`✔ 渠道      : ${ch?.value}`);
  console.log(`✔ App Token : ${tk?.value ? mask(tk.value) : '(空)'}`);
  console.log(`✔ UID       : ${ud?.value ? ud.value.split(',').map((u) => mask(u, 8)).join(', ') : '(空)'}`);
  console.log('  （都存在数据库 Setting 表里，不进代码、不进 git）');
} finally {
  await prisma.$disconnect();
}

console.log('\n=== 第 3 步：确认应用侧 ===');
console.log('打开 http://localhost:3000/admin/settings ，「客户提醒」里应已选中 WxPusher 并回填了 Token/UID。');
console.log('点一次「📲 发送测试提醒」，走的是与真实留资完全相同的代码路径。');
console.log('然后可以运行 node scripts/simulate-real-lead.mjs 模拟一条真实客户留资。');

console.log('\n⚠️ 提示：AppToken 等价于推送密钥（只能发消息，不能读你的数据）。');
console.log('   你已把它贴给我，若担心记录外传，可去 WxPusher 后台重置 AppToken，然后在后台页面换掉即可。');

process.exit(directOk ? 0 : 1);
