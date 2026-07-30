// ─────────────────────────────────────────────────────────────────────────────
// Popup.tsx — Main orchestrator
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

    useEffect(() => {
        (async () => {
            const s = await getTestSession();
            setSession(s);
        })();
    }, []);

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

    if (loading) {
        return (
            <div className="w-[360px] h-[500px] flex flex-col items-center justify-center bg-[#fafafa]">
                <div className="flex flex-col items-center gap-2.5">
                    <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-800 rounded-full animate-spin" />
                    <span className="text-neutral-400 text-[10px] font-semibold tracking-widest uppercase">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-[360px] min-h-[520px] bg-[#fafafa] flex flex-col select-none overflow-hidden">

            {/* ── Header ──────────────────── */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center gap-[1px] px-1">
                        <span className="text-white font-bold text-[10px] leading-none tracking-tight">F</span>
                        <svg className="w-3 h-3 text-white shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-[13px] font-bold text-neutral-900 tracking-tight leading-none">Fill-It</span>
                        <span className="text-[10px] text-neutral-400 block leading-none mt-0.5">Form Auto-Fill Tool</span>
                    </div>
                </div>
                {session?.isActive ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        REC
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        Idle
                    </span>
                )}
            </header>

            {/* ── Tab Navigation ──────────── */}
            <div className="flex border-b border-neutral-200 px-4 shrink-0 bg-white">
                {(['profile', 'scanner'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2.5 mr-4 text-[12px] font-semibold transition-colors border-b-2 outline-none ${
                            activeTab === tab
                                ? 'border-neutral-900 text-neutral-900'
                                : 'border-transparent text-neutral-400 hover:text-neutral-600'
                        }`}
                    >
                        {tab === 'profile' ? 'Identity Profile' : 'Form Scanner'}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ─────────────── */}
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

            {activeTab === 'scanner' && (
                <div className="flex-1 flex flex-col min-h-[400px]">
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
            <div className="mt-auto px-4 py-3 border-t border-neutral-200 flex items-center justify-between bg-white">
                <span className="text-neutral-400 text-[10px] font-medium">v1.0.0</span>
                <span className="text-neutral-400 text-[10px] font-medium">© 2026 Fill-It</span>
            </div>
        </div>
    );
}

export default Popup;
