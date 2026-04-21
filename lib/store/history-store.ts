/**
 * History State Store using Zustand
 * Manages viewing history with localStorage persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { VideoHistoryItem, Episode } from '@/lib/types';
import { clearSegmentsForUrl, clearAllCache } from '@/lib/utils/cacheManager';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useCloudSyncStatusStore } from '@/lib/store/cloud-sync-status';

const MAX_HISTORY_ITEMS = 50;

interface HistoryState {
  viewingHistory: VideoHistoryItem[];
  isHydrated: boolean;
}

interface HistoryActions {
  setIsHydrated: (isHydrated: boolean) => void;
  addToHistory: (
    videoId: string | number,
    title: string,
    url: string,
    episodeIndex: number,
    source: string,
    playbackPosition: number,
    duration: number,
    poster?: string,
    episodes?: Episode[]
  ) => void;
  removeFromHistory: (videoId: string | number, source: string) => void;
  clearHistory: () => void;
  importHistory: (history: VideoHistoryItem[]) => void;
}

interface HistoryStore extends HistoryState, HistoryActions { }

function generateShowIdentifier(title: string, source: string, videoId: string | number): string {
  return `${source}:${videoId}:${title.toLowerCase().trim()}`;
}

let remoteHistoryUserId: string | null = null;
let historyConsumerCount = 0;
const historyAvailabilityListeners = new Set<(available: boolean, userId: string | null) => void>();

function setRemoteHistoryUserId(userId: string | null) {
  remoteHistoryUserId = userId;
}

function notifyHistoryAvailability(available: boolean, history?: VideoHistoryItem[]) {
  const activeUserId = remoteHistoryUserId;

  if (!available && history) {
    useLocalHistoryStore.getState().importHistory(history);
  }

  useCloudSyncStatusStore.getState().setHistoryStatus(available ? 'available' : 'fallback');
  historyAvailabilityListeners.forEach((listener) => listener(available, activeUserId));
}

const useLocalHistoryStore = create<HistoryStore>()(
    persist(
        (set, get) => ({
            viewingHistory: [],
            isHydrated: false,
            setIsHydrated: (isHydrated) => set({ isHydrated }),
            addToHistory: (videoId, title, url, episodeIndex, source, playbackPosition, duration, poster, episodes = []) => {
                const showIdentifier = generateShowIdentifier(title, source, videoId);
                const timestamp = Date.now();
                set((state) => {
                    const existingIndex = state.viewingHistory.findIndex(item => item.showIdentifier === showIdentifier);
                    let newHistory: VideoHistoryItem[];
                    if (existingIndex !== -1) {
                        const updatedItem: VideoHistoryItem = { ...state.viewingHistory[existingIndex], url, episodeIndex, playbackPosition, duration, timestamp, episodes: episodes.length > 0 ? episodes : state.viewingHistory[existingIndex].episodes };
                        newHistory = [updatedItem, ...state.viewingHistory.filter((_, index) => index !== existingIndex)];
                    } else {
                        const newItem: VideoHistoryItem = { videoId, title, url, episodeIndex, source, timestamp, playbackPosition, duration, poster, episodes, showIdentifier };
                        newHistory = [newItem, ...state.viewingHistory];
                    }
                    if (newHistory.length > MAX_HISTORY_ITEMS) {
                        newHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);
                    }
                    return { viewingHistory: newHistory };
                });
            },
            removeFromHistory: (videoId, source) => {
                const itemToRemove = get().viewingHistory.find(item => item.videoId === videoId && item.source === source);
                if (itemToRemove) {
                    clearSegmentsForUrl(itemToRemove.url);
                }
                set((state) => ({ viewingHistory: state.viewingHistory.filter(item => !(item.videoId === videoId && item.source === source)) }));
            },
            clearHistory: () => {
                clearAllCache();
                set({ viewingHistory: [] });
            },
            importHistory: (history) => set({ viewingHistory: history }),
        }),
        {
            name: 'kvideo-history-store',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                if (state) state.setIsHydrated(true);
            },
        }
    )
);

const useRemoteHistoryStore = create<HistoryStore>((set, get) => ({
    viewingHistory: [],
    isHydrated: false,
    setIsHydrated: (isHydrated) => set({ isHydrated }),
    addToHistory: async (videoId, title, url, episodeIndex, source, playbackPosition, duration, poster, episodes = []) => {
        const showIdentifier = generateShowIdentifier(title, source, videoId);
        const timestamp = Date.now();
        let newHistory: VideoHistoryItem[];
        const existingIndex = get().viewingHistory.findIndex(item => item.showIdentifier === showIdentifier);
        if (existingIndex !== -1) {
            const updatedItem: VideoHistoryItem = { ...get().viewingHistory[existingIndex], url, episodeIndex, playbackPosition, duration, timestamp, episodes: episodes.length > 0 ? episodes : get().viewingHistory[existingIndex].episodes };
            newHistory = [updatedItem, ...get().viewingHistory.filter((_, index) => index !== existingIndex)];
        } else {
            const newItem: VideoHistoryItem = { videoId, title, url, episodeIndex, source, timestamp, playbackPosition, duration, poster, episodes, showIdentifier };
            newHistory = [newItem, ...get().viewingHistory];
        }
        if (newHistory.length > MAX_HISTORY_ITEMS) {
            newHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);
        }
        set({ viewingHistory: newHistory });
        await syncHistory(newHistory);
    },
    removeFromHistory: async (videoId, source) => {
        const itemToRemove = get().viewingHistory.find(item => item.videoId === videoId && item.source === source);
        if (itemToRemove) {
            clearSegmentsForUrl(itemToRemove.url);
        }
        const newHistory = get().viewingHistory.filter(item => !(item.videoId === videoId && item.source === source));
        set({ viewingHistory: newHistory });
        await syncHistory(newHistory);
    },
    clearHistory: async () => {
        clearAllCache();
        set({ viewingHistory: [] });
        await syncHistory([]);
    },
    importHistory: async (history) => {
        set({ viewingHistory: history });
        await syncHistory(history);
    },
}));

async function syncHistory(history: VideoHistoryItem[]) {
    if (!remoteHistoryUserId) return false;

    try {
        const response = await fetch(`/api/history?userId=${remoteHistoryUserId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(history),
        });

        if (!response.ok) {
            notifyHistoryAvailability(false, history);
            return false;
        }

        notifyHistoryAvailability(true);
        return true;
    } catch (error) {
        console.error('Failed to sync history:', error);
        notifyHistoryAvailability(false, history);
        return false;
    }
}

export function useHistory() {
    const { data: session } = useSession();
    const localStore = useLocalHistoryStore();
    const remoteStore = useRemoteHistoryStore();
    const [remoteState, setRemoteState] = useState<{ userId: string | null; available: boolean }>({
        userId: null,
        available: false,
    });

    useEffect(() => {
        const userId = session?.user?.id ?? null;

        if (!userId) {
            setRemoteHistoryUserId(null);
            useCloudSyncStatusStore.getState().setHistoryStatus('unknown');
            return;
        }

        historyConsumerCount += 1;
        setRemoteHistoryUserId(userId);
        const handleAvailabilityChange = (available: boolean, updatedUserId: string | null) => {
            setRemoteState({ userId: updatedUserId, available });
        };
        historyAvailabilityListeners.add(handleAvailabilityChange);

        let cancelled = false;

        async function fetchData() {
            try {
                const response = await fetch(`/api/history?userId=${userId}`);
                if (!response.ok) {
                    if (!cancelled) notifyHistoryAvailability(false);
                    return;
                }

                const history = await response.json();
                useRemoteHistoryStore.setState({ viewingHistory: history, isHydrated: true });
                if (!cancelled) {
                    notifyHistoryAvailability(true);
                }
            } catch (error) {
                console.error('Failed to fetch remote history:', error);
                if (!cancelled) notifyHistoryAvailability(false);
            }
        }

        fetchData();

        return () => {
            cancelled = true;
            historyAvailabilityListeners.delete(handleAvailabilityChange);
            historyConsumerCount = Math.max(0, historyConsumerCount - 1);
            if (historyConsumerCount === 0) {
                setRemoteHistoryUserId(null);
            }
        };
    }, [session?.user?.id]);

    return session?.user?.id && remoteState.userId === session.user.id && remoteState.available
        ? remoteStore
        : localStore;
}
