import { useState } from 'react';
import type { Identity, AppSettings, TestSession, Template } from '../../shared/types';
import { LOCALE_OPTIONS } from '../../shared/types';
import {
    generateIdentity,
} from '../../shared/fakerService';
import {
    getTemplates,
    getLastRegisteredIdentity,
    saveLastRegisteredIdentity,
    logInjection,
} from '../../shared/storageService';
import {
    injectAndFill,
    injectLoginFields,
    type IdentitySnapshot,
    type FieldOverride,
} from '../../shared/pageScripts';
import { getValueFromIdentity } from '../utils/fieldGuesser';
import { generateFieldValue } from '../../shared/fakerService';
import { SessionPanel } from './SessionPanel';

// ─────────────────────────────────────────────────────────────────────────────
// IdentityProfileTab.tsx — Identity Profile tab UI
// ─────────────────────────────────────────────────────────────────────────────

interface IdentityProfileTabProps {
    identity: Identity | null;
    settings: AppSettings;
    session: TestSession | null;
    onFieldChange: (key: keyof Identity, value: string) => Promise<void>;
    onRefresh: () => Promise<void>;
    onLocaleChange: (locale: string) => Promise<void>;
    onToggleSetting: (key: 'autoSubmit' | 'safeMode') => Promise<void>;
    onStartSession: () => Promise<void>;
    onStopSession: () => Promise<void>;
    onExportSession: () => void;
    setIdentity: (id: Identity) => Promise<void>;
}

