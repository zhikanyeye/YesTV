/**
 * 屏幕常亮（Wake Lock）：播放时保持屏幕唤醒，暂停/销毁时释放。
 */

export interface WakeLockController {
  request: () => void;
  release: () => void;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released?: boolean;
}

export function createWakeLock(): WakeLockController {
  let sentinel: WakeLockSentinelLike | null = null;
  let pending = false;
  let generation = 0;

  const request = () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (pending || (sentinel && !sentinel.released)) return;
    pending = true;
    const requestGeneration = generation;
    (
      navigator as Navigator & {
        wakeLock: { request: (t: 'screen') => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock
      .request('screen')
      .then((lock) => {
        if (requestGeneration !== generation) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
      })
      .catch(() => {
        if (requestGeneration === generation) sentinel = null;
      })
      .finally(() => {
        if (requestGeneration === generation) pending = false;
      });
  };

  const release = () => {
    generation++;
    pending = false;
    if (!sentinel) return;
    const lock = sentinel;
    sentinel = null;
    lock.release().catch(() => {});
  };

  return { request, release };
}
