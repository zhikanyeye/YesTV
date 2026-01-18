'use client';

/**
 * SourceSwitcher - Component for actively searching and switching video sources
 * Allows users to find and switch to alternative sources even when not in grouped mode
 * Following Liquid Glass design system
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { settingsStore } from '@/lib/store/settings-store';
import type { Video } from '@/lib/types';

interface SourceSwitcherProps {
  videoTitle: string;        // Current video title
  currentSource: string;     // Current video source ID
  isPremium?: boolean;       // Is premium source
}

interface SearchResult extends Video {
  sourceDisplayName?: string;
}

export function SourceSwitcher({
  videoTitle,
  currentSource,
  isPremium = false,
}: SourceSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);

  // Get current episode to preserve when switching
  const currentEpisode = searchParams.get('episode') || '0';

  // Filter and sort results
  const filteredResults = useMemo(() => {
    if (!searchResults.length) return [];

    // Filter: match video title and exclude current source
    const filtered = searchResults.filter(video => {
      // Normalize titles for comparison
      const normalizeTitle = (title: string) => 
        title.toLowerCase().replace(/\s+/g, '').trim();
      
      const currentTitle = normalizeTitle(videoTitle);
      const resultTitle = normalizeTitle(video.vod_name);
      
      // Match if titles are similar and not the current source
      return resultTitle.includes(currentTitle) || currentTitle.includes(resultTitle);
    }).filter(video => video.source !== currentSource);

    // Sort by latency (low to high)
    return filtered.sort((a, b) => {
      const latencyA = a.latency ?? Infinity;
      const latencyB = b.latency ?? Infinity;
      return latencyA - latencyB;
    });
  }, [searchResults, videoTitle, currentSource]);

  // Search for alternative sources
  const handleSearch = useCallback(async () => {
    if (!videoTitle || isSearching) return;

    setIsSearching(true);
    setError('');
    setSearchResults([]);
    setHasSearched(true);

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
                // Update results in real-time
                setSearchResults([...allVideos]);
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
      setError(err instanceof Error ? err.message : '搜索失败,请重试');
    } finally {
      setIsSearching(false);
    }
  }, [videoTitle, isPremium, isSearching]);

  // Handle source switch
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

  // Calculate rank for display (1-based, top 3 get badges)
  const getRank = (index: number): number => index + 1;

  return (
    <Card hover={false} className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-[var(--text-color)] flex items-center gap-2">
          <Icons.Layers size={20} className="sm:w-6 sm:h-6" />
          <span>切换视频源</span>
          {filteredResults.length > 0 && (
            <Badge variant="primary">{filteredResults.length}</Badge>
          )}
        </h3>
      </div>

      {/* Search Button */}
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

      {/* Results List */}
      {hasSearched && !isSearching && filteredResults.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredResults.map((video, index) => {
            const rank = getRank(index);
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
      {hasSearched && !isSearching && filteredResults.length === 0 && !error && (
        <div className="text-center py-8 text-[var(--text-color-secondary)]">
          <Icons.Search size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">未找到其他可用视频源</p>
          <p className="text-xs mt-1">尝试在设置中启用更多视频源</p>
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
    </Card>
  );
}
