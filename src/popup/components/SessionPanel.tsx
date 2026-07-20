import type { TestSession } from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// SessionPanel.tsx — Session recording controls
// ─────────────────────────────────────────────────────────────────────────────

interface SessionPanelProps {
    session: TestSession | null;
    onStart: () => Promise<void>;
    onStop: () => Promise<void>;
    onExport: () => void;
}

export function SessionPanel({ session, onStart, onStop, onExport }: SessionPanelProps) {
    return (
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
                                onClick={onExport}
                                disabled={!session.logs || session.logs.length === 0}
                                className="px-2.5 py-1.5 rounded-xl bg-[#4f46e5] text-white hover:bg-[#4338ca] text-[10px] font-extrabold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                Export
                            </button>
                            <button
                                onClick={onStop}
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
                            onClick={onStart}
                            className="px-3.5 py-1.5 rounded-xl bg-[#4f46e5] text-white hover:bg-[#4338ca] text-[10px] font-extrabold transition-all shadow-sm shrink-0"
                        >
                            Start Session
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
