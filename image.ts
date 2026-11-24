import 'server-only';

/**
 * 图片压缩。
 * 业务员的房源照片直接从手机上传，动辄 5-8MB，十张就上百兆，
 * 客户在微信里打开会一直转圈 —— 直接影响留资转化。
 *
 * 这里用 sharp 统一转成 WebP、最长边压到 1600px，
 * 一般能把 5MB 压到 150-300KB，肉眼看不出差别。
 * sharp 不可用时（例如某些精简环境装不上）自动跳过，不影响上传。
 */

const MAX_EDGE = 1600;
const QUALITY = 80;

type SharpFn = (input: Buffer, options?: { failOn?: string }) => {
  rotate: () => ReturnType<SharpFn>;
  resize: (opts: Record<string, unknown>) => ReturnType<SharpFn>;
  webp: (opts: Record<string, unknown>) => { toBuffer: () => Promise<Buffer> };
};

let sharpModule: SharpFn | null | undefined;

async function getSharp(): Promise<SharpFn | null> {
  if (sharpModule !== undefined) return sharpModule;

  try {
    // sharp 是可选依赖：装不上时（例如精简环境）自动降级为不压缩
    const mod: unknown = await import('sharp');
    const fn = (mod as { default?: unknown }).default ?? mod;
    sharpModule = typeof fn === 'function' ? (fn as SharpFn) : null;
    if (!sharpModule) console.warn('[image] sharp 导出异常，跳过压缩');
  } catch (e) {
    console.warn('[image] sharp 不可用，跳过压缩', e instanceof Error ? e.message : e);
    sharpModule = null;
  }

  return sharpModule;
}

export type CompressResult = {
  buffer: Buffer;
  ext: string;
  contentType: string;
  /** 压缩前后的字节数，用于日志和统计 */
  originalSize: number;
  size: number;
  compressed: boolean;
};

export async function compressImage(input: Buffer, mime: string): Promise<CompressResult> {
  const originalSize = input.length;
  const fallbackExt = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';

  // GIF 可能带动画，压缩会丢帧，直接放行
  if (mime === 'image/gif') {
    return {
      buffer: input,
      ext: 'gif',
      contentType: 'image/gif',
      originalSize,
      size: originalSize,
      compressed: false,
    };
  }

  const sharp = await getSharp();
  if (!sharp) {
    return {
      buffer: input,
      ext: fallbackExt,
      contentType: mime,
      originalSize,
      size: originalSize,
      compressed: false,
    };
  }

  try {
    const out = await sharp(input, { failOn: 'none' })
      .rotate() // 按 EXIF 自动纠正手机拍摄方向
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY })
      .toBuffer();

    // 万一压完更大（小图或已优化过的图），就保留原图
    if (out.length >= originalSize) {
      return {
        buffer: input,
        ext: fallbackExt,
        contentType: mime,
        originalSize,
        size: originalSize,
        compressed: false,
      };
    }

    return {
      buffer: out,
      ext: 'webp',
      contentType: 'image/webp',
      originalSize,
      size: out.length,
      compressed: true,
    };
  } catch (e) {
    console.warn('[image] 压缩失败，使用原图', e instanceof Error ? e.message : e);
    return {
      buffer: input,
      ext: fallbackExt,
      contentType: mime,
      originalSize,
      size: originalSize,
      compressed: false,
    };
  }
}
