import { useEffect } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { fetchSourcesFromUrl, mergeSources } from '@/lib/utils/source-import-utils';
import type { SourceSubscription, VideoSource } from '@/lib/types';

// Minimum time between syncs for the same subscription (5 minutes)
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
// Delay before fallback scheduling when requestIdleCallback is unavailable
const INITIAL_SYNC_DELAY_MS = 1200;

let syncScheduled = false;
let syncPromise: Promise<void> | null = null;

function mergeSyncedSources(existing: VideoSource[], incoming: VideoSource[]): VideoSource[] {
    const enabledById = new Map(existing.map(source => [source.id, source.enabled]));
    return mergeSources(existing, incoming).map(source =>
        enabledById.has(source.id)
            ? { ...source, enabled: enabledById.get(source.id) }
            : source
    );
}

function runSubscriptionSync(): Promise<void> {
    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        try {
            // Read subscriptions directly from store (not via state to avoid re-renders)
            const settings = settingsStore.getSettings();
            const activeSubscriptions = settings.subscriptions.filter((s: SourceSubscription) => s.autoRefresh !== false);

            if (activeSubscriptions.length === 0) {
                return;
            }

            const now = Date.now();

            // Filter out subscriptions that were synced recently (within cooldown period)
            const subsToSync = activeSubscriptions.filter(
                (sub: SourceSubscription) => !(sub.lastUpdated && now - sub.lastUpdated < SYNC_COOLDOWN_MS)
            );

            if (subsToSync.length === 0) {
                return;
            }

            // Fetch all subscriptions in parallel for better performance
            const results = await Promise.allSettled(
                subsToSync.map((sub: SourceSubscription) => fetchSourcesFromUrl(sub.url))
            );

            const successfulResults: Array<{
                subscriptionId: string;
                normalSources: VideoSource[];
                premiumSources: VideoSource[];
            }> = [];

            results.forEach((result, index) => {
                const sub = subsToSync[index];
                if (result.status === 'fulfilled') {
                    successfulResults.push({
                        subscriptionId: sub.id,
                        normalSources: result.value.normalSources,
                        premiumSources: result.value.premiumSources,
                    });
                } else {
                    console.error(`Failed to sync subscription: ${sub.name}`, result.reason);
                }
            });

            if (successfulResults.length > 0) {
                const latestSettings = settingsStore.getSettings();
                let currentSources = [...latestSettings.sources];
                let currentPremiumSources = [...latestSettings.premiumSources];
                const successfulIds = new Set(successfulResults.map(result => result.subscriptionId));

                successfulResults.forEach(result => {
                    currentSources = mergeSyncedSources(currentSources, result.normalSources);
                    currentPremiumSources = mergeSyncedSources(currentPremiumSources, result.premiumSources);
                });

                settingsStore.saveSettings({
                    ...latestSettings,
                    sources: currentSources,
                    premiumSources: currentPremiumSources,
                    subscriptions: latestSettings.subscriptions.map(subscription =>
                        successfulIds.has(subscription.id)
                            ? { ...subscription, lastUpdated: now }
                            : subscription
                    ),
                });
            }
        } finally {
            syncPromise = null;
        }
    })();

    return syncPromise;
}

function scheduleSubscriptionSync() {
    if (syncScheduled || syncPromise) {
        return;
    }

    syncScheduled = true;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
            syncScheduled = false;
            void runSubscriptionSync();
        }, { timeout: 2000 });
        return;
    }

    setTimeout(() => {
        syncScheduled = false;
        void runSubscriptionSync();
    }, INITIAL_SYNC_DELAY_MS);
}

export function useSubscriptionSync() {
    useEffect(() => {
        scheduleSubscriptionSync();
        return settingsStore.subscribe(scheduleSubscriptionSync);
    }, []);
}
