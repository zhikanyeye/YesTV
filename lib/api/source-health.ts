/**
 * Source health tracking with ladder-based auto-disable.
 * Aligned with LibreTV's approach: sources that keep failing are skipped
 * temporarily so they stop occupying search concurrency slots.
 */

interface SourceHealth {
  consecutiveFailures: number;
  disabledUntil: number;
  lastFailureAt: number;
}

// Ladder: 1st failure -> 1min, 2nd -> 5min, 3rd+ -> 15min
const DISABLE_LADDER_MS = [60_000, 5 * 60_000, 15 * 60_000];

const healthMap = new Map<string, SourceHealth>();

export function isSourceDisabled(sourceId: string): boolean {
  const health = healthMap.get(sourceId);
  if (!health) return false;
  if (Date.now() >= health.disabledUntil) {
    healthMap.delete(sourceId);
    return false;
  }
  return true;
}

export function getDisabledUntil(sourceId: string): number {
  return healthMap.get(sourceId)?.disabledUntil ?? 0;
}

export function recordSourceSuccess(sourceId: string): void {
  healthMap.delete(sourceId);
}

export function recordSourceFailure(sourceId: string): void {
  const now = Date.now();
  const health = healthMap.get(sourceId) ?? {
    consecutiveFailures: 0,
    disabledUntil: 0,
    lastFailureAt: 0,
  };
  health.consecutiveFailures += 1;
  health.lastFailureAt = now;
  const ladderIndex = Math.min(
    health.consecutiveFailures - 1,
    DISABLE_LADDER_MS.length - 1
  );
  health.disabledUntil = now + DISABLE_LADDER_MS[ladderIndex];
  healthMap.set(sourceId, health);
}
