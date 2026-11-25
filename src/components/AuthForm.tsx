'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = { initialMode: 'login' | 'register' };

export default function AuthForm({ initialMode }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login' ? { phone, password } : { phone, password, name };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; redirect?: string };

      if (!res.ok) {
        setError(data.error || '操作失败，请重试');
        return;
      }
      router.push(data.redirect || '/');
      router.refresh();
    } catch {
      setError('网络异常，请检查网络后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-md p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">
        {mode === 'login' ? '欢迎回来' : '注册账号'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {mode === 'login' ? '登录后可收藏房源、预约看房、查看进度' : '注册后即可收藏房源并预约看房'}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="phone">
            手机号
          </label>
          <input
            id="phone"
            className="input"
            inputMode="numeric"
            autoComplete="username"
            placeholder="请输入 11 位手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            required
          />
        </div>

        {mode === 'register' && (
          <div>
            <label className="label" htmlFor="name">
              称呼
            </label>
            <input
              id="name"
              className="input"
              placeholder="如：张先生"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'register' ? '至少 6 位' : '请输入密码'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-brand-700 hover:underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
        <Link href="/" className="text-slate-500 hover:text-slate-700">
          返回首页
        </Link>
      </div>

      <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-400">
        员工账号由管理员在后台开通，不开放自助注册。登录即表示同意平台服务条款，
        我们仅将你的手机号用于房源咨询与看房联系。
      </p>
    </div>
  );
}
