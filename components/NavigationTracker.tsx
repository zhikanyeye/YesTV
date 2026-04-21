'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const CURRENT_ROUTE_KEY = 'kvideo-nav-current';
const PREVIOUS_ROUTE_KEY = 'kvideo-nav-previous';

export function NavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const query = window.location.search;
    const route = query ? `${pathname}${query}` : pathname;
    const currentRoute = sessionStorage.getItem(CURRENT_ROUTE_KEY);

    if (currentRoute && currentRoute !== route) {
      sessionStorage.setItem(PREVIOUS_ROUTE_KEY, currentRoute);
    }

    sessionStorage.setItem(CURRENT_ROUTE_KEY, route);
  }, [pathname]);

  return null;
}

export function getPreviousInternalRoute(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PREVIOUS_ROUTE_KEY);
}
