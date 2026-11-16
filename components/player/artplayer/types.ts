/**
 * ArtVideoPlayer 内部共享类型：设置项与回调的 ref 形状。
 * 供设置面板构建、长按加速等模块复用，避免类型重复定义。
 */

import type { Setting } from 'artplayer';

/** 播放器相关设置的快照（存于 ref，避免 effect 频繁重跑） */
export interface PlayerSettingsSnapshot {
  autoNextEpisode: boolean;
  autoSkipIntro: boolean;
  skipIntroSeconds: number;
  autoSkipOutro: boolean;
  skipOutroSeconds: number;
  adBlockEnabled: boolean;
  showModeIndicator: boolean;
  showResolutionIndicator: boolean;
  longPressSpeed: number;
  longPressSpeedEnabled: boolean;
  rememberPlayerState: boolean;
  totalEpisodes: number;
  currentEpisodeIndex: number;
  isReversed: boolean;
}

/** 设置变更回调集合（存于 ref，保持稳定） */
export interface PlayerSettingCallbacks {
  setAutoNextEpisode: (value: boolean) => void;
  setAutoSkipIntro: (value: boolean) => void;
  setSkipIntroSeconds: (value: number) => void;
  setAutoSkipOutro: (value: boolean) => void;
  setSkipOutroSeconds: (value: number) => void;
  setAdBlockEnabled: (value: boolean) => void;
  setShowModeIndicator: (value: boolean) => void;
  setShowResolutionIndicator: (value: boolean) => void;
  setLongPressSpeed: (value: number) => void;
  setLongPressSpeedEnabled: (value: boolean) => void;
}

export type CustomSettingFactory = (
  settingsRef: { current: PlayerSettingsSnapshot },
  callbacksRef: { current: PlayerSettingCallbacks }
) => Setting[];
