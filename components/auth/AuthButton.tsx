'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { useAuthProviders } from './useAuthProviders';

interface AccountState {
  loggedIn: boolean;
  isAdmin: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    banned: boolean;
    banReason: string | null;
  } | null;
}

export default function AuthButton() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [account, setAccount] = useState<AccountState | null>(null);
  const { isLoading: isLoadingProviders, githubEnabled, qqEnabled, emailEnabled } = useAuthProviders();
  const userDisplayName = session?.user?.name || '用户';
  const [emailInput, setEmailInput] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailStatus('sending');
    setEmailMessage('');

    try {
      const response = await fetch('/api/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) {
        setEmailStatus('sent');
        setEmailMessage('登录链接已发送，请查收邮件（10 分钟内有效）');
      } else {
        setEmailStatus('error');
        setEmailMessage(data.error || '发送失败，请稍后重试');
      }
    } catch {
      setEmailStatus('error');
      setEmailMessage('网络错误，请稍后重试');
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadAccount() {
      if (!session?.user) {
        setAccount(null);
        return;
      }

      try {
        const response = await fetch('/api/account/me', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!ignore) {
          setAccount(data);
        }
      } catch {
        if (!ignore) {
          setAccount(null);
        }
      }
    }

    loadAccount();

    return () => {
      ignore = true;
    };
  }, [session?.user]);

  if (session) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2"
          aria-label={`${userDisplayName}账户菜单`}
          title={`${userDisplayName}账户菜单`}
          aria-haspopup="menu"
          type="button"
        >
          {session.user?.image ? (
            <Image
              src={session.user.image}
              alt={userDisplayName}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-white"
              aria-hidden="true"
            >
              {userDisplayName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-2 z-10">
            <div className="px-4 pb-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{account?.user?.name || userDisplayName}</p>
              <p className="text-xs text-gray-500 truncate">{account?.user?.email || '未提供邮箱'}</p>
              <p className="text-[11px] text-gray-400 truncate mt-1">{account?.isAdmin ? '管理员' : '普通用户'}</p>
            </div>

            <Link
              href="/settings"
              onClick={() => setIsMenuOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              账号与设置
            </Link>

            {account?.isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsMenuOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                管理员面板
              </Link>
            )}

            <button
              onClick={() => signOut()}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              登出
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="text-sm font-medium"
        aria-haspopup="menu"
        type="button"
      >
        登录
      </button>
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-10">
          {githubEnabled && (
            <button
              onClick={() => signIn('github')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              使用 GitHub 登录
            </button>
          )}
          {qqEnabled && (
            <button
              onClick={() => signIn('qq')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              使用 QQ 登录
            </button>
          )}
          {emailEnabled && (
            <form
              onSubmit={handleEmailSubmit}
              className={`px-4 py-2 space-y-2 ${githubEnabled || qqEnabled ? 'border-t border-gray-100' : ''}`}
            >
              <input
                type="email"
                value={emailInput}
                onChange={event => setEmailInput(event.target.value)}
                placeholder="输入邮箱，获取登录链接"
                required
                autoComplete="email"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              />
              <button
                type="submit"
                disabled={emailStatus === 'sending'}
                className="w-full rounded bg-gray-900 px-2 py-1.5 text-sm text-white disabled:opacity-60"
              >
                {emailStatus === 'sending' ? '发送中...' : '发送登录链接'}
              </button>
              {emailMessage && (
                <p className={`text-xs ${emailStatus === 'sent' ? 'text-green-600' : 'text-red-600'}`}>
                  {emailMessage}
                </p>
              )}
            </form>
          )}
          {!isLoadingProviders && !githubEnabled && !qqEnabled && !emailEnabled && (
            <p className="px-4 py-2 text-sm text-gray-500">登录服务尚未配置</p>
          )}
        </div>
      )}
    </div>
  );
}
