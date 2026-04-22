import { useCallback } from 'react';
import type { SourceBadge, Video } from '@/lib/types';

type CachedVideo = Omit<Video, 'vod_content' | 'vod_actor' | 'vod_director'>;

interface SearchCache {
  query: string;
  results: CachedVideo[];
  availableSources: SourceBadge[];
  timestamp: number;
}

const CACHE_KEY = 'kvideo_search_cache';
type SearchCacheScope = 'normal' | 'premium';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const MAX_CACHED_RESULTS = 300;

function getScopedCacheKey(scope: SearchCacheScope): string {
  return `${CACHE_KEY}:${scope}`;
}

/**
 * Strip unnecessary large fields before caching to save LocalStorage space
 */
const stripVideoData = (results: Video[]): CachedVideo[] => {
  return results.slice(0, MAX_CACHED_RESULTS).map(video => {
    // Remove large text fields that are only needed for the detail page
    const stripped: Video = { ...video };
    delete stripped.vod_content;
    delete stripped.vod_actor;
    delete stripped.vod_director;
    return stripped;
  });
};

const stripReducedVideoData = (results: Video[]): CachedVideo[] => stripVideoData(results).slice(0, 100);

export function useSearchCache(scope: SearchCacheScope = 'normal') {
  const scopedCacheKey = getScopedCacheKey(scope);

  const saveToCache = useCallback((
    query: string,
    results: Video[],
    sources: SourceBadge[]
  ) => {
    try {
      const strippedResults = stripVideoData(results);

      const cache: SearchCache = {
        query,
        results: strippedResults,
        availableSources: sources,
        timestamp: Date.now(),
      };

      localStorage.setItem(scopedCacheKey, JSON.stringify(cache));
      console.log(`[Cache] Successfully saved ${strippedResults.length} ${scope} results for query: "${query}"`);

    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[Cache] LocalStorage quota exceeded. Clearing cache and trying again with fewer results.');
        try {
          localStorage.removeItem(scopedCacheKey);
          // Try saving only top 100 results if quota exceeded
          const reducedResults = stripReducedVideoData(results);
          const reducedCache = {
            query,
            results: reducedResults,
            availableSources: sources,
            timestamp: Date.now(),
          };
          localStorage.setItem(scopedCacheKey, JSON.stringify(reducedCache));
        } catch (innerError) {
          console.error('[Cache] Failed to save even reduced cache:', innerError);
        }
      } else {
        console.error('[Cache] Failed to save search results to LocalStorage:', error);
      }
    }
  }, [scope, scopedCacheKey]);

  const loadFromCache = useCallback((): SearchCache | null => {
    try {
      const cached = localStorage.getItem(scopedCacheKey) || (scope === 'normal' ? localStorage.getItem(CACHE_KEY) : null);
      if (!cached) return null;

      const cache: SearchCache = JSON.parse(cached);

      // Check if cache is still valid
      if (Date.now() - cache.timestamp > CACHE_DURATION) {
        localStorage.removeItem(scopedCacheKey);
        if (scope === 'normal') {
          localStorage.removeItem(CACHE_KEY);
        }
        return null;
      }

      return cache;
    } catch (error) {
      console.error('[Cache] Failed to load search results from LocalStorage:', error);
      return null;
    }
  }, [scope, scopedCacheKey]);

  return {
    saveToCache,
    loadFromCache,
  };
}
