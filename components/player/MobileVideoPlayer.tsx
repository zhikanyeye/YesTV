'use client';

import React from 'react';
import { Icons } from '@/components/ui/Icon';
import { useHlsPlayer } from './hooks/useHlsPlayer';
import { useAutoSkip } from './hooks/useAutoSkip';
import { useDoubleTap } from '@/lib/hooks/mobile/useDoubleTap';
import { useScreenOrientation } from '@/lib/hooks/mobile/useScreenOrientation';

interface MobileVideoPlayerProps {
  src: string;
  poster?: string;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onResolutionChange?: (resolution: { width: number; height: number } | null) => void;
  initialTime?: number;
  shouldAutoPlay?: boolean;
  totalEpisodes?: number;
  currentEpisodeIndex?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export function MobileVideoPlayer({
  src,
  poster,
  onError,
  onTimeUpdate,
  onResolutionChange,
  initialTime = 0,
  shouldAutoPlay = false,
  totalEpisodes = 1,
  currentEpisodeIndex = 0,
  onNextEpisode,
  isReversed = false,
}: MobileVideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [showHud, setShowHud] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const [showSkipBackward, setShowSkipBackward] = React.useState(false);
  const [showSkipForward, setShowSkipForward] = React.useState(false);
  const [skipBackwardAmount, setSkipBackwardAmount] = React.useState(10);
  const [skipForwardAmount, setSkipForwardAmount] = React.useState(10);

  const hudTimeoutRef = React.useRef<number | null>(null);
  const skipTimeoutRef = React.useRef<number | null>(null);
  const hasSeekedInitialRef = React.useRef(false);
  const skipModeUntilRef = React.useRef(0);
  const [isSkipModeActive, setIsSkipModeActive] = React.useState(false);

  useScreenOrientation(isFullscreen);

  useHlsPlayer({
    videoRef,
    src,
    autoPlay: shouldAutoPlay,
    onError: (message) => onError?.(message),
  });

  useAutoSkip({
    videoRef,
    src,
    currentTime,
    duration,
    isPlaying,
    totalEpisodes,
    currentEpisodeIndex,
    onNextEpisode,
    isReversed,
  });

  React.useEffect(() => {
    hasSeekedInitialRef.current = false;
    setIsLoading(true);
    setShowHud(true);
    setCurrentTime(0);
    setDuration(0);
    setShowSkipBackward(false);
    setShowSkipForward(false);
  }, [src]);

  React.useEffect(() => {
    if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    if (skipTimeoutRef.current) window.clearTimeout(skipTimeoutRef.current);
    return () => {
      if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
      if (skipTimeoutRef.current) window.clearTimeout(skipTimeoutRef.current);
    };
  }, []);

  const scheduleHideHud = React.useCallback(() => {
    if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = window.setTimeout(() => {
      setShowHud(false);
    }, 2500);
  }, []);

  const setSkipMode = React.useCallback(() => {
    skipModeUntilRef.current = Date.now() + 900;
    setIsSkipModeActive(true);
    if (skipTimeoutRef.current) window.clearTimeout(skipTimeoutRef.current);
    skipTimeoutRef.current = window.setTimeout(() => {
      setIsSkipModeActive(false);
      setShowSkipBackward(false);
      setShowSkipForward(false);
    }, 900);
  }, []);

  React.useEffect(() => {
    if (!isSkipModeActive) return;
    const id = window.setInterval(() => {
      if (Date.now() >= skipModeUntilRef.current) {
        setIsSkipModeActive(false);
        setShowSkipBackward(false);
        setShowSkipForward(false);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [isSkipModeActive]);

  const clampSeek = (t: number) => {
    const d = videoRef.current?.duration || duration;
    if (!isFinite(d) || d <= 0) return Math.max(0, t);
    return Math.min(Math.max(0, t), Math.max(0, d - 0.5));
  };

  const skipBy = React.useCallback((deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = clampSeek(video.currentTime + deltaSeconds);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    setSkipMode();
    if (deltaSeconds < 0) {
      setSkipBackwardAmount(Math.abs(deltaSeconds));
      setShowSkipBackward(true);
      setShowSkipForward(false);
    } else {
      setSkipForwardAmount(Math.abs(deltaSeconds));
      setShowSkipForward(true);
      setShowSkipBackward(false);
    }
  }, [setSkipMode]);

  const { handleTap } = useDoubleTap({
    onDoubleTapLeft: () => skipBy(-10),
    onDoubleTapRight: () => skipBy(10),
    onSingleTap: () => {
      setShowHud((v) => !v);
      if (isPlaying) scheduleHideHud();
    },
    onSkipContinueLeft: () => skipBy(-10),
    onSkipContinueRight: () => skipBy(10),
    isSkipModeActive,
  });

  const togglePlay = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleLoadedMetadata = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    setDuration(isFinite(d) ? d : 0);

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w > 0 && h > 0) onResolutionChange?.({ width: w, height: h });
    else onResolutionChange?.(null);

    if (!hasSeekedInitialRef.current && initialTime > 1 && isFinite(d) && d > 0) {
      const t = clampSeek(initialTime);
      video.currentTime = t;
      setCurrentTime(t);
      hasSeekedInitialRef.current = true;
    }
  }, [initialTime, onResolutionChange, clampSeek]);

  const handleTimeUpdateEvent = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    const d = video.duration;
    setCurrentTime(isFinite(t) ? t : 0);
    setDuration(isFinite(d) ? d : 0);
    onTimeUpdate?.(t, d);
  }, [onTimeUpdate]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onFsChange = () => {
      const doc: any = document;
      const el = doc.fullscreenElement || doc.webkitFullscreenElement;
      setIsFullscreen(!!el);
    };
    const onWebkitBegin = () => setIsFullscreen(true);
    const onWebkitEnd = () => setIsFullscreen(false);

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as any);
    video.addEventListener('webkitbeginfullscreen', onWebkitBegin as any);
    video.addEventListener('webkitendfullscreen', onWebkitEnd as any);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as any);
      video.removeEventListener('webkitbeginfullscreen', onWebkitBegin as any);
      video.removeEventListener('webkitendfullscreen', onWebkitEnd as any);
    };
  }, [src]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-none sm:rounded-[var(--radius-2xl)] overflow-hidden"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        playsInline
        x-webkit-airplay="allow"
        controls
        onTouchStart={handleTap}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdateEvent}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => {
          setIsLoading(false);
          if (shouldAutoPlay) {
            videoRef.current?.play().catch(() => {});
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          setShowHud(true);
          scheduleHideHud();
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowHud(true);
        }}
        onError={() => {
          onError?.('视频播放失败');
        }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/70 border-t-transparent" />
        </div>
      )}

      {showSkipBackward && (
        <div className="absolute top-1/2 left-16 -translate-y-1/2 pointer-events-none z-20">
          <div className="text-white text-2xl font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
            -{skipBackwardAmount}秒
          </div>
        </div>
      )}

      {showSkipForward && (
        <div className="absolute top-1/2 right-16 -translate-y-1/2 pointer-events-none z-20">
          <div className="text-white text-2xl font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
            +{skipForwardAmount}秒
          </div>
        </div>
      )}

      {showHud && !isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          {!isPlaying && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="pointer-events-auto w-16 h-16 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
              aria-label="播放"
            >
              <Icons.Play className="w-8 h-8 text-white ml-1" />
            </button>
          )}
        </div>
      )}

      {showHud && (
        <div className="absolute left-0 right-0 bottom-0 z-20 px-4 pb-3 pt-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <div className="flex items-center justify-between text-white/90 text-xs">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
