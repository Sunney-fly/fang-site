import 'server-only';
import { prisma } from './db';

/**
 * 线索实时提醒。
 *
 * 背景：多数中小中介没有企业微信/公众号，但"客户留资后 5 分钟内要回电"这条铁律必须支持，
 * 所以这里同时支持几种零门槛渠道，业务员在手机上就能收到：
 *
 *  1. wxpusher    WxPusher（推荐：有独立 App，消息不会被微信折叠，支持 Markdown）
 *  2. serverchan  Server酱（关注公众号即可，个人微信直接收到）
 *  3. pushplus    PushPlus（同上，另一种选择）
 *  4. wecom       企业微信群机器人（如果以后有企业微信，最推荐）
 *  5. custom      通用 webhook：把 JSON 推给你自己的任意接收端（钉钉/飞书/自建）
 *
 * 配置存在 Setting 表里，管理员在「系统设置 → 客户提醒」里填写，改完点"发送测试"即可验证。
 * 密钥只进数据库，不进代码、不进 git。
 */

export type NotifyChannel = 'wxpusher' | 'wecom' | 'serverchan' | 'pushplus' | 'custom' | 'off';

export type NotifyConfig = {
  channel: NotifyChannel;
  /** WxPusher 应用 App Token（AT_ 开头） */
  wxpusherToken: string;
  /** WxPusher 接收人 UID（UID_ 开头），多个用逗号/空格分隔 */
  wxpusherUids: string;
  /** 企业微信机器人 webhook 完整地址 */
  wecomWebhook: string;
  /** Server酱 SendKey */
  serverchanKey: string;
  /** PushPlus token */
  pushplusToken: string;
  /** 通用 webhook 地址 */
  customWebhook: string;
  /** 是否同时把提醒发给管理员（默认只发给归属业务员） */
  notifyAdmin: boolean;
  /** 平台负责人手机号，用于兜底提醒 */
  adminPhone: string;
};

export const NOTIFY_KEYS = {
  channel: 'notify_channel',
  wxpusherToken: 'notify_wxpusher_token',
  wxpusherUids: 'notify_wxpusher_uids',
  wecomWebhook: 'notify_wecom_webhook',
  serverchanKey: 'notify_serverchan_key',
  pushplusToken: 'notify_pushplus_token',
  customWebhook: 'notify_custom_webhook',
  notifyAdmin: 'notify_admin',
  adminPhone: 'notify_admin_phone',
} as const;

export async function loadNotifyConfig(): Promise<NotifyConfig> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(NOTIFY_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    channel: (map.get(NOTIFY_KEYS.channel) as NotifyChannel) || 'off',
    wxpusherToken: map.get(NOTIFY_KEYS.wxpusherToken) ?? '',
    wxpusherUids: map.get(NOTIFY_KEYS.wxpusherUids) ?? '',
    wecomWebhook: map.get(NOTIFY_KEYS.wecomWebhook) ?? '',
    serverchanKey: map.get(NOTIFY_KEYS.serverchanKey) ?? '',
    pushplusToken: map.get(NOTIFY_KEYS.pushplusToken) ?? '',
    customWebhook: map.get(NOTIFY_KEYS.customWebhook) ?? '',
    notifyAdmin: map.get(NOTIFY_KEYS.notifyAdmin) === '1',
    adminPhone: map.get(NOTIFY_KEYS.adminPhone) ?? '',
  };
}

export type NotifyPayload = {
  title: string;
  /** 纯文本正文（企业微信 markdown 也会用它） */
  content: string;
  /** 点击跳转的链接（部分渠道支持） */
  url?: string;
};

export type SendResult = { ok: boolean; channel: string; detail: string };

const TIMEOUT_MS = 8000;

