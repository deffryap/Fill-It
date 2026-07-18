import { useState, useEffect } from 'react';
import type { Identity, AppSettings, TestSession } from '../shared/types';
import { LOCALE_OPTIONS } from '../shared/types';
import { generateIdentity, generateFieldValue } from '../shared/fakerService';
import {
    getIdentity,
    saveIdentity,
    getSettings,
    saveSettings,
    getLastRegisteredIdentity,
    saveLastRegisteredIdentity,
    getTemplates,
    logInjection,
    getTestSession,
    startNewSession,
    endActiveSession,
} from '../shared/storageService';

const getValueFromIdentity = (category: string, identity: Identity): string | null => {
    const key = category.toLowerCase();
    if (key.includes('fullname') || key.includes('name.fullname') || key.includes('person.fullname')) return identity.fullName;
    if (key.includes('firstname') || key.includes('name.firstname') || key.includes('person.firstname')) return identity.firstName;
    if (key.includes('lastname') || key.includes('name.lastname') || key.includes('person.lastname')) return identity.lastName;
    if (key.includes('email') || key.includes('internet.email')) return identity.email;
    if (key.includes('phone') || key.includes('phone.number')) return identity.phone;
    if (key.includes('address') || key.includes('streetaddress') || key.includes('location.streetaddress')) return identity.address;
    if (key.includes('bankaccount') || key.includes('bank.account')) return identity.bankAccount;
    if (key.includes('nik')) return identity.nik || null;
    if (key.includes('npwp')) return identity.npwp || null;
    if (key.includes('bankname')) return identity.bankName || null;
    if (key.includes('birthdate')) return identity.birthDate || null;
    if (key.includes('password')) return identity.password || null;
    if (key.includes('company')) return identity.company || null;
    if (key.includes('jobtitle')) return identity.jobTitle || null;
    if (key.includes('website')) return identity.website || null;
    if (key.includes('bio')) return identity.bio || null;
    return null;
};

