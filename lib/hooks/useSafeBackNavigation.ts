'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPreviousInternalRoute } from '@/components/NavigationTracker';

export function useSafeBackNavigation(fallbackHref: string) {
  const router = useRouter();

  return useCallback(() => {
    const previousRoute = getPreviousInternalRoute();
    const currentRoute = `${window.location.pathname}${window.location.search}`;

    if (previousRoute && previousRoute !== currentRoute) {
      router.push(previousRoute);
      return;
    }

    router.push(fallbackHref);
  }, [fallbackHref, router]);
}
