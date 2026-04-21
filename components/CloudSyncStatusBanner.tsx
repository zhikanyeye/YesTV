'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useCloudSyncStatusStore } from '@/lib/store/cloud-sync-status';

export function CloudSyncStatusBanner() {
  const { data: session } = useSession();
  const favoritesStatus = useCloudSyncStatusStore((state) => state.favorites);
  const historyStatus = useCloudSyncStatusStore((state) => state.history);

  const message = useMemo(() => {
    const fallbackFavorites = favoritesStatus === 'fallback';
    const fallbackHistory = historyStatus === 'fallback';

    if (!fallbackFavorites && !fallbackHistory) {
      return null;
    }

    if (fallbackFavorites && fallbackHistory) {
      return '云端同步暂不可用，已自动切换为本地收藏和历史记录。';
    }

    if (fallbackFavorites) {
      return '云端收藏暂不可用，已自动切换为本地收藏。';
    }

    return '云端历史暂不可用，已自动切换为本地历史记录。';
  }, [favoritesStatus, historyStatus]);

  if (!session?.user?.id || !message) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 z-[1100] w-[min(92vw,42rem)] -translate-x-1/2">
      <div
        className="rounded-[var(--radius-2xl)] border border-amber-300/60 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-[var(--shadow-md)] backdrop-blur-[10px]"
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
}
