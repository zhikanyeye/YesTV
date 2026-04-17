'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import type { ManagedUser } from '@/lib/types';

interface AccountInfo {
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

type UserAction = 'ban' | 'unban' | 'delete';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPage() {
  const { status } = useSession();
  const router = useRouter();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});

  const isReady = status !== 'loading' && !loading;

  async function loadUsers() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || '加载用户失败');
      }

      const data = await response.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载用户失败';
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      if (status === 'loading') return;

      setLoading(true);
      try {
        const accountResponse = await fetch('/api/account/me', { cache: 'no-store' });
        const accountData = (await accountResponse.json()) as AccountInfo;

        if (ignore) return;

        setAccount(accountData);

        if (!accountData.loggedIn) {
          router.replace('/');
          return;
        }

        if (!accountData.isAdmin) {
          setError('当前账号不是管理员，无法访问此页面。');
          return;
        }

        const userResponse = await fetch('/api/admin/users', { cache: 'no-store' });
        if (!userResponse.ok) {
          const data = await userResponse.json().catch(() => null);
          throw new Error(data?.error || '加载用户失败');
        }

        const userData = await userResponse.json();
        setUsers(Array.isArray(userData.users) ? userData.users : []);
        setError(null);
      } catch (err) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : '初始化失败';
          setError(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [status, router]);

  const stats = useMemo(() => {
    const total = users.length;
    const banned = users.filter((u) => u.banned).length;
    return { total, banned };
  }, [users]);

  async function runAction(action: UserAction, userId: string) {
    if (!account?.isAdmin) return;

    if (action === 'delete') {
      const confirmed = window.confirm('确认删除该用户以及其收藏与历史数据吗？此操作不可撤销。');
      if (!confirmed) return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId,
          reason: reasonDraft[userId] || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || '操作失败');
      }

      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败';
      window.alert(message);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-color)] bg-[image:var(--bg-image)] bg-fixed">
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-color)]">管理员面板</h1>
            <p className="text-[var(--text-color-secondary)] mt-1">
              管理用户账号状态，支持封禁、解封和删除用户数据。
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2.5 md:px-6 md:py-3 font-semibold text-sm md:text-base rounded-[var(--radius-2xl)] border border-[var(--glass-border)] text-[var(--text-color)]"
            >
              返回首页
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center px-4 py-2.5 md:px-6 md:py-3 font-semibold text-sm md:text-base rounded-[var(--radius-2xl)] border border-[var(--glass-border)] text-[var(--text-color)]"
            >
              返回设置
            </Link>
            <Button variant="secondary" onClick={loadUsers} disabled={refreshing || loading}>
              刷新用户
            </Button>
          </div>
        </div>

        {isReady && account?.isAdmin && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-[var(--radius-xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
              <p className="text-sm text-[var(--text-color-secondary)]">用户总数</p>
              <p className="text-2xl font-bold text-[var(--text-color)] mt-1">{stats.total}</p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
              <p className="text-sm text-[var(--text-color-secondary)]">封禁人数</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{stats.banned}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-[var(--radius-xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 text-[var(--text-color-secondary)]">
            正在加载管理员数据...
          </div>
        )}

        {error && (
          <div className="rounded-[var(--radius-xl)] border border-red-400/40 bg-red-500/10 p-6 text-red-500">
            {error}
          </div>
        )}

        {!loading && !error && account?.isAdmin && (
          <div className="space-y-4">
            {users.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 text-[var(--text-color-secondary)]">
                当前还没有已登记用户。用户首次登录后会自动出现在这里。
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-[var(--radius-xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-[var(--text-color)] font-semibold">{user.name || '未命名用户'}</p>
                      <p className="text-sm text-[var(--text-color-secondary)]">{user.email || '未提供邮箱'}</p>
                      <p className="text-xs text-[var(--text-color-secondary)] mt-2 break-all">ID: {user.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-color-secondary)]">最近登录</p>
                      <p className="text-sm text-[var(--text-color)]">{formatDate(user.lastLoginAt)}</p>
                      <p className={`text-xs mt-1 ${user.banned ? 'text-red-500' : 'text-green-500'}`}>
                        {user.banned ? '已封禁' : '正常'}
                      </p>
                    </div>
                  </div>

                  {user.banned && user.banReason && (
                    <p className="text-sm text-red-500">封禁原因: {user.banReason}</p>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="text"
                      value={reasonDraft[user.id] || ''}
                      onChange={(e) => setReasonDraft((prev) => ({ ...prev, [user.id]: e.target.value }))}
                      placeholder="封禁原因（可选）"
                      className="min-w-[220px] flex-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-xl)] px-3 py-2 text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]"
                    />

                    {!user.banned ? (
                      <Button variant="secondary" onClick={() => runAction('ban', user.id)}>
                        封禁
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => runAction('unban', user.id)}>
                        解封
                      </Button>
                    )}

                    <Button variant="ghost" onClick={() => runAction('delete', user.id)}>
                      删除用户
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
