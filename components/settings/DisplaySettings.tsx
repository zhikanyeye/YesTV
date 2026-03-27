'use client';

/**
 * DisplaySettings - Settings for search display and latency
 * Following Liquid Glass design system
 */

import { Switch } from '@/components/ui/Switch';

interface DisplaySettingsProps {
    realtimeLatency: boolean;
    onRealtimeLatencyChange: (enabled: boolean) => void;
}

export function DisplaySettings({
    realtimeLatency,
    onRealtimeLatencyChange,
}: DisplaySettingsProps) {
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] p-6 mb-6">
            <h2 className="text-xl font-semibold text-[var(--text-color)] mb-4">显示设置</h2>

            {/* Real-time Latency Toggle */}
            <div>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-[var(--text-color)]">实时延迟显示</h3>
                        <p className="text-sm text-[var(--text-color-secondary)] mt-1">
                            开启后，搜索结果中的延迟数值会每 5 秒更新一次
                        </p>
                    </div>
                    <Switch
                        checked={realtimeLatency}
                        onChange={onRealtimeLatencyChange}
                        ariaLabel="实时延迟显示开关"
                    />
                </div>
            </div>
        </div>
    );
}
