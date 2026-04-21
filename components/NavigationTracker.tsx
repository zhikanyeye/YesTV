'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const CURRENT_ROUTE_KEY = 'kvideo-nav-current';
const PREVIOUS_ROUTE_KEY = 'kvideo-nav-previous';

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    const currentRoute = sessionStorage.getItem(CURRENT_ROUTE_KEY);

    if (currentRoute && currentRoute !== route) {
      sessionStorage.setItem(PREVIOUS_ROUTE_KEY, currentRoute);
    }

    sessionStorage.setItem(CURRENT_ROUTE_KEY, route);
  }, [route]);

  return null;
}

export function getPreviousInternalRoute(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PREVIOUS_ROUTE_KEY);
}
