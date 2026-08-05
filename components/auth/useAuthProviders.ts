'use client';

import { getProviders } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function useAuthProviders() {
  const [providerIds, setProviderIds] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;

    getProviders()
      .then(providers => {
        if (active) {
          setProviderIds(Object.keys(providers ?? {}));
        }
      })
      .catch(() => {
        if (active) {
          setProviderIds([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    isLoading: providerIds === null,
    githubEnabled: providerIds?.includes('github') ?? false,
    qqEnabled: providerIds?.includes('qq') ?? false,
  };
}
