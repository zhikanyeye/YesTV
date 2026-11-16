import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWakeLock } from './wake-lock';
import { createWatchdog } from './watchdog';
import { resolveMediaType } from './media-type';
import { buildCustomSettings } from './settings-panel';
import { resolveCapabilityOptions } from './player-options';
import type Artplayer from 'artplayer';
import type { PlayerSettingCallbacks, PlayerSettingsSnapshot } from './types';

test('mobile keeps a single fullscreen entry and drops the speed button', () => {
  const mobile = resolveCapabilityOptions(true);
  assert.equal(mobile.fullscreen, true);
  assert.equal(mobile.fullscreenWeb, false);
  assert.equal(mobile.pip, false);
  assert.equal(mobile.showSpeedBoostButton, false);
  assert.equal(mobile.lock, true);
  assert.equal(mobile.gesture, false);

  const desktop = resolveCapabilityOptions(false);
  assert.equal(desktop.fullscreen, true);
  assert.equal(desktop.fullscreenWeb, true);
  assert.equal(desktop.pip, true);
  assert.equal(desktop.showSpeedBoostButton, true);
  assert.equal(desktop.gesture, true);
});

test('long-press speed has a single slider that persists changes', () => {
  let savedSpeed = 0;
  const settings: PlayerSettingsSnapshot = {
    autoNextEpisode: true, autoSkipIntro: false, skipIntroSeconds: 0,
    autoSkipOutro: false, skipOutroSeconds: 0, adBlockEnabled: false,
    showModeIndicator: true, showResolutionIndicator: true,
    longPressSpeed: 2, longPressSpeedEnabled: true, rememberPlayerState: true,
    totalEpisodes: 1, currentEpisodeIndex: 0, isReversed: false,
  };
  const noop = () => {};
  const callbacks: PlayerSettingCallbacks = {
    setAutoNextEpisode: noop, setAutoSkipIntro: noop, setSkipIntroSeconds: noop,
    setAutoSkipOutro: noop, setSkipOutroSeconds: noop, setAdBlockEnabled: noop,
    setShowModeIndicator: noop, setShowResolutionIndicator: noop,
    setLongPressSpeedEnabled: noop, setLongPressSpeed: value => { savedSpeed = value; },
  };
  const art = { notice: { show: '' } } as unknown as Artplayer;
  const items = buildCustomSettings(art, { current: settings }, { current: callbacks });
  const speedItems = items.filter(item => String(item.html).includes('倍速'));
  assert.equal(speedItems.length, 1);
  const slider = speedItems[0];
  assert.deepEqual(slider.range, [2, 0.25, 8, 0.25]);
  assert.ok(slider.onChange);
  const item = { ...slider, $range: { valueAsNumber: 3.5 } };
  slider.onChange.call(art, item as Parameters<NonNullable<typeof slider.onChange>>[0],
    {} as HTMLDivElement, new Event('input'));
  assert.equal(savedSpeed, 3.5);
  assert.equal(item.tooltip, '3.5X');
});

test('original media URL determines type through proxy and fragment', () => {
  assert.equal(resolveMediaType('https://example.com/video.mp4#t=10', '/api/proxy'), 'mp4');
  assert.equal(resolveMediaType('https://example.com/video.m3u8?token=abc', '/api/proxy'), 'm3u8');
});

test('watchdog reports once and can be cancelled', async () => {
  let calls = 0;
  const watchdog = createWatchdog(() => calls++, 5);
  watchdog.start();
  watchdog.clear();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(calls, 0);
  watchdog.start();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(calls, 1);
  watchdog.clear();
});

test('pending wake lock is released after player cleanup', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let resolveLock!: (lock: { release: () => Promise<void> }) => void;
  let requests = 0;
  let releases = 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { wakeLock: { request: () => {
      requests++;
      return new Promise(resolve => { resolveLock = resolve; });
    } } },
  });
  try {
    const controller = createWakeLock();
    controller.request();
    controller.request();
    assert.equal(requests, 1);
    controller.release();
    resolveLock({ release: async () => { releases++; } });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(releases, 1);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
  }
});
