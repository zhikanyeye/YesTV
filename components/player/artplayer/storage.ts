/**
 * 播放器状态持久化：记忆倍速与画面比例。
 * 仅依赖 localStorage，读写失败时静默降级。
 */

import {
  STORAGE_ASPECT_RATIO_KEY,
  STORAGE_PLAYBACK_RATE_KEY,
} from './constants';

export interface PersistedPlayerState {
  playbackRate: number;
  aspectRatio: string;
}

const DEFAULT_STATE: PersistedPlayerState = {
  playbackRate: 1.0,
  aspectRatio: 'default',
};

/** 从 localStorage 读取记忆的倍速与画面比例 */
export function loadPersistedPlayerState(): PersistedPlayerState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };

  let playbackRate = DEFAULT_STATE.playbackRate;
  let aspectRatio = DEFAULT_STATE.aspectRatio;

  try {
    const storedRate = localStorage.getItem(STORAGE_PLAYBACK_RATE_KEY);
    if (storedRate) {
      const num = parseFloat(storedRate);
      if (!isNaN(num) && num > 0) playbackRate = num;
    }
    const storedRatio = localStorage.getItem(STORAGE_ASPECT_RATIO_KEY);
    if (storedRatio) aspectRatio = storedRatio;
  } catch {
    // ignore
  }

  return { playbackRate, aspectRatio };
}

/** 持久化当前倍速 */
export function savePlaybackRate(rate: number): void {
  if (typeof window === 'undefined' || !(rate > 0)) return;
  try {
    localStorage.setItem(STORAGE_PLAYBACK_RATE_KEY, String(rate));
  } catch {
    // ignore
  }
}

/** 持久化当前画面比例 */
export function saveAspectRatio(ratio: string): void {
  if (typeof window === 'undefined' || !ratio) return;
  try {
    localStorage.setItem(STORAGE_ASPECT_RATIO_KEY, String(ratio));
  } catch {
    // ignore
  }
}
