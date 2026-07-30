# Fill-It ⚡

> **Smart Form Testing & Data Injection Extension — Auto-fill any web form with realistic, privacy-safe dummy data in one click.**

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-blue.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![React 19](https://img.shields.io/badge/React-19.2-61dafb.svg?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646cff.svg?style=flat-square)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-Academic_TA-green.svg?style=flat-square)](#-lisensi--license)

---

## 📌 Daftar Isi / Table of Contents
- [🇮🇩 Bahasa Indonesia](#-bahasa-indonesia)
  - [Fitur Utama](#-fitur-utama)
  - [Strategi Dummy Privacy-Safe](#-strategi-dummy-data-privacy-safe)
  - [Analisis Arsitektur Enterprise & Batasan Teknis](#-analisis-arsitektur-enterprise--batasan-teknis)
  - [Arsitektur Kode & Komponen](#-arsitektur-kode--komponen)
  - [Panduan Developer & Build](#-panduan-developer--build)
  - [Instalasi di Browser](#-instalasi-di-browser)
- [🇬🇧 English](#-english)
  - [Key Features](#-key-features)
  - [Privacy-Safe Dummy Strategy](#-privacy-safe-dummy-strategy)
  - [Enterprise Architecture Analysis & Technical Boundaries](#-enterprise-architecture-analysis--technical-boundaries)
  - [Architecture](#-architecture)
  - [Developer Setup](#-developer-setup)
- [🛡️ Keamanan & Lisensi](#%EF%B8%8F-keamanan--lisensi)

---

<a name="bahasa-indonesia"></a>
# 🇮🇩 Bahasa Indonesia

**Fill-It** adalah ekstensi browser berbasis Chrome Manifest V3 yang dirancang untuk **Software Quality Assurance (SQA) Engineers**, **Frontend Developers**, dan **Form Testers**. Ekstensi ini memindai kolom formulir web secara otomatis, memetakan konteks bisnis (seperti NIK, NPWP, Nomor KK, Rekening Bank, Tanggal Lahir, dll.), serta menginjeksikan data dummy yang valid secara struktur namun 100% aman dari data pribadi warga nyata.

---

## ✨ Fitur Utama

### 1. 🪄 Identity Profile Tab (Injeksi 1-Klik)
* **One-Click Fill It**: Memindai seluruh input di halaman aktif dan mengisinya secara atomik.
* **Deteksi Konteks Cerdas**: Mengidentifikasi kolom berdasarkan atribut (`id`, `name`, `placeholder`, `aria-label`, `data-testid`), pembungkus label (`<label>`, `<reg-form-item>`), dan hierarki kontainer parent.
* **Dukungan Kompleksitas UI Modern**: Penanganan khusus untuk komponen **PrimeNG / Angular** (`<p-calendar>`, `<p-dropdown>`, `<ui-input-date-2>`) termasuk pengiriman event kustom `ngModelChange`, simulasi keyboard, dan penanganan atribut `readonly`.
* **Deteksi Halaman Hibrida**: Otomatis membedakan mode **Login** (hanya menginjeksikan kredensial) dan mode **Registrasi** (menggenerasi profil identitas lengkap baru).

### 2. 🔍 Form Scanner Tab (Pindai, Edit & Injeksi)
* **Inspeksi Form Real-Time**: Menampilkan seluruh elemen input yang terdeteksi di halaman aktif dalam daftar interaktif.
* **Preservasi Per-Field**: Kolom yang diedit manual diberi lencana `Edited` agar nilainya tidak tertimpa saat pemindaian ulang.
* **Domain Email Kustom**: Mengingat domain email kustom (misal `@perusahaan.com`) dan hanya memperbarui username saat refresh identitas.

### 3. 🌐 Multi-Locale & Identitas Indonesia Lengkap
Mendukung 3 locale (`id_ID`, `en_SG`, `en_US`) dengan fokus khusus pada kelengkapan formulir regulasi Indonesia:
* **NIK (16 Digit)**: Diturunkan dari kode provinsi resmi 38 provinsi di Indonesia.
* **Nomor KK (16 Digit)**: Nomor Kartu Keluarga dengan akhiran anti-bentrokan data.
* **NPWP-16 & NPWP-15**: Mendukung format NPWP 16-digit (PMK 136/2023) dan format 15-digit terformat (`99.999.999.9-054.000`).
* **Rekening Bank Lokal**: Bank BCA, Mandiri, BNI, dan BRI dengan penomoran berstandar.
* **Alamat RT/RW**: Format alamat jalan lengkap dengan kelurahan, kecamatan, kota, provinsi, dan kode pos.

---

## 🛡️ Strategi Dummy Data Privacy-Safe

Semua generator data Indonesia menggunakan algoritma **Privacy-Safe & Anti-Collision** yang menjamin data lulus validasi format regulasi tetapi **tidak mungkin memaparkan data warga asli**:

| Kolom Identitas | Format / Struktur | Strategi Keamanan Privacy |
|-----------------|-------------------|---------------------------|
| **NIK** (16-Digit) | `[6-Digit Wilayah Valid][9999999999]` | Tanggal/Bulan `99` tidak mungkin ada pada kalender resmi Dukcapil. |
| **Nomor KK** (16-Digit) | `[6-Digit Wilayah Valid][8888888888]` | Suffix `8888888888` berbeda dari NIK untuk mencegah tabrakan data antar-kolom. |
| **NPWP-16** (16-Digit) | `[6-Digit Wilayah NIK][7777777777]` | Mengikuti aturan PMK 136/2023 (NPWP berbasis NIK) dengan suffix `7777777777`. |
| **No. Telepon** | `0811-xxxx`, `0812-xxxx`, `0857-xxxx` | Menggunakan awalan penyedia seluler resmi BRTI Indonesia. |
| **No. Rekening** | `999xxxxxxx` | Awalan `999` reserved sebagai nomor uji dummy internal perbankan. |

---

## 🔍 Analisis Arsitektur Enterprise & Batasan Teknis

Dalam evaluasi pengujian perangkat lunak (*Software Testing Boundary Analysis*), ekstensi ini berhasil 100% pada formulir berbasis React, Vue, HTML5 Native, Bootstrap, dan Formik. Namun, terdapat batasan teknis alami (*Technical Edge Case*) pada sistem tingkat enterprise berskala nasional seperti **Coretax DJP**:

1. **Enkapsulasi State Angular `ControlValueAccessor`**:
   Sistem seperti Coretax mengisolasi data input di dalam state privat Angular `FormGroup`. Elemen `<input>` fisik hanyalah lapisan tampilan visual (*display layer*) yang terkunci. Manipulasi teks DOM dari luar akan di-*rollback* oleh siklus *Angular Change Detection*.
2. **Chrome Extension Isolated World Security**:
   Berdasarkan spesifikasi Manifest V3, Content Script ekstensi berjalan di dunia terisolasi (*Isolated World*) sehingga tidak dapat mengubah instansi memori privat JavaScript di *Main World* tempat controller Coretax berada.
3. **Strict Validation & Event Masking**:
   Input tanggal pada Coretax mewajibkan pemicuan event internal dari picker kalender yang sah. Nilai masukan teks mentah akan dikosongkan kembali demi menjamin integritas data validasi pajak.

> **Kesimpulan Akademik**: Batasan ini menjadi poin analisis mendalam pada Laporan Tugas Akhir mengenai batas jangkauan otomasi ekstensi browser terhadap aplikasi web berarsitektur *Encapsulated Enterprise Micro-Frontend*.

---

## 🏗️ Arsitektur Kode & Komponen

Ekstensi dirancang dengan pemisahan tanggung jawab yang ketat (*Strict Separation of Concerns*):

```
TA/
├── public/
│   ├── manifest.json              # Manifest V3 Configuration (MV3)
│   └── icons/                     # Iconset Ekstensi (16px, 48px, 128px)
├── src/
│   ├── popup/                     # User Interface Popup Ekstensi
│   │   ├── Popup.tsx              # Main Orchestrator UI
│   │   ├── main.tsx               # Entry Point React
│   │   ├── components/
│   │   │   ├── IdentityProfileTab.tsx
│   │   │   ├── FormScannerTab.tsx
│   │   │   └── SessionPanel.tsx
│   │   ├── hooks/
│   │   │   ├── useIdentity.ts     # Custom Hook State Profil & Storage
│   │   │   └── useScanner.ts      # Custom Hook State Form Scanner
│   │   └── utils/
│   │       └── fieldGuesser.ts    # Penebak nilai konteks Popup
│   └── shared/                    # Shared Modules & Core Engine
│       ├── pageScripts.ts         # Script Injeksi Mandiri (DOM Browser Context)
│       ├── fakerService.ts        # Generator Data Dummy (@faker-js/faker)
│       ├── storageService.ts      # Layer Transaksi Storage & Validasi Skema
│       └── types.ts               # Interface & Type Definitions
├── vite.config.ts                 # Config Bundler Vite
└── package.json                   # Dependencies & Script Runners
```

> **Prinsip Utama Execution Injection**: Semua fungsi yang berjalan di dalam konteks tab halaman web (`pageScripts.ts`) bersifat **100% Self-Contained** tanpa modul eksternal agar aman diserialisasikan oleh Chrome Scripting API (`chrome.scripting.executeScript`).

---

## 🛠️ Panduan Developer & Build

### Prasyarat System
* **Node.js**: v18.0.0 atau lebih baru
* **npm**: v9.0.0 atau lebih baru
* **Browser**: Google Chrome atau Microsoft Edge berbasis Chromium

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menjalankan Server Development UI
Untuk melihat pratinjau antarmuka popup di browser:
```bash
npm run dev
```

### 3. Pengujian Unit Test (Vitest)
Menjalankan 26 unit test untuk validasi NIK, NPWP, Nomor KK, Nomor Telepon, dan Rekening Bank:
```bash
npm run test
```

### 4. Pemeriksaan Kode & Linter (ESLint)
```bash
npm run lint
```

### 5. Build Distrbusi Ekstensi
Kompilasi TypeScript dan bundel aset ke dalam direktori `dist/`:
```bash
npm run build
```

---

## 📦 Instalasi di Browser

Setelah melakukan build (`npm run build`):

1. Buka browser Chrome / Edge, lalu masuk ke alamat:
   ```text
   chrome://extensions/
   ```
2. Aktifkan **Developer mode** pada sakelar di pojok kanan atas.
3. Klik tombol **Load unpacked** (Muat ekstensi yang membuka kemasan).
4. Pilih folder **`dist/`** di dalam repositori proyek ini.
5. Klik ikon puzzle 🧩 pada toolbar browser dan pasang (**Pin**) ikon **Fill-It (F⚡)**.

---

<a name="english"></a>
# 🇬🇧 English

**Fill-It** is a Chrome Manifest V3 browser extension built for **QA Engineers**, **Frontend Developers**, and **Software Testers**. It automatically scans form inputs on any active web page, identifies business contexts (such as NIK, NPWP, Family Card Number, Bank Accounts, Birth Dates, etc.), and injects dummy data that is structurally valid yet 100% safe from real citizen data exposure.

---

## ✨ Key Features

* **One-Click Fill It**: Instantly scans and populates all detected form inputs atomically.
* **Smart Context Matching**: Resolves fields by inspecting 7 element attributes, label text (`<label>`, `<reg-form-item>`), and parent DOM hierarchy.
* **Complex UI Framework Support**: Built-in handlers for **PrimeNG / Angular** elements (`<p-calendar>`, `<p-dropdown>`, `<ui-input-date-2>`) with custom `ngModelChange` event triggers and keyboard simulation.
* **Privacy-Safe Dummy Strategy**: Generates structurally valid Indonesian identifiers using non-colliding dummy suffixes (NIK `9999999999`, KK `8888888888`, NPWP `7777777777`).
* **Session Recording & Export**: Track injection history across sessions and export logs to `.json` files.

---

## 🔍 Enterprise Architecture Analysis & Technical Boundaries

While Fill-It achieves 100% success on standard web forms (React, Vue, Native HTML5, Bootstrap, Formik), national enterprise systems like **Coretax DJP** showcase technical edge boundaries:

1. **Angular `ControlValueAccessor` State Encapsulation**: Enterprise forms encapsulate data in private Angular `FormGroup` states. Physical DOM inputs act solely as read-only display layers; external DOM text edits are rolled back by Angular Change Detection.
2. **Chrome Extension Isolated World Security**: Under Manifest V3, Content Scripts run in an Isolated World, preventing direct mutation of private Main World JavaScript instances.
3. **Strict Validation Masking**: Custom datepickers require internal calendar selection events. Raw string injections are cleared to maintain tax data integrity.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI Framework** | React 19 + TypeScript 5.9 |
| **Bundler & Build Tool** | Vite 7 + Rollup |
| **Styling** | Tailwind CSS 3.4 + PostCSS |
| **Dummy Generator** | `@faker-js/faker` v10 (locale-specific) |
| **Extension Platform** | Chrome Manifest V3 (`scripting`, `storage`, `activeTab`) |
| **Test Runner** | Vitest 4 |
| **Code Quality** | ESLint 9 + TypeScript-ESLint |

---

<a name="keamanan--lisensi"></a>
## 🛡️ Keamanan & Lisensi

* **Izin Minimum (Least Privilege)**: Ekstensi ini hanya meminta izin `activeTab`, `scripting`, dan `storage`.
* **Zero Telemetry**: Tidak ada data pengujian yang dikirim ke server eksternal; seluruh pemrosesan dan penyimpanan dilakukan secara lokal di perangkat pengguna.
* **Lisensi Akademik**: Proyek ini dikembangkan sebagai bagian dari Tugas Akhir. Data dummy yang dihasilkan murni diperuntukkan bagi pengujian perangkat lunak dan tidak dapat digunakan untuk transaksi atau keperluan ilegal.
