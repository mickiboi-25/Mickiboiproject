# Upgrade Fitur StokKita: Kamera Bebas Sandbox, Kartu Stok, Dead Stock Report & Top Out Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengupgrade aplikasi StokKita dengan kamera popup mandiri (bebas batasan sandbox Apps Script), menu mandiri Kartu Stok, modul laporan Slow Moving / Dead Stock, dan peningkatan visualisasi produk paling banyak keluar di dashboard.

**Architecture:** 
1. Menggunakan arsitektur top-level window injection (`window.open` + `document.write` / `Blob URL`) dengan dual-channel listener (`postMessage` + `localStorage` fallback) untuk bypass sandbox permission kamera di GAS.
2. Menambahkan route `stockcard` pada SPA state router dan menu navigasi untuk menyajikan buku besar mutasi per barang dengan filter gudang dan rentang waktu.
3. Menambahkan analisis perputaran barang di Pusat Laporan (`reports`) berbasis riwayat transaksi keluar untuk mendeteksi barang lambat bergerak dan aset mengendap.
4. Menyempurnakan widget agregasi keluar di dashboard agar sinkron dengan periode filter waktu.

**Tech Stack:** Google Apps Script (HTMLService V8, clasp), Vanilla JavaScript (SPA Reactive State Store), CSS3 (Modern Glassmorphism Design Tokens).

---

## Global Constraints
- Tetap mempertahankan arsitektur single-bundle `index.html` dan `Kode.js` agar kompatibel penuh dengan Google Apps Script Web App.
- Tidak merusak struktur database Google Spreadsheet yang sudah berjalan (kolom transaksi, produk, gudang, dan log).
- Kompatibel dengan mode mobile (touch-friendly, responsif, dan bebas error popup/izin kamera di browser ponsel).

## Review Focus
1. Izin kamera popup di ponsel diblokir popup blocker jika tidak dipicu langsung oleh gesture klik pengguna.
2. Referensi `window.opener` terputus di Safari iOS / browser seluler tertentu -> ditangani oleh `localStorage` polling fallback.
3. Transaksi tanpa detail array (`t.details` kosong/format lama) pada perhitungan barang keluar -> ditangani dengan fallback ke properti transaksi langsung (`t.qty`, `t.product`, `t.productId`).
4. Produk baru yang belum pernah memiliki transaksi mutasi di buku besar kartu stok -> menampilkan saldo awal dan riwayat kosong secara elegan tanpa error NaN/undefined.
5. Filter periode tanggal di kartu stok dan laporan slow moving menangani parsing format tanggal lokal Indonesia (`DD/MM/YYYY`, `YYYY-MM-DD`, maupun ISO string) dengan konsisten.

---

### Task 1: Integrasi Modul Kamera Bebas Sandbox (Popup Mandiri & Dual-Channel)

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html` (bagian photo attachment handler & popup camera generator)

**Interfaces:**
- Consumes: `mergedOpts` dari `renderPhotoAttachmentInner`, `state.activeCameraTarget`
- Produces: `openCameraTab(targetKey, containerId)`, event handler `message` & polling `localStorage`

- [ ] **Step 1: Definisikan fungsi generator template kamera mandiri `createCameraPopupHTML(targetOrigin, storageKey, targetKey)`**
  Menyusun HTML lengkap kamera dengan video preview, switch camera depan/belakang (`facingMode`), capture canvas ke JPEG Base64 (maks lebar 1280px, kompresi 0.82), retake, dan tombol kirim.
- [ ] **Step 2: Implementasikan `openCameraTab(targetKey, containerId)` dengan `window.open` dan fallback Blob URL**
  Menangani pembukaan popup saat tombol "Ambil Foto (Kamera)" diklik, melakukan injeksi dokumen, dan mengaktifkan polling fallback.
- [ ] **Step 3: Implementasikan listener `window.addEventListener('message')` dan `startCameraPolling()`**
  Menerima payload foto `{ type: 'CAMERA_PHOTO_RESULT', photoId, imageBase64, targetKey }`, memperbarui `state[targetKey]`, dan memperbarui tampilan container lampiran foto.
- [ ] **Step 4: Hubungkan trigger kamera di semua form modal**
  Perbarui tombol ambil foto pada: Barang Masuk (`txCameraInput`), Barang Keluar, Barang Rusak (`damagedPhoto`), Transfer Gudang (`transferPhoto`), dan Master Produk (`productPhoto`).
- [ ] **Step 5: Verifikasi interaksi kamera**
  Pastikan pembukaan popup, penutupan otomatis setelah pilih foto, dan pembaruan thumbnail foto di form berjalan tanpa kendala.

---

### Task 2: Halaman & Menu Mandiri Kartu Stok (`route: 'stockcard'`)

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html` (navigasi, state router, fungsi `stockCardPage`, event delegation)

**Interfaces:**
- Consumes: `store.products`, `store.warehouses`, `store.stockLedger`, `store.transactions`
- Produces: Halaman `stockCardPage()`, pencarian produk realtime, filter mutasi per gudang & rentang tanggal, fungsi cetak kartu stok

- [ ] **Step 1: Daftarkan route `stockcard` pada navigasi `navAdmin` dan `navStaff`**
  Tambahkan item menu `{ id: 'stockcard', label: 'Kartu Stok', icon: 'clipboard' }` pada group 'Inventori' dan metadata `routeMeta.stockcard = ['Kartu Stok', 'Buku mutasi pergerakan barang']`.
