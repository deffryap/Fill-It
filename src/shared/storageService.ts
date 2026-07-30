import type { Identity, Template, AppSettings, Locale, TestSession, InjectedLog } from './types';

const KEYS = {
    IDENTITY: 'fill_it_identity',
    TEMPLATES: 'fill_it_templates',
    SETTINGS: 'fill_it_settings',
    LAST_REGISTERED: 'fill_it_last_registered',
    SESSION: 'fill_it_session',
};

// ─── Schema Validators ────────────────────────────────────────────────────────
// Ensure data from storage conforms to the expected shape before use.
// Guards against crashes when loading data saved by an older extension version.

const validateIdentity = (data: unknown): Identity | null => {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    // Required fields check
    if (typeof d.fullName !== 'string' || typeof d.email !== 'string' || typeof d.locale !== 'string') return null;
    return data as Identity;
};

const validateSettings = (data: unknown): AppSettings | null => {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (typeof d.autoSubmit !== 'boolean' || typeof d.safeMode !== 'boolean' || typeof d.selectedLocale !== 'string') return null;
    return data as AppSettings;
};

const isExtension = () =>
    typeof chrome !== 'undefined' && chrome?.storage?.session;

// ─── Session Identity (persists until browser close) ───────────────

export const saveIdentity = async (identity: Identity): Promise<void> => {
    if (isExtension()) {
        await chrome.storage.session.set({ [KEYS.IDENTITY]: identity });
    } else {
        sessionStorage.setItem(KEYS.IDENTITY, JSON.stringify(identity));
    }
};

export const getIdentity = async (): Promise<Identity | null> => {
    if (isExtension()) {
        const r = await chrome.storage.session.get(KEYS.IDENTITY);
        return validateIdentity(r[KEYS.IDENTITY]);
    }
    const d = sessionStorage.getItem(KEYS.IDENTITY);
    return d ? validateIdentity(JSON.parse(d)) : null;
};

export const clearIdentity = async (): Promise<void> => {
    if (isExtension()) {
        await chrome.storage.session.remove(KEYS.IDENTITY);
    } else {
        sessionStorage.removeItem(KEYS.IDENTITY);
    }
};

// ─── Templates (persist across sessions via chrome.storage.local) ──

export const saveTemplates = async (templates: Template[]): Promise<void> => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({ [KEYS.TEMPLATES]: templates });
    } else {
        localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));
    }
};

export const getTemplates = async (): Promise<Template[]> => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const r = await chrome.storage.local.get(KEYS.TEMPLATES);
        return (r[KEYS.TEMPLATES] as Template[]) ?? [];
    }
    const d = localStorage.getItem(KEYS.TEMPLATES);
    return d ? JSON.parse(d) : [];
};

// ─── Settings ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
    autoSubmit: false,
    safeMode: true,
    selectedLocale: 'id_ID' as Locale,
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({ [KEYS.SETTINGS]: settings });
    } else {
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    }
};

export const getSettings = async (): Promise<AppSettings> => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const r = await chrome.storage.local.get(KEYS.SETTINGS);
        return validateSettings(r[KEYS.SETTINGS]) ?? DEFAULT_SETTINGS;
    }
    const d = localStorage.getItem(KEYS.SETTINGS);
    return d ? (validateSettings(JSON.parse(d)) ?? DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
};

// ─── Last Registered Identity (for credentials transfer) ───────────

export const saveLastRegisteredIdentity = async (identity: Identity): Promise<void> => {
    if (isExtension()) {
        await chrome.storage.session.set({ [KEYS.LAST_REGISTERED]: identity });
    } else {
        sessionStorage.setItem(KEYS.LAST_REGISTERED, JSON.stringify(identity));
    }
};

export const getLastRegisteredIdentity = async (): Promise<Identity | null> => {
    if (isExtension()) {
        const r = await chrome.storage.session.get(KEYS.LAST_REGISTERED);
        return validateIdentity(r[KEYS.LAST_REGISTERED]);
    }
    const d = sessionStorage.getItem(KEYS.LAST_REGISTERED);
    return d ? validateIdentity(JSON.parse(d)) : null;
};

// ─── Test Sessions ──────────────────────────────────────────────────

export const getTestSession = async (): Promise<TestSession | null> => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const r = await chrome.storage.local.get(KEYS.SESSION);
        return (r[KEYS.SESSION] as TestSession) ?? null;
    }
    const d = localStorage.getItem(KEYS.SESSION);
    return d ? JSON.parse(d) : null;
};

export const saveTestSession = async (session: TestSession): Promise<void> => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({ [KEYS.SESSION]: session });
    } else {
        localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
    }
};

export const startNewSession = async (): Promise<TestSession> => {
    const newSession: TestSession = {
        id: crypto.randomUUID(),
        startTime: Date.now(),
        isActive: true,
        logs: [],
    };
    await saveTestSession(newSession);
    return newSession;
};

export const endActiveSession = async (): Promise<void> => {
    const current = await getTestSession();
    if (current) {
        current.isActive = false;
        await saveTestSession(current);
    }
};

export const logInjection = async (url: string, templateName: string, data: Record<string, string>): Promise<void> => {
    const current = await getTestSession();
    if (current && current.isActive) {
        const newLog: InjectedLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            url,
            templateName,
            injectedData: data,
        };
        current.logs.unshift(newLog); // Prepend so latest shows first
        await saveTestSession(current);
    }
};
