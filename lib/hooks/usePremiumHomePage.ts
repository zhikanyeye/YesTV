import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSourceFingerprint, useSearchCache } from '@/lib/hooks/useSearchCache';
import { useParallelSearch } from '@/lib/hooks/useParallelSearch';
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync';
import { settingsStore, type SortOption } from '@/lib/store/settings-store';
import { VideoSource } from '@/lib/types';

export function usePremiumHomePage() {
    useSubscriptionSync();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loadFromCache, saveToCache } = useSearchCache('premium');
    const hasLoadedCache = useRef(false);
    const hasSearchedWithSourcesRef = useRef(false);
    const searchedSourceFingerprintRef = useRef('');
    const enabledPremiumSourcesRef = useRef<VideoSource[]>([]);

    const [query, setQuery] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [currentSortBy, setCurrentSortBy] = useState<SortOption>('default');

    const onUrlUpdate = useCallback((q: string) => {
        router.replace(`/premium?q=${encodeURIComponent(q)}`, { scroll: false });
    }, [router]);

    // Search stream hook
    const {
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        failedSources,
        performSearch,
        resetSearch,
        loadCachedResults,
        applySorting,
    } = useParallelSearch(
        saveToCache,
        onUrlUpdate
    );

    // Core search execution function - extracted to eliminate duplication
    const executeSearch = useCallback((searchQuery: string, sources: VideoSource[] = enabledPremiumSourcesRef.current) => {
        if (!searchQuery.trim()) return false;

        if (sources.length === 0) {
            return false;
        }

        performSearch(searchQuery, sources, currentSortBy);
        searchedSourceFingerprintRef.current = createSourceFingerprint(sources);
        hasSearchedWithSourcesRef.current = true;
        return true;
    }, [performSearch, currentSortBy]);

    // Re-sort results when sort preference changes
    useEffect(() => {
        if (hasSearched && results.length > 0) {
            applySorting(currentSortBy);
        }
    }, [currentSortBy, applySorting, hasSearched, results.length]);

    // Load sources and subscribe to changes
    useEffect(() => {
        const updateSettings = () => {
            const settings = settingsStore.getSettings();

            const newPremiumSources = settings.premiumSources.filter(s => s.enabled !== false);
            const sourceFingerprint = createSourceFingerprint(newPremiumSources);
            const sourcesChanged = searchedSourceFingerprintRef.current !== sourceFingerprint;
            enabledPremiumSourcesRef.current = newPremiumSources;

            if (settings.sortBy !== currentSortBy) {
                setCurrentSortBy(settings.sortBy);
            }

            // Check if we need to re-trigger search due to new sources being loaded
            const hasSources = newPremiumSources.length > 0;

            // If we have a query, and we haven't searched with sources yet,
            // and we suddenly have sources, trigger the search.
            if (
                hasLoadedCache.current &&
                query &&
                hasSources &&
                !loading &&
                (!hasSearchedWithSourcesRef.current || sourcesChanged)
            ) {
                if (executeSearch(query)) {
                    setHasSearched(true);
                }
            }
        };

        // Initial load
        updateSettings();

        // Subscribe to changes
        const unsubscribe = settingsStore.subscribe(updateSettings);
        return () => unsubscribe();
    }, [query, loading, executeSearch, currentSortBy]);

    const handleSearch = useCallback((searchQuery: string) => {
        if (!searchQuery.trim()) return;
        setQuery(searchQuery);
        setHasSearched(true);
        executeSearch(searchQuery);
    }, [executeSearch]);

    // Load cached results on mount
    useEffect(() => {
        if (hasLoadedCache.current) return;
        hasLoadedCache.current = true;

        const urlQuery = searchParams.get('q');
        const cached = loadFromCache(enabledPremiumSourcesRef.current);

        if (urlQuery) {
            setQuery(urlQuery);

            if (cached && cached.query === urlQuery && cached.results.length > 0) {
                setHasSearched(true);
                loadCachedResults(cached.results, cached.availableSources);
                searchedSourceFingerprintRef.current = createSourceFingerprint(enabledPremiumSourcesRef.current);
                hasSearchedWithSourcesRef.current = true;
                return;
            }

            handleSearch(urlQuery);
            // If no sources yet, the useEffect above will catch it when they load
        }
    }, [searchParams, loadFromCache, loadCachedResults, handleSearch]);

    const handleReset = useCallback(() => {
        setHasSearched(false);
        setQuery('');
        hasSearchedWithSourcesRef.current = false;
        searchedSourceFingerprintRef.current = '';
        resetSearch();
        router.replace('/premium', { scroll: false });
    }, [resetSearch, router]);

    return {
        query,
        hasSearched,
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        failedSources,
        handleSearch,
        handleReset,
    };
}
