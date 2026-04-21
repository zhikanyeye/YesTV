'use client';

import { CloudSyncStatusBanner } from '@/components/CloudSyncStatusBanner';
import { NavigationTracker } from '@/components/NavigationTracker';
import { useInitializeFavoritesSync } from '@/lib/store/favorites-store';
import { useInitializeHistorySync } from '@/lib/store/history-store';

export function StoreInitializer() {
  useInitializeFavoritesSync();
  useInitializeHistorySync();

  return (
    <>
      <NavigationTracker />
      <CloudSyncStatusBanner />
    </>
  );
}
