# Panduan Instalasi StokKita sebagai PWA Mandiri (Cold-Start Offline)

Paket ini memungkinkan StokKita dipasang layaknya aplikasi native di layar beranda Android/iOS/PC dan dapat dibuka dari posisi tertutup total meski tidak ada sinyal internet sama sekali.

---

## Cara Pasang (Paling Praktis via GitHub Pages / Cloudflare Pages):

1. **Unggah Berkas ke Hosting Statis:**
   - Unggah berkas berikut ke repositori GitHub atau project Cloudflare Pages:
     - `index.html` (dari root proyek StokKita)
     - `manifest.json` (dari folder `pwa/`)
     - Salin isi `pwa/sw.client.js` dan simpan sebagai `sw.js` di hosting Anda.
2. **Aktifkan GitHub Pages:**
   - Masuk ke Settings GitHub > **Pages** > Branch: `main` / `master` > Save.
   - Anda akan mendapatkan URL HTTPS seperti `https://username.github.io/stokkita/`.
3. **Buka di Ponsel & Hubungkan Database:**
   - Buka URL tersebut di browser Chrome (Android) atau Safari (iOS).
   - Masuk ke menu **Pengaturan** > masukkan URL Web App Google Apps Script Anda.
   - Klik menu browser > **"Tambahkan ke Layar Utama" (Install App)**.
4. **Selesai!**
   - Ikon aplikasi **StokKita** akan muncul di layar ponsel staf gudang.
   - Aplikasi dapat dibuka kapan pun meski perangkat dalam mode pesawat (*Airplane Mode*), dan seluruh transaksi akan tersimpan di antrean lokal hingga internet tersedia kembali.