function Popup() {
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [settings, setSettings] = useState<AppSettings>({
        autoSubmit: false,
        safeMode: true,
        selectedLocale: 'id_ID',
    });
    const [status, setStatus] = useState<'idle' | 'injecting' | 'done' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<TestSession | null>(null);

    /* ─── bootstrap ────────────────────────────────────────── */
    useEffect(() => {
        (async () => {
            const [savedId, savedSettings, savedSession] = await Promise.all([
                getIdentity(),
                getSettings(),
                getTestSession(),
            ]);
            if (savedId) setIdentity(savedId);
            setSettings(savedSettings);
            setSession(savedSession);
            setLoading(false);
        })();
    }, []);

    /* ─── storage listener for session sync ────────────────── */
    useEffect(() => {
        const handleStorageChange = async (_changes: Record<string, chrome.storage.StorageChange> | unknown, areaName: string) => {
            if (areaName === 'local' || !areaName) {
                const updated = await getTestSession();
                setSession(updated);
            }
        };
        
        if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
            chrome.storage.onChanged.addListener(handleStorageChange);
            return () => chrome.storage.onChanged.removeListener(handleStorageChange);
        } else {
            const handleLocalEvent = async (e: StorageEvent) => {
                if (e.key === 'fill_it_session') {
                    const updated = await getTestSession();
                    setSession(updated);
                }
            };
            window.addEventListener('storage', handleLocalEvent);
            return () => window.removeEventListener('storage', handleLocalEvent);
        }
    }, []);

    const handleStartSession = async () => {
        const next = await startNewSession();
        setSession(next);
    };

    const handleStopSession = async () => {
        await endActiveSession();
        const updated = await getTestSession();
        setSession(updated);
    };

    const handleExportSession = () => {
        if (!session) return;
        const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const startTimeStr = new Date(session.startTime).toISOString().split('T')[0];
        a.download = `fill_it_session_${session.id}_${startTimeStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ─── handlers ─────────────────────────────────────────── */
    const handleMagicFill = async () => {
        setStatus('injecting');

        let id = identity;
        let isLogin = false;
        let isRegister = false;
        let activeTab: chrome.tabs.Tab | null = null;

        // Query active tab and check URL
        if (typeof chrome !== 'undefined' && chrome?.tabs) {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            activeTab = tab ?? null;
            if (tab?.url) {
                isLogin = /login|signin|masuk/i.test(tab.url);
                isRegister = /register|signup|daftar/i.test(tab.url);
            }
        }

        if (isLogin) {
            // Retrieve last registered credentials
            const lastReg = await getLastRegisteredIdentity();
            if (lastReg) {
                id = lastReg;
                setIdentity(id);
                await saveIdentity(id);
            } else {
                if (!id) {
                    id = generateIdentity(settings.selectedLocale);
                    setIdentity(id);
                    await saveIdentity(id);
                }
            }
        } else if (isRegister) {
            // always generate a fresh identity for registration
            id = generateIdentity(settings.selectedLocale);
            setIdentity(id);
            await saveIdentity(id);
            await saveLastRegisteredIdentity(id);
        } else {
            // standard behavior for other pages
            if (!id) {
                id = generateIdentity(settings.selectedLocale);
                setIdentity(id);
                await saveIdentity(id);
            }
        }

        // Get active template mappings if exists
        let customFields: { selector: string; value: string }[] = [];
        let activeTemplateName = 'Default Identity';
        try {
            const templates = await getTemplates();
            const activeTemplate = templates.find(t => t.isActive);
            if (activeTemplate) {
                activeTemplateName = activeTemplate.name;
                if (activeTemplate.fields) {
                    customFields = activeTemplate.fields.map(f => {
                        const identityVal = id ? getValueFromIdentity(f.fakerCategory, id) : null;
                        const val = identityVal !== null ? identityVal : generateFieldValue(f.fakerCategory, f.fakerLocale);
                        return { selector: f.selector, value: val };
                    });
                }
            }
        } catch (e) {
            console.error('Error loading template fields:', e);
        }

        // Safe Mode Confirmation
        if (settings.safeMode) {
            const isConfirmed = confirm("Apakah Anda yakin ingin mengisi data otomatis di halaman ini?");
            if (!isConfirmed) {
                setStatus('idle');
                return;
            }
        }

        // Inject into the active tab
        try {
            if (activeTab?.id) {
                if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:') || activeTab.url.includes('chrome.google.com/webstore'))) {
                    throw new Error('Halaman sistem dilindungi.');
                }
                await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: injectData,
                    args: [id, isLogin ? 'login' : 'all', customFields, settings.autoSubmit],
                });
            } else {
                console.log('[Fill-It] Inject data:', id, isLogin ? 'login' : 'all', customFields, settings.autoSubmit);
            }

            // Record session log
            const injectedData: Record<string, string> = {};
            customFields.forEach(f => {
                injectedData[f.selector] = f.value;
            });
            if (id) {
                if (isLogin) {
                    injectedData['Email/Username'] = id.email || id.fullName || '';
                    injectedData['Password'] = id.password || '••••••••';
                } else {
                    injectedData['Full Name'] = id.fullName;
                    injectedData['Email'] = id.email;
                    injectedData['Phone'] = id.phone;
                    injectedData['Address'] = id.address;
                    if (id.nik) injectedData['NIK'] = id.nik;
                    if (id.npwp) injectedData['NPWP'] = id.npwp;
                    if (id.bankName && id.bankAccount) {
                        injectedData['Bank Account'] = `${id.bankName} - ${id.bankAccount}`;
                    }
                    if (id.bio) injectedData['Bio'] = id.bio;
                    if (id.website) injectedData['Website'] = id.website;
                    if (id.company) injectedData['Company'] = id.company;
                    if (id.jobTitle) injectedData['Job Title'] = id.jobTitle;
                }
            }
            const currentUrl = activeTab?.url || 'Halaman Web';
            await logInjection(currentUrl, activeTemplateName, injectedData);

            setStatus('done');
            setTimeout(() => setStatus('idle'), 1500);
        } catch (err: unknown) {
            console.error('[Fill-It] Injection failed:', err);
            const error = err as Error;
            setErrorMsg(error?.message || 'Gagal mengisi data.');
            setStatus('error');
            setTimeout(() => {
                setStatus('idle');
                setErrorMsg(null);
            }, 3000);
        }
    };



    const handleRefresh = async () => {
        const newId = generateIdentity(settings.selectedLocale);
        setIdentity(newId);
        await saveIdentity(newId);
    };

    const handleLocaleChange = async (locale: string) => {
        const next = {
            ...settings,
            selectedLocale: locale as AppSettings['selectedLocale'],
        };
        setSettings(next);
        await saveSettings(next);
        // Generate fresh with new locale
        const newId = generateIdentity(
            locale as AppSettings['selectedLocale'],
        );
        setIdentity(newId);
        await saveIdentity(newId);
    };

    const toggleSetting = async (key: 'autoSubmit' | 'safeMode') => {
        const next = { ...settings, [key]: !settings[key] };
        setSettings(next);
        await saveSettings(next);
    };



    /* ─── render ───────────────────────────────────────────── */
    if (loading) {
        return (
            <div className="w-[360px] h-[500px] flex flex-col items-center justify-center bg-[#f8f9fa]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-[#4f46e5]/20 border-t-[#4f46e5] rounded-full animate-spin" />
                    <span className="text-[#4f46e5] text-[10px] font-extrabold tracking-widest animate-pulse">PREPARING MAGIC...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-[360px] min-h-[520px] bg-[#f8f9fa] flex flex-col font-sans text-[#0f1115]/90 select-none relative overflow-hidden">
            {/* Background Glow Orb */}
            <div className="absolute top-[-150px] left-[30px] w-[300px] h-[300px] bg-gradient-to-br from-[#6366f1]/15 to-[#0f1115]/3 rounded-full blur-[60px] pointer-events-none z-0" />
            
            {/* ── Header ──────────────────── */}
            <header className="flex items-center justify-between px-5 py-4 z-10">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#0f1115]/5 border border-black/10 flex items-center justify-center shadow-sm relative overflow-hidden hover-glow transition-all duration-300">
                        <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-sm font-extrabold text-[#0f1115] tracking-tight">Fill-It</span>
                        <span className="text-[9px] text-[#0f1115]/40 block leading-none font-medium mt-0.5">Automated Fill</span>
                    </div>
                </div>
                {session?.isActive ? (
                    <span className="flex items-center gap-1.5 text-[9px] font-extrabold text-white bg-green-500 border border-green-500/25 px-2.5 py-0.5 rounded-full tracking-wider shadow-sm animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        RECORDING
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-[9px] font-extrabold text-white bg-[#4f46e5] border border-[#4f46e5]/25 px-2.5 py-0.5 rounded-full tracking-wider shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        STANDBY
                    </span>
                )}
            </header>

            {/* ── Magic Auto-Fill ─────────── */}
            <div className="px-5 pt-2 pb-3.5 z-10">
                <button
                    onClick={handleMagicFill}
                    disabled={status === 'injecting'}
                    className={`w-full py-5 rounded-2xl flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 border relative overflow-hidden group ${
                        status === 'error'
                            ? 'bg-gradient-to-br from-red-500 to-pink-600 border-red-500/30 text-white shadow-lg shadow-red-500/20 animate-shake'
                            : status === 'done'
                            ? 'bg-gradient-to-br from-[#4f46e5] to-indigo-700 border-[#4f46e5]/30 text-white shadow-lg shadow-[#4f46e5]/20'
                            : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white border-[#4f46e5]/25 shadow-lg shadow-[#4f46e5]/15 animate-magic-glow font-extrabold'
                    }`}
                >
                    {/* Gloss shine effect */}
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
                                {status === 'injecting'
                                    ? 'Filling Fields…'
                                    : status === 'done'
                                        ? '✓ Inject Successful!'
                                        : 'Fill It'}
                            </span>
                            <span className="text-white/60 text-[9px] font-bold tracking-widest uppercase">
                                Detect & Inject Data
                            </span>
                        </>
                    )}
                </button>
            </div>

            {/* ── Session Recording Control Panel ── */}
            <div className="px-5 pb-3.5 z-10">
                <div className="p-3 rounded-2xl border border-black/10 bg-white shadow-sm flex items-center justify-between">
                    {session?.isActive ? (
                        <>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-[10px] font-extrabold text-[#0f1115] tracking-tight uppercase block leading-none">Recording Logs</span>
                                    <span className="text-[8px] text-[#0f1115]/40 font-semibold">{session.logs?.length || 0} injected log(s)</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    onClick={handleExportSession}
                                    disabled={!session.logs || session.logs.length === 0}
                                    className="px-2.5 py-1.5 rounded-xl bg-[#4f46e5] text-white hover:bg-[#4338ca] text-[10px] font-extrabold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    Export
                                </button>
                                <button
                                    onClick={handleStopSession}
                                    className="px-2.5 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-[#0f1115]/80 text-[10px] font-bold transition-all border border-black/5"
                                >
                                    Stop
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-black/15 shrink-0" />
                                <span className="text-[10px] font-bold text-[#0f1115]/40 tracking-tight uppercase">Session Logs Standby</span>
                            </div>
                            <button
                                onClick={handleStartSession}
                                className="px-3.5 py-1.5 rounded-xl bg-[#4f46e5] text-white hover:bg-[#4338ca] text-[10px] font-extrabold transition-all shadow-sm shrink-0"
                            >
                                Start Session
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Session Identity Preview ── */}
            {identity && (
                <div className="mx-5 mb-3.5 p-4 rounded-2xl glass-panel relative overflow-hidden z-10">
                    <div className="flex items-center justify-between mb-3 border-b border-black/5 pb-2">
                        <span className="text-[9px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest">Active Session Profile</span>
                        <button
                            onClick={handleRefresh}
                            className="text-[9px] text-[#4f46e5] hover:text-[#4338ca] font-bold flex items-center gap-1 transition-colors"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                    <div className="space-y-1 text-xs text-[#0f1115]/70 font-medium">
                        <p className="text-[#0f1115] font-bold text-sm tracking-tight mb-1">{identity.fullName}</p>
                        <p className="truncate">{identity.email}</p>
                        <p>{identity.phone}</p>
                        {identity.locale === 'id_ID' && (
                            <div className="pt-1.5 space-y-0.5 border-t border-black/5 mt-1.5">
                                {identity.nik && <p className="text-[10px] text-[#0f1115]/40"><span className="font-extrabold text-[#0f1115]/30 uppercase">NIK:</span> <span className="font-mono text-[#0f1115]/80">{identity.nik}</span></p>}
                                {identity.npwp && <p className="text-[10px] text-[#0f1115]/40"><span className="font-extrabold text-[#0f1115]/30 uppercase">NPWP:</span> <span className="font-mono text-[#0f1115]/80">{identity.npwp}</span></p>}
                                {identity.bankName && identity.bankAccount && (
                                    <p className="text-[10px] text-[#0f1115]/40 truncate">
                                        <span className="font-extrabold text-[#0f1115]/30 uppercase">Bank:</span> <span className="text-[#0f1115]/80">{identity.bankName} ({identity.bankAccount})</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Profile Selector ────────── */}
            <div className="px-5 space-y-1.5 z-10">
                <span className="text-[9px] font-extrabold text-[#0f1115]/30 uppercase tracking-widest block">
                    Profile Locale Selector
                </span>
                <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0f1115]/30">
                        <svg className="w-4 h-4 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                    </div>
                    <select
                        value={settings.selectedLocale}
                        onChange={(e) => handleLocaleChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-black/10 hover:border-black/20 text-[#0f1115]/90 text-xs font-semibold appearance-none cursor-pointer focus:border-[#4f46e5]/50 focus:ring-1 focus:ring-[#4f46e5]/20 outline-none transition-all duration-300"
                    >
                        {LOCALE_OPTIONS.map((l) => (
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

            {/* ── Toggles ─────────────────── */}
            <div className="px-5 mt-4 space-y-2.5 z-10">
                {/* Auto-submit */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-black/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#4f46e5]/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#0f1115]">Auto-Submit</p>
                            <p className="text-[9px] text-[#0f1115]/40 leading-none mt-0.5">Submit forms after injection</p>
                        </div>
                    </div>
                    <button
                        onClick={() => toggleSetting('autoSubmit')}
                        className={`w-10 h-5.5 rounded-full transition-colors duration-300 relative ${settings.autoSubmit ? 'bg-[#4f46e5]' : 'bg-black/10'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.autoSubmit ? 'translate-x-4.5' : ''}`} />
                    </button>
                </div>

                {/* Safe Mode */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-black/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#4f46e5]/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#4f46e5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[#0f1115]">Safe Mode</p>
                            <p className="text-[9px] text-[#0f1115]/40 leading-none mt-0.5">Confirm before injecting data</p>
                        </div>
                    </div>
                    <button
                        onClick={() => toggleSetting('safeMode')}
                        className={`w-10 h-5.5 rounded-full transition-colors duration-300 relative ${settings.safeMode ? 'bg-[#4f46e5]' : 'bg-black/10'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.safeMode ? 'translate-x-4.5' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Footer ──────────────────── */}
            <div className="mt-auto px-5 py-4 border-t border-black/5 flex items-center justify-between text-xs z-10">
                <span className="text-[#0f1115]/30 font-bold text-[9px] tracking-wider">v1.0.0</span>
                <span className="text-[#0f1115]/30 font-bold text-[9px] tracking-wider">Developer Mode</span>
            </div>
        </div>
    );
}

