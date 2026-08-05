'use client';

import { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { GroupedVideo, VideoGroupCard } from './VideoGroupCard';
import { Video } from '@/lib/types';

interface VideoGridProps {
  videos: Video[];
  className?: string;
  isPremium?: boolean;
}

export const VideoGrid = memo(function VideoGrid({ videos, className = '', isPremium = false }: VideoGridProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Callback ref for the load more trigger
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();

    if (node) {
      observerRef.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 24);
        }
      }, { rootMargin: '400px' });

      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  // Memoize the click handler
  const handleCardClick = useCallback((e: React.MouseEvent, videoId: string, videoUrl: string) => {
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
      if (activeCardId === videoId) {
        window.location.href = videoUrl;
      } else {
        e.preventDefault();
        setActiveCardId(videoId);
      }
    }
  }, [activeCardId]);

  // Group videos by normalized title for source aggregation
  const videoGroups = useMemo(() => {
    const groups = new Map<string, Video[]>();

    videos.forEach(video => {
      // Normalize title for comparison
      const normalizedTitle = video.vod_name.toLowerCase().replace(/\s+/g, '');
      if (!groups.has(normalizedTitle)) {
        groups.set(normalizedTitle, []);
      }
      groups.get(normalizedTitle)!.push(video);
    });

    return groups;
  }, [videos]);

  const visibleVideoGroups = useMemo(() => {
    return Array.from(videoGroups.values())
      .map((groupVideos): GroupedVideo => {
        const representative = groupVideos.reduce((best, candidate) => {
          const bestLatency = best.latency ?? Infinity;
          const candidateLatency = candidate.latency ?? Infinity;
          return candidateLatency < bestLatency ? candidate : best;
        });

        return {
          representative,
          videos: groupVideos,
          name: representative.vod_name,
        };
      })
      .slice(0, visibleCount);
  }, [videoGroups, visibleCount]);

  const totalItems = videoGroups.size;

  if (videos.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3 md:gap-4 lg:gap-6 max-w-[1920px] mx-auto ${className}`}
        role="list"
        aria-label="视频搜索结果"
      >
        {visibleVideoGroups.map((group, index) => {
          const cardId = `${group.representative.source}-${group.representative.vod_id}-${group.name}`;
          const isActive = activeCardId === cardId;
          return (
            <VideoGroupCard
              key={cardId}
              group={group}
              cardId={cardId}
              isActive={isActive}
              onCardClick={handleCardClick}
              imagePriority={index < 6}
              isPremium={isPremium}
            />
          );
        })}
      </div>

      {/* Load more trigger */}
      {visibleCount < totalItems && (
        <div
          ref={loadMoreRef}
          className="h-20 w-full flex items-center justify-center opacity-0 pointer-events-none"
          aria-hidden="true"
        />
      )}
    </>
  );
});
