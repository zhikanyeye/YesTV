/**
 * 播放器设置面板：向 ArtPlayer 设置面板注入项目自定义项。
 * 读取 settingsRef 的当前值初始化，交互时通过 callbacksRef 回写设置。
 */

import type Artplayer from 'artplayer';
import type { Setting, SettingOption } from 'artplayer';
import {
  LONG_PRESS_SPEED_MAX,
  LONG_PRESS_SPEED_MIN,
  LONG_PRESS_SPEED_STEP,
  normalizeLongPressSpeed,
} from '@/lib/utils/player-speed';
import type { PlayerSettingCallbacks, PlayerSettingsSnapshot } from './types';

type SettingsRef = { current: PlayerSettingsSnapshot };
type CallbacksRef = { current: PlayerSettingCallbacks };

/**
 * 构建自定义设置项数组。
 * 每个开关/滑块读取 ref 的即时值，交互后通过 callbacksRef 写回 store。
 */
export function buildCustomSettings(
  art: Artplayer,
  settingsRef: SettingsRef,
  callbacksRef: CallbacksRef
): Setting[] {
  const toggle = (
    html: string,
    get: () => boolean,
    set: (next: boolean) => void,
    onText = '开启',
    offText = '关闭'
  ): Setting => ({
    html,
    tooltip: get() ? onText : offText,
    switch: get(),
    onSwitch: function (item: SettingOption) {
      const next = !item.switch;
      item.switch = next;
      item.tooltip = next ? onText : offText;
      set(next);
      art.notice.show = `${html}已${next ? onText : offText}`;
      return next;
    },
  });

  return [
    toggle(
      '自动连播',
      () => settingsRef.current.autoNextEpisode,
      (v) => callbacksRef.current.setAutoNextEpisode(v)
    ),
    toggle(
      '跳过片头',
      () => settingsRef.current.autoSkipIntro,
      (v) => callbacksRef.current.setAutoSkipIntro(v),
      `${settingsRef.current.skipIntroSeconds}s`,
      '关闭'
    ),
    {
      html: '片头秒数',
      width: 200,
      tooltip: `${settingsRef.current.skipIntroSeconds}s`,
      range: [settingsRef.current.skipIntroSeconds, 0, 300, 5],
      onChange: function (item: SettingOption) {
        const val = item.$range?.valueAsNumber ?? Number(item.range[0] ?? 0);
        const tooltip = `${val}s`;
        item.tooltip = tooltip;
        callbacksRef.current.setSkipIntroSeconds(val);
        return tooltip;
      },
    },
    toggle(
      '跳过片尾',
      () => settingsRef.current.autoSkipOutro,
      (v) => callbacksRef.current.setAutoSkipOutro(v),
      `${settingsRef.current.skipOutroSeconds}s`,
      '关闭'
    ),
    {
      html: '片尾秒数',
      width: 200,
      tooltip: `${settingsRef.current.skipOutroSeconds}s`,
      range: [settingsRef.current.skipOutroSeconds, 0, 300, 5],
      onChange: function (item: SettingOption) {
        const val = item.$range?.valueAsNumber ?? Number(item.range[0] ?? 0);
        const tooltip = `${val}s`;
        item.tooltip = tooltip;
        callbacksRef.current.setSkipOutroSeconds(val);
        return tooltip;
      },
    },
    {
      html: '自动去广告',
      tooltip: settingsRef.current.adBlockEnabled ? '开启' : '关闭',
      switch: settingsRef.current.adBlockEnabled,
      onSwitch: function (item: SettingOption) {
        const next = !item.switch;
        item.switch = next;
        item.tooltip = next ? '开启' : '关闭';
        callbacksRef.current.setAdBlockEnabled(next);
        art.notice.show = `自动去广告已${next ? '开启' : '关闭'}（切集生效）`;
        return next;
      },
    },
    toggle(
      '分辨率指示',
      () => settingsRef.current.showResolutionIndicator,
      (v) => callbacksRef.current.setShowResolutionIndicator(v),
      '显示',
      '隐藏'
    ),
    toggle(
      '长按加速',
      () => settingsRef.current.longPressSpeedEnabled,
      (v) => callbacksRef.current.setLongPressSpeedEnabled(v)
    ),
    {
      html: '长按倍速',
      width: 200,
      tooltip: `${settingsRef.current.longPressSpeed}X`,
      range: [
        settingsRef.current.longPressSpeed,
        LONG_PRESS_SPEED_MIN,
        LONG_PRESS_SPEED_MAX,
        LONG_PRESS_SPEED_STEP,
      ],
      onChange: function (item: SettingOption) {
        const val = normalizeLongPressSpeed(
          item.$range?.valueAsNumber ?? Number(item.range[0])
        );
        const tooltip = `${val}X`;
        item.tooltip = tooltip;
        callbacksRef.current.setLongPressSpeed(val);
        return tooltip;
      },
    },
    toggle(
      '模式指示器',
      () => settingsRef.current.showModeIndicator,
      (v) => callbacksRef.current.setShowModeIndicator(v),
      '显示',
      '隐藏'
    ),
  ];
}
