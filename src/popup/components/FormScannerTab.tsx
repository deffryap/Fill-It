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
                <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-800 rounded-full animate-spin" />
                <span className="text-neutral-400 text-[10px] font-semibold tracking-widest uppercase mt-3">Scanning...</span>
            </div>
        );
    }

    if (scannedFields.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <svg className="w-10 h-10 text-neutral-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                </svg>
                <p className="text-[12px] font-medium text-neutral-500 mb-1">No fields scanned yet</p>
                {errorMsg && (
                    <p className="text-[11px] text-red-600 font-medium mb-3">{errorMsg}</p>
                )}
                <button
                    onClick={onScan}
                    className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-700 text-white text-[12px] font-semibold transition-colors active:scale-[0.98]"
                >
                    Scan This Page
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col px-4 pb-4">
            {/* Action Buttons */}
            <div className="flex gap-2 mb-3 pt-3 shrink-0">
                <button
                    onClick={onInject}
                    disabled={status === 'injecting'}
                    className={`flex-1 py-2.5 rounded-lg text-[12px] font-semibold text-white active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 ${
                        status === 'error'
                            ? 'bg-red-600 hover:bg-red-700'
                            : status === 'done'
                            ? 'bg-green-600'
                            : 'bg-neutral-900 hover:bg-neutral-700'
                    }`}
                >
                    {status === 'injecting' ? 'Injecting...'
                        : status === 'done' ? '✓ Done'
                        : status === 'error' ? 'Failed'
                        : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Inject Data
                            </>
                        )}
                </button>
                <button
                    onClick={onScan}
                    className="px-3.5 py-2.5 rounded-lg bg-white hover:bg-neutral-50 text-neutral-700 text-[12px] font-semibold border border-neutral-200 active:scale-[0.98] transition-colors"
                >
                    Rescan
                </button>
            </div>

            {/* Field List */}
            <div className="flex-1 overflow-y-auto max-h-[300px] pr-0.5 space-y-2">
                {scannedFields.map((field, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-white border border-neutral-200 flex flex-col gap-1.5">
                        {/* Field Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[11px] font-semibold text-neutral-900 truncate">
                                    {field.label}
                                </span>
                                {field.isEdited && (
                                    <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                        edited
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] font-mono text-neutral-300 truncate max-w-[80px]" title={field.selector}>
                                    {field.selector}
                                </span>
                                <button
                                    onClick={() => onRefreshField(idx)}
                                    className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer outline-none border-none flex items-center justify-center bg-transparent"
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
                                className="w-full px-2.5 py-1.5 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-400 focus:ring-0 outline-none rounded-md text-[12px] font-medium bg-neutral-50 text-neutral-800 min-h-[44px] resize-none"
                            />
                        ) : (
                            <input
                                type="text"
                                value={field.value}
                                onChange={e => onFieldEdit(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-400 focus:ring-0 outline-none rounded-md text-[12px] font-medium bg-neutral-50 text-neutral-800"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