- [ ] **Step 2: Buat fungsi render utama `stockCardPage()`**
  Menampilkan:
  - Header & toolbar pemilihan produk (Dropdown searchable + input pencarian SKU/Nama).
  - Filter Gudang (Semua Gudang atau gudang tertentu) dan Filter Tanggal.
  - Kartu Ringkasan Metrik: Saldo Awal, Total Masuk (+), Total Keluar (-), dan Saldo Akhir.
- [ ] **Step 3: Bangun algoritma penyusunan mutasi buku besar**
  Mengagregasi data transaksi & opname untuk produk terpilih, menghitung saldo berjalan (running balance), dan menampilkan tabel kronologis dengan kolom: Tanggal, Gudang, Jenis Mutasi, No. Ref, Masuk, Keluar, Saldo, User, Keterangan/Foto Bukti.
- [ ] **Step 4: Tambahkan aksi cetak khusus `printStockCard()`**
  Menyediakan layout cetak kertas A4 / struk yang rapi untuk kartu stok produk terpilih.
- [ ] **Step 5: Verifikasi navigasi kartu stok**
  Uji alur buka menu kartu stok, ganti produk, ganti gudang, ubah tanggal, dan klik kartu stok dari halaman Cek Stok.

---

### Task 3: Modul Laporan Slow Moving & Dead Stock

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html` (bagian `reportsPage` dan algoritma analisis inventori)

**Interfaces:**
- Consumes: `store.products`, `store.transactions`, `store.stockLedger`
- Produces: Tampilan tab/sub-laporan "Analisis Slow Moving & Dead Stock" dengan filter hari mengendap, tabel ranking aset mengendap, dan ekspor data

- [ ] **Step 1: Tambahkan tab/pilihan laporan baru di `reportsPage()`**
  Tambahkan opsi laporan "Slow Moving & Dead Stock" di dropdown/tab jenis laporan.
- [ ] **Step 2: Implementasikan algoritma kalkulasi perputaran barang**
  - Hitung tanggal transaksi keluar terakhir (`lastOutDate`) untuk setiap produk.
  - Hitung jumlah hari tanpa penjualan/keluar (`daysInactive`).
  - Hitung total kuantitas keluar dalam rentang waktu yang dipilih (misal 30, 60, 90, 180 hari).
  - Klasifikasi status:
    - 🔴 **Dead Stock**: Stok > 0 dan tidak ada pengeluaran sama sekali (> 90 hari).
    - 🟡 **Slow Moving**: Rasio keluar terhadap stok < 15% dalam periode.
    - 🟢 **Fast Moving / Sehat**: Perputaran aktif.
- [ ] **Step 3: Tampilkan visualisasi kartu ringkasan & tabel analisis**
  - Total Nilai Aset Mengendap (Rp).
  - Jumlah SKU Dead Stock vs Slow Moving.
  - Tabel interaktif dengan SKU, Nama, Stok, Nilai Aset, Hari Mengendap, Status, dan Tombol Cek Kartu Stok.
- [ ] **Step 4: Sediakan tombol Cetak dan Ekspor CSV/Excel untuk laporan Dead Stock**
- [ ] **Step 5: Verifikasi keakuratan perhitungan pada berbagai sampel transaksi**

---

### Task 4: Peningkatan Informasi Stok Paling Banyak Keluar di Dashboard

**Files:**
- Modify: `d:/PROJEK DIGITAL/Stokkita/index.html` (bagian render dashboard `topOutProducts` & widget ranking)

**Interfaces:**
- Consumes: `store.products`, `filteredTx`, `state.dashboardPeriod`
- Produces: Widget visualisasi Top 5/Top 10 Barang Terlaris Keluar yang akurat, interaktif, dan informatif

- [ ] **Step 1: Sempurnakan kalkulasi kuantitas keluar per produk**
  Memastikan perolehan kuantitas memeriksa `t.details` (array multi-item) dan fallback ke `t.qty` jika transaksi berformat single-item, hanya menghitung transaksi bertipe 'Barang Keluar' (atau 'OUT').
- [ ] **Step 2: Perkaya tampilan kartu "Barang Paling Banyak Keluar"**
  - Tampilkan ranking 1 s.d 5 (atau toggle ke 10).
  - Tampilkan bar progress proporsional, jumlah unit keluar, persentase kontribusi, dan thumbnail foto produk.
  - Berikan aksi klik langsung menuju Kartu Stok barang bersangkutan (`data-action="view-stock-card"`).
- [ ] **Step 3: Sinkronkan dengan filter tanggal dashboard (Hari Ini, 7 Hari, 30 Hari, Semua)**
- [ ] **Step 4: Verifikasi tampilan dashboard pada mode desktop dan mobile**

---

### Task 5: Pengujian Menyeluruh, Clasp Push & Deployment Live

**Files:**
- Sync: `d:/PROJEK DIGITAL/Stokkita/index.html`, `d:/PROJEK DIGITAL/Stokkita/Kode.js`

- [ ] **Step 1: Uji seluruh fungsionalitas di browser (Kamera, Kartu Stok, Dead Stock, Dashboard)**
- [ ] **Step 2: Jalankan `clasp push` untuk mengunggah perubahan ke Google Apps Script**
- [ ] **Step 3: Jalankan `clasp deploy` untuk menerbitkan versi rilis baru**
- [ ] **Step 4: Uji akses URL live Web App untuk memastikan status 200 OK dan bebas bug runtime**