async function postJson(url: string, body: unknown): Promise<SendResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => '');
    return {
      ok: res.ok,
      channel: 'http',
      detail: `HTTP ${res.status} ${text.slice(0, 200)}`,
    };
  } catch (e) {
    return {
      ok: false,
      channel: 'http',
      detail: e instanceof Error ? e.message : '网络错误',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 按配置发一条提醒。永远不抛异常，失败只记日志。 */
export async function sendNotify(payload: NotifyPayload, cfg?: NotifyConfig): Promise<SendResult> {
  const config = cfg ?? (await loadNotifyConfig());

  if (config.channel === 'off') {
    return { ok: false, channel: 'off', detail: '未开启提醒' };
  }

  try {
    if (config.channel === 'wxpusher') {
      if (!config.wxpusherToken.startsWith('AT_')) {
        return { ok: false, channel: 'wxpusher', detail: '未填写 WxPusher App Token（应以 AT_ 开头）' };
      }
      const uids = config.wxpusherUids
        .split(/[\s,，;；]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (uids.length === 0) {
        return { ok: false, channel: 'wxpusher', detail: '未填写接收人 UID（应以 UID_ 开头）' };
      }

      // contentType 3 = Markdown，手机上排版更好看
      const body: Record<string, unknown> = {
        appToken: config.wxpusherToken,
        content: `${payload.content}${payload.url ? `\n\n[👉 在后台查看并跟进](${payload.url})` : ''}`,
        summary: payload.title.slice(0, 100),
        contentType: 3,
        uids,
      };
      if (payload.url) body.url = payload.url;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        const text = await res.text().catch(() => '');

        let parsed: {
          code?: number;
          msg?: string;
          data?: Array<{ uid?: string; code?: number; status?: string }>;
        } = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          /* 非 JSON 响应 */
        }

        // 注意：WxPusher 顶层 code=1000 只代表"任务已接受"，
        // 每个接收人的真实结果在 data[].code —— 1000 才是投递成功。
        const topOk = res.ok && parsed.code === 1000;
        const failed = (parsed.data ?? []).filter((d) => d.code !== undefined && d.code !== 1000);
        const delivered = (parsed.data ?? []).filter((d) => d.code === 1000);

        if (!topOk) {
          return {
            ok: false,
            channel: 'wxpusher',
            detail: `接口返回 code=${parsed.code ?? '?'} msg=${parsed.msg ?? text.slice(0, 120)}`,
          };
        }

        if (failed.length > 0) {
          const first = failed[0]!;
          // 1001 且提示未订阅 —— 这是最常见的坑，给出可操作的提示
          const notSubscribed = /未订阅|需要用户订阅/.test(first.status ?? '');
          return {
            ok: false,
            channel: 'wxpusher',
            detail: notSubscribed
              ? `有 ${failed.length} 个接收人未订阅该应用。请让对方用微信扫描应用的订阅二维码（WxPusher 后台 → 应用管理 → 应用详情里可复制），订阅后再试。`
              : `接收人投递失败：code=${first.code} ${first.status ?? ''}`,
          };
        }

        return {
          ok: delivered.length > 0,
          channel: 'wxpusher',
          detail: `已投递给 ${delivered.length} 个接收人${delivered.length === 0 ? '（无有效接收人）' : ''}`,
        };
      } finally {
        clearTimeout(timer);
      }
    }

    if (config.channel === 'wecom') {
      if (!config.wecomWebhook.startsWith('http')) {
        return { ok: false, channel: 'wecom', detail: '未填写企业微信机器人地址' };
      }
      const body = {
        msgtype: 'markdown',
        markdown: {
          content: `**${payload.title}**\n${payload.content}${
            payload.url ? `\n[点击查看](${payload.url})` : ''
          }`,
        },
      };
      const r = await postJson(config.wecomWebhook, body);
      return { ...r, channel: 'wecom' };
    }

    if (config.channel === 'serverchan') {
      if (!config.serverchanKey) {
        return { ok: false, channel: 'serverchan', detail: '未填写 Server酱 SendKey' };
      }
      const key = config.serverchanKey.trim();
      // 兼容 sctp<num>t... 与 sct<num>t... 两种 SendKey 格式
      const url = /^sctp/i.test(key)
        ? `https://push.ft07.com/send/${key}.send`
        : `https://sctapi.ftqq.com/${key}.send`;
      const form = new URLSearchParams({
        title: payload.title,
        desp: payload.content + (payload.url ? `\n\n[点击查看](${payload.url})` : ''),
      });
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
          signal: ctrl.signal,
        });
        const text = await res.text().catch(() => '');
        return { ok: res.ok, channel: 'serverchan', detail: `HTTP ${res.status} ${text.slice(0, 200)}` };
      } finally {
        clearTimeout(timer);
      }
    }

    if (config.channel === 'pushplus') {
      if (!config.pushplusToken) {
        return { ok: false, channel: 'pushplus', detail: '未填写 PushPlus token' };
      }
      const r = await postJson('https://www.pushplus.plus/send', {
        token: config.pushplusToken,
        title: payload.title,
        content: payload.content + (payload.url ? `\n\n<a href="${payload.url}">点击查看</a>` : ''),
        template: 'html',
      });
      return { ...r, channel: 'pushplus' };
    }

    if (config.channel === 'custom') {
      if (!config.customWebhook.startsWith('http')) {
        return { ok: false, channel: 'custom', detail: '未填写 webhook 地址' };
      }
      const r = await postJson(config.customWebhook, {
        title: payload.title,
        content: payload.content,
        url: payload.url ?? null,
        at: new Date().toISOString(),
      });
      return { ...r, channel: 'custom' };
    }

    return { ok: false, channel: String(config.channel), detail: '未知渠道' };
  } catch (e) {
    console.error('[notify] 发送失败', e);
    return { ok: false, channel: String(config.channel), detail: e instanceof Error ? e.message : '未知错误' };
  }
}