export default Popup;

/* ── Injected into page context ──────────────────────────── */
function injectData(identity: Identity, fillType: 'login' | 'all', customFields?: { selector: string; value: string }[], autoSubmit?: boolean) {
    const setValueForElement = (el: HTMLElement, value: string) => {
        const proto = Object.getPrototypeOf(el);
        let setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (!setter) {
            const parentProto = Object.getPrototypeOf(proto);
            if (parentProto) {
                setter = Object.getOwnPropertyDescriptor(parentProto, 'value')?.set;
            }
        }
        
        if (setter) {
            setter.call(el, value);
        } else {
            (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = value;
        }
        
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const fill = (selectors: string[], value: string, forceText: boolean = false) => {
        for (const sel of selectors) {
            const els = document.querySelectorAll<HTMLElement>(sel);
            els.forEach((el) => {
                el.focus();
                
                if (el instanceof HTMLInputElement) {
                    const type = (el.getAttribute('type') || '').toLowerCase();
                    if (type === 'checkbox' || type === 'radio') {
                        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
                        const boolVal = value === 'true' || value === '1' || value === 'yes' || !!value;
                        if (setter) {
                            setter.call(el, boolVal);
                        } else {
                            el.checked = boolVal;
                        }
                        el.dispatchEvent(new Event('click', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                    }
                    if (type === 'date') {
                        let dateStr = value;
                        const d = new Date(value);
                        if (!isNaN(d.getTime())) {
                            dateStr = d.toISOString().split('T')[0];
                        }
                        setValueForElement(el, dateStr);
                        return;
                    }
                    if (type === 'number') {
                        const minAttr = el.getAttribute('min');
                        const maxAttr = el.getAttribute('max');
                        if (minAttr !== null && maxAttr !== null) {
                            const minVal = parseInt(minAttr, 10);
                            const maxVal = parseInt(maxAttr, 10);
                            if (!isNaN(minVal) && !isNaN(maxVal) && maxVal >= minVal) {
                                const stepAttr = el.getAttribute('step');
                                const step = stepAttr ? parseFloat(stepAttr) : 1;
                                const randVal = Math.floor(Math.random() * ((maxVal - minVal) / step + 1)) * step + minVal;
                                setValueForElement(el, String(randVal));
                                return;
                            }
                        }
                        
                        const id = (el.getAttribute('id') || '').toLowerCase();
                        const name = (el.getAttribute('name') || '').toLowerCase();
                        const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
                        const combined = `${id} ${name} ${placeholder}`;
                        
                        if (/age|umur|usia/i.test(combined)) {
                            const minVal = minAttr ? parseInt(minAttr, 10) : 18;
                            const maxVal = maxAttr ? parseInt(maxAttr, 10) : 60;
                            const randVal = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
                            setValueForElement(el, String(randVal));
                            return;
                        }
                        if (/salary|gaji|income|pendapatan/i.test(combined)) {
                            const minVal = minAttr ? parseInt(minAttr, 10) : 4000000;
                            const maxVal = maxAttr ? parseInt(maxAttr, 10) : 12000000;
                            const step = 500000;
                            const randVal = Math.floor(Math.random() * ((maxVal - minVal) / step + 1)) * step + minVal;
                            setValueForElement(el, String(randVal));
                            return;
                        }
                        if (/qty|quantity|jumlah|count|pax|pcs/i.test(combined)) {
                            const minVal = minAttr ? parseInt(minAttr, 10) : 1;
                            const maxVal = maxAttr ? parseInt(maxAttr, 10) : 5;
                            const randVal = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
                            setValueForElement(el, String(randVal));
                            return;
                        }
                        
                        const minVal = minAttr ? parseInt(minAttr, 10) : 1;
                        const maxVal = maxAttr ? parseInt(maxAttr, 10) : 100;
                        const randVal = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
                        setValueForElement(el, String(randVal));
                        return;
                    }
                    
                    let valToFill = value;
                    if (!forceText) {
                        if (el.type === 'number' || el.getAttribute('maxlength') === '15' || el.getAttribute('maxlength') === '16') {
                            valToFill = value.replace(/[^0-9]/g, '');
                        }
                    }
                    setValueForElement(el, valToFill);
                } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
                    setValueForElement(el, value);
                }
            });
        }
    };

    // If custom template is active, inject custom fields
    if (customFields && customFields.length > 0 && fillType !== 'login') {
        const getElementSelectors = (sel: string) => {
            if (sel.startsWith('#') || sel.startsWith('.') || sel.startsWith('[') || sel.includes(' ')) {
                return [sel];
            }
            return [
                `#${sel}`,
                `[name="${sel}"]`,
                `[id="${sel}"]`,
                `[placeholder="${sel}"]`,
                `input[name*="${sel}" i]`,
                `input[id*="${sel}" i]`,
                `input[placeholder*="${sel}" i]`,
                `textarea[name*="${sel}" i]`,
                `textarea[id*="${sel}" i]`,
                `select[name*="${sel}" i]`,
            ];
        };

        customFields.forEach((field) => {
            const selectors = getElementSelectors(field.selector);
            fill(selectors, field.value, true);
        });
        return;
    }

    if (fillType === 'login') {
        // Only fill username/email and password
        fill(
            ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]', 'input[placeholder*="email" i]', 'input[name*="username" i]', 'input[name*="user" i]', 'input[placeholder*="username" i]'],
            identity.email
        );
        fill(
            ['input[type="password"]', 'input[name*="password" i]', 'input[id*="password" i]', 'input[placeholder*="password" i]', 'input[name*="pass" i]'],
            identity.password || 'P@ssw0rd123!'
        );
        return;
    }

    // Default: fill all fields
    // Full Name
    fill(
        ['input[name*="name" i]', 'input[id*="name" i]', 'input[placeholder*="name" i]', 'input[autocomplete="name"]'],
        identity.fullName
    );
    
    // First Name
    fill(
        ['input[name*="first" i]', 'input[id*="first" i]', 'input[placeholder*="first" i]'],
        identity.firstName
    );
    
    // Last Name
    fill(
        ['input[name*="last" i]', 'input[id*="last" i]', 'input[placeholder*="last" i]'],
        identity.lastName
    );

    // Email
    fill(
        ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]', 'input[placeholder*="email" i]'],
        identity.email
    );

    // Phone (handling 08... vs +628... vs 628...)
    const phoneVal = identity.phone;
    const phoneFields = document.querySelectorAll<HTMLInputElement>('input[type="tel"], input[name*="phone" i], input[id*="phone" i], input[placeholder*="phone" i]');
    phoneFields.forEach((el) => {
        el.focus();
        let valToFill = phoneVal;
        const placeholder = el.getAttribute('placeholder') || '';
        const labelText = el.closest('label')?.textContent || '';
        if (placeholder.includes('+62') || labelText.includes('+62')) {
            valToFill = phoneVal.replace(/^0/, '+62');
        } else if (placeholder.includes('62') || labelText.includes('62')) {
            valToFill = phoneVal.replace(/^0/, '62');
        }
        
        if (el.type === 'number') {
            valToFill = valToFill.replace(/[^0-9]/g, '');
        }
        
        setValueForElement(el, valToFill);
    });

    // Address
    fill(
        ['input[name*="address" i]', 'input[id*="address" i]', 'textarea[name*="address" i]', 'input[name*="alamat" i]', 'textarea[name*="alamat" i]'],
        identity.address
    );

    // Username
    fill(
        ['input[name*="username" i]', 'input[name*="user" i]', 'input[placeholder*="username" i]'],
        identity.email.split('@')[0]
    );

    // Password
    fill(
        ['input[type="password"]', 'input[name*="password" i]', 'input[id*="password" i]', 'input[placeholder*="password" i]', 'input[name*="pass" i]'],
        identity.password || 'P@ssw0rd123!'
    );

    // Indonesian specific fields
    if (identity.nik) {
        fill(
            ['input[name*="nik" i]', 'input[id*="nik" i]', 'input[placeholder*="nik" i]', 'input[name*="ktp" i]', 'input[id*="ktp" i]', 'input[name*="identitas" i]'],
            identity.nik
        );
    }

    if (identity.npwp) {
        fill(
            ['input[name*="npwp" i]', 'input[id*="npwp" i]', 'input[placeholder*="npwp" i]', 'input[name*="pajak" i]'],
            identity.npwp
        );
    }

    if (identity.bankName) {
        const bankSelectors = ['select[name*="bank" i]', 'input[name*="bank" i]', 'input[placeholder*="bank" i]'];
        for (const sel of bankSelectors) {
            const els = document.querySelectorAll<HTMLElement>(sel);
            els.forEach((el) => {
                el.focus();
                if (el instanceof HTMLSelectElement) {
                    const opt = Array.from(el.options).find(o => 
                        o.text.toLowerCase().includes(identity.bankName!.toLowerCase()) ||
                        o.value.toLowerCase().includes(identity.bankName!.toLowerCase())
                    );
                    if (opt) {
                        setValueForElement(el, opt.value);
                    }
                } else if (el instanceof HTMLInputElement) {
                    setValueForElement(el, identity.bankName!);
                }
            });
        }
    }

    if (identity.bankAccount) {
        fill(
            ['input[name*="rekening" i]', 'input[name*="account" i]', 'input[placeholder*="rekening" i]', 'input[name*="rek" i]'],
            identity.bankAccount
        );
    }

    // ─── Default Mappings: Pekerjaan, Perusahaan & Website ───
    if (identity.company) {
        fill(
            ['input[name*="company" i]', 'input[name*="perusahaan" i]', 'input[name*="kantor" i]', 'input[id*="company" i]', 'input[id*="perusahaan" i]'],
            identity.company
        );
    }
    if (identity.jobTitle) {
        fill(
            ['input[name*="job" i]', 'input[name*="pekerjaan" i]', 'input[name*="jabatan" i]', 'input[name*="occupation" i]', 'input[name*="profesi" i]', 'input[id*="job" i]'],
            identity.jobTitle
        );
    }
    if (identity.website) {
        fill(
            ['input[type="url"]', 'input[name*="website" i]', 'input[name*="url" i]', 'input[name*="blog" i]', 'input[name*="portfolio" i]', 'input[id*="website" i]'],
            identity.website
        );
    }

    // ─── Default Mappings: Umur, Gaji & Qty ───
    const randAge = String(Math.floor(Math.random() * (60 - 18 + 1)) + 18);
    fill(
        ['input[name*="age" i]', 'input[name*="umur" i]', 'input[name*="usia" i]', 'input[id*="age" i]', 'input[id*="umur" i]', 'input[id*="usia" i]'],
        randAge
    );
    const randSalary = String(Math.floor(Math.random() * (12000000 - 4000000 + 1) / 500000) * 500000 + 4000000);
    fill(
        ['input[name*="salary" i]', 'input[name*="gaji" i]', 'input[name*="income" i]', 'input[id*="salary" i]', 'input[id*="gaji" i]', 'input[id*="income" i]'],
        randSalary
    );
    const randQty = String(Math.floor(Math.random() * 5) + 1);
    fill(
        ['input[name*="qty" i]', 'input[name*="quantity" i]', 'input[name*="jumlah" i]', 'input[id*="qty" i]', 'input[id*="quantity" i]', 'input[id*="jumlah" i]'],
        randQty
    );

    // ─── Smart Textareas Filling ───
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
    textareas.forEach((ta) => {
        ta.focus();
        if (ta.value) return;

        const id = (ta.getAttribute('id') || '').toLowerCase();
        const name = (ta.getAttribute('name') || '').toLowerCase();
        const placeholder = (ta.getAttribute('placeholder') || '').toLowerCase();
        const combined = `${id} ${name} ${placeholder}`;

        let val = '';
        if (/address|alamat|jalan|street/i.test(combined)) {
            val = identity.address;
        } else if (/bio|about|desc|profile|diri|tentang/i.test(combined)) {
            val = identity.bio || '';
        } else if (/note|catatan|keterangan|comment|pesan|instruction/i.test(combined)) {
            const notes = [
                'Tolong kirimkan sebelum jam 5 sore.',
                'Titip di pos satpam jika rumah kosong.',
                'Harap hubungi nomor telepon jika sudah sampai.',
                'Paket ditaruh di teras saja.',
                'Barang mudah pecah, mohon hati-hati.',
            ];
            val = notes[Math.floor(Math.random() * notes.length)];
        } else {
            val = identity.bio || 'Form testing data input.';
        }
        setValueForElement(ta, val);
    });

    // ─── Dropdown Fallback Acak (Generic Select) ───
    const selects = document.querySelectorAll<HTMLSelectElement>('select');
    selects.forEach((sel) => {
        sel.focus();
        if (sel.selectedIndex > 0) return;
        
        const validOptions = Array.from(sel.options).filter((opt, idx) => {
            if (idx === 0) return false;
            const txt = opt.text.toLowerCase();
            const val = opt.value.toLowerCase();
            if (txt.includes('pilih') || txt.includes('select') || txt.includes('--') || !val) {
                return false;
            }
            return true;
        });

        if (validOptions.length > 0) {
            const randomOpt = validOptions[Math.floor(Math.random() * validOptions.length)];
            setValueForElement(sel, randomOpt.value);
        } else if (sel.options.length > 1) {
            setValueForElement(sel, sel.options[1].value);
        }
    });

    // ─── Automated Checkbox, Radio, and Date Pickers (Post-Process) ───
    // 1. Checkboxes (like agree to terms, subscribe)
    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
        const parentText = (cb.closest('label')?.textContent || cb.parentElement?.textContent || '').toLowerCase();
        if (parentText.includes('setuju') || parentText.includes('agree') || parentText.includes('syarat') || parentText.includes('terms') || parentText.includes('privacy') || parentText.includes('kebijakan') || parentText.includes('newsletter') || parentText.includes('langganan')) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            if (setter) {
                setter.call(cb, true);
            } else {
                cb.checked = true;
            }
            cb.dispatchEvent(new Event('click', { bubbles: true }));
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // 2. Radio buttons (like gender, gender options)
    const radioNames = new Set<string>();
    const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    radios.forEach((r) => {
        if (r.name) radioNames.add(r.name);
    });
    
    radioNames.forEach((name) => {
        const group = document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`);
        if (group.length > 0) {
            const randomIdx = Math.floor(Math.random() * group.length);
            const r = group[randomIdx];
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            if (setter) {
                setter.call(r, true);
            } else {
                r.checked = true;
            }
            r.dispatchEvent(new Event('click', { bubbles: true }));
            r.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    // 3. Date fields (like Birth Date)
    if (identity.birthDate) {
        fill(
            ['input[type="date"]', 'input[name*="date" i]', 'input[name*="lahir" i]', 'input[name*="birth" i]', 'input[id*="date" i]', 'input[id*="lahir" i]'],
            identity.birthDate
        );
    }

    // ─── Auto Submit Implementation ───
    if (autoSubmit) {
        setTimeout(() => {
            const form = document.querySelector('form');
            if (form) {
                const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                if (submitBtn) {
                    (submitBtn as HTMLElement).click();
                } else {
                    form.submit();
                }
            }
        }, 500);
    }
}


