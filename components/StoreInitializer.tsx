'use client';

import { useEffect } from 'react';
import { useFavorites } from '@/lib/store/favorites-store';
import { useHistory } from '@/lib/store/history-store';
import { v4 as uuidv4 } from 'uuid';

export function StoreInitializer() {
  // By calling these hooks, we are initializing the stores
  useFavorites();
  useHistory();

  return null;
}
