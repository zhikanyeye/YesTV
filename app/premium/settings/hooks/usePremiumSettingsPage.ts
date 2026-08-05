import { useState } from 'react';
import { settingsStore, getDefaultPremiumSources, type SortOption } from '@/lib/store/settings-store';
import type { VideoSource } from '@/lib/types';

export function usePremiumSettingsPage() {
    const [premiumSources, setPremiumSources] = useState<VideoSource[]>(() => settingsStore.getSettings().premiumSources || []);
    const [sortBy] = useState<SortOption>(() => settingsStore.getSettings().sortBy);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRestoreDefaultsDialogOpen, setIsRestoreDefaultsDialogOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<VideoSource | null>(null);

    const handleSourcesChange = (newSources: VideoSource[]) => {
        setPremiumSources(newSources);
        const currentSettings = settingsStore.getSettings();
        settingsStore.saveSettings({
            ...currentSettings,
            premiumSources: newSources,
        });
    };

    const handleAddSource = (source: VideoSource) => {
        const exists = premiumSources.some(s => s.id === source.id);
        const updated = exists
            ? premiumSources.map(s => s.id === source.id ? source : s)
            : [...premiumSources, source];
        handleSourcesChange(updated);
        setEditingSource(null);
    };

    const handleEditSource = (source: VideoSource) => {
        setEditingSource(source);
        setIsAddModalOpen(true);
    };

    const handleRestoreDefaults = () => {
        const defaults = getDefaultPremiumSources();
        handleSourcesChange(defaults);
        setIsRestoreDefaultsDialogOpen(false);
    };

    return {
        premiumSources,
        sortBy,
        isAddModalOpen,
        isRestoreDefaultsDialogOpen,
        setIsAddModalOpen,
        setIsRestoreDefaultsDialogOpen,
        setEditingSource,
        handleSourcesChange,
        handleAddSource,
        handleRestoreDefaults,
        editingSource,
        handleEditSource,
    };
}
