# Privacy Policy for Fill-It Chrome Extension

**Effective Date**: July 30, 2026  
**Extension Name**: Fill-It (⚡ Smart Data Injection Extension)

---

## 1. Overview
**Fill-It** is a privacy-focused browser extension built for QA engineers and developers to test web forms using realistic, generated dummy data. We believe in total data privacy: **Fill-It operates 100% locally inside your browser**.

---

## 2. Information Collection and Use
- **Zero External Data Transmission**: Fill-It does **NOT** collect, log, transmit, or share any personal data, usage telemetry, browsing history, or analytics to external servers.
- **Local Dummy Generation**: All identity profiles (such as NIK, NPWP, names, phone numbers, and addresses) are generated client-side inside your browser using local locale-aware algorithms.
- **Privacy-Safe Dummy Data**: Sensitive Indonesian data fields are generated with non-colliding dummy structures (e.g. invalid province/date codes for NIK, reserved test ranges for bank accounts and phone numbers) to guarantee no collision with real individuals' data.

---

## 3. Extension Permissions Usage
Fill-It requests only the minimal set of browser permissions required for form auto-filling:

| Permission | Purpose |
|------------|---------|
| `storage` | Saves your custom identity profiles, field templates, settings, and local session logs inside your browser's `chrome.storage.local`. |
| `activeTab` | Reads the active tab's URL to distinguish login pages from registration pages when you click the Fill-It icon. |
| `scripting` | Executes the local form scanning and value injection script into the active page DOM when triggered by the user. |

---

## 4. Third-Party Access
Fill-It does **NOT** integrate with any third-party advertising, analytics, or tracking services. No data is ever sold, rented, or shared with third parties.

---

## 5. Changes to This Policy
Any updates to this Privacy Policy will be reflected directly in this document and published in the extension's official GitHub repository.

---

## 6. Contact & Source Code
Fill-It is an open-source project developed for academic research purposes.  
**GitHub Repository**: [https://github.com/deffryap/fill-it](https://github.com/deffryap/fill-it)
