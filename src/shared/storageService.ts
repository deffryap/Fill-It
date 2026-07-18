import type { Identity, Template, AppSettings, Locale, TestSession, InjectedLog } from './types';

const KEYS = {
    IDENTITY: 'fill_it_identity',
    TEMPLATES: 'fill_it_templates',
    SETTINGS: 'fill_it_settings',
    LAST_REGISTERED: 'fill_it_last_registered',
    SESSION: 'fill_it_session',
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
        return (r[KEYS.IDENTITY] as Identity) ?? null;
    }
    const d = sessionStorage.getItem(KEYS.IDENTITY);
    return d ? JSON.parse(d) : null;
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
        return (r[KEYS.SETTINGS] as AppSettings) ?? DEFAULT_SETTINGS;
    }
    const d = localStorage.getItem(KEYS.SETTINGS);
    return d ? JSON.parse(d) : DEFAULT_SETTINGS;
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
        return (r[KEYS.LAST_REGISTERED] as Identity) ?? null;
    }
    const d = sessionStorage.getItem(KEYS.LAST_REGISTERED);
    return d ? JSON.parse(d) : null;
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
        id: Math.random().toString(36).slice(2, 9),
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
            id: Math.random().toString(36).slice(2, 9),
            timestamp: Date.now(),
            url,
            templateName,
            injectedData: data,
        };
        current.logs.unshift(newLog); // Prepend so latest shows first
        await saveTestSession(current);
    }
};
