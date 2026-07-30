import { useState, useEffect } from 'react';
import type { Identity, AppSettings } from '../../shared/types';
import { guessValueForField } from '../utils/fieldGuesser';
import { scanPageForm, injectCustomFieldsData } from '../../shared/pageScripts';
import { generateIdentity } from '../../shared/fakerService';
import { logInjection } from '../../shared/storageService';

// ─────────────────────────────────────────────────────────────────────────────
// useScanner
//
// Manages the Form Scanner tab state: scanned fields, scanning status, and
// injection. Fixes:
//   - QA #3: Side-effects extracted OUT of setState callbacks
//   - QA #8: handleRefreshField reuses shared identity, not a new random one
// ─────────────────────────────────────────────────────────────────────────────

export interface ScannedField {
    selector: string;
    label: string;
    value: string;
    type: string;
    isEdited?: boolean;
    name?: string;
    id?: string;
    placeholder?: string;
    customDomain?: string;
}

interface UseScannerReturn {
    scannedFields: ScannedField[];
    isScanning: boolean;
    status: 'idle' | 'injecting' | 'done' | 'error';
    errorMsg: string | null;
    handleScan: () => Promise<void>;
    handleInject: () => Promise<void>;
    handleFieldEdit: (idx: number, value: string) => void;
    handleRefreshField: (idx: number) => void;
}

const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
    if (typeof chrome === 'undefined' || !chrome?.tabs) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
};

// Lightweight real-time single-field injector (for on-edit sync)
const injectSingleField = async (selector: string, value: string): Promise<void> => {
    try {
        const tab = await getActiveTab();
        if (!tab?.id) return;
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (sel: string, val: string): void => {
                const el = document.querySelector<HTMLElement>(sel);
                if (!el) return;

                const pDropdown = el.closest('p-dropdown, .p-dropdown');
                if (pDropdown) {
                    const clickTarget = pDropdown.querySelector<HTMLElement>('.p-dropdown-trigger') || (pDropdown as HTMLElement);
                    clickTarget.click();
                    setTimeout(() => {
                        const items = Array.from(document.querySelectorAll<HTMLElement>('.p-dropdown-panel .p-dropdown-item, li[role="option"]'));
                        const match = items.find(i => i.textContent?.trim().toLowerCase() === val.toLowerCase())
                            || items.find(i => i.textContent?.trim().toLowerCase().includes(val.toLowerCase()));
                        if (match) match.click();
                    }, 120);
                    return;
                }

                if (el instanceof HTMLSelectElement) {
                    const opt = Array.from(el.options).find(o => o.value.toLowerCase() === val.toLowerCase() || o.text.toLowerCase() === val.toLowerCase());
                    if (opt) opt.selected = true;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }

                const proto = Object.getPrototypeOf(el);
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
                    || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'value')?.set;
                if (setter) setter.call(el, val);
                else (el as HTMLInputElement).value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            },
            args: [selector, value],
        });
    } catch (e) {
        console.error('[Fill-It] Real-time sync failed:', e);
    }
};

