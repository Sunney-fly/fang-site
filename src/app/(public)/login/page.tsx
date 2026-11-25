import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import AuthForm from '@/components/AuthForm';
import { getCurrentUser, homeFor } from '@/lib/auth';

export const metadata: Metadata = {
  title: '登录 / 注册',
  description: '登录后可收藏房源、预约看房、管理与跟进客户。',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  const sp = await searchParams;
  const mode = sp.mode === 'register' ? 'register' : 'login';

  return (
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-12">
      <AuthForm initialMode={mode} />
    </div>
  );
}
