'use client';

import { useEffect } from 'react';
import { useFavoritesStore } from '@/lib/store/favorites-store';
import { useHistoryStore } from '@/lib/store/history-store';
import { v4 as uuidv4 } from 'uuid';

export function StoreInitializer() {
  const setFavoritesUserId = useFavoritesStore((state) => state.setUserId);
  const setHistoryUserId = useHistoryStore((state) => state.setUserId);

  useEffect(() => {
    let userId = localStorage.getItem('kvideo-user-id');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('kvideo-user-id', userId);
    }
    setFavoritesUserId(userId);
    setHistoryUserId(userId);
  }, [setFavoritesUserId, setHistoryUserId]);

  return null;
}
