# Fitur Chat AI Analisis Stok Keluar Masuk & Rekomendasi Pertanyaan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengintegrasikan fitur Chat AI Asisten Stok berbasis Google Gemini API ke dalam StokKita untuk menganalisis pergerakan barang keluar-masuk, rekomendasi restock, deteksi stok menipis/habis, serta menyediakan tombol pertanyaan populer (*FAQ chips*) yang siap diklik.

**Architecture:** 
1. Penyimpanan terpusat Gemini API Key dan model pilihan di `store.settings` (tersinkron ke Google Sheets tabel `SETTINGS`), di mana Admin mengonfigurasi dan Staf Gudang otomatis mewarisi akses.
2. Smart Data Context Injector yang menyaring dan merangkum transaksi mutasi barang masuk & keluar, saldo per gudang (dengan isolasi gudang bagi Staf), dan kartu stok menjadi data kontekstual ringkas (< 800 token) untuk `systemInstruction` Gemini.
3. Pemanggilan Client-side REST API Google Gemini (`gemini-2.5-flash` / `gemini-1.5-flash`) dengan dukungan *multi-turn conversational memory* (sliding window 6 pesan) serta fallback deterministik lokal saat API key belum diisi.
4. Antarmuka mandiri `route: 'aichat'` dengan FAQ chips interaktif, bubble chat responsif, parser markdown ringan, dan Floating Action Button (FAB) melayang di sudut layar.

**Tech Stack:** Google Apps Script (HTMLService V8, SpreadsheetApp), Vanilla JavaScript (Reactive State Store, Fetch REST API), CSS3 (Glassmorphism design tokens, CSS variables, Dark/Light Mode).

**Spec:** `docs/superpowers/specs/2026-11-03-ai-chat-stock-analysis-design.md`

---

## Global Constraints

- Tetap mempertahankan arsitektur single-bundle `index.html` dan `Kode.js` agar kompatibel penuh dengan Google Apps Script Web App.
- Tidak merusak struktur database Google Spreadsheet yang sudah berjalan (kolom transaksi, produk, gudang, dan log).
- Privasi & Keamanan: Gemini API Key hanya dapat diedit oleh peran `ADMIN`; peran `STAFF` mewarisi kunci secara read-only.
- Isolasi Data: Pengguna dengan peran `STAFF` hanya menerima analisis mutasi dan stok di gudang tugasnya (`currentUser.warehouse`), sedangkan `ADMIN` mencakup seluruh gudang.
- Kompatibel dengan mode mobile (touch-friendly, responsif, dan bebas overlap navigasi bawah).

---

## Review Focus

1. **Staf mengakses data di luar gudang tugasnya:** Diproteksi pada fungsi `buildInventoryContext()` yang mendeteksi `currentUser.role === 'STAFF'` dan memfilter produk serta transaksi hanya untuk `currentUser.warehouse`.
2. **API Key belum diisi atau kuota habis:** Sistem menyediakan fallback lokal deterministik yang langsung menghitung statistik mutasi barang masuk/keluar saat pengguna mengklik FAQ chips tanpa menimbulkan error JS.
3. **Penyusutan token payload konteks inventori:** Agregasi data inventori tidak mengirim raw baris transaksi mentah melainkan ringkasan terstruktur (Top 5 keluar, Top 5 masuk, barang habis, barang menipis, saldo per gudang).
4. **Multi-turn conversation memory overflow:** Riwayat obrolan dibatasi dengan sliding window maksimal 6 pesan terakhir (`role: 'user'` dan `role: 'model'`) agar hemat token dan responsif.
5. **Respons markdown Gemini yang mengandung tag HTML atau pemformatan tabel:** Parser markdown `formatAiMessage` meng-escape teks berbahaya terlebih dahulu sebelum mengonversi markdown bold, bullet, dan tabel secara aman.

---