export function IdentityProfileTab({
    identity,
    settings,
    session,
    onFieldChange,
    onRefresh,
    onLocaleChange,
    onToggleSetting,
    onStartSession,
    onStopSession,
    onExportSession,
    setIdentity,
}: IdentityProfileTabProps) {
    const [status, setStatus] = useState<'idle' | 'injecting' | 'done' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [pendingFill, setPendingFill] = useState(false);

    // ─── Fill It (one-shot identity inject) ─────────────────────────────────
    const handleFillIt = async (skipConfirm = false) => {
        // Safe Mode: show in-popup confirmation instead of window.confirm()
        if (settings.safeMode && !skipConfirm) {
            setPendingFill(true);
            return;
        }
        setPendingFill(false);
        setStatus('injecting');
        let id = identity;
        let isLogin = false;
        let activeTab: chrome.tabs.Tab | null = null;

        try {
            if (typeof chrome !== 'undefined' && chrome?.tabs) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                activeTab = tab ?? null;
                if (tab?.url) {
                    isLogin = /login|log-in|signin|sign-in|masuk|user-login|auth\/login/i.test(tab.url);
                }
            }

            if (isLogin) {
                const lastReg = await getLastRegisteredIdentity();
                if (lastReg) {
                    id = lastReg;
                    await setIdentity(id);
                } else if (!id) {
                    id = generateIdentity(settings.selectedLocale);
                    await setIdentity(id);
                }
            } else {
                id = generateIdentity(settings.selectedLocale);
                await setIdentity(id);
                // Save as last registered identity when filling any non-login form (registration/sign-up)
                await saveLastRegisteredIdentity(id);
            }

            if (!activeTab?.id) throw new Error('Cannot find active tab.');
            if (
                activeTab.url &&
                (activeTab.url.startsWith('chrome://') ||
                    activeTab.url.startsWith('edge://') ||
                    activeTab.url.startsWith('about:') ||
                    activeTab.url.includes('chrome.google.com/webstore'))
            ) {
                throw new Error('System pages are protected and cannot be auto-filled.');
            }

            if (isLogin && id) {
                await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: injectLoginFields,
                    args: [id.email, id.password || 'P@ssw0rd123!'],
                });

                const logData: Record<string, string> = {
                    'Email / Username': id.email,
                    'Password': '••••••••',
                };
                await logInjection(activeTab.url || 'Web Page', 'Login', logData);

            } else if (id) {
                let customFields: FieldOverride[] = [];
                let activeTemplateName = 'Default Identity';
                try {
                    const templates: Template[] = await getTemplates();
                    const activeTemplate = templates.find(t => t.isActive);
                    if (activeTemplate) {
                        activeTemplateName = activeTemplate.name;
                        if (activeTemplate.fields) {
                            customFields = activeTemplate.fields.map(f => {
                                const fromIdentity = id ? getValueFromIdentity(f.fakerCategory, id) : null;
                                const val = fromIdentity !== null
                                    ? fromIdentity
                                    : generateFieldValue(f.fakerCategory, f.fakerLocale);
                                return { selector: f.selector, value: val };
                            });
                        }
                    }
                } catch (e) {
                    console.error('[Fill-It] Error loading template fields:', e);
                }

                const snapshot: IdentitySnapshot = {
                    fullName: id.fullName ?? '',
                    firstName: id.firstName ?? '',
                    lastName: id.lastName ?? '',
                    email: id.email ?? '',
                    phone: id.phone ?? '',
                    address: id.address ?? '',
                    bankAccount: id.bankAccount ?? '',
                    bankName: id.bankName ?? '',
                    nik: id.nik ?? '',
                    nomorKK: id.nomorKK ?? '',
                    npwp: id.npwp ?? '',
                    birthDate: id.birthDate ?? '',
                    password: id.password ?? 'P@ssw0rd123!',
                    company: id.company ?? '',
                    jobTitle: id.jobTitle ?? '',
                    website: id.website ?? '',
                    bio: id.bio ?? '',
                    locale: id.locale ?? 'id_ID',
                    city: id.city ?? '',
                    province: id.province ?? '',
                    zipCode: id.zipCode ?? '',
                    kecamatan: id.kecamatan ?? '',
                    kelurahan: id.kelurahan ?? '',
                };

                await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: injectAndFill,
                    args: [snapshot, customFields, settings.autoSubmit],
                });

                const logData: Record<string, string> = {
                    'Full Name': id.fullName,
                    'Email': id.email,
                    'Phone': id.phone,
                    'Address': id.address,
                };
                if (id.nik) logData['NIK'] = id.nik;
                if (id.npwp) logData['NPWP'] = id.npwp;
                if (id.bankName && id.bankAccount) logData['Bank Account'] = `${id.bankName} - ${id.bankAccount}`;
                if (id.company) logData['Company'] = id.company;
                if (id.jobTitle) logData['Job Title'] = id.jobTitle;
                customFields.forEach(f => { if (!logData[f.selector]) logData[f.selector] = f.value; });
                await logInjection(activeTab.url || 'Web Page', activeTemplateName, logData);
            }

            setStatus('done');
            setTimeout(() => setStatus('idle'), 1500);
        } catch (err: unknown) {
            const error = err as Error;
            console.error('[Fill-It] Fill It failed:', error);
            setErrorMsg(error?.message || 'Injection failed.');
            setStatus('error');
            setTimeout(() => { setStatus('idle'); setErrorMsg(null); }, 3000);
        }
    };

    return (
        <>
            {/* ── Fill It Button ────────────── */}
            <div className="px-4 pt-3 pb-3 space-y-2">
                <button
                    onClick={() => handleFillIt()}
                    disabled={status === 'injecting' || pendingFill}
                    className={`w-full py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 font-semibold text-[13px] ${
                        status === 'error'
                            ? 'bg-red-600 text-white'
                            : status === 'done'
                            ? 'bg-green-600 text-white'
                            : 'bg-neutral-900 hover:bg-neutral-700 text-white'
                    }`}
                >
                    {status === 'error' ? (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                            </svg>
                            <span>{errorMsg || 'Failed'}</span>
                        </>
                    ) : status === 'injecting' ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Filling...</span>
                        </>
                    ) : status === 'done' ? (
                        <span>✓ Injected Successfully</span>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Fill It</span>
                        </>
                    )}
                </button>

                {/* ── Safe Mode Inline Confirmation ── */}
                {pendingFill && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <span className="text-[11px] font-medium text-amber-800">
                            Autofill this page?
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                            <button
                                onClick={() => setPendingFill(false)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-neutral-600 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleFillIt(true)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-700 transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Session Panel ─────────────── */}
            <SessionPanel
                session={session}
                onStart={onStartSession}
                onStop={onStopSession}
                onExport={onExportSession}
            />

            {/* ── Identity Card ─────────────── */}
            {identity && (
                <div className="mx-4 mb-3 p-3.5 rounded-lg border border-neutral-200 bg-white">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Active Profile</span>
                        <button
                            onClick={onRefresh}
                            className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium flex items-center gap-1 transition-colors"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                            </svg>
                            Refresh
                        </button>
                    </div>

                    <div className="space-y-2.5">
                        {/* Full Name */}
                        <div>
                            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">Full Name</label>
                            <input
                                type="text"
                                value={identity.fullName}
                                onChange={e => onFieldChange('fullName', e.target.value)}
                                className="bg-transparent border-b border-neutral-100 hover:border-neutral-300 focus:border-neutral-500 outline-none text-neutral-900 font-semibold text-[13px] py-0.5 transition-colors w-full"
                                placeholder="Full Name"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">Email</label>
                            <input
                                type="email"
                                value={identity.email}
                                onChange={e => onFieldChange('email', e.target.value)}
                                className="bg-transparent border-b border-neutral-100 hover:border-neutral-300 focus:border-neutral-500 outline-none py-0.5 transition-colors text-neutral-700 text-[12px] w-full"
                                placeholder="Email"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">Phone</label>
                            <input
                                type="tel"
                                value={identity.phone}
                                onChange={e => onFieldChange('phone', e.target.value)}
                                className="bg-transparent border-b border-neutral-100 hover:border-neutral-300 focus:border-neutral-500 outline-none py-0.5 transition-colors text-neutral-700 text-[12px] w-full"
                                placeholder="Phone"
                            />
                        </div>

                        {/* Indonesian-specific fields */}
                        {identity.locale === 'id_ID' && (
                            <div className="pt-2.5 space-y-2.5 border-t border-neutral-100 mt-1">
                                {identity.nik !== undefined && (
                                    <div>
                                        <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">NIK</label>
                                        <input
                                            type="text"
                                            value={identity.nik}
                                            onChange={e => onFieldChange('nik', e.target.value)}
                                            className="bg-transparent border-b border-neutral-100 hover:border-neutral-300 focus:border-neutral-500 outline-none py-0.5 transition-colors text-neutral-700 font-mono text-[12px] w-full"
                                            placeholder="NIK"
                                            maxLength={16}
                                        />
                                    </div>
                                )}
                                {identity.npwp !== undefined && (
                                    <div>
                                        <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">NPWP</label>
                                        <input
                                            type="text"
                                            value={identity.npwp}
                                            onChange={e => onFieldChange('npwp', e.target.value)}
                                            className="bg-transparent border-b border-neutral-100 hover:border-neutral-300 focus:border-neutral-500 outline-none py-0.5 transition-colors text-neutral-700 font-mono text-[12px] w-full"
                                            placeholder="NPWP"
                                        />
                                    </div>
                                )}
                                {identity.bankName !== undefined && identity.bankAccount !== undefined && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">Bank</label>
                                            <input
                                                type="text"
                                                value={identity.bankName}
                                                onChange={e => onFieldChange('bankName', e.target.value)}
                                                className="bg-transparent border-b border-neutral-100 hover:border-neutral-300 focus:border-neutral-500 outline-none py-0.5 transition-colors text-neutral-700 text-[12px] w-full"
                                                placeholder="Bank Name"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">Account No.</label>
                                            <input
                                                type="text"
                                                value={identity.bankAccount}
                                                onChange={e => onFieldChange('bankAccount', e.target.value)}
                                                className="bg-transparent border-b border-neutral-100 hover:border-neutral-300 focus:border-neutral-500 outline-none py-0.5 transition-colors text-neutral-700 font-mono text-[12px] w-full"
                                                placeholder="Account Number"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Locale Selector ──────────── */}
            <div className="px-4 space-y-1">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Locale</label>
                <div className="relative">
                    <select
                        value={settings.selectedLocale}
                        onChange={e => onLocaleChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-800 text-[12px] font-medium appearance-none cursor-pointer focus:border-neutral-400 focus:ring-0 outline-none transition-colors"
                    >
                        {LOCALE_OPTIONS.map(l => (
                            <option key={l.value} value={l.value}>
                                {l.flag} {l.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Settings ──────────────────── */}
            <div className="px-4 mt-3 space-y-2 pb-3">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Settings</label>

                {/* Auto-Submit */}
                <div
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-neutral-200 cursor-pointer hover:border-neutral-300 transition-colors"
                    onClick={() => onToggleSetting('autoSubmit')}
                >
                    <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${settings.autoSubmit ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
                            <svg className={`w-3.5 h-3.5 transition-colors ${settings.autoSubmit ? 'text-white' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-neutral-800 leading-none">Auto-Submit</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5 leading-none">Submit form after fill</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold transition-colors ${settings.autoSubmit ? 'text-neutral-900' : 'text-neutral-300'}`}>
                            {settings.autoSubmit ? 'ON' : 'OFF'}
                        </span>
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${settings.autoSubmit ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${settings.autoSubmit ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                    </div>
                </div>

                {/* Safe Mode */}
                <div
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-neutral-200 cursor-pointer hover:border-neutral-300 transition-colors"
                    onClick={() => onToggleSetting('safeMode')}
                >
                    <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${settings.safeMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
                            <svg className={`w-3.5 h-3.5 transition-colors ${settings.safeMode ? 'text-white' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-neutral-800 leading-none">Safe Mode</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5 leading-none">Confirm before injecting</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold transition-colors ${settings.safeMode ? 'text-neutral-900' : 'text-neutral-300'}`}>
                            {settings.safeMode ? 'ON' : 'OFF'}
                        </span>
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${settings.safeMode ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${settings.safeMode ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