export function useScanner(identity: Identity | null, settings: AppSettings): UseScannerReturn {
    const [scannedFields, setScannedFields] = useState<ScannedField[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<'idle' | 'injecting' | 'done' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // When identity changes, update preview values for non-edited fields (popup UI only, no page injection)
    useEffect(() => {
        if (!identity || scannedFields.length === 0) return;
        setScannedFields(prev =>
            prev.map(field => {
                // For email fields with a custom domain: preserve domain, update username
                if (field.label.toLowerCase().includes('email') && field.customDomain) {
                    const newUsername = identity.email.split('@')[0];
                    return { ...field, value: `${newUsername}@${field.customDomain}` };
                }
                // Locked edited fields stay as-is
                if (field.isEdited) return field;

                const guessed = guessValueForField({
                    label: field.label,
                    type: field.type,
                    name: field.name || '',
                    id: field.id || '',
                    placeholder: field.placeholder || '',
                }, identity);
                return { ...field, value: guessed };
            })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [identity]);

    const handleScan = async () => {
        setIsScanning(true);
        setErrorMsg(null);
        try {
            const tab = await getActiveTab();
            if (!tab?.id) throw new Error('Cannot find active tab to scan.');
            if (tab.url && (
                tab.url.startsWith('chrome://') ||
                tab.url.startsWith('edge://') ||
                tab.url.startsWith('about:') ||
                tab.url.includes('chrome.google.com/webstore')
            )) {
                throw new Error('System pages cannot be scanned.');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scanPageForm,
            });

            const scanned = results?.[0]?.result;
            if (scanned && Array.isArray(scanned)) {
                // Use active profile identity if present, otherwise generate new cohesive batch
                const scanIdentity = identity || generateIdentity(settings.selectedLocale);

                const fieldsWithValues: ScannedField[] = scanned.map((field: {
                    selector: string; label: string; type: string;
                    placeholder: string; name: string; id: string;
                }) => {
                    // Preserve edited state across re-scans
                    const existing = scannedFields.find(f => f.selector === field.selector);
                    if (existing?.isEdited) {
                        // Special case: email field with a custom domain (@company.com)
                        // → refresh the username from the scan identity, but keep the domain
                        if (existing.customDomain) {
                            const newUsername = scanIdentity.email.split('@')[0];
                            return { ...existing, value: `${newUsername}@${existing.customDomain}` };
                        }
                        // All other edited fields: fully locked, return as-is
                        return existing;
                    }

                    const guessed = guessValueForField(field, scanIdentity);

                    return {
                        selector: field.selector,
                        label: field.label,
                        value: guessed,
                        type: field.type,
                        name: field.name,
                        id: field.id,
                        placeholder: field.placeholder,
                    };
                });
                setScannedFields(fieldsWithValues);
            } else {
                setScannedFields([]);
            }
        } catch (err) {
            const error = err as Error;
            console.error('[Fill-It] Scan failed:', error);
            setErrorMsg(error.message || 'Failed to scan the page.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleInject = async () => {
        setStatus('injecting');
        try {
            const tab = await getActiveTab();
            if (!tab?.id) throw new Error('Cannot find active tab.');
            if (settings.safeMode) {
                const confirmed = confirm('Are you sure you want to autofill these custom fields to this page?');
                if (!confirmed) { setStatus('idle'); return; }
            }

            const resolvedFields = scannedFields.map(f => ({
                selector: f.selector,
                value: f.value,
            }));

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: injectCustomFieldsData,
                args: [resolvedFields],
            });

            // Accurate log: record what was actually shown and injected
            const logData: Record<string, string> = {};
            scannedFields.forEach(f => { logData[f.label || f.selector] = f.value; });
            await logInjection(tab.url || 'Web Page', 'Scanned Form', logData);

            setStatus('done');
            setTimeout(() => setStatus('idle'), 1500);
        } catch (err) {
            const error = err as Error;
            console.error('[Fill-It] Inject failed:', error);
            setErrorMsg(error.message || 'Failed to inject data.');
            setStatus('error');
            setTimeout(() => { setStatus('idle'); setErrorMsg(null); }, 3000);
        }
    };

    // FIX QA #3: inject called OUTSIDE the setState callback, not inside it
    const handleFieldEdit = (idx: number, value: string) => {
        const selector = scannedFields[idx]?.selector;
        const label = scannedFields[idx]?.label || '';

        setScannedFields(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], value, isEdited: true };
            if (label.toLowerCase().includes('email')) {
                updated[idx].customDomain = value.includes('@') ? value.split('@')[1] : undefined;
            }
            return updated;
        });

        if (selector) injectSingleField(selector, value);
    };

    // Refresh a single field with fresh generated dummy data
    const handleRefreshField = (idx: number) => {
        const field = scannedFields[idx];
        if (!field) return;

        const freshId = generateIdentity(identity?.locale || settings.selectedLocale);
        const guessed = guessValueForField({
            label: field.label,
            type: field.type,
            name: field.name || '',
            id: field.id || '',
            placeholder: field.placeholder || '',
        }, freshId);

        let finalValue = guessed;
        let isStillEdited = false;

        // For email with a custom domain: preserve domain, update the username from fresh identity
        if (field.label.toLowerCase().includes('email') && field.customDomain) {
            const newUsername = freshId.email.split('@')[0];
            finalValue = `${newUsername}@${field.customDomain}`;
            isStillEdited = true;
        }

        setScannedFields(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], value: finalValue, isEdited: isStillEdited };
            return updated;
        });

        injectSingleField(field.selector, finalValue);
    };

    return {
        scannedFields,
        isScanning,
        status,
        errorMsg,
        handleScan,
        handleInject,
        handleFieldEdit,
        handleRefreshField,
    };
}
