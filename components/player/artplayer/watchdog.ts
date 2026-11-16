/**
 * 播放看门狗：视频在超时时间内未开始播放时上报错误。
 * 与媒体事件解耦，便于在初始化时立即启动、在播放/错误时清除。
 */

import { PLAYBACK_WATCHDOG_MS } from './constants';

export interface Watchdog {
  start: () => void;
  clear: () => void;
}

/** 创建看门狗，onTimeout 在超时且未清除时触发一次 */
export function createWatchdog(
  onTimeout: () => void,
  timeoutMs: number = PLAYBACK_WATCHDOG_MS
): Watchdog {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    start: () => {
      clear();
      timer = setTimeout(() => {
        timer = null;
        onTimeout();
      }, timeoutMs);
    },
    clear,
  };
}
