import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { SETTING_KEYS } from '@/lib/setting-keys';
import { PageHeader } from '@/components/admin/ui';
import SettingsForm from '@/components/admin/SettingsForm';
import NotifySettingsForm from '@/components/admin/NotifySettingsForm';
import { NOTIFY_KEYS, recentNotifyLog } from '@/lib/notify';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireRole('SUPER_ADMIN');

  const [rows, log] = await Promise.all([prisma.setting.findMany(), recentNotifyLog()]);
  const values: Record<string, string> = {};
  for (const r of rows) values[r.key] = r.value;

  const requireReview = values[SETTING_KEYS.requireReview] !== '0';
  const updatedAt = rows.reduce<Date | null>(
    (latest, r) => (!latest || r.updatedAt > latest ? r.updatedAt : latest),
    null,
  );

  return (
    <div>
      <PageHeader
        title="系统设置"
        desc={`仅超级管理员可见。当前登录：${user.name}${updatedAt ? ` · 上次修改 ${formatDate(updatedAt)}` : ''}`}
      />

      <div className="space-y-4">
        <NotifySettingsForm
          values={{
            channel: values[NOTIFY_KEYS.channel] ?? 'off',
            wxpusherToken: values[NOTIFY_KEYS.wxpusherToken] ?? '',
            wxpusherUids: values[NOTIFY_KEYS.wxpusherUids] ?? '',
            wecomWebhook: values[NOTIFY_KEYS.wecomWebhook] ?? '',
            serverchanKey: values[NOTIFY_KEYS.serverchanKey] ?? '',
            pushplusToken: values[NOTIFY_KEYS.pushplusToken] ?? '',
            customWebhook: values[NOTIFY_KEYS.customWebhook] ?? '',
            notifyAdmin: values[NOTIFY_KEYS.notifyAdmin] === '1',
            adminPhone: values[NOTIFY_KEYS.adminPhone] ?? '',
          }}
          log={log}
        />

        <SettingsForm values={values} requireReview={requireReview} />
      </div>
    </div>
  );
}
