import { useState, useEffect } from 'react';
import type { Identity, AppSettings } from '../../shared/types';
import { generateIdentity } from '../../shared/fakerService';
import { getIdentity, saveIdentity, getSettings, saveSettings } from '../../shared/storageService';

// ─────────────────────────────────────────────────────────────────────────────
// useIdentity
//
// Manages the active identity profile and app settings.
// Handles: load from storage, refresh, per-field editing, locale switching,
// and settings toggles.
// ─────────────────────────────────────────────────────────────────────────────

interface UseIdentityReturn {
    identity: Identity | null;
    settings: AppSettings;
    loading: boolean;
    setIdentity: (id: Identity) => Promise<void>;
    handleRefresh: () => Promise<void>;
    handleFieldChange: (key: keyof Identity, value: string) => Promise<void>;
    handleLocaleChange: (locale: string) => Promise<void>;
    toggleSetting: (key: 'autoSubmit' | 'safeMode') => Promise<void>;
}

export function useIdentity(): UseIdentityReturn {
    const [identity, setIdentityState] = useState<Identity | null>(null);
    const [settings, setSettings] = useState<AppSettings>({
        autoSubmit: false,
        safeMode: true,
        selectedLocale: 'id_ID',
    });
    const [loading, setLoading] = useState(true);

    // Bootstrap: load saved identity and settings from storage
    useEffect(() => {
        (async () => {
            const [savedId, savedSettings] = await Promise.all([getIdentity(), getSettings()]);
            if (savedId) setIdentityState(savedId);
            setSettings(savedSettings);
            setLoading(false);
        })();
    }, []);

    const setIdentity = async (id: Identity) => {
        setIdentityState(id);
        await saveIdentity(id);
    };

    const handleRefresh = async () => {
        const newId = generateIdentity(settings.selectedLocale);
        await setIdentity(newId);
    };

    const handleFieldChange = async (key: keyof Identity, value: string) => {
        if (!identity) return;
        const updated: Identity = { ...identity, [key]: value };
        // Keep firstName/lastName in sync when fullName is edited
        if (key === 'fullName') {
            const parts = value.trim().split(/\s+/);
            updated.firstName = parts[0] || '';
            updated.lastName = parts.slice(1).join(' ') || '';
        }
        await setIdentity(updated);
    };

    const handleLocaleChange = async (locale: string) => {
        const next: AppSettings = {
            ...settings,
            selectedLocale: locale as AppSettings['selectedLocale'],
        };
        setSettings(next);
        await saveSettings(next);
        // Generate a fresh identity for the new locale
        const newId = generateIdentity(locale as AppSettings['selectedLocale']);
        await setIdentity(newId);
    };

    const toggleSetting = async (key: 'autoSubmit' | 'safeMode') => {
        const next = { ...settings, [key]: !settings[key] };
        setSettings(next);
        await saveSettings(next);
    };

    return {
        identity,
        settings,
        loading,
        setIdentity,
        handleRefresh,
        handleFieldChange,
        handleLocaleChange,
        toggleSetting,
    };
}
