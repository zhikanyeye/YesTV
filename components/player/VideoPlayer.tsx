'use client';

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useHistory } from '@/lib/store/history-store';
import { settingsStore } from '@/lib/store/settings-store';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { VideoPlayerError } from './VideoPlayerError';
import { VideoPlayerEmpty } from './VideoPlayerEmpty';

interface VideoPlayerProps {
  playUrl: string;
  videoId?: string;
  currentEpisode: number;
  onBack: () => void;
  // Episode navigation props for auto-skip/auto-next
  totalEpisodes?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
  isPremium?: boolean;
  /** Suggested when the video cannot be played in either mode */
  onSwitchSource?: () => void;
}

export function VideoPlayer({
  playUrl,
  videoId,
  currentEpisode,
  onBack,
  totalEpisodes,
  onNextEpisode,
  isReversed = false,
  onSwitchSource,
}: VideoPlayerProps) {
  const [videoError, setVideoError] = useState<string>('');
  const [useProxy, setUseProxy] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_MANUAL_RETRIES = 20;
  const AUTO_PROXY_COOLDOWN_MS = 20000;
  const lastSaveTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const SAVE_INTERVAL = 5000; // 5 seconds throttle
  const lastAutoProxyAtRef = useRef(0);
  const autoProxyUsedRef = useRef(false);

  const subscribeToSettings = useCallback((listener: () => void) => settingsStore.subscribe(listener), []);
  const showModeIndicator = useSyncExternalStore(
    subscribeToSettings,
    () => settingsStore.getSettings().showModeIndicator,
    () => false,
  );
  const showResolutionIndicator = useSyncExternalStore(
    subscribeToSettings,
    () => settingsStore.getSettings().showResolutionIndicator,
    () => false,
  );
  
  // Store video resolution
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);

  // Use reactive hook to subscribe to history updates
  // This ensures the component re-renders when history is hydrated from localStorage
  const { viewingHistory, addToHistory } = useHistory();
  const searchParams = useSearchParams();

  // Get video metadata from URL params
  const source = searchParams.get('source') || '';
  const title = searchParams.get('title') || '未知视频';

  // Get saved progress for this video
  const getSavedProgress = () => {
    if (!videoId) return 0;

    // Directly check HistoryStore for progress
    // We prioritize a strict match (including source), but fall back to any match for this video/episode
    // This fixes issues where the source parameter might be missing or different
    const historyItem = viewingHistory.find((item) =>
      item.videoId.toString() === videoId?.toString() &&
      item.episodeIndex === currentEpisode &&
      (source ? item.source === source : true)
    ) || viewingHistory.find((item) =>
      item.videoId.toString() === videoId?.toString() &&
      item.episodeIndex === currentEpisode
    );

    return historyItem ? historyItem.playbackPosition : 0;
  };

  // Save progress function (used by throttle and beforeunload)
  const saveProgress = useCallback((currentTime: number, duration: number) => {
    if (!videoId || !playUrl || duration === 0 || currentTime <= 1) return;
    addToHistory(
      videoId,
      title,
      playUrl,
      currentEpisode,
      source,
      currentTime,
      duration,
      undefined,
      []
    );
  }, [videoId, playUrl, title, currentEpisode, source, addToHistory]);

  // Handle time updates and save progress (throttled to every 5 seconds)
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    // Always track current time for beforeunload
    currentTimeRef.current = currentTime;
    durationRef.current = duration;

    if (!videoId || !playUrl || duration === 0) return;

    const now = Date.now();
    // Only save if enough time has passed since last save
    if (currentTime > 1 && now - lastSaveTimeRef.current >= SAVE_INTERVAL) {
      lastSaveTimeRef.current = now;
      saveProgress(currentTime, duration);
    }
  }, [videoId, playUrl, saveProgress]);

  // Save on page leave/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save current progress before leaving
      if (currentTimeRef.current > 1 && durationRef.current > 0) {
        saveProgress(currentTimeRef.current, durationRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveProgress]);

  // Handle video errors
  const handleVideoError = useCallback((error: string) => {
    console.error('Video playback error:', error);

    // hls.js and the <video> element can both report the same failure in one
    // tick; ignore the echo right after an automatic proxy switch.
    if (!useProxy && autoProxyUsedRef.current && Date.now() - lastAutoProxyAtRef.current < 1500) {
      return;
    }

    // The proxy path is a one-shot automatic fallback; after that the user
    // decides whether to retry in the other direction, which keeps the
    // player from flickering between direct and proxy on its own.
    if (!useProxy && !autoProxyUsedRef.current && Date.now() - lastAutoProxyAtRef.current >= AUTO_PROXY_COOLDOWN_MS) {
      autoProxyUsedRef.current = true;
      lastAutoProxyAtRef.current = Date.now();
      setUseProxy(true);
      setShouldAutoPlay(true);
      setVideoError('');
      return;
    }

    setVideoError(error);
  }, [useProxy]);

  // A new episode gets a fresh automatic proxy fallback
  useEffect(() => {
    autoProxyUsedRef.current = false;
  }, [playUrl]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_MANUAL_RETRIES) return;

    setRetryCount(prev => prev + 1);
    setVideoError('');
    setShouldAutoPlay(true);
    setUseProxy(prev => !prev);
  }, [retryCount, MAX_MANUAL_RETRIES]);

  const finalPlayUrl = useProxy
    ? `/api/proxy?url=${encodeURIComponent(playUrl)}&retry=${retryCount}` // Add retry param to force fresh request
    : playUrl;

  if (!playUrl) {
    return <VideoPlayerEmpty />;
  }

  return (
    <Card hover={false} className="p-0 overflow-hidden relative rounded-none sm:rounded-[var(--radius-2xl)]">
      {/* Resolution Indicator Badge - controlled by settings */}
      {showResolutionIndicator && videoResolution && videoResolution.width > 0 && videoResolution.height > 0 && (
        <div className="absolute top-3 left-3 z-30">
          <span className="px-2 py-1 text-xs font-medium rounded-full backdrop-blur-md transition-all duration-300 bg-cyan-500/80 text-white">
            {videoResolution.width}×{videoResolution.height}
          </span>
        </div>
      )}
      {/* Mode Indicator Badge - controlled by settings */}
      {showModeIndicator && (
        <div className="absolute top-3 right-3 z-30">
          <span className={`px-2 py-1 text-xs font-medium rounded-full backdrop-blur-md transition-all duration-300 ${useProxy
            ? 'bg-orange-500/80 text-white'
            : 'bg-green-500/80 text-white'
            }`}>
            {useProxy ? '代理模式' : '直连模式'}
          </span>
        </div>
      )}
      {videoError ? (
        <VideoPlayerError
          error={videoError}
          onBack={onBack}
          onRetry={handleRetry}
          retryCount={retryCount}
          maxRetries={MAX_MANUAL_RETRIES}
          onSwitchSource={retryCount >= 5 ? onSwitchSource : undefined}
        />
      ) : (
        <CustomVideoPlayer
          key={`${useProxy ? 'proxy' : 'direct'}-${retryCount}`} // Only remount when switching modes or retrying, NOT when changing episodes
          src={finalPlayUrl}
          onError={handleVideoError}
          onTimeUpdate={handleTimeUpdate}
          onResolutionChange={setVideoResolution}
          initialTime={getSavedProgress()}
          shouldAutoPlay={shouldAutoPlay}
          totalEpisodes={totalEpisodes}
          currentEpisodeIndex={currentEpisode}
          onNextEpisode={onNextEpisode}
          isReversed={isReversed}
        />
      )}
    </Card>
  );
}
