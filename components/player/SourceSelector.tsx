'use client';

/**
 * SourceSelector - Component for selecting video source in player
 * Following Liquid Glass design system
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { Button } from '@/components/ui/Button';

export interface SourceInfo {
    id: string | number;
    source: string;
    sourceName?: string;
    latency?: number;
    pic?: string;
}

interface SourceSelectorProps {
    sources: SourceInfo[];
    currentSource: string;
    onSourceChange: (source: SourceInfo) => void;
    className?: string;
}

export function SourceSelector({
    sources,
    currentSource,
    onSourceChange,
    className = '',
}: SourceSelectorProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [latencies, setLatencies] = useState<Record<string, number>>({});
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Sort sources by latency - keep current source at top
    const sortedSources = useMemo(() => {
        // Separate current source and other sources
        const current = sources.find(s => s.source === currentSource);
        const others = sources.filter(s => s.source !== currentSource);
        
        // Sort other sources by latency
        const sortedOthers = others.sort((a, b) => {
            const latA = latencies[a.source] ?? a.latency ?? Infinity;
            const latB = latencies[b.source] ?? b.latency ?? Infinity;
            return latA - latB;
        });
        
        // Current source at top
        return current ? [current, ...sortedOthers] : sortedOthers;
    }, [sources, latencies, currentSource]);

    // Calculate rank for non-current sources (1-based ranking)
    const calculateSourceRank = useCallback((sourceId: string, index: number): number => {
        if (sourceId === currentSource) return -1; // Current source has no rank
        // If current source is at position 0, actual rank = index, otherwise index + 1
        return sortedSources[0]?.source === currentSource ? index : index + 1;
    }, [currentSource, sortedSources]);

    // Refresh latency for all sources
    const refreshLatencies = useCallback(async () => {
        setIsLoading(true);

        const results = await Promise.all(
            sources.map(async (source) => {
                try {
                    // Use the stored baseUrl or extract from source
                    const response = await fetch('/api/ping', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: source.source, // This should be the baseUrl ideally
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
    }, [sources]);

    // Initialize latencies from sources
    useEffect(() => {
        const initial: Record<string, number> = {};
        sources.forEach(s => {
            if (s.latency !== undefined) {
                initial[s.source] = s.latency;
            }
        });
        setLatencies(initial);
    }, [sources]);

    // Auto-scroll to current source when it changes
    useEffect(() => {
        buttonRefs.current[currentSource]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }, [currentSource]);

    if (sources.length <= 1) {
        return null;
    }

    return (
        <Card hover={false} className={`mt-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-[var(--text-color)] flex items-center gap-2">
                    <Icons.Layers size={20} className="sm:w-6 sm:h-6" />
                    <span></span>
                    <Badge variant="primary">{sources.length}</Badge>
                </h3>
                <Button
                    variant="secondary"
                    onClick={refreshLatencies}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5"
                >
                    <Icons.RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    刷新延迟
                </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {sortedSources.map((source, index) => {
                    const isCurrent = source.source === currentSource;
                    const latency = latencies[source.source] ?? source.latency;
                    const rank = calculateSourceRank(source.source, index);

                    return (
                        <button
                            key={`${source.source}-${index}`}
                            ref={(el) => { buttonRefs.current[source.source] = el; }}
                            onClick={() => !isCurrent && onSourceChange(source)}
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
        </Card>
    );
}
