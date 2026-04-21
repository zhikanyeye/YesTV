'use client';

import { useFavorites } from '@/lib/store/favorites-store';
import { useHistory } from '@/lib/store/history-store';
import { CloudSyncStatusBanner } from '@/components/CloudSyncStatusBanner';

export function StoreInitializer() {
  // By calling these hooks, we are initializing the stores
  useFavorites();
  useHistory();

  return <CloudSyncStatusBanner />;
}
