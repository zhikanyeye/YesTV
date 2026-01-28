import { useRef, useCallback } from 'react';

interface SearchCache {
  query: string;
  results: any[];
  availableSources: any[];
  timestamp: number;
}

interface SourceGroupCache {
  [videoTitle: string]: {
    sources: any[];
    timestamp: number;
  };
}

const CACHE_KEY = 'kvideo_search_cache';
const SOURCE_GROUP_CACHE_KEY = 'kvideo_source_group_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const MAX_CACHED_RESULTS = 300;

/**
 * Strip unnecessary large fields before caching to save LocalStorage space
 */
const stripVideoData = (results: any[]) => {
  return results.slice(0, MAX_CACHED_RESULTS).map(video => {
    // Remove large text fields that are only needed for the detail page
    const {
      vod_content,
      vod_actor,
      vod_director,
      ...rest
    } = video;
    return rest;
  });
};

export function useSearchCache() {
  /**
   * Strip unnecessary large fields before caching to save LocalStorage space
   */


  const saveToCache = useCallback((
    query: string,
    results: any[],
    sources: any[]
  ) => {
    try {
      const strippedResults = stripVideoData(results);

      const cache: SearchCache = {
        query,
        results: strippedResults,
        availableSources: sources,
        timestamp: Date.now(),
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      console.log(`[Cache] Successfully saved ${strippedResults.length} results for query: "${query}"`);

    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('[Cache] LocalStorage quota exceeded. Clearing cache and trying again with fewer results.');
        try {
          localStorage.removeItem(CACHE_KEY);
          // Try saving only top 100 results if quota exceeded
          const reducedResults = results.slice(0, 100).map(({ vod_content, vod_actor, vod_director, ...rest }: any) => rest);
          const reducedCache = {
            query,
            results: reducedResults,
            availableSources: sources,
            timestamp: Date.now(),
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(reducedCache));
        } catch (innerError) {
          console.error('[Cache] Failed to save even reduced cache:', innerError);
        }
      } else {
        console.error('[Cache] Failed to save search results to LocalStorage:', error);
      }
    }
  }, []);

  const loadFromCache = useCallback((): SearchCache | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cache: SearchCache = JSON.parse(cached);

      // Check if cache is still valid
      if (Date.now() - cache.timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return cache;
    } catch (error) {
      console.error('[Cache] Failed to load search results from LocalStorage:', error);
      return null;
    }
  }, []);

  /**
   * Save grouped sources for a specific video title
   */
  const saveSourceGroup = useCallback((videoTitle: string, sources: any[]) => {
    try {
      // Load existing cache
      const cached = localStorage.getItem(SOURCE_GROUP_CACHE_KEY);
      const cache: SourceGroupCache = cached ? JSON.parse(cached) : {};

      // Add or update this video's sources
      cache[videoTitle.toLowerCase().trim()] = {
        sources,
        timestamp: Date.now(),
      };

      localStorage.setItem(SOURCE_GROUP_CACHE_KEY, JSON.stringify(cache));
      console.log(`[Cache] Successfully saved ${sources.length} sources for video: "${videoTitle}"`);
    } catch (error) {
      console.error('[Cache] Failed to save source group to LocalStorage:', error);
    }
  }, []);

  /**
   * Load grouped sources for a specific video title
   */
  const loadSourceGroup = useCallback((videoTitle: string): any[] | null => {
    try {
      const cached = localStorage.getItem(SOURCE_GROUP_CACHE_KEY);
      if (!cached) return null;

      const cache: SourceGroupCache = JSON.parse(cached);
      const normalizedTitle = videoTitle.toLowerCase().trim();
      const entry = cache[normalizedTitle];

      if (!entry) return null;

      // Check if cache is still valid
      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        // Clean up expired entry
        delete cache[normalizedTitle];
        localStorage.setItem(SOURCE_GROUP_CACHE_KEY, JSON.stringify(cache));
        return null;
      }

      console.log(`[Cache] Loaded ${entry.sources.length} cached sources for video: "${videoTitle}"`);
      return entry.sources;
    } catch (error) {
      console.error('[Cache] Failed to load source group from LocalStorage:', error);
      return null;
    }
  }, []);

  return {
    saveToCache,
    loadFromCache,
    saveSourceGroup,
    loadSourceGroup,
  };
}
