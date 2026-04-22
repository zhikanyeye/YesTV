import { useEffect } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { fetchSourcesFromUrl, mergeSources } from '@/lib/utils/source-import-utils';
import type { SourceSubscription } from '@/lib/types';

// Minimum time between syncs for the same subscription (5 minutes)
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
// Delay before fallback scheduling when requestIdleCallback is unavailable
const INITIAL_SYNC_DELAY_MS = 1200;

let syncScheduled = false;
let syncCompleted = false;
let syncPromise: Promise<void> | null = null;

function runSubscriptionSync(): Promise<void> {
    if (syncCompleted) {
        return Promise.resolve();
    }

    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        try {
            // Read subscriptions directly from store (not via state to avoid re-renders)
            const settings = settingsStore.getSettings();
            const activeSubscriptions = settings.subscriptions.filter((s: SourceSubscription) => s.autoRefresh !== false);

            if (activeSubscriptions.length === 0) {
                syncCompleted = true;
                return;
            }

            let anyChanged = false;
            let currentSources = [...settings.sources];
            let currentPremiumSources = [...settings.premiumSources];
            const updatedSubscriptions = [...settings.subscriptions];
            const now = Date.now();

            // Filter out subscriptions that were synced recently (within cooldown period)
            const subsToSync = activeSubscriptions.filter(
                (sub: SourceSubscription) => !(sub.lastUpdated && now - sub.lastUpdated < SYNC_COOLDOWN_MS)
            );

            if (subsToSync.length === 0) {
                syncCompleted = true;
                return;
            }

            // Fetch all subscriptions in parallel for better performance
            const results = await Promise.allSettled(
                subsToSync.map((sub: SourceSubscription) => fetchSourcesFromUrl(sub.url))
            );

            // Process results
            results.forEach((result, index) => {
                const sub = subsToSync[index];
                if (result.status === 'fulfilled') {
                    const fetchResult = result.value;

                    if (fetchResult.normalSources.length > 0) {
                        currentSources = mergeSources(currentSources, fetchResult.normalSources);
                        anyChanged = true;
                    }

                    if (fetchResult.premiumSources.length > 0) {
                        currentPremiumSources = mergeSources(currentPremiumSources, fetchResult.premiumSources);
                        anyChanged = true;
                    }

                    // Update timestamp for successful sync
                    const subIdx = updatedSubscriptions.findIndex(s => s.id === sub.id);
                    if (subIdx !== -1) {
                        updatedSubscriptions[subIdx] = {
                            ...updatedSubscriptions[subIdx],
                            lastUpdated: now
                        };
                        anyChanged = true;
                    }
                } else {
                    console.error(`Failed to sync subscription: ${sub.name}`, result.reason);
                }
            });

            if (anyChanged) {
                settingsStore.saveSettings({
                    ...settings,
                    sources: currentSources,
                    premiumSources: currentPremiumSources,
                    subscriptions: updatedSubscriptions
                });
            }

            syncCompleted = true;
        } finally {
            syncPromise = null;
        }
    })();

    return syncPromise;
}

function scheduleSubscriptionSync() {
    if (syncScheduled || syncCompleted) {
        return;
    }

    syncScheduled = true;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
            void runSubscriptionSync();
        }, { timeout: 2000 });
        return;
    }

    setTimeout(() => {
        void runSubscriptionSync();
    }, INITIAL_SYNC_DELAY_MS);
}

export function useSubscriptionSync() {
    useEffect(() => {
        scheduleSubscriptionSync();
    }, []);
}