/* ==================== 业务级提醒 ==================== */

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** 新客户留资 / 预约看房提醒 */
export async function notifyNewLead(input: {
  leadId: string;
  name?: string | null;
  phone: string;
  wechat?: string | null;
  message?: string | null;
  source: string;
  listingTitle?: string | null;
  listingId?: string | null;
  ownerName?: string | null;
  sourceCodeName?: string | null;
  device?: string | null;
}): Promise<void> {
  const cfg = await loadNotifyConfig();
  if (cfg.channel === 'off') return;

  const sourceLabel =
    input.source === 'APPOINTMENT' ? '预约看房' : input.source === 'FORM' ? '留资咨询' : '客户咨询';

  const lines = [
    `**客户**：${input.name || '未留姓名'}　${input.phone}`,
    input.wechat ? `**微信**：${input.wechat}` : '',
    `**来源**：${sourceLabel}${input.sourceCodeName ? `（${input.sourceCodeName}）` : ''}`,
    input.listingTitle ? `**意向房源**：${input.listingTitle}` : '',
    input.message ? `**客户留言**：${input.message.slice(0, 100)}` : '',
    input.ownerName ? `**归属业务员**：${input.ownerName}` : '**归属业务员**：未分配（公共池）',
    input.device === 'mobile' ? `**设备**：手机端（很可能是微信来的）` : '',
    '',
    '⏰ 建议 5 分钟内电话联系，机会最大。',
  ].filter(Boolean);

  await sendNotify(
    {
      title: `🔔 新客户：${input.name || '未留姓名'} ${input.phone}`,
      content: lines.join('\n'),
      url: `${baseUrl()}/admin/leads`,
    },
    cfg,
  );

  await logNotify('lead', input.leadId, lines.join(' | '));
}

/** 测试提醒：管理员点按钮时调用 */
export async function sendTestNotify(): Promise<SendResult> {
  const cfg = await loadNotifyConfig();
  return sendNotify(
    {
      title: '✅ 测试提醒：配置成功',
      content: [
        '如果你看到这条消息，说明客户留资提醒已经打通。',
        '',
        '接下来客户在前台留资或预约看房时，你的手机就会收到类似这样的提醒。',
        `配置渠道：${cfg.channel}`,
      ].join('\n'),
      url: `${baseUrl()}/admin/settings`,
    },
    cfg,
  );
}

/**
 * 按线索 id 发提醒（内部自己查关联信息）。
 * 调用方一句 `void notifyLeadById(id)` 即可，不影响主流程。
 */
export async function notifyLeadById(leadId: string): Promise<void> {
  try {
    const cfg = await loadNotifyConfig();
    if (cfg.channel === 'off') return;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        name: true,
        phone: true,
        wechat: true,
        message: true,
        source: true,
        owner: { select: { name: true } },
        listing: { select: { id: true, title: true } },
        sourceCode: { select: { name: true } },
        session: { select: { device: true } },
      },
    });
    if (!lead) return;

    await notifyNewLead({
      leadId: lead.id,
      name: lead.name,
      phone: lead.phone,
      wechat: lead.wechat,
      message: lead.message,
      source: lead.source,
      listingTitle: lead.listing?.title ?? null,
      listingId: lead.listing?.id ?? null,
      ownerName: lead.owner?.name ?? null,
      sourceCodeName: lead.sourceCode?.name ?? null,
      device: lead.session?.device ?? null,
    });
  } catch (e) {
    console.error('[notify] notifyLeadById 失败', e);
  }
}

/**
 * 记录提醒日志。
 * 只用 Setting 表存最近若干条，避免为了一个提醒日志再建一张表。
 */
export async function logNotify(kind: string, refId: string, detail: string): Promise<void> {
  try {
    const line = `[${new Date().toISOString()}] ${kind} ${refId} ${detail}`;
    const prev = await prisma.setting.findUnique({ where: { key: 'notify_log' } });
    const lines = (prev?.value ? prev.value.split('\n') : []).filter(Boolean);
    lines.unshift(line);
    const value = lines.slice(0, 30).join('\n');
    await prisma.setting.upsert({
      where: { key: 'notify_log' },
      create: { key: 'notify_log', value },
      update: { value },
    });
  } catch {
    /* 日志失败无所谓 */
  }
}

export async function recentNotifyLog(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: 'notify_log' } });
  return (row?.value ? row.value.split('\n') : []).filter(Boolean).slice(0, 10);
}
