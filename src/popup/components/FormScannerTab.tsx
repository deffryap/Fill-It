import type { ScannedField } from '../hooks/useScanner';

// ─────────────────────────────────────────────────────────────────────────────
// FormScannerTab.tsx — Form Scanner tab UI
// ─────────────────────────────────────────────────────────────────────────────

interface FormScannerTabProps {
    scannedFields: ScannedField[];
    isScanning: boolean;
    status: 'idle' | 'injecting' | 'done' | 'error';
    errorMsg: string | null;
    onScan: () => Promise<void>;
    onInject: () => Promise<void>;
    onFieldEdit: (idx: number, value: string) => void;
    onRefreshField: (idx: number) => void;
}

export function FormScannerTab({
    scannedFields,
    isScanning,
    status,
    errorMsg,
    onScan,
    onInject,
    onFieldEdit,
    onRefreshField,
}: FormScannerTabProps) {
    if (isScanning) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-10">
                <div className="w-10 h-10 border-2 border-[#4f46e5]/20 border-t-[#4f46e5] rounded-full animate-spin" />
                <span className="text-[#4f46e5] text-[10px] font-extrabold tracking-widest animate-pulse mt-3">SCANNING PAGE FORM...</span>
            </div>
        );
    }

    if (scannedFields.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <svg className="w-12 h-12 text-[#0f1115]/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                </svg>
                <p className="text-xs font-bold text-[#0f1115]/60 mb-1">No fields scanned yet.</p>
                {errorMsg && (
                    <p className="text-[10px] text-red-500 font-medium mb-3">{errorMsg}</p>
                )}
                <button
                    onClick={onScan}
                    className="px-5 py-3 rounded-2xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-extrabold shadow-md transition-all active:scale-[0.98]"
                >
                    Scan Form on This Page
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col px-5 pb-5">
            {/* Action Buttons */}
            <div className="flex gap-2.5 mb-4 shrink-0">
                <button
                    onClick={onInject}
                    disabled={status === 'injecting'}
                    className={`flex-1 py-3 rounded-2xl text-xs font-extrabold text-white shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 ${
                        status === 'error'
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                            : status === 'done'
                            ? 'bg-green-500 shadow-green-500/20'
                            : 'bg-[#4f46e5] hover:bg-[#4338ca] shadow-[#4f46e5]/20'
                    }`}
                >
                    {status === 'injecting' ? 'Injecting...'
                        : status === 'done' ? '✓ Filled Successfully!'
                        : status === 'error' ? 'Failed!'
                        : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Inject Custom Data
                            </>
                        )}
                </button>
                <button
                    onClick={onScan}
                    className="px-4 py-3 rounded-2xl bg-black/5 hover:bg-black/10 text-[#0f1115]/80 text-xs font-bold border border-black/5 active:scale-[0.98] transition-all"
                >
                    Rescan
                </button>
            </div>

            {/* Field List */}
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-1 space-y-3">
                {scannedFields.map((field, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-white border border-black/10 shadow-sm flex flex-col gap-1.5">
                        {/* Field Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-extrabold text-[#0f1115] tracking-tight uppercase leading-none truncate">
                                    {field.label}
                                </span>
                                {field.isEdited && (
                                    <span className="text-[7px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/50 uppercase tracking-wider shrink-0">
                                        Edited
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[7.5px] font-mono text-[#0f1115]/30 truncate max-w-[100px]" title={field.selector}>
                                    {field.selector}
                                </span>
                                <button
                                    onClick={() => onRefreshField(idx)}
                                    className="p-1 rounded-lg hover:bg-black/5 text-[#0f1115]/30 hover:text-[#4f46e5] transition-all cursor-pointer outline-none border-none flex items-center justify-center bg-transparent"
                                    title="Regenerate this field"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Field Input */}
                        {field.type === 'textarea' ? (
                            <textarea
                                value={field.value}
                                onChange={e => onFieldEdit(idx, e.target.value)}
                                className="w-full px-3 py-2 border border-black/5 hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none rounded-xl text-xs font-medium bg-[#f8f9fa] text-[#0f1115]/80 min-h-[50px] resize-none"
                            />
                        ) : (
                            <input
                                type="text"
                                value={field.value}
                                onChange={e => onFieldEdit(idx, e.target.value)}
                                className="w-full px-3 py-2 border border-black/5 hover:border-black/10 focus:border-[#4f46e5]/50 focus:ring-0 outline-none rounded-xl text-xs font-medium bg-[#f8f9fa] text-[#0f1115]/80"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
