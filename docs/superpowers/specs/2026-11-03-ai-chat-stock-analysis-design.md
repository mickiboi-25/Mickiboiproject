# Design Document: Fitur Chat AI Analisis Stok Keluar Masuk & Rekomendasi Pertanyaan (Google Gemini API)

**Tanggal:** 2026-11-04  
**Status:** Approved & Finalized  
**Target Modul:** `index.html`, `Kode.js` (Settings sync), SPA Navigation & Reactive State Store  

---

## 1. Intent & The Why

Pengguna StokKita (baik Administrator maupun Staf Gudang) setiap hari membutuhkan informasi cepat mengenai kondisi stok: barang apa yang paling cepat habis, barang apa yang baru diterima dari pemasok, perbandingan pengeluaran antar gudang, serta estimasi restock. Saat ini, pengguna harus membuka tab laporan atau kartu stok dan menghitung sendiri.

Dengan adanya **Chat AI Asisten Stok**, pengguna dapat berinteraksi langsung menggunakan bahasa alami untuk menganalisis data keluar masuk barang secara instan. Fitur ini dilengkapi dengan **Pintasan Pertanyaan Populer (FAQ Chips)** agar pengguna tidak perlu bingung mengetik prompt dari nol, cukup satu klik untuk mendapatkan laporan analisis menyeluruh.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **Antarmuka Chat AI yang Elegan & Intuitif**: Menu mandiri di navigasi sidebar (`route: 'aichat'`) serta tombol Floating Action Button (FAB) melayang di sudut kanan bawah yang memudahkan navigasi instan ke ruang asisten AI.
- **Rekomendasi Pertanyaan Sering Ditanyakan (FAQ Chips)**: Tombol prompt instan yang dikelompokkan secara tematik (Analisis Keluar, Analisis Masuk, Peringatan Stok & Restock, Evaluasi Gudang).
- **Integrasi Google Gemini API Terpusat**: Menggunakan model generatif cepat dan efisien (`gemini-2.5-flash` dengan fallback `gemini-1.5-flash`) via Client-side REST API langsung dari browser.
- **Manajemen API Key Terpusat (Admin-Controlled)**: API Key diatur oleh Admin melalui tab Pengaturan (`store.settings.geminiApiKey`) dan tersinkron ke Google Sheets tabel `SETTINGS`. Seluruh staf gudang otomatis mewarisi kunci ini tanpa harus membuat akun Google AI Studio masing-masing.
- **Isolasi Data Berbasis Peran Gudang**:
  - Untuk peran **STAFF**: `buildInventoryContext()` memfilter data transaksi, stok, dan mutasi khusus untuk gudang tugasnya (`currentUser.warehouse`).
  - Untuk peran **ADMIN**: Analisis mencakup seluruh gudang secara global.
- **Percakapan Bersambung (Multi-Turn Chat)**: Mendukung pertanyaan lanjutan dengan menyertakan riwayat percakapan terkini (*sliding window* 6 pesan terakhir) serta `systemInstruction` terstruktur.
- **Smart Data Context Injector**: Modul penyusun ringkasan inventori otomatis yang merangkum data mutasi riwayat (`store.transactions`), kartu stok (`store.stockLedger`), produk menipis/habis (`store.products`), dan gudang (`store.warehouses`) ke dalam payload prompt secara ringkas dan faktual.
- **Fallback Cerdas Tanpa API Key**: Jika pengguna belum memiliki API key, bot menampilkan statistik ringkas inventori dan mampu menjawab pertanyaan FAQ chip menggunakan kalkulasi komputasi lokal deterministik.
- **Dukungan Mobile & Tema**: Tampilan chat responsif di layar ponsel (keyboard friendly) serta mendukung tema Dark Mode & Light Mode bawaan StokKita.

### Non-Goals
- Chat AI tidak melakukan operasi penulisan/modifikasi data (Write/Update/Delete) ke database inventori secara otomatis tanpa konfirmasi pengguna. Perannya murni analitis, pelaporan, dan rekomendasi (*Read-Only Assistant*).
- Tidak mengirim data sensitif non-inventori (seperti hash password pengguna atau riwayat login) ke payload Gemini.

### Anti-Goals
- Tidak membebani browser dengan mengirimkan seluruh baris database mentah (ribuan baris) ke API. Data harus diagregasikan terlebih dahulu menjadi ringkasan statistik yang padat dan informatif.
- Tidak menghasilkan jawaban spekulatif/halusinasi; instruksi sistem Gemini wajib membatasi jawaban hanya pada data inventori yang diberikan.

---

## 3. Approaches & Tradeoffs

Dalam proses perancangan, 2 pendekatan arsitektur telah dipertimbangkan:

| Aspek | Opsi 1: Direct Client-Side Gemini API (Dipilih) | Opsi 2: Backend Relay GAS (`UrlFetchApp`) |
|---|---|---|
| **Kecepatan Respons** | Sangat cepat & instan (langsung browser ke Google AI) | Lebih lambat (+ jembatan eksekusi Google Apps Script) |
| **Beban Kuota Server** | 0 kuota server GAS (menggunakan kuota API Gemini langsung) | Mengurangi kuota harian `UrlFetchApp` akun Google |
| **Kemandirian Aplikasi** | Berjalan sempurna baik di Apps Script maupun saat dibuka mandiri | Terikat dengan runtime Apps Script Web App |
| **Keamanan Kunci** | Disimpan di settings/localStorage & Google Sheets | Tersembunyi di sisi server backend |
| **Kemampuan Fallback** | Bisa fallback ke kalkulasi analitik lokal secara fleksibel | Sulit jika koneksi backend timeout |

