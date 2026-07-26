'use client';

import { useCallback } from 'react';
import { sortVideos } from '@/lib/utils/sort';
import type { SortOption } from '@/lib/store/settings-store';
import type { Video, SourceBadge, VideoSource } from '@/lib/types';
import { useSearchState } from './useSearchState';
import { useSearchAction } from './useSearchAction';

interface ParallelSearchResult {
  loading: boolean;
  results: Video[];
  availableSources: SourceBadge[];
  completedSources: number;
  totalSources: number;
  totalVideosFound: number;
  failedSources: string[];
  performSearch: (query: string, sources?: VideoSource[], sortBy?: SortOption) => Promise<void>;
  resetSearch: () => void;
  loadCachedResults: (results: Video[], sources: SourceBadge[]) => void;
  applySorting: (sortBy: SortOption) => void;
}

export function useParallelSearch(
  onCacheUpdate: (query: string, results: Video[], sources: SourceBadge[], searchedSources: VideoSource[]) => void,
  onUrlUpdate: (query: string) => void
): ParallelSearchResult {
  const state = useSearchState();
  const {
    loading,
    results,
    availableSources,
    completedSources,
    totalSources,
    totalVideosFound,
    failedSources,
    setResults,
    setAvailableSources,
    setTotalVideosFound,
    resetState,
  } = state;

  const { performSearch, cancelSearch } = useSearchAction({
    state,
    onCacheUpdate,
    onUrlUpdate,
  });

  /**
   * Reset search state
   */
  const resetSearch = useCallback(() => {
    cancelSearch();
    resetState();
  }, [cancelSearch, resetState]);

  /**
   * Load cached results
   */
  const loadCachedResults = useCallback((cachedResults: Video[], cachedSources: SourceBadge[]) => {
    setResults(cachedResults);
    setAvailableSources(cachedSources);
    setTotalVideosFound(cachedResults.length);
  }, [setResults, setAvailableSources, setTotalVideosFound]);

  /**
   * Apply sorting to current results
   */
  const applySorting = useCallback((sortBy: SortOption) => {
    setResults((currentResults) => sortVideos(currentResults, sortBy));
  }, [setResults]);

  return {
    loading,
    results,
    availableSources,
    completedSources,
    totalSources,
    totalVideosFound,
    failedSources,
    performSearch,
    resetSearch,
    loadCachedResults,
    applySorting,
  };
}