### Task 1: Konfigurasi Gemini API Key & Pengaturan Terpusat di Settings

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html` (bagian `defaultData.settings`, `settingsPage`, modal edit pengaturan)
- Modify: `d:/PROJEK DIGITAL/Stokkita/Kode.js` (sinkronisasi tabel `SETTINGS` pada Google Sheets)

**Interfaces:**
- Consumes: `store.settings`
- Produces: `store.settings.geminiApiKey`, `store.settings.geminiModel`

- [ ] **Step 1: Daftarkan properti `geminiApiKey` dan `geminiModel` pada `defaultData.settings` di `index.html`**
  Menambahkan `geminiApiKey: ''` dan `geminiModel: 'gemini-2.5-flash'` pada inisialisasi default settings.
- [ ] **Step 2: Tambahkan field input Google Gemini API Key di `settingsPage()`**
  Menambahkan kartu pengaturan "Integrasi AI Google Gemini" di halaman pengaturan (khusus Admin):
  - Input teks password dengan toggle lihat/sembunyikan untuk API Key.
  - Dropdown pilihan model (`gemini-2.5-flash` [Rekomendasi - Cepat & Cerdas], `gemini-1.5-flash`).
  - Link panduan cepat untuk mendapatkan API Key gratis dari Google AI Studio (`https://aistudio.google.com/app/apikey`).
  - Tombol "Uji Koneksi API" untuk memvalidasi kunci.
- [ ] **Step 3: Sinkronkan field Gemini API Key pada `saveSettings` di `index.html` dan `Kode.js`**
  Memastikan nilai `geminiApiKey` dan `geminiModel` ikut dikirim dan disimpan ke baris tabel `SETTINGS` di Google Spreadsheet.
- [ ] **Step 4: Verifikasi penyimpanan settings**
  Jalankan pengujian simpan settings dan pastikan nilai tersimpan di `store.settings` dan `localStorage`.
- [ ] **Step 5: Commit perubahan Task 1**
  `git commit -m "feat(settings): add centralized Gemini API key and model configuration"`

---

### Task 2: Smart Data Context Aggregator & Fallback Deterministik Lokal

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html`

**Interfaces:**
- Consumes: `store.products`, `store.transactions`, `store.stockLedger`, `store.warehouses`, `state.currentUser`
- Produces: `buildInventoryContext(warehouseFilter)`, `runLocalInventoryAnalysis(chipId, warehouseFilter)`

- [ ] **Step 1: Implementasikan fungsi `buildInventoryContext(targetWarehouse)`**
  - Periksa peran pengguna: jika `state.currentUser?.role === 'STAFF'`, paksa `targetWarehouse = getStaffAssignedWarehouse()`.
  - Hitung total jenis barang aktif dan total fisik saldo unit di gudang target.
  - Saring daftar produk status "Habis" (saldo <= 0) dan "Menipis" (saldo <= min).
  - Agregasikan 30 hari terakhir: Top 5 barang keluar terbanyak (nama, SKU, qty keluar) dan Top 5 barang masuk terbanyak (nama, SKU, qty masuk).
  - Ambil 10 transaksi mutasi terakhir (tanggal, tipe IN/OUT, nama barang, qty, gudang).
  - Format menjadi string konteks padat dan terstruktur (< 800 kata).
- [ ] **Step 2: Implementasikan fungsi fallback `runLocalInventoryAnalysis(chipId, targetWarehouse)`**
  Menyediakan kalkulasi deterministik berbasis data lokal saat API key belum aktif:
  - `top-out`: Menghitung dan merender tabel 5 barang dengan pengeluaran tertinggi.
  - `top-in`: Menghitung dan merender tabel 5 barang dengan penerimaan tertinggi.
  - `low-stock`: Menampilkan daftar barang kritis beserta stok sisa vs batas minimum.
  - `stock-health`: Menghitung rasio kesehatan stok (total item aman vs menipis vs habis) dan saldo per gudang.
  - `recent-movements`: Menampilkan ringkasan mutasi transaksi terbaru.
- [ ] **Step 3: Verifikasi fungsi kalkulasi lokal & penyusun konteks**
  Uji dengan data inventori simulasi dan pastikan output berupa string markdown yang akurat dan bersih dari error.
- [ ] **Step 4: Commit perubahan Task 2**
  `git commit -m "feat(ai): implement smart inventory context builder and local deterministic fallback"`

---

### Task 3: Client-Side Google Gemini REST API Client (`callGeminiAPI`)

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html`

