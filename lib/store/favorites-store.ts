/**
 * Favorites Store - Manages user's favorite videos
 * Uses Zustand with localStorage persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FavoriteItem } from '@/lib/types';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useCloudSyncStatusStore } from '@/lib/store/cloud-sync-status';

const MAX_FAVORITES = 100;

interface FavoritesState {
    favorites: FavoriteItem[];
    isHydrated: boolean;
}

interface FavoritesActions {
    setIsHydrated: (isHydrated: boolean) => void;
    addFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => void | Promise<void>;
    removeFavorite: (videoId: string | number, source: string) => void | Promise<void>;
    toggleFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => boolean | Promise<boolean>;
    isFavorite: (videoId: string | number, source: string) => boolean;
    clearFavorites: () => void | Promise<void>;
    importFavorites: (favorites: FavoriteItem[]) => void | Promise<void>;
}

interface FavoritesStore extends FavoritesState, FavoritesActions { }

function generateFavoriteId(videoId: string | number, source: string): string {
    return `${source}:${videoId}`;
}

let remoteFavoritesUserId: string | null = null;
let favoritesConsumerCount = 0;
const favoritesAvailabilityListeners = new Set<(available: boolean, userId: string | null) => void>();

function setRemoteFavoritesUserId(userId: string | null) {
    remoteFavoritesUserId = userId;
}

function notifyFavoritesAvailability(available: boolean, favorites?: FavoriteItem[]) {
    const activeUserId = remoteFavoritesUserId;

    if (!available && favorites) {
        useLocalFavoritesStore.getState().importFavorites(favorites);
    }

    useCloudSyncStatusStore.getState().setFavoritesStatus(available ? 'available' : 'fallback');
    favoritesAvailabilityListeners.forEach((listener) => listener(available, activeUserId));
}

// This is the store for unauthenticated users, using localStorage
const useLocalFavoritesStore = create<FavoritesStore>()(
    persist(
        (set, get) => ({
            favorites: [],
            isHydrated: false,
            setIsHydrated: (isHydrated) => set({ isHydrated }),
            addFavorite: (item) => {
                const favoriteId = generateFavoriteId(item.videoId, item.source);
                set((state) => {
                    const exists = state.favorites.some(fav => generateFavoriteId(fav.videoId, fav.source) === favoriteId);
                    if (exists) return state;
                    const newFavorite: FavoriteItem = { ...item, addedAt: Date.now() };
                    let newFavorites = [newFavorite, ...state.favorites];
                    if (newFavorites.length > MAX_FAVORITES) {
                        newFavorites = newFavorites.slice(0, MAX_FAVORITES);
                    }
                    return { favorites: newFavorites };
                });
            },
            removeFavorite: (videoId, source) => {
                const favoriteId = generateFavoriteId(videoId, source);
                set((state) => ({ favorites: state.favorites.filter(fav => generateFavoriteId(fav.videoId, fav.source) !== favoriteId) }));
            },
            toggleFavorite: (item) => {
                const state = get();
                const exists = state.isFavorite(item.videoId, item.source);
                if (exists) {
                    state.removeFavorite(item.videoId, item.source);
                    return false;
                } else {
                    state.addFavorite(item);
                    return true;
                }
            },
            isFavorite: (videoId, source) => {
                const favoriteId = generateFavoriteId(videoId, source);
                return get().favorites.some(fav => generateFavoriteId(fav.videoId, fav.source) === favoriteId);
            },
            clearFavorites: () => { set({ favorites: [] }); },
            importFavorites: (favorites) => { set({ favorites }); },
        }),
        {
            name: 'kvideo-favorites-store',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                if (state) state.setIsHydrated(true);
            },
        }
    )
);

// This is the store for authenticated users, using API
const useRemoteFavoritesStore = create<FavoritesStore>((set, get) => ({
    favorites: [],
    isHydrated: false,
    setIsHydrated: (isHydrated) => set({ isHydrated }),
    addFavorite: async (item) => {
        const favoriteId = generateFavoriteId(item.videoId, item.source);
        const state = get();
        if (state.favorites.some(fav => generateFavoriteId(fav.videoId, fav.source) === favoriteId)) return;

        const newFavorite: FavoriteItem = { ...item, addedAt: Date.now() };
        let newFavorites = [newFavorite, ...state.favorites];
        if (newFavorites.length > MAX_FAVORITES) {
            newFavorites = newFavorites.slice(0, MAX_FAVORITES);
        }
        set({ favorites: newFavorites });
        await syncFavorites(newFavorites);
    },
    removeFavorite: async (videoId, source) => {
        const favoriteId = generateFavoriteId(videoId, source);
        const newFavorites = get().favorites.filter(fav => generateFavoriteId(fav.videoId, fav.source) !== favoriteId);
        set({ favorites: newFavorites });
        await syncFavorites(newFavorites);
    },
    toggleFavorite: async (item) => {
        const state = get();
        const exists = state.isFavorite(item.videoId, item.source);
        if (exists) {
            await state.removeFavorite(item.videoId, item.source);
            return false;
        } else {
            await state.addFavorite(item);
            return true;
        }
    },
    isFavorite: (videoId, source) => {
        const favoriteId = generateFavoriteId(videoId, source);
        return get().favorites.some(fav => generateFavoriteId(fav.videoId, fav.source) === favoriteId);
    },
    clearFavorites: async () => {
        set({ favorites: [] });
        await syncFavorites([]);
    },
    importFavorites: async (favorites) => {
        set({ favorites });
        await syncFavorites(favorites);
    },
}));

async function syncFavorites(favorites: FavoriteItem[]) {
    if (!remoteFavoritesUserId) return false;

    try {
        const response = await fetch(`/api/favorites?userId=${remoteFavoritesUserId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(favorites),
        });

        if (!response.ok) {
            notifyFavoritesAvailability(false, favorites);
            return false;
        }

        notifyFavoritesAvailability(true);
        return true;
    } catch (error) {
        console.error('Failed to sync favorites:', error);
        notifyFavoritesAvailability(false, favorites);
        return false;
    }
}

export function useFavorites() {
    const { data: session } = useSession();
    const localStore = useLocalFavoritesStore();
    const remoteStore = useRemoteFavoritesStore();
    const [remoteState, setRemoteState] = useState<{ userId: string | null; available: boolean }>({
        userId: null,
        available: false,
    });

    useEffect(() => {
        const userId = session?.user?.id ?? null;

        if (!userId) {
            setRemoteFavoritesUserId(null);
            useCloudSyncStatusStore.getState().setFavoritesStatus('unknown');
            return;
        }

        favoritesConsumerCount += 1;
        setRemoteFavoritesUserId(userId);
        const handleAvailabilityChange = (available: boolean, updatedUserId: string | null) => {
            setRemoteState({ userId: updatedUserId, available });
        };
        favoritesAvailabilityListeners.add(handleAvailabilityChange);

        let cancelled = false;

        async function fetchData() {
            try {
                const response = await fetch(`/api/favorites?userId=${userId}`);
                if (!response.ok) {
                    if (!cancelled) notifyFavoritesAvailability(false);
                    return;
                }

                const favorites = await response.json();
                useRemoteFavoritesStore.setState({ favorites, isHydrated: true });
                if (!cancelled) {
                    notifyFavoritesAvailability(true);
                }
            } catch (error) {
                console.error('Failed to fetch remote favorites:', error);
                if (!cancelled) notifyFavoritesAvailability(false);
            }
        }

        fetchData();

        return () => {
            cancelled = true;
            favoritesAvailabilityListeners.delete(handleAvailabilityChange);
            favoritesConsumerCount = Math.max(0, favoritesConsumerCount - 1);
            if (favoritesConsumerCount === 0) {
                setRemoteFavoritesUserId(null);
            }
        };
    }, [session?.user?.id]);

    return session?.user?.id && remoteState.userId === session.user.id && remoteState.available
        ? remoteStore
        : localStore;
}
