'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

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
  const userDisplayName = session?.user?.name || '用户';

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
          <Image
            src={session.user?.image ?? ''}
            alt={userDisplayName}
            width={32}
            height={32}
            className="rounded-full"
          />
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
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
          <button
            onClick={() => signIn('github')}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            使用 GitHub 登录
          </button>
          <button
            onClick={() => signIn('qq')}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            使用 QQ 登录
          </button>
        </div>
      )}
    </div>
  );
}
