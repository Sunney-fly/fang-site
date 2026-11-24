/**
 * 检查后台「客户提醒」配置页是否已正确显示 Server酱 配置。
 * 用法：node scripts/check-notify-ui.mjs [baseUrl]
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

const jar = new Jar();
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ phone: '13800000000', password: 'admin123456' }),
});
jar.absorb(login);
console.log(`超管登录：${login.status}`);

const page = await fetch(`${BASE}/admin/settings`, { headers: { cookie: jar.header() } });
const html = await page.text();
console.log(`设置页：${page.status}（${html.length} 字节）`);

function radioChecked(html, value) {
  const tags = [...html.matchAll(/<input[^>]*name="channel"[^>]*>/g)].map((m) => m[0]);
  return tags.some((t) => t.includes(`value="${value}"`) && /\schecked/.test(t));
}

const checks = [
  ['页面能正常渲染', page.status === 200],
  ['存在「客户提醒」板块', html.includes('客户提醒')],
  ['WxPusher 选项已选中（配置写入成功）', radioChecked(html, 'wxpusher')],
  ['Server酱 未被误选中', !radioChecked(html, 'serverchan')],
  ['App Token 已回填', /name="wxpusherToken"[^>]*value="AT_/.test(html)],
  ['接收人 UID 已回填', /name="wxpusherUids"[^>]*value="UID_/.test(html)],
  ['有「发送测试提醒」按钮', html.includes('发送测试提醒')],
  ['其它渠道（企业微信/PushPlus）仍可选', html.includes('企业微信') && html.includes('PushPlus')],
];

let pass = 0;
let fail = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '✔' : '✘'} ${label}`);
  ok ? (pass += 1) : (fail += 1);
}

// 单独确认凭证是否真的回填了（只打印掩码，不泄露完整 key）
const m = /name="wxpusherToken"[^>]*value="([^"]+)"/.exec(html);
if (m) {
  const key = m[1];
  console.log(`\n  回填的 App Token：${key.slice(0, 6)}…${key.slice(-4)}（长度 ${key.length}）`);
}
const mu = /name="wxpusherUids"[^>]*value="([^"]+)"/.exec(html);
if (mu) {
  const uid = mu[1];
  console.log(`  回填的 UID      ：${uid.slice(0, 8)}…${uid.slice(-4)}`);
}

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