**Pilihan:** Pengguna memilih **Opsi 1** dengan pengelolaan terpusat oleh Admin.

---

## 4. Architectural & Functional Specification

### 4.1. Navigation & State Model
- **Route Baru**: `aichat`
  - Tambahkan ke `navAdmin` (grup Ringkasan/Inventori) dan `navStaff` (Menu Staf Gudang).
  - Judul di `routeMeta`: `aichat: ['Asisten AI Stok', 'Analisis cerdas mutasi barang masuk & keluar']`.
  - Icon: SVG icon khusus `i-sparkles` di sprite SVG.
- **Floating Action Button (FAB)**:
  - Tombol melayang di pojok kanan bawah dengan icon AI berpendar/gradien elegan.
  - Memiliki badge status (online/ready) dan tooltip interaktif "Tanya AI Stok".
  - Saat diklik memanggil `navigate('aichat')`.
- **State Properties**:
  ```javascript
  state.aiMessages = [
    // { id, role: 'user'|'model', text, timestamp }
  ];
  state.aiLoading = false;
  state.aiCategoryFilter = 'all';
  ```
- **Settings Store**:
  - `store.settings.geminiApiKey`: string API Key organisasi.
  - `store.settings.geminiModel`: default `'gemini-2.5-flash'` (dengan fallback otomatis `'gemini-1.5-flash'`).

### 4.2. Pintasan Pertanyaan Populer (FAQ Chips)
Disediakan daftar pertanyaan siap klik yang dibagi dalam kategori praktis:
1. **Analisis Barang Keluar**:
   - *"Barang apa yang paling banyak keluar dalam 30 hari terakhir?"*
   - *"Siapa customer / tujuan penerima barang terbanyak?"*
   - *"Bagaimana tren barang keluar minggu ini?"*
2. **Analisis Barang Masuk**:
   - *"Barang apa saja yang baru masuk minggu ini?"*
   - *"Berapa total volume unit barang masuk per gudang?"*
   - *"Pemasok/supplier mana yang paling sering memasok barang?"*
3. **Peringatan & Restock**:
   - *"Barang apa saja yang stoknya menipis (di bawah batas minimum) atau habis?"*
   - *"Rekomendasikan barang yang harus segera dipesan ulang (restock)!"*
   - *"Apakah ada barang lambat bergerak (slow-moving/dead stock)?"*
4. **Ringkasan Operasional**:
   - *"Beri saya ringkasan eksekutif mutasi keluar-masuk barang saat ini."*
   - *"Apakah ada catatan barang rusak atau penyesuaian opname terbaru?"*

### 4.3. Smart Data Context Injector (`buildInventoryContext()`)
Modul ini menyusun ringkasan inventori berbasis hak akses pengguna:
- **Filtering Per Gudang**:
  - Jika `currentUser.role === 'STAFF'`, lingkup data otomatis dibatasi ke `currentUser.warehouse`.
  - Jika Admin, menyajikan ringkasan global dan perbandingan antar gudang.
- **Isi Konteks Agregat**:
  - Ringkasan total SKU, total kuantitas stok saat ini.
  - Daftar produk dengan status Habis (saldo 0) dan Menipis (saldo <= min).
  - Top 5 produk dengan akumulasi kuantitas keluar tertinggi.
  - Top 5 produk dengan akumulasi kuantitas masuk tertinggi.
  - 10 transaksi mutasi terakhir (tanggal, tipe IN/OUT, nama produk, qty, gudang).
- **System Instruction Prompt**:
  - Menginstruksikan Gemini untuk bertindak sebagai Analis Inventori Profesional StokKita.
  - Menjawab dengan bahasa Indonesia yang jelas, faktual, ramah, dan terstruktur (markdown bold, bullet points, tabel ringkas jika relevan).
  - Dilarang keras berasumsi atau membuat angka fiktif di luar konteks data yang diberikan.

### 4.4. Gemini REST API Handler (`callGeminiAPI(userQuery)`)
- **Multi-Turn Handling**:
  - `systemInstruction`: Berisi prompt peran dan ringkasan data inventori terkini (`buildInventoryContext()`).
  - `contents`: Array riwayat pesan terkini (maksimal 6 pesan terakhir untuk efisiensi token) + pesan terbaru user.
- **Request Endpoint**:
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
- **Fallback Deterministik Lokal**:
  - Jika API Key belum diisi, bot tetap menjawab FAQ chips populer dengan melakukan kalkulasi array langsung dari `store.transactions` dan `store.products`, disertai notifikasi ramah untuk menambahkan API Key di pengaturan agar dapat menjawab pertanyaan bebas.

### 4.5. Antarmuka UI (`aiChatPage()`)
- **Chat Header**:
  - Informasi model AI & status koneksi (Terhubung / Belum Terkonfigurasi).
  - Tombol konfigurasi API Key (khusus Admin membuka modal setting, staf menampilkan status).
  - Tombol bersihkan chat (*Clear History*).
- **FAQ Chips Carousel**:
  - Pill buttons yang rapi dan mudah digeser di layar sentuh ponsel.
- **Message Stream**:
  - Bubble chat user (kanan, aksen warna primer) dan bubble AI (kiri, card background dengan icon sparkles).
  - Markdown parser ringan bawaan (bold, list, table, line break).
  - Typing indicator animasi saat API sedang memproses.
- **Input Area**:
  - Textarea responsif dengan tombol kirim dan dukungan `Enter` to send.

---

## 5. What's Left to the Builder
- Visual styling CSS tokens yang rapi selaras dengan glassmorphism dark & light mode StokKita.
- Format Markdown parser sederhana di bubble chat.
- Sinkronisasi kolom `geminiApiKey` di modal Pengaturan Admin.
