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
        <div className="px-4 pb-3">
            <div className="p-2.5 rounded-lg border border-neutral-200 bg-white flex items-center justify-between">
                {session?.isActive ? (
                    <>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                            <div className="min-w-0">
                                <span className="text-[11px] font-semibold text-neutral-900 block leading-none">Recording</span>
                                <span className="text-[10px] text-neutral-400 mt-0.5 block">{session.logs?.length || 0} log(s)</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={onExport}
                                disabled={!session.logs || session.logs.length === 0}
                                className="px-2.5 py-1 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 text-[10px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Export
                            </button>
                            <button
                                onClick={onStop}
                                className="px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[10px] font-semibold transition-colors border border-neutral-200"
                            >
                                Stop
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-neutral-300 shrink-0" />
                            <span className="text-[11px] font-medium text-neutral-400">Session idle</span>
                        </div>
                        <button
                            onClick={onStart}
                            className="px-3 py-1 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 text-[10px] font-semibold transition-colors shrink-0"
                        >
                            Start Session
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
