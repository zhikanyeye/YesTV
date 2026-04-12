/**
 * History State Store using Zustand
 * Manages viewing history with localStorage persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { VideoHistoryItem, Episode } from '@/lib/types';
import { clearSegmentsForUrl, clearAllCache } from '@/lib/utils/cacheManager';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

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
    const session = (useSession as any)();
    if (!session.data?.user?.id) return;
    try {
        await fetch(`/api/history?userId=${session.data.user.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(history),
        });
    } catch (error) {
        console.error('Failed to sync history:', error);
    }
}

export function useHistory() {
    const { data: session } = useSession();
    const localStore = useLocalHistoryStore();
    const remoteStore = useRemoteHistoryStore();

    useEffect(() => {
        async function fetchData() {
            if (session?.user?.id) {
                try {
                    const response = await fetch(`/api/history?userId=${session.user.id}`);
                    if (response.ok) {
                        const history = await response.json();
                        remoteStore.setState({ viewingHistory: history, isHydrated: true });
                    }
                } catch (error) {
                    console.error('Failed to fetch remote history:', error);
                }
            }
        }
        fetchData();
    }, [session, remoteStore]);

    return session ? remoteStore : localStore;
}
