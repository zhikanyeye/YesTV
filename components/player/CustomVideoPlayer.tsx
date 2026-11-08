'use client';

import { ArtVideoPlayer } from './ArtVideoPlayer';

interface CustomVideoPlayerProps {
  src: string;
  /** 原始播放地址（未经代理），用于判断真实媒体类型 */
  sourceUrl?: string;
  poster?: string;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onResolutionChange?: (resolution: { width: number; height: number } | null) => void;
  initialTime?: number;
  shouldAutoPlay?: boolean;
  // Episode navigation props for auto-skip/auto-next
  totalEpisodes?: number;
  currentEpisodeIndex?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
}

/**
 * Video Player based on ArtPlayer with hls.js integration.
 * Supports ad filtering, auto-skip, resume playback, and mobile gestures.
 */
export function CustomVideoPlayer(props: CustomVideoPlayerProps) {
  return <ArtVideoPlayer {...props} />;
}
