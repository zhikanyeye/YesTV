'use client';

import { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { VideoCard } from './VideoCard';
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
      const normalizedTitle = video.vod_name.toLowerCase().trim();
      if (!groups.has(normalizedTitle)) {
        groups.set(normalizedTitle, []);
      }
      groups.get(normalizedTitle)!.push(video);
    });

    return groups;
  }, [videos]);

  const visibleVideoItems = useMemo(() => {
    return videos.slice(0, visibleCount).map((video, index) => {
      const absoluteIndex = index;
      const params: Record<string, string> = {
        id: String(video.vod_id),
        source: video.source,
        title: video.vod_name,
      };

      if (isPremium) {
        params.premium = '1';
      }

      // Get all sources for this video title (grouped sources)
      const normalizedTitle = video.vod_name.toLowerCase().trim();
      const groupedVideos = videoGroups.get(normalizedTitle) || [video];
      
      // Only add groupedSources if there are multiple sources for the same video
      if (groupedVideos.length > 1) {
        const groupData = groupedVideos.map(v => ({
          id: v.vod_id,
          source: v.source,
          sourceName: v.sourceName,
          latency: v.latency,
          pic: v.vod_pic,
        }));
        params.groupedSources = JSON.stringify(groupData);
      }

      const videoUrl = `/player?${new URLSearchParams(params).toString()}`;

      const cardId = `${video.source}-${video.vod_id}-${absoluteIndex}`;

      return { video, videoUrl, cardId, absoluteIndex };
    });
  }, [videos, visibleCount, videoGroups, isPremium]);

  const totalItems = videos.length;

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
        {visibleVideoItems.map(({ video, videoUrl, cardId, absoluteIndex }) => {
          const isActive = activeCardId === cardId;
          return (
            <VideoCard
              key={cardId}
              video={video}
              videoUrl={videoUrl}
              cardId={cardId}
              isActive={isActive}
              onCardClick={handleCardClick}
              imagePriority={absoluteIndex < 6}
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
