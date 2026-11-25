/**
 * 图片上传压缩验证。
 * 用法：node scripts/e2e-image.mjs [baseUrl]
 *
 * 生成一张手机照片尺寸的测试图（含噪点，模拟真实照片不易压缩的特征），
 * 走真实的 /api/upload 上传，检查：
 *   1. 上传成功并且服务端返回的是 WebP
 *   2. 长边被限制在 1600px 以内
 *   3. 体积明显变小
 * 最后删除测试图片，不留垃圾文件。
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';

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

const sharp = (await import('sharp')).default;
const { readFile, unlink } = await import('node:fs/promises');
const path = await import('node:path');

// 造一张 3000x2000 的带噪点图，体积接近手机实拍
console.log('生成 3000x2000 测试图…');
const width = 3000;
const height = 2000;
const noise = Buffer.alloc(width * height * 3);
for (let i = 0; i < noise.length; i += 1) {
  noise[i] = (Math.random() * 255) | 0;
}
const bigJpeg = await sharp(noise, { raw: { width, height, channels: 3 } })
  .jpeg({ quality: 95 })
  .toBuffer();
console.log(`测试图大小：${(bigJpeg.length / 1024 / 1024).toFixed(2)} MB`);

// 登录一个子管理员
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
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ phone: '13900000001', password: 'agent123456' }),
});
jar.absorb(loginRes);
check('子管理员登录成功', loginRes.status === 200);

// 上传
const fd = new FormData();
fd.append('files', new Blob([bigJpeg], { type: 'image/jpeg' }), 'test-photo.jpg');

const upRes = await fetch(`${BASE}/api/upload`, {
  method: 'POST',
  headers: { cookie: jar.header() },
  body: fd,
});
const upData = await upRes.json().catch(() => ({}));
check('上传接口返回成功', upRes.status === 200 && Array.isArray(upData.urls), JSON.stringify(upData).slice(0, 200));

const url = upData.urls?.[0];
check('返回了可访问的图片地址', typeof url === 'string' && url.startsWith('/uploads/'), `url=${url}`);
check('转换成了 WebP 格式（体积更小）', typeof url === 'string' && url.endsWith('.webp'), `url=${url}`);
check(
  '服务端报告了压缩量',
  typeof upData.originalKB === 'number' && typeof upData.savedKB === 'number' && upData.savedKB > 0,
  `原始 ${upData.originalKB}KB → 节省 ${upData.savedKB}KB`,
);

// 取回图片检查尺寸与体积
if (url) {
  const imgRes = await fetch(`${BASE}${url}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  check('图片可以正常访问', imgRes.status === 200 && buf.length > 0, `status=${imgRes.status}`);
  check('返回的 Content-Type 是 webp', imgRes.headers.get('content-type')?.includes('webp') === true, imgRes.headers.get('content-type') ?? '');

  const meta = await sharp(buf).metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  check(`长边已限制在 1600px 以内（实际 ${meta.width}x${meta.height}）`, longest <= 1600);
  check(
    `体积明显变小（${(bigJpeg.length / 1024).toFixed(0)}KB → ${(buf.length / 1024).toFixed(0)}KB）`,
    buf.length < bigJpeg.length * 0.5,
  );

  // 清理：删掉刚上传的测试图
  const local = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
  await unlink(local).catch(() => undefined);
  console.log(`  · 已清理测试图片 ${url}`);
}

console.log(`\n=========================`);
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
