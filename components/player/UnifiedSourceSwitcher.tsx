'use client';

/**
 * UnifiedSourceSwitcher - Unified component for video source selection and switching
 * Combines functionality of SourceSelector (pre-grouped sources) and SourceSwitcher (active search)
 * Following Liquid Glass design system
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { Button } from '@/components/ui/Button';
import { settingsStore } from '@/lib/store/settings-store';
import type { Video } from '@/lib/types';

export interface SourceInfo {
    id: string | number;
    source: string;
    sourceName?: string;
    latency?: number;
    pic?: string;
}

interface SearchResult extends Video {
  sourceDisplayName?: string;
}

interface UnifiedSourceSwitcherProps {
    // Optional pre-grouped sources (from search results with grouped mode)
    groupedSources?: SourceInfo[];
    // Current video information
    videoTitle: string;
    currentSource: string;
    isPremium?: boolean;
    // Callback when source changes (for grouped sources)
    onSourceChange?: (source: SourceInfo) => void;
    className?: string;
}

export function UnifiedSourceSwitcher({
    groupedSources = [],
    videoTitle,
    currentSource,
    isPremium = false,
    onSourceChange,
    className = '',
}: UnifiedSourceSwitcherProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [latencies, setLatencies] = useState<Record<string, number>>({});
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [error, setError] = useState<string>('');
    const [hasSearched, setHasSearched] = useState(false);
    const [usingCache, setUsingCache] = useState(false);
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Get current episode to preserve when switching
    const currentEpisode = searchParams.get('episode') || '0';

    // Determine if we have pre-grouped sources
    const hasGroupedSources = groupedSources.length > 0;

    // Sort grouped sources by latency - keep current source at top
    const sortedGroupedSources = useMemo(() => {
        if (!hasGroupedSources) return [];
        
        // Separate current source and other sources
        const current = groupedSources.find(s => s.source === currentSource);
        const others = groupedSources.filter(s => s.source !== currentSource);
        
        // Sort other sources by latency
        const sortedOthers = others.sort((a, b) => {
            const latA = latencies[a.source] ?? a.latency ?? Infinity;
            const latB = latencies[b.source] ?? b.latency ?? Infinity;
            return latA - latB;
        });
        
        // Current source at top
        return current ? [current, ...sortedOthers] : sortedOthers;
    }, [groupedSources, latencies, currentSource, hasGroupedSources]);

    // Filter and sort search results
    const filteredSearchResults = useMemo(() => {
        if (!searchResults.length) return [];

        // Normalize titles for comparison
        const normalizeTitle = (title: string) => 
            title.toLowerCase().replace(/\s+/g, '');
        
        const currentTitle = normalizeTitle(videoTitle);

        // Strict filtering: only keep results with exact title match (excluding current source)
        const filtered = searchResults.filter(video => {
            const resultTitle = normalizeTitle(video.vod_name);
            
            // Exact match: normalized titles must be equal
            return resultTitle === currentTitle && video.source !== currentSource;
        });

        // Sort by latency (low to high)
        return filtered.sort((a, b) => {
            const latencyA = a.latency ?? Infinity;
            const latencyB = b.latency ?? Infinity;
            return latencyA - latencyB;
        });
    }, [searchResults, videoTitle, currentSource]);

    // Calculate rank for non-current sources (1-based ranking)
    const calculateSourceRank = useCallback((sourceId: string, index: number): number => {
        if (sourceId === currentSource) return -1; // Current source has no rank
        // If current source is at position 0, actual rank = index, otherwise index + 1
        return sortedGroupedSources[0]?.source === currentSource ? index : index + 1;
    }, [currentSource, sortedGroupedSources]);

    // Refresh latency for grouped sources
    const refreshLatencies = useCallback(async () => {
        if (!hasGroupedSources) return;
        
        setIsLoading(true);

        const results = await Promise.all(
            groupedSources.map(async (source) => {
                try {
                    const response = await fetch('/api/ping', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: source.source,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return { source: source.source, latency: data.latency };
                    }
                } catch {
                    // Ignore errors
                }
                return { source: source.source, latency: undefined };
            })
        );

        const newLatencies: Record<string, number> = {};
        results.forEach(({ source, latency }) => {
            if (latency !== undefined) {
                newLatencies[source] = latency;
            }
        });

        setLatencies(newLatencies);
        setIsLoading(false);
    }, [groupedSources, hasGroupedSources]);

    // Search for alternative sources with timeout protection
    const handleSearch = useCallback(async () => {
        if (!videoTitle || isSearching) return;

        setIsSearching(true);
        setError('');
        setSearchResults([]);
        setHasSearched(true);
        setUsingCache(false);

        // Create abort controller for timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout

        try {
            // Get enabled sources from settings
            const settings = settingsStore.getSettings();
            const sources = isPremium ? settings.premiumSources : settings.sources;
            const enabledSources = sources.filter(s => s.enabled !== false);

            if (enabledSources.length === 0) {
                setError('没有启用的视频源');
                setIsSearching(false);
                return;
            }

            // Use parallel search API
            const response = await fetch('/api/search-parallel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: videoTitle,
                    sources: enabledSources,
                    page: 1,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                throw new Error('搜索请求失败');
            }

            // Read streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            const allVideos: SearchResult[] = [];

            if (!reader) {
                throw new Error('无法读取响应数据');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'videos' && Array.isArray(data.videos)) {
                                allVideos.push(...data.videos);
                                // Update results in real-time with batching
                                setSearchResults(prev => [...prev, ...data.videos]);
                            } else if (data.type === 'error') {
                                console.error('Search error:', data.message);
                            }
                        } catch {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }

            if (allVideos.length === 0) {
                setError('未找到匹配的视频源');
            }
        } catch (err) {
            console.error('Search failed:', err);
            if (err instanceof Error && err.name === 'AbortError') {
                setError('搜索超时，请重试');
            } else {
                setError(err instanceof Error ? err.message : '搜索失败,请重试');
            }
        } finally {
            clearTimeout(timeoutId);
            setIsSearching(false);
        }
    }, [videoTitle, isPremium, isSearching]);

    // Handle source switch from search results
    const handleSourceSwitch = useCallback((video: SearchResult) => {
        // Build new URL preserving the episode
        const params = new URLSearchParams();
        params.set('id', String(video.vod_id));
        params.set('source', video.source);
        params.set('title', video.vod_name);
        params.set('episode', currentEpisode);
        
        if (isPremium) {
            params.set('premium', '1');
        }

        // Navigate to new source
        router.push(`/player?${params.toString()}`);
    }, [router, currentEpisode, isPremium]);

    // Initialize latencies from grouped sources
    useEffect(() => {
        if (!hasGroupedSources) return;
        
        const initial: Record<string, number> = {};
        groupedSources.forEach(s => {
            if (s.latency !== undefined) {
                initial[s.source] = s.latency;
            }
        });
        setLatencies(initial);
        setUsingCache(true); // Mark that we're using cached sources
    }, [groupedSources, hasGroupedSources]);

    // Auto-scroll to current source when it changes
    useEffect(() => {
        if (hasGroupedSources) {
            buttonRefs.current[currentSource]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, [currentSource, hasGroupedSources]);

    // Don't show if only one grouped source and no search capability
    if (hasGroupedSources && groupedSources.length <= 1) {
        return null;
    }

    return (
        <Card hover={false} className={`mt-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-[var(--text-color)] flex items-center gap-2">
                    <Icons.Layers size={20} className="sm:w-6 sm:h-6" />
                    <span>切换视频源</span>
                    {hasGroupedSources ? (
                        <Badge variant="primary">{groupedSources.length}</Badge>
                    ) : filteredSearchResults.length > 0 ? (
                        <Badge variant="primary">{filteredSearchResults.length}</Badge>
                    ) : null}
                    {usingCache && hasGroupedSources && (
                        <Badge variant="secondary" className="text-xs">
                            <Icons.Zap size={12} className="mr-1" />
                            已缓存
                        </Badge>
                    )}
                </h3>
                {hasGroupedSources && (
                    <Button
                        variant="secondary"
                        onClick={refreshLatencies}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5"
                    >
                        <Icons.RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        刷新延迟
                    </Button>
                )}
            </div>

            {/* Show grouped sources if available */}
            {hasGroupedSources && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {sortedGroupedSources.map((source, index) => {
                        const isCurrent = source.source === currentSource;
                        const latency = latencies[source.source] ?? source.latency;
                        const rank = calculateSourceRank(source.source, index);

                        return (
                            <button
                                key={`${source.source}-${index}`}
                                ref={(el) => { buttonRefs.current[source.source] = el; }}
                                onClick={() => !isCurrent && onSourceChange?.(source)}
                                className={`
                                    w-full p-3 rounded-[var(--radius-2xl)] text-left transition-all duration-200
                                    flex items-center gap-3
                                    ${isCurrent
                                        ? 'bg-[var(--accent-color)] text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--accent-color)_50%,transparent)]'
                                        : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-[var(--text-color)] border border-[var(--glass-border)] cursor-pointer'
                                    }
                                `}
                                aria-current={isCurrent ? 'true' : undefined}
                            >
                                {/* Thumbnail */}
                                {source.pic && (
                                    <div className="w-12 h-16 rounded-[var(--radius-2xl)] overflow-hidden flex-shrink-0 bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)]">
                                        <Image
                                            src={source.pic}
                                            alt=""
                                            width={48}
                                            height={64}
                                            className="w-full h-full object-cover"
                                            unoptimized
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Source Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm sm:text-base truncate">
                                        {source.sourceName || source.source}
                                    </div>
                                    {latency !== undefined && (
                                        <div className="mt-1">
                                            <LatencyBadge latency={latency} />
                                        </div>
                                    )}
                                </div>

                                {/* Current indicator */}
                                {isCurrent && (
                                    <Icons.Play size={16} className="flex-shrink-0" />
                                )}

                                {/* Rank badge for top 3 (excluding current source) */}
                                {!isCurrent && rank > 0 && rank <= 3 && (
                                    <Badge
                                        variant="secondary"
                                        className={`flex-shrink-0 ${rank === 1 ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500' :
                                            rank === 2 ? 'bg-gray-400/20 text-gray-600 border-gray-400' :
                                                'bg-orange-400/20 text-orange-600 border-orange-400'
                                            }`}
                                    >
                                        #{rank}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Search Button - show if no grouped sources or always available for additional searches */}
            {!hasGroupedSources && (
                <>
                    <Button
                        variant="primary"
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="w-full flex items-center justify-center gap-2 mb-4"
                    >
                        {isSearching ? (
                            <>
                                <Icons.RefreshCw size={16} className="animate-spin" />
                                搜索中...
                            </>
                        ) : (
                            <>
                                <Icons.Search size={16} />
                                搜索其他源
                            </>
                        )}
                    </Button>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 rounded-[var(--radius-2xl)] bg-red-500/10 border border-red-500/30 text-red-600 text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {/* Search Results List */}
                    {hasSearched && !isSearching && filteredSearchResults.length > 0 && (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {filteredSearchResults.map((video, index) => {
                                const rank = index + 1; // 1-based ranking
                                const isTopRank = rank <= 3;

                                return (
                                    <button
                                        key={`${video.source}-${video.vod_id}`}
                                        onClick={() => handleSourceSwitch(video)}
                                        className="
                                            w-full p-3 rounded-[var(--radius-2xl)] text-left transition-all duration-200
                                            flex items-center gap-3
                                            bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] 
                                            text-[var(--text-color)] border border-[var(--glass-border)]
                                            cursor-pointer hover:border-[var(--accent-color)]
                                        "
                                        aria-label={`切换到 ${video.sourceDisplayName || video.source}`}
                                    >
                                        {/* Source Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm sm:text-base truncate">
                                                {video.sourceDisplayName || video.source}
                                            </div>
                                            <div className="text-xs text-[var(--text-color-secondary)] truncate mt-0.5">
                                                {video.vod_name}
                                                {video.vod_remarks && (
                                                    <span className="ml-2">· {video.vod_remarks}</span>
                                                )}
                                            </div>
                                            {video.latency !== undefined && (
                                                <div className="mt-1.5">
                                                    <LatencyBadge latency={video.latency} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Rank Badge for top 3 */}
                                        {isTopRank && (
                                            <Badge
                                                variant="secondary"
                                                className={`flex-shrink-0 ${
                                                    rank === 1 ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500' :
                                                    rank === 2 ? 'bg-gray-400/20 text-gray-600 border-gray-400' :
                                                    'bg-orange-400/20 text-orange-600 border-orange-400'
                                                }`}
                                            >
                                                #{rank}
                                            </Badge>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty State */}
                    {hasSearched && !isSearching && filteredSearchResults.length === 0 && !error && (
                        <div className="text-center py-8 text-[var(--text-color-secondary)]">
                            <Icons.Search size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">未找到完全匹配的视频源</p>
                            <p className="text-xs mt-1">其他视频源中没有找到与当前视频标题完全相同的资源</p>
                        </div>
                    )}

                    {/* Initial State */}
                    {!hasSearched && (
                        <div className="text-center py-6 text-[var(--text-color-secondary)]">
                            <Icons.Layers size={40} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">点击上方按钮搜索其他视频源</p>
                            <p className="text-xs mt-1">自动按延迟排序,快速切换</p>
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}
