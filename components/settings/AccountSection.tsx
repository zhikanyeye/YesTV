'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { SettingsSection } from './SettingsSection';
import { Button } from '@/components/ui/Button';

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

export function AccountSection() {
  const { data: session, status } = useSession();
  const [account, setAccount] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadAccount() {
      if (status !== 'authenticated') {
        setAccount(null);
        return;
      }

      setLoading(true);
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
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      ignore = true;
    };
  }, [status]);

  const displayName = session?.user?.name || account?.user?.name || '未命名用户';
  const displayEmail = session?.user?.email || account?.user?.email || '未提供邮箱';
  const userId = account?.user?.id || session?.user?.id || '';

  return (
    <SettingsSection
      title="账号管理"
      description="登录后可同步收藏和历史记录；管理员可在后台管理用户。"
    >
      {status === 'loading' || loading ? (
        <p className="text-sm text-[var(--text-color-secondary)]">正在加载账号信息...</p>
      ) : status !== 'authenticated' ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-color-secondary)]">当前未登录。登录后可启用云端同步。</p>
          <div className="flex gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => signIn('github')}>
              使用 GitHub 登录
            </Button>
            <Button variant="secondary" onClick={() => signIn('qq')}>
              使用 QQ 登录
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
            <p className="text-[var(--text-color)] font-semibold">{displayName}</p>
            <p className="text-sm text-[var(--text-color-secondary)]">{displayEmail}</p>
            <p className="text-xs text-[var(--text-color-secondary)] mt-2 break-all">用户ID: {userId}</p>
            <p className="text-xs mt-2 text-[var(--text-color-secondary)]">
              权限: {account?.isAdmin ? '管理员' : '普通用户'}
            </p>
            {account?.user?.banned && (
              <p className="text-sm mt-2 text-red-500">
                当前账号已被封禁{account.user.banReason ? `: ${account.user.banReason}` : ''}
              </p>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {account?.isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center px-4 py-2.5 md:px-6 md:py-3 font-semibold text-sm md:text-base rounded-[var(--radius-2xl)] border border-[var(--glass-border)] text-[var(--text-color)] hover:shadow-[0_4px_12px_color-mix(in_srgb,var(--shadow-color)_70%,transparent)] transition-all duration-200"
              >
                打开管理员面板
              </Link>
            )}
            <Button variant="ghost" onClick={() => signOut()}>
              退出登录
            </Button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
