# Rencana Implementasi: Sistem Barcode & QR Code StokKita (Generator, Cetak Label & Scanner Kamera HP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Ringkasan Proyek
Menambahkan modul dan menu komprehensif **Barcode & QR Code** pada aplikasi StokKita yang mengadopsi tampilan visual sesuai gambar referensi user:
1. **Generator & Cetak Label (Barcode / QR Code):**
   - Tab navigasi: `My items` (dari katalog master barang) dan `One code` (kode teks kustom manual).
   - Panel **Choose Items**: filter pencarian live, pilihan cepat `Pilih Semua` / `Batal Pilih`, checkbox multi-select dengan informasi stok & satuan.
   - Panel **Code Type**: pilihan format `Barcode (Code 128)` vs `QR Code`, serta opsi teks di bawah kode (`Kode SKU`, `Nama Barang`, `Kode & Nama`, `Tanpa Teks`).
   - Panel **Printing**: mode cetak (`Individual Label`, `Sheet Grid A4`, `Roll Berkelanjutan`), dimensi label (`Width`, `Height` dalam mm, presets 84x48, 50x30, 40x20), dan jumlah salinan (`1 per barang`, `Sesuai Stok Fisik`, atau `Kustom`).
   - Panel **Overview (Live Preview)**: tampilan pratinjau real-time kartu label siap cetak lengkap dengan barcode/QR dinamis, nama barang, kode SKU, dan harga/satuan.
   - Tombol utama **Cetak Label (Print Label)** dengan CSS `@media print` presisi tinggi.

2. **Scanner Kamera HP (Barcode & QR Scanner):**
   - Bypass sandbox iframe Google Apps Script menggunakan popup window mandiri (`openBarcodeScannerPopup`) yang memiliki akses penuh hardware kamera seluler tanpa diblokir peramban.
   - Didukung library `Html5Qrcode` yang membaca barcode 1D (Code 128, EAN, UPC, Code 39) dan 2D (QR Code) secara instan.
   - Suara *Beep* (Web Audio API) dan getar HP (*Haptic Feedback*) saat kode berhasil terdeteksi.
   - Integrasi langsung ke form Transaksi Masuk/Keluar (otomatis memasukkan barang dan menambah kuantitas) dan pencarian inventaris.

---

## File yang Terlibat
- `index.html`:
  - Menambahkan CDN `JsBarcode`, `QRCode`, dan `Html5Qrcode`.
  - Menambahkan icon `barcode` & `qrcode` ke library helper SVG.
  - Menambahkan rute dan navigasi sidebar `barcodes` (Admin & Staff).
  - Menambahkan reactive state untuk barcode & printer settings.
  - Menambahkan fungsi render halaman `barcodePage()` dan popup scanner `openBarcodeScannerPopup()`.
  - Mengintegrasikan tombol pemicu scanner pada form transaksi dan bilah pencarian.
  - Menambahkan styling CSS cetak khusus label (`@media print`).
- `docs/superpowers/plans/2026-10-30-barcode-qr-system.md`: Dokumen rencana implementasi.

---

## Rincian Tugas & Langkah Implementasi

### Task 1: Injeksi Library & Helper Barcode / QR Code
- [ ] Load library CDN `JsBarcode` (`https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js`), `qrcode` (`https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js`), dan `html5-qrcode` (`https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js`) di `index.html`.
- [ ] Tambahkan ikon SVG `barcode` dan `qrcode` ke dictionary fungsi `icon()`.
- [ ] Buat fungsi utilitas:
  - `generateBarcodeSvg(text, format, options)`
  - `generateQrCodeCanvas(text, elementId, options)`
  - `playBeepSound()` (AudioContext synthesizer).
- [ ] Jalankan verifikasi sintaks JavaScript via Node.js.

### Task 2: Modul Halaman "Barcode / QR code" (Sesuai Mockup Referensi)
- [ ] Daftarkan menu `barcodes: { id: 'barcodes', label: 'Barcode / QR', icon: 'barcode' }` di `navAdmin` dan `navStaff`.
- [ ] Tambahkan state reaktif:
  - `barcodeTab`: `'items'` | `'custom'`
  - `barcodeSelectedProductIds`: `[]`
  - `barcodeCustomText`: `''`
  - `barcodeType`: `'barcode'` | `'qrcode'`
  - `barcodeTextDisplay`: `'code'` | `'name'` | `'both'` | `'none'`
  - `barcodePrintMode`: `'individual'` | `'sheet'` | `'roll'`
  - `barcodeLabelWidth`: `84` (mm)
  - `barcodeLabelHeight`: `48` (mm)
  - `barcodeLabelQty`: `1` (atau `'stock'`)
  - `barcodeSearchQuery`: `''`
- [ ] Implementasikan `barcodePage()` dengan 2 kolom presisi sesuai mockup:
  - Header dengan judul "Barcode / QR code", Search bar, tombol Scan Kamera HP, dan tab switch (One code / My items).
  - Kolom kiri: **Choose Items** (search, select all/none, list items) & **Code Type** (Barcode/QR pill buttons, text under code).
  - Kolom kanan: **Printing** (Mode, Width, Height, Quantity) & **Overview** (Live label preview) & tombol **Print label**.
- [ ] Pasang listener interaktif (checkbox toggle, select all, dimensions change, tab change) dan re-render preview label.
- [ ] Tambahkan CSS styling cetak `@media print` untuk ukuran thermal label dan kertas stiker A4.

### Task 3: Scanner Kamera HP (Bypass Sandbox & Autocomplete)
- [ ] Buat fungsi `openBarcodeScannerPopup(contextCallback)`:
  - Membuka popup window top-level di luar iframe sandbox Google Apps Script.
  - Mengaktifkan kamera belakang HP (`facingMode: 'environment'`) dengan library `Html5Qrcode`.
  - Tampilan overlay kotak bidik (*viewfinder target*) dengan animasi garis laser hijau bergerak.
  - Membunyikan suara *Beep* dan getar ponsel saat kode terbaca.
  - Mengirimkan kode hasil scan via `window.opener.postMessage` dan `localStorage.setItem('STOKKITA_SCANNER_RESULT_V1', ...)`.
- [ ] Tambahkan tombol "📷 Scan Barcode / QR" di:
  - Form Transaksi Masuk (`incoming`)
  - Form Transaksi Keluar (`outgoing`)
  - Form Mutasi Antar Gudang (`transfer`)
  - Header halaman Barcode (`barcodes`)
- [ ] Handler otomatis saat scan berhasil pada transaksi:
  - Mencari barang berdasarkan SKU atau Barcode.
  - Jika ditemukan: memasukkan ke baris barang (`transactionLines`) atau menambah Qty (+1) jika sudah ada.
  - Menampilkan notifikasi visual toast "Barang [Nama] berhasil di-scan".

### Task 4: Uji Coba, Verifikasi Sintaks, dan Deployment
- [ ] Lakukan verifikasi sintaks menggunakan Node.js pada `index.html` dan `Kode.js`.
- [ ] Lakukan commit git dengan pesan deskriptif.
- [ ] Unggah dan deploy versi baru menggunakan Clasp (`clasp push --force` & `clasp deploy`).
- [ ] Lakukan verifikasi live URL web app dengan `read_url_content`.
- [ ] Berikan laporan kepada user beserta link dan panduan uji coba.
