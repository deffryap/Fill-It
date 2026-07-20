// ─────────────────────────────────────────────────────────────────────────────
// Popup.tsx — Main orchestrator (~150 lines)
//
// Composes the two tabs (Identity Profile & Form Scanner) and manages:
//   - Tab navigation state
//   - Session recording state
//   - Shared identity via useIdentity hook
//   - Form scanner state via useScanner hook
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import type { TestSession } from '../shared/types';
import {
    getTestSession,
    startNewSession,
    endActiveSession,
} from '../shared/storageService';
import { useIdentity } from './hooks/useIdentity';
import { useScanner } from './hooks/useScanner';
import { IdentityProfileTab } from './components/IdentityProfileTab';
import { FormScannerTab } from './components/FormScannerTab';
import '../index.css';

type ActiveTab = 'profile' | 'scanner';

function Popup() {
    const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
    const [session, setSession] = useState<TestSession | null>(null);

    // ── Hooks ──────────────────────────────────────────────────────────────
    const {
        identity,
        settings,
        loading,
        setIdentity,
        handleRefresh,
        handleFieldChange,
        handleLocaleChange,
        toggleSetting,
    } = useIdentity();

    const {
        scannedFields,
        isScanning,
        status: scannerStatus,
        errorMsg: scannerError,
        handleScan,
        handleInject,
        handleFieldEdit,
        handleRefreshField,
    } = useScanner(identity, settings);

    // ── Session Bootstrap ──────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const s = await getTestSession();
            setSession(s);
        })();
    }, []);

    // ── Storage change listener (multi-window session sync) ────────────────
    useEffect(() => {
        const handleStorageChange = async (
            _changes: Record<string, chrome.storage.StorageChange> | unknown,
            areaName: string
        ) => {
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

    // ── Session Handlers ───────────────────────────────────────────────────
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
        const dateStr = new Date(session.startTime).toISOString().split('T')[0];
        a.download = `fill_it_session_${session.id}_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Loading State ──────────────────────────────────────────────────────
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

            {/* ── Tab Navigation ──────────── */}
            <div className="flex border-b border-black/5 px-5 mb-2.5 z-10 gap-4 shrink-0">
                {(['profile', 'scanner'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 text-xs font-bold transition-all border-b-2 outline-none ${
                            activeTab === tab
                                ? 'border-[#4f46e5] text-[#4f46e5]'
                                : 'border-transparent text-[#0f1115]/40 hover:text-[#0f1115]/60'
                        }`}
                    >
                        {tab === 'profile' ? 'Identity Profile' : 'Form Scanner'}
                    </button>
                ))}
            </div>

            {/* ── Identity Profile Tab ─────── */}
            {activeTab === 'profile' && (
                <IdentityProfileTab
                    identity={identity}
                    settings={settings}
                    session={session}
                    onFieldChange={handleFieldChange}
                    onRefresh={handleRefresh}
                    onLocaleChange={handleLocaleChange}
                    onToggleSetting={toggleSetting}
                    onStartSession={handleStartSession}
                    onStopSession={handleStopSession}
                    onExportSession={handleExportSession}
                    setIdentity={setIdentity}
                />
            )}

            {/* ── Form Scanner Tab ─────────── */}
            {activeTab === 'scanner' && (
                <div className="flex-1 flex flex-col z-10 min-h-[400px]">
                    <FormScannerTab
                        scannedFields={scannedFields}
                        isScanning={isScanning}
                        status={scannerStatus}
                        errorMsg={scannerError}
                        onScan={handleScan}
                        onInject={handleInject}
                        onFieldEdit={handleFieldEdit}
                        onRefreshField={handleRefreshField}
                    />
                </div>
            )}

            {/* ── Footer ──────────────────── */}
            <div className="mt-auto px-5 py-4 border-t border-black/5 flex items-center justify-between text-xs z-10">
                <span className="text-[#0f1115]/30 font-bold text-[9px] tracking-wider">v1.0.0</span>
                <span className="text-[#0f1115]/30 font-bold text-[9px] tracking-wider">Developer Mode</span>
            </div>
        </div>
    );
}

export default Popup;