**Interfaces:**
- Consumes: `store.settings.geminiApiKey`, `store.settings.geminiModel`, `buildInventoryContext()`, `state.aiMessages`
- Produces: `callGeminiAPI(userQuery, options)`

- [ ] **Step 1: Implementasikan fungsi `callGeminiAPI(userQuery)`**
  - Periksa ketersediaan API key: jika kosong, alihkan ke `runLocalInventoryAnalysis` dengan pesan pendamping cara aktivasi Gemini.
  - Ambil konteks inventori via `buildInventoryContext()`.
  - Susun payload API Gemini v1beta:
    - `systemInstruction`: instruksi peran asisten inventori profesional StokKita + data konteks terkini.
    - `contents`: riwayat percakapan terkini (sliding window 6 pesan terakhir dari `state.aiMessages`) ditambah pertanyaan terbaru user.
    - `generationConfig`: `temperature: 0.3`, `maxOutputTokens: 1024`.
  - Panggil `fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey)` dengan timeout 20 detik.
  - Ekstrak teks balasan dari `candidates[0].content.parts[0].text`.
- [ ] **Step 2: Tangani error penolakan API & fallback model**
  - Jika model `gemini-2.5-flash` mengembalikan status 404/400 (model deprecated/not available), otomatis coba fallback ke `gemini-1.5-flash`.
  - Jika error 403 (Invalid API key), berikan pesan ramah bahwa API key salah atau belum diaktifkan di Google AI Studio.
  - Jika error 429 (Quota limit), sarankan menunggu beberapa saat atau gunakan analisis lokal.
- [ ] **Step 3: Uji simulasi pemanggilan API & error handling**
  Verifikasi aliran eksekusi baik saat API key valid, salah, maupun kosong.
- [ ] **Step 4: Commit perubahan Task 3**
  `git commit -m "feat(ai): integrate Google Gemini REST API client with multi-turn history and error handling"`

---

