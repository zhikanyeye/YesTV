import { create } from 'zustand';

export type CloudSyncFeatureStatus = 'unknown' | 'available' | 'fallback';

interface CloudSyncStatusState {
  favorites: CloudSyncFeatureStatus;
  history: CloudSyncFeatureStatus;
  setFavoritesStatus: (status: CloudSyncFeatureStatus) => void;
  setHistoryStatus: (status: CloudSyncFeatureStatus) => void;
  reset: () => void;
}

export const useCloudSyncStatusStore = create<CloudSyncStatusState>((set) => ({
  favorites: 'unknown',
  history: 'unknown',
  setFavoritesStatus: (status) => set({ favorites: status }),
  setHistoryStatus: (status) => set({ history: status }),
  reset: () => set({ favorites: 'unknown', history: 'unknown' }),
}));
