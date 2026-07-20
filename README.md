# Fill-It ⚡

> **Pengujian Form Cerdas — Deteksi, Buat Data & Injeksi Dalam Satu Klik**

[![Bahasa Indonesia](https://img.shields.io/badge/Bahasa-Indonesia-red?style=flat-square)](#bahasa-indonesia) [![English](https://img.shields.io/badge/Language-English-blue?style=flat-square)](#english)

---

<a name="bahasa-indonesia"></a>
# 🇮🇩 Bahasa Indonesia

Fill-It adalah ekstensi browser Chrome / Edge yang dirancang untuk QA engineer dan developer yang sering menguji formulir web. Ekstensi ini secara otomatis mendeteksi kolom input pada halaman aktif, menghasilkan data dummy realistis sesuai locale, dan menyuntikkannya secara instan — sehingga formulir yang kosong bisa terisi penuh dalam hitungan detik.

---

## ✨ Fitur Utama

### 🪄 Tab Identity Profile — Isi Otomatis Sekali Klik
- **Tombol Fill It**: Memindai halaman aktif, menebak nilai yang tepat untuk setiap kolom, dan menyuntikkan semua data dalam satu operasi.
- **Deteksi Kolom Cerdas**: Secara otomatis memetakan label, nama, ID, dan placeholder ke tipe data yang sesuai (nama, email, telepon, NIK, NPWP, rekening, tanggal lahir, jenis kelamin, agama, status perkawinan, nama ibu, nomor KK, dll.).
- **Deteksi Login vs. Pendaftaran**: Mendeteksi halaman login dari URL dan hanya mengisi `email/username` + `password`. Pada halaman registrasi, identitas baru yang lengkap digenerate secara otomatis.
- **Kartu Identitas yang Bisa Diedit**: Setiap kolom pada kartu profil dapat diedit langsung sebelum data diinjeksikan. Perubahan disimpan antar sesi.
- **Refresh Per-Kolom**: Buat ulang satu kolom identitas tanpa menghilangkan kolom lainnya.

### 🔍 Tab Form Scanner — Pindai, Edit & Injeksi
- **Pindai Form**: Menemukan semua input yang terlihat di halaman dan menampilkannya beserta nilai dugaan di dalam popup.
- **Edit Sebelum Injeksi**: Ubah nilai kolom mana saja sebelum dikirim ke halaman. Kolom yang diedit dikunci dengan lencana `Edited` agar bertahan saat pindai ulang.
- **Penyimpanan Domain Email Kustom**: Jika Anda mengetik domain email kustom (misal `@perusahaan.com`), domain tersebut diingat dan hanya bagian username yang diperbarui saat refresh.
- **Sinkronisasi Real-Time**: Mengedit nilai di scanner langsung tercermin di halaman web tanpa perlu klik Inject.
- **Inject Custom Data**: Mengirimkan semua nilai (yang mungkin sudah diedit) ke halaman dalam satu klik.

### 🌐 Dukungan Multi-Locale
| Bendera | Locale | Kolom Khusus |
|---------|--------|--------------|
| 🇮🇩 | Indonesian (ID) | NIK, NPWP, rekening bank lokal, format telepon Indonesia |
| 🇸🇬 | Singapore (SG) | — |
| 🇺🇸 | American (US) | — |

### 🛡️ Perlindungan Data Dummy Mutlak
Semua data sensitif Indonesia di-generate agar **valid secara struktur namun dijamin palsu**, sehingga tidak pernah bertabrakan dengan data warga nyata:

| Kolom | Strategi Dummy |
|-------|----------------|
| **No. Telepon** | Awalan `0800-xxxx` (nomor bebas pulsa, tidak dialokasikan untuk pelanggan seluler aktif) |
| **NIK** (16 digit) | Kode provinsi `99` (tidak ada di Dukcapil) |
| **NPWP** (15 digit) | Kategori wajib pajak `00`, akhiran `.000` |
| **Nomor Rekening** | Awalan `999` (nomor cadangan internal bank, bukan untuk nasabah aktif) |

### 🎛️ Pengaturan
| Pengaturan | Keterangan |
|------------|------------|
| **Safe Mode** | Menampilkan dialog konfirmasi sebelum injeksi dilakukan (toggle ON/OFF) |
| **Auto-Submit** | Otomatis mengklik tombol submit setelah Fill It berhasil (toggle ON/OFF) |

### 📋 Perekaman Sesi & Ekspor Log
- Mulai sesi perekaman untuk memantau setiap injeksi: halaman apa, data apa, dan kapan.
- Ekspor log sesi sebagai file `.json` untuk laporan QA atau audit.

### 📑 Template Kolom Kustom
- Simpan template bernama yang memetakan CSS selector tertentu ke kategori Faker.js.
- Aktifkan template untuk menerapkan override kolom tetap di atas hasil deteksi otomatis.

---

## 🏗️ Arsitektur

Ekstensi ini dibangun dengan **arsitektur modular yang bersih** — logika dipisahkan berdasarkan tanggung jawab agar setiap file tetap terfokus dan mudah diuji.

```
src/
├── popup/
│   ├── Popup.tsx                     # Orkestrator utama (~185 baris)
│   │
│   ├── components/
│   │   ├── IdentityProfileTab.tsx    # UI tab profil + tombol Fill It
│   │   ├── FormScannerTab.tsx        # UI tab scanner + daftar kolom
│   │   └── SessionPanel.tsx          # Kontrol perekaman sesi
│   │
│   ├── hooks/
│   │   ├── useIdentity.ts            # State identitas & pengaturan
│   │   └── useScanner.ts             # State kolom terpindai + logika injeksi
│   │
│   └── utils/
│       └── fieldGuesser.ts           # Penebak nilai kolom (konteks popup)
│
└── shared/
    ├── pageScripts.ts                # Script mandiri untuk konteks halaman
    │                                 # (diinjeksikan via chrome.scripting.executeScript)
    │                                 #   • scanPageForm()
    │                                 #   • injectAndFill()          ← Tab Identity Profile
    │                                 #   • injectCustomFieldsData() ← Tab Form Scanner
    │                                 #   • injectLoginFields()
    ├── fakerService.ts               # Generator data berbasis locale
    ├── storageService.ts             # Abstraksi Chrome storage
    └── types.ts                      # Interface TypeScript bersama
```

> **Prinsip desain utama**: Semua kode yang berjalan di dalam halaman browser (`pageScripts.ts`) bersifat *self-contained* — tanpa import, tanpa closure — sehingga dapat diserialisasi dan diinjeksikan dengan aman oleh Chrome Scripting API. Fungsi `guess()` adalah satu-satunya sumber kebenaran untuk pencocokan kolom di kedua tab.

---

## 🛠️ Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| UI Framework | React 19 + TypeScript (TSX) |
| Build Tool | Vite 7 + Rollup |
| Styling | Tailwind CSS 3 + PostCSS |
| Generator Data | `@faker-js/faker` v10 (locale-spesifik) |
| Extension API | Chrome Manifest V3 (`scripting`, `storage`, `activeTab`) |
| Test Runner | Vitest |
| Linter | ESLint 9 + typescript-eslint |

---

## 🚀 Memulai (Panduan Developer)

### Prasyarat
- Node.js ≥ 18
- npm ≥ 9
- Google Chrome atau Microsoft Edge (berbasis Chromium)

### 1. Instal Dependensi
```bash
npm install
```

### 2. Jalankan Development Server
Pratinjau UI popup di browser dengan hot-reload:
```bash
npm run dev
```

### 3. Jalankan Unit Test
Verifikasi generator data dummy (NIK, NPWP, telepon, rekening):
```bash
npm run test
```

### 4. Jalankan Linter
Periksa error TypeScript dan ESLint:
```bash
npm run lint
```

### 5. Build Ekstensi
Kompilasi TypeScript dan bundling semua aset ke folder `dist/`:
```bash
npm run build
```

---

## 📦 Pemasangan Ekstensi di Chrome

Setelah build berhasil (`npm run build`):

1. Buka Chrome atau Edge, navigasi ke `chrome://extensions/`
2. Aktifkan **Developer mode** (toggle di sudut kanan atas)
3. Klik **Load unpacked**
4. Pilih folder **`dist/`** di root project
5. Ikon **Fill-It** akan muncul di toolbar browser — klik untuk membuka popup

> **Setelah setiap perubahan kode**, jalankan ulang `npm run build` lalu klik ikon **↺ refresh** di samping Fill-It pada halaman ekstensi.

---

## 🧪 Pengujian dengan Sandbox

Project ini menyertakan file [`sandbox.html`](./sandbox.html) berisi formulir pendaftaran lengkap berlocale Indonesia (termasuk kolom NIK, NPWP, KK, tanggal lahir, jenis kelamin, agama, status perkawinan, rekening bank, dan dropdown bergaya PrimeNG).

Buka di browser untuk menguji injeksi Fill-It tanpa perlu server:
- **Klik dua kali** `sandbox.html` untuk membukanya sebagai file lokal, atau
- Jalankan `npm run dev` dan navigasi ke route sandbox

---

## 🔒 Izin Ekstensi

Fill-It hanya meminta izin minimum yang diperlukan:

| Izin | Alasan |
|------|--------|
| `activeTab` | Membaca URL tab aktif untuk mendeteksi halaman login vs. pendaftaran |
| `scripting` | Menginjeksikan form scanner dan value injector ke halaman aktif |
| `storage` | Menyimpan profil identitas, template, pengaturan, dan log sesi antar buka popup |

---

## 📄 Lisensi

Project ini dikembangkan sebagai karya Tugas Akhir. Seluruh data dummy bersifat non-fungsional dan tidak dapat digunakan untuk tujuan penipuan, pencurian identitas, atau keperluan ilegal apapun.

---
---

<a name="english"></a>
# 🇬🇧 English

Fill-It is a Chrome / Edge browser extension built for QA engineers and developers who test web forms regularly. It automatically detects form fields on any page, generates realistic locale-specific dummy data, and injects it instantly — so you can go from blank form to fully filled in under a second.

---

## ✨ Features

### 🪄 Identity Profile Tab — One-Shot Fill
- **Fill It button**: Scans the active page, guesses the correct value for each field, and injects everything in a single atomic operation.
- **Smart Field Detection**: Automatically maps labels, names, IDs, and placeholders to the correct data type (name, email, phone, NIK, NPWP, bank account, birth date, gender, religion, marital status, mother's name, family card number, etc.).
- **Login vs. Registration awareness**: Detects login pages from the URL and only fills `email/username` + `password`. On registration pages, a full fresh identity is generated.
- **Editable Identity Card**: Every field in the profile card is directly editable inline before injecting. Changes are persisted across sessions.
- **Per-field Refresh**: Regenerate any individual identity field without losing the rest.

### 🔍 Form Scanner Tab — Inspect, Edit & Inject
- **Scan Form**: Discovers all visible inputs on the current page and lists them with their guessed values inside the popup.
- **Edit before inject**: Modify any field value before it is sent to the page. Edited fields are locked with an `Edited` badge so they survive re-scans and identity refreshes.
- **Email domain preservation**: If you manually type a custom email domain (e.g. `@perusahaan.com`), the domain is remembered and only the username is regenerated on refresh.
- **Real-time sync**: Editing a value in the scanner immediately reflects in the live page without needing to click Inject.
- **Inject Custom Data**: Sends all (possibly edited) values back to the page in one shot.

### 🌐 Multi-Locale Support
| Flag | Locale | Special Fields |
|------|--------|----------------|
| 🇮🇩 | Indonesian (ID) | NIK, NPWP, Indonesian bank account, local phone format |
| 🇸🇬 | Singapore (SG) | — |
| 🇺🇸 | American (US) | — |

### 🛡️ Strict Dummy Data Protection
All sensitive Indonesian data is generated to be **structurally valid but guaranteed fake**, so it can never collide with real citizens' data:

| Field | Dummy Strategy |
|-------|---------------|
| **Phone** | Prefix `0800-xxxx` (toll-free range, not assigned to mobile subscribers) |
| **NIK** (16 digits) | Province code `99` (non-existent in Dukcapil) |
| **NPWP** (15 digits) | Taxpayer category `00`, suffix `.000` |
| **Bank Account** | Prefix `999` (internal reserve range, not issued to customers) |

### 🎛️ Settings
| Setting | Description |
|---------|-------------|
| **Safe Mode** | Shows a confirmation dialog before any injection (toggle ON/OFF) |
| **Auto-Submit** | Automatically clicks the submit button after a successful Fill It injection (toggle ON/OFF) |

### 📋 Session Recording & Export
- Start a recording session to track every injection: which page, which data, at what time.
- Export the session log as a `.json` file for QA reports or audit trails.

### 📑 Custom Field Templates
- Save named templates that map specific CSS selectors to Faker.js categories.
- Activate a template to apply fixed field overrides on top of the auto-detected fill.

---

## 🏗️ Architecture

The extension is built with a **clean modular architecture** — logic is separated by responsibility so each file stays focused and testable.

```
src/
├── popup/
│   ├── Popup.tsx                     # Main orchestrator (~185 lines)
│   │
│   ├── components/
│   │   ├── IdentityProfileTab.tsx    # Profile tab UI + Fill It button
│   │   ├── FormScannerTab.tsx        # Scanner tab UI + field list
│   │   └── SessionPanel.tsx          # Session recording controls
│   │
│   ├── hooks/
│   │   ├── useIdentity.ts            # Identity & settings state
│   │   └── useScanner.ts             # Scanned fields state + injection logic
│   │
│   └── utils/
│       └── fieldGuesser.ts           # Popup-context field value guesser
│
└── shared/
    ├── pageScripts.ts                # Self-contained page-context scripts
    │                                 # (injected via chrome.scripting.executeScript)
    │                                 #   • scanPageForm()
    │                                 #   • injectAndFill()          ← Identity Profile tab
    │                                 #   • injectCustomFieldsData() ← Form Scanner tab
    │                                 #   • injectLoginFields()
    ├── fakerService.ts               # Locale-aware data generators
    ├── storageService.ts             # Chrome storage abstraction layer
    └── types.ts                      # Shared TypeScript interfaces
```

> **Key design principle**: All code that runs inside the browser page (`pageScripts.ts`) is completely self-contained — no imports, no closures — so it can be safely serialized and injected by Chrome's Scripting API. The single `guess()` function is the canonical source of truth for field matching in both tabs.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript (TSX) |
| Build Tool | Vite 7 + Rollup |
| Styling | Tailwind CSS 3 + PostCSS |
| Data Generation | `@faker-js/faker` v10 (locale-specific) |
| Extension API | Chrome Manifest V3 (`scripting`, `storage`, `activeTab`) |
| Test Runner | Vitest |
| Linter | ESLint 9 + typescript-eslint |

---

## 🚀 Getting Started (Developer Guide)

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- Google Chrome or Microsoft Edge (Chromium-based)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
Preview the popup UI in the browser with hot-reload:
```bash
npm run dev
```

### 3. Run Unit Tests
Verify the dummy data generators (NIK, NPWP, phone, bank account):
```bash
npm run test
```

### 4. Lint the Code
Check for TypeScript and ESLint errors:
```bash
npm run lint
```

### 5. Build the Extension
Compile TypeScript and bundle all assets into the `dist/` folder:
```bash
npm run build
```

---

## 📦 Installing the Extension in Chrome

After a successful build (`npm run build`):

1. Open Chrome or Edge and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the **`dist/`** folder in the project root
5. The **Fill-It** icon will appear in your browser toolbar — click it to open the popup

> **After any code change**, re-run `npm run build` and then click the **↺ refresh** icon next to Fill-It on the extensions page.

---

## 🧪 Testing with the Sandbox

The project includes a [`sandbox.html`](./sandbox.html) file with a complete Indonesian-locale registration form (including NIK, NPWP, family card, date of birth, gender, religion, marital status, bank account fields, and PrimeNG-style dropdowns).

Open it in your browser to test Fill-It injection without needing a live server:
- **Double-click** `sandbox.html` to open it as a local file, or
- Serve it locally with `npm run dev` and navigate to the sandbox route

---

## 🔒 Extension Permissions

Fill-It requests the minimum set of permissions required:

| Permission | Why it's needed |
|-----------|-----------------| 
| `activeTab` | Read the URL of the current tab to detect login vs. registration pages |
| `scripting` | Inject the form scanner and value injector into the active page |
| `storage` | Persist the identity profile, templates, settings, and session logs between popup opens |

---

## 📄 License

This project is developed as a Final Assignment (*Tugas Akhir*) submission. All dummy data is strictly non-functional and cannot be used for any fraudulent, identity-theft, or illegal purposes.