### Task 4: Antarmuka Halaman AI Chat (`aiChatPage`), FAQ Chips & Markdown Parser

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html` (sprite SVG icon, navigasi `navAdmin`/`navStaff`, router `renderContent`, styling CSS)

**Interfaces:**
- Consumes: `callGeminiAPI`, `runLocalInventoryAnalysis`, `state.aiMessages`, `state.aiLoading`
- Produces: `aiChatPage()`, `sendAiMessage()`, `clearAiChatHistory()`, `formatAiMarkdown()`

- [ ] **Step 1: Daftarkan icon `i-sparkles` dan route `aichat`**
  - Tambahkan simbol SVG `i-sparkles` pada `<svg class="sr-only">`.
  - Daftarkan `aichat` pada `navAdmin` (grup Ringkasan) dan `navStaff` (Menu Staf Gudang).
  - Daftarkan `routeMeta.aichat = ['Asisten AI Stok', 'Analisis cerdas mutasi barang masuk & keluar']`.
- [ ] **Step 2: Implementasikan parser markdown ringan `formatAiMarkdown(text)`**
  Mengonversi format teks dari Gemini secara aman:
  - Escape karakter HTML `<` dan `>`.
  - Konversi `**teks**` menjadi `<strong>teks</strong>`.
  - Konversi baris `- ` atau `* ` menjadi daftar bullet `<ul><li>...</li></ul>`.
  - Konversi sintaks tabel markdown `| header | header |` menjadi tabel HTML dengan class `table table-compact`.
  - Konversi baris baru menjadi `<br>`.
- [ ] **Step 3: Buat template dan render `aiChatPage()`**
  - Header: Status koneksi AI badge ("Gemini 2.5 Flash Aktif" / "Mode Offline Lokal"), tombol reset chat, dan tombol setel API Key cepat.
  - FAQ Chips Container: Kategori tab dan daftar chip siap klik:
    - 🏷️ *Barang Keluar Terbanyak (30 Hari)*
    - 📦 *Barang Baru Masuk Minggu Ini*
    - ⚠️ *Daftar Stok Menipis & Habis*
    - 💡 *Rekomendasi Restock Prioritas*
    - 🏢 *Perbandingan Perputaran Gudang*
    - 📋 *Ringkasan Kesehatan Stok Menyeluruh*
  - Message Stream: Area percakapan dengan scroll otomatis ke bawah, bubble user di sisi kanan, bubble AI di sisi kiri dengan avatar sparkles dan waktu pesan.
  - Typing Indicator: Animasi 3 titik berkedip (*pulsing dots*) saat `state.aiLoading === true`.
  - Chat Input Bar: Textarea auto-resize dengan placeholder "Tanyakan pergerakan stok atau klik rekomendasi di atas...", tombol kirim icon pesawat kertas, event listener `Enter` (dan `Shift+Enter` baris baru).
- [ ] **Step 4: Hubungkan event delegation dan interaktivitas**
  - Klik pada FAQ chip langsung memanggil `sendAiMessage(chipPrompt)`.
  - Tombol kirim membaca isi textarea dan memicu `sendAiMessage(userText)`.
  - Tombol bersihkan chat mereset `state.aiMessages = []`.
- [ ] **Step 5: Tambahkan CSS styling tema gelap & terang untuk AI Chat**
  Menyusun styling glassmorphism yang serasi dengan desain StokKita (CSS tokens `--bg-card`, `--ink-primary`, `--primary-500`, bubble border, scroll styling).
- [ ] **Step 6: Verifikasi interaktivitas chat di browser**
  Pastikan pengiriman pesan, pembaruan bubble, FAQ chips, dan pemformatan markdown berjalan lancar.
- [ ] **Step 7: Commit perubahan Task 4**
  `git commit -m "feat(ui): build AI chat interface with FAQ chips, markdown rendering, and interactive stream"`

---

### Task 5: Floating Action Button (FAB) & Mobile Responsiveness

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html`

**Interfaces:**
- Consumes: `state.route`, `navigate('aichat')`
- Produces: `#aiFloatingBtn` komponen melayang

- [ ] **Step 1: Tambahkan Floating Action Button (FAB) pada `#appShell`**
  - Elemen tombol melayang di pojok kanan bawah dengan icon sparkles pendar gradient.
  - Tooltip "Tanya AI Stok".
  - Saat diklik memanggil `navigate('aichat')`.
  - Tersembunyi otomatis jika pengguna sudah berada di halaman `aichat`.
- [ ] **Step 2: Optimasi responsivitas mobile (layar ponsel)**
  - Pastikan tombol input chat menempel rapi di atas bottom bar mobile tanpa menutupi navigasi.
  - Pastikan daftar FAQ chips dapat digeser mendatar (*horizontal swipeable*) dengan sentuhan jari.
  - Sediakan padding yang cukup saat keyboard virtual ponsel aktif.
- [ ] **Step 3: Verifikasi end-to-end fitur Chat AI**
  - Login sebagai Admin -> Buka Chat AI -> Klik FAQ chip -> Periksa jawaban analisis.
  - Buka pengaturan -> Konfigurasi Gemini API Key -> Uji koneksi.
  - Beralih Tema Gelap / Terang -> Periksa kontras bubble chat.
  - Login sebagai Staf Gudang -> Pastikan analisis hanya mengambil data gudang staf.
- [ ] **Step 4: Commit perubahan Task 5**
  `git commit -m "feat(ui): add AI floating action button and optimize mobile layout responsiveness"`

