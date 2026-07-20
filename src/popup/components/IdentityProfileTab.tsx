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
//
// Handles the "Fill It" button (one-shot identity injection) and the identity
// profile editor (name, email, phone, NIK, NPWP, bank account).
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

    // ─── Fill It (one-shot identity inject) ─────────────────────────────────
    const handleFillIt = async () => {
        setStatus('injecting');
        let id = identity;
        let isLogin = false;
        let isRegister = false;
        let activeTab: chrome.tabs.Tab | null = null;

        try {
            if (typeof chrome !== 'undefined' && chrome?.tabs) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                activeTab = tab ?? null;
                if (tab?.url) {
                    isLogin = /login|signin|masuk/i.test(tab.url);
                    isRegister = /register|signup|daftar|registrasi|pendaftaran|coretax/i.test(tab.url);
                }
            }

            // Resolve which identity to use
            if (isLogin) {
                const lastReg = await getLastRegisteredIdentity();
                if (lastReg) {
                    id = lastReg;
                    await setIdentity(id);
                } else if (!id) {
                    id = generateIdentity(settings.selectedLocale);
                    await setIdentity(id);
                }
            } else if (isRegister) {
                id = generateIdentity(settings.selectedLocale);
                await setIdentity(id);
                await saveLastRegisteredIdentity(id);
            } else {
                if (!id) {
                    id = generateIdentity(settings.selectedLocale);
                    await setIdentity(id);
                }
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

            // Safe Mode confirmation
            if (settings.safeMode) {
                const confirmed = confirm('Are you sure you want to autofill the data on this page?');
                if (!confirmed) { setStatus('idle'); return; }
            }

            if (isLogin && id) {
                // Login pages: only inject email/username and password
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
                // Registration / generic pages: full identity injection
                // Load template overrides if any active template exists
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

                // Build serializable identity snapshot (no undefined values)
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
                    npwp: id.npwp ?? '',
                    birthDate: id.birthDate ?? '',
                    password: id.password ?? 'P@ssw0rd123!',
                    company: id.company ?? '',
                    jobTitle: id.jobTitle ?? '',
                    website: id.website ?? '',
                    bio: id.bio ?? '',
                    locale: id.locale ?? 'id_ID',
                };

                await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: injectAndFill,
                    args: [snapshot, customFields, settings.autoSubmit],
                });

                // Accurate log: record resolved identity values actually passed to the page
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
            <div className="px-5 pt-2 pb-3.5 z-10">
                <button
                    onClick={handleFillIt}
                    disabled={status === 'injecting'}
                    className={`w-full py-5 rounded-2xl flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 border relative overflow-hidden group ${
                        status === 'error'
                            ? 'bg-gradient-to-br from-red-500 to-pink-600 border-red-500/30 text-white shadow-lg shadow-red-500/20 animate-shake'
                            : status === 'done'
                            ? 'bg-gradient-to-br from-[#4f46e5] to-indigo-700 border-[#4f46e5]/30 text-white shadow-lg shadow-[#4f46e5]/20'
                            : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white border-[#4f46e5]/25 shadow-lg shadow-[#4f46e5]/15 animate-magic-glow font-extrabold'
                    }`}
                >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

                    {status === 'error' ? (
                        <>
                            <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                            </svg>
                            <span className="text-base font-extrabold tracking-wide">Failed!</span>
                            <span className="text-[10px] font-medium text-white/90 text-center px-4 truncate w-full">
                                {errorMsg || 'Protected System Page'}
                            </span>
                        </>
                    ) : (
                        <>
                            <svg className="w-6 h-6 transition-transform group-hover:rotate-12 duration-300 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                            </svg>
                            <span className="text-base font-extrabold tracking-wide">
                                {status === 'injecting' ? 'Filling Fields…' : status === 'done' ? '✓ Inject Successful!' : 'Fill It'}
                            </span>
                            <span className="text-white/60 text-[9px] font-bold tracking-widest uppercase">Detect &amp; Inject Data</span>
                        </>
                    )}
                </button>
            </div>

            {/* ── Session Panel ─────────────── */}
            <SessionPanel
                session={session}
                onStart={onStartSession}
                onStop={onStopSession}
                onExport={onExportSession}
            />

            {/* ── Identity Preview ──────────── */}
            {identity && (
                <div className="mx-5 mb-3.5 p-4 rounded-2xl glass-panel relative overflow-hidden z-10">
                    <div className="flex items-center justify-between mb-3 border-b border-black/5 pb-2">
                        <span className="text-[9px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest">Active Session Profile</span>
                        <button
                            onClick={onRefresh}
                            className="text-[9px] text-[#4f46e5] hover:text-[#4338ca] font-bold flex items-center gap-1 transition-colors"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                            </svg>
                            Refresh
                        </button>
                    </div>

                    <div className="space-y-2.5 text-[11px] text-[#0f1115]/70 font-medium">
                        {/* Full Name */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest leading-none">Full Name</span>
                            <input
                                type="text"
                                value={identity.fullName}
                                onChange={e => onFieldChange('fullName', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none text-[#0f1115] font-extrabold text-xs tracking-tight py-0.5 transition-all w-full"
                                placeholder="Full Name"
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest leading-none">Email</span>
                            <input
                                type="email"
                                value={identity.email}
                                onChange={e => onFieldChange('email', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none py-0.5 transition-all text-[#0f1115]/80 font-semibold w-full"
                                placeholder="Email"
                            />
                        </div>

                        {/* Phone */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest leading-none">Phone Number</span>
                            <input
                                type="tel"
                                value={identity.phone}
                                onChange={e => onFieldChange('phone', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none py-0.5 transition-all text-[#0f1115]/80 font-semibold w-full"
                                placeholder="Phone Number"
                            />
                        </div>

                        {/* Indonesian-specific fields */}
                        {identity.locale === 'id_ID' && (
                            <div className="pt-2.5 space-y-2.5 border-t border-black/5 mt-2">
                                {identity.nik !== undefined && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest leading-none">NIK</span>
                                        <input
                                            type="text"
                                            value={identity.nik}
                                            onChange={e => onFieldChange('nik', e.target.value)}
                                            className="bg-transparent border-b border-transparent hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none py-0.5 transition-all text-[#0f1115]/80 font-mono w-full"
                                            placeholder="NIK"
                                            maxLength={16}
                                        />
                                    </div>
                                )}
                                {identity.npwp !== undefined && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest leading-none">NPWP</span>
                                        <input
                                            type="text"
                                            value={identity.npwp}
                                            onChange={e => onFieldChange('npwp', e.target.value)}
                                            className="bg-transparent border-b border-transparent hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none py-0.5 transition-all text-[#0f1115]/80 font-mono w-full"
                                            placeholder="NPWP"
                                        />
                                    </div>
                                )}
                                {identity.bankName !== undefined && identity.bankAccount !== undefined && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest leading-none">Bank Name</span>
                                            <input
                                                type="text"
                                                value={identity.bankName}
                                                onChange={e => onFieldChange('bankName', e.target.value)}
                                                className="bg-transparent border-b border-transparent hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none py-0.5 transition-all text-[#0f1115]/80 font-semibold w-full"
                                                placeholder="Bank Name"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[8px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest leading-none">Bank Account</span>
                                            <input
                                                type="text"
                                                value={identity.bankAccount}
                                                onChange={e => onFieldChange('bankAccount', e.target.value)}
                                                className="bg-transparent border-b border-transparent hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none py-0.5 transition-all text-[#0f1115]/80 font-mono w-full"
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
            <div className="px-5 space-y-1.5 z-10">
                <span className="text-[9px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest block">Profile Locale Selector</span>
                <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0f1115]/30">
                        <svg className="w-4 h-4 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                    </div>
                    <select
                        value={settings.selectedLocale}
                        onChange={e => onLocaleChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-black/10 hover:border-black/20 text-[#0f1115]/90 text-xs font-semibold appearance-none cursor-pointer focus:border-[#4f46e5]/50 focus:ring-1 focus:ring-[#4f46e5]/20 outline-none transition-all duration-300"
                    >
                        {LOCALE_OPTIONS.map(l => (
                            <option key={l.value} value={l.value} className="bg-white text-[#0f1115]">
                                {l.flag} {l.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#0f1115]/30">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Settings Toggles ──────────── */}
            <div className="px-5 mt-4 space-y-2.5 z-10">

                {/* Auto-Submit */}
                <div
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-black/10 cursor-pointer hover:border-[#4f46e5]/30 transition-all duration-200"
                    onClick={() => onToggleSetting('autoSubmit')}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300 ${settings.autoSubmit ? 'bg-[#4f46e5]' : 'bg-[#4f46e5]/15'}`}>
                            <svg className={`w-4 h-4 transition-colors duration-300 ${settings.autoSubmit ? 'text-white' : 'text-[#4f46e5]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#0f1115]">Auto-Submit</p>
                            <p className="text-[9px] text-[#0f1115]/40 leading-none mt-0.5">Submit form automatically after injection</p>
                        </div>
                    </div>
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-extrabold tracking-widest transition-colors duration-300 ${settings.autoSubmit ? 'text-[#4f46e5]' : 'text-[#0f1115]/25'}`}>
                            {settings.autoSubmit ? 'ON' : 'OFF'}
                        </span>
                        <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${settings.autoSubmit ? 'bg-[#4f46e5]' : 'bg-black/10'}`}>
                            <span
                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${settings.autoSubmit ? 'left-[22px]' : 'left-0.5'}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Safe Mode */}
                <div
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-black/10 cursor-pointer hover:border-[#4f46e5]/30 transition-all duration-200"
                    onClick={() => onToggleSetting('safeMode')}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300 ${settings.safeMode ? 'bg-[#4f46e5]' : 'bg-[#4f46e5]/15'}`}>
                            <svg className={`w-4 h-4 transition-colors duration-300 ${settings.safeMode ? 'text-white' : 'text-[#4f46e5]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#0f1115]">Safe Mode</p>
                            <p className="text-[9px] text-[#0f1115]/40 leading-none mt-0.5">Ask for confirmation before injecting</p>
                        </div>
                    </div>
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-extrabold tracking-widest transition-colors duration-300 ${settings.safeMode ? 'text-[#4f46e5]' : 'text-[#0f1115]/25'}`}>
                            {settings.safeMode ? 'ON' : 'OFF'}
                        </span>
                        <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${settings.safeMode ? 'bg-[#4f46e5]' : 'bg-black/10'}`}>
                            <span
                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${settings.safeMode ? 'left-[22px]' : 'left-0.5'}`}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}
