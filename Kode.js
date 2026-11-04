/**
 * ==============================================================================
 * STOKKITA — GOOGLE APPS SCRIPT DATABASE BACKEND (code.gs)
 * ==============================================================================
 * Skrip ini bertindak sebagai API Cloud Database untuk aplikasi StokKita Inventori.
 * Seluruh data disimpan dan disinkronkan secara terstruktur pada Google Spreadsheet:
 * 
 * 1.  SETTINGS         - Konfigurasi aplikasi, identitas bisnis, dan aturan stok
 * 2.  CATEGORIES       - Master kategori/kelompok barang
 * 3.  WAREHOUSES       - Master lokasi gudang fisik
 * 4.  PRODUCTS         - Master barang dan saldo stok PER GUDANG (Kolom Terpisah)
 * 5.  USERS            - Akun pengguna, peran (ADMIN/STAFF), dan hak akses
 * 6.  BARANG_MASUK     - Riwayat penerimaan barang masuk (Kolom terpisah: SKU, Nama, Qty, Satuan)
 * 7.  BARANG_KELUAR    - Riwayat pengeluaran barang keluar (Kolom terpisah: SKU, Nama, Qty, Satuan)
 * 8.  TRANSFERS        - Mutasi dan surat jalan transfer antar gudang (Kolom terpisah)
 * 9.  STOK_OPNAME      - Pemeriksaan fisik stok (Kolom terpisah: Sistem, Fisik, Selisih, Satuan)
 * 10. DAMAGED_ITEMS    - Pencatatan barang bermasalah / rusak / hilang
 * 11. STOCK_LEDGER     - Kartu stok lengkap (jejak audit mutasi per barang)
 * 12. AUDIT_LOGS       - Catatan jejak audit sistem keamanan
 *
 * FITUR DATABASE TERBARU:
 * - Tidak ada lagi kolom teks gabungan (items_detail, stocks_json, dsb.).
 * - Data barang pada transaksi dipecah menjadi kolom-kolom tersendiri:
 *   kolom 'sku', 'nama_barang', 'qty', dan 'satuan'.
 * - Pada stok opname dipecah menjadi kolom 'stok_sistem', 'stok_fisik', 'selisih', 'satuan'.
 * - Transaksi dengan banyak barang (multi-item) dicatat per baris secara rapi.
 * - Pengguna dapat mengedit angka qty, nama barang, atau sku langsung di sel spreadsheet!
 *
 * ------------------------------------------------------------------------------
 * CARA PEMASANGAN / PEMBARUAN:
 * ------------------------------------------------------------------------------
 * 1. Buka spreadsheet database Anda di browser (atau buat baru di https://sheets.new).
 * 2. Buka menu: Ekstensi (Extensions) > Apps Script.
 * 3. Hapus seluruh kode lama yang ada di editor, lalu tempel seluruh isi file ini (code.gs).
 * 4. Untuk DATABASE BARU:
 *    - Pilih fungsi "setupDatabase" di toolbar atas, lalu klik "Run" (Jalankan).
 *    Untuk DATABASE YANG SUDAH ADA (MIGRASI):
 *    - Pilih fungsi "migrateDatabase" di toolbar atas, lalu klik "Run" (Jalankan).
 * 5. Klik tombol "Deploy" (Terapkan) di kanan atas > "Manage deployments" (atau "New deployment").
 * 6. Edit deployment Web app:
 *    - Version: New version (Versi baru)
 *    - Execute as: "Me" (Saya / email Google akun Anda)
 *    - Who has access: "Anyone" (Siapa saja)  <-- SANGAT PENTING
 * 7. Klik "Deploy", lalu pastikan Web app URL sudah terhubung di aplikasi StokKita.
 * ==============================================================================
 */

const SHEET_NAMES = {
  SETTINGS: 'SETTINGS',
  CATEGORIES: 'CATEGORIES',
  WAREHOUSES: 'WAREHOUSES',
  PRODUCTS: 'PRODUCTS',
  USERS: 'USERS',
  TRANSACTIONS_IN: 'BARANG_MASUK',
  TRANSACTIONS_OUT: 'BARANG_KELUAR',
  TRANSFERS: 'TRANSFERS',
  OPNAMES: 'STOK_OPNAME',
  DAMAGED_ITEMS: 'DAMAGED_ITEMS',
  STOCK_LEDGER: 'STOCK_LEDGER',
  AUDIT_LOGS: 'AUDIT_LOGS'
};

/**
 * Handle HTTP GET requests from frontend
 * Endpoint: ?action=readAll | ?action=ping | ?action=setup | ?action=migrate | ?action=readTable&table=products
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';

    // 1. Uji koneksi / Ping (API)
    if (action === 'ping') {
      return jsonResponse({
        status: 'success',
        message: 'Koneksi ke Database Google Spreadsheet berhasil!',
        timestamp: new Date().toISOString()
      });
    }

    // 2. Setup database sheet otomatis via GET jika diperlukan (API)
    if (action === 'setup') {
      setupDatabase();
      return jsonResponse({
        status: 'success',
        message: 'Struktur sheet Google Spreadsheet berhasil diinisialisasi.',
        timestamp: new Date().toISOString()
      });
    }

    // 3. Migrasi database otomatis ke format kolom terpisah (API)
    if (action === 'migrate') {
      const resultMsg = migrateDatabase();
      return jsonResponse({
        status: 'success',
        message: resultMsg,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Baca satu tabel spesifik (API)
    if (action === 'readTable') {
      const tableName = (e.parameter.table || '').toUpperCase();
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const targetSheetName = SHEET_NAMES[tableName] || tableName;
      const sheet = getSheetByAliases(ss, [targetSheetName, tableName]);
      if (!sheet) {
        return jsonResponse({ status: 'error', message: 'Tabel tidak ditemukan: ' + tableName });
      }
      const data = readTableSheet(ss, sheet.getName());
      return jsonResponse({ status: 'success', table: tableName, data: data });
    }

    // 5. Baca seluruh data store (readAll API jika dipanggil via fetch)
    if (action === 'readAll') {
      const data = readAllDataFromSpreadsheet();
      return jsonResponse({
        status: 'success',
        data: data,
        timestamp: new Date().toISOString()
      });
    }

    // 6. DEFAULT BROWSER VISIT: Sajikan Antarmuka Frontend (index.html) Langsung di Web App!
    // Ini memungkinkan seluruh aplikasi berjalan 100% langsung di link Google Apps Script tanpa server eksternal.
    try {
      return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('StokKita — Sistem Manajemen Inventaris Multi-Gudang')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (htmlErr) {
      // Jika file 'index.html' belum dibuat di editor Apps Script
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>StokKita - Siap Menjalankan Frontend</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; margin: 0; }
            .card { max-width: 640px; margin: 40px auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            h2 { color: #0f172a; margin-top: 0; font-size: 22px; }
            .step { display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start; }
            .num { width: 28px; height: 28px; border-radius: 50%; background: #176b57; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 14px; }
            .txt { font-size: 14px; line-height: 1.6; color: #334155; }
            code { background: #f1f5f9; padding: 3px 8px; border-radius: 6px; color: #0f766e; font-weight: 600; }
            .btn { display: inline-block; background: #176b57; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Langkah Terakhir: Pasang Frontend index.html</h2>
            <p style="color:#64748b;font-size:14px;line-height:1.6">Backend Google Apps Script sudah aktif 100%! Untuk menjalankan aplikasi antarmuka lengkap langsung di link ini:</p>
            <div class="step">
              <div class="num">1</div>
              <div class="txt">Buka editor Google Apps Script di tab spreadsheet Anda.</div>
            </div>
            <div class="step">
              <div class="num">2</div>
              <div class="txt">Klik tombol <b>+ (Tambah file)</b> di panel kiri &gt; pilih <b>HTML</b> &gt; beri nama persis: <code>index</code></div>
            </div>
            <div class="step">
              <div class="num">3</div>
              <div class="txt">Salin (Copy) seluruh isi file <b>index.html</b> di komputer Anda, lalu Tempel (Paste) ke file <code>index.html</code> tersebut.</div>
            </div>
            <div class="step">
              <div class="num">4</div>
              <div class="txt">Klik <b>Deploy (Terapkan) &gt; Manage deployments &gt; Edit (ikon pensil) &gt; New version &gt; Deploy</b>.</div>
            </div>
            <p style="color:#15803d;font-weight:600;font-size:14px;margin-top:20px;">Setelah langkah di atas, aplikasi StokKita lengkap akan langsung tampil di link ini!</p>
          </div>
        </body>
        </html>
      `).setTitle('StokKita Inventori - Panduan Deploy Frontend');
    }

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString(), stack: err.stack });
  }
}

/**
 * ==============================================================================
 * ENDPOINT NATIVE UNTUK google.script.run (FRONTEND LANGSUNG DI APPS SCRIPT)
 * ==============================================================================
 * Fungsi-fungsi ini dipanggil secara instan oleh index.html ketika dibuka langsung
 * di dalam Google Apps Script tanpa membutuhkan konfigurasi URL ataupun terkena CORS!
 */
function apiReadAll() {
  try {
    const data = readAllDataFromSpreadsheet();
    return { status: 'success', data: data, timestamp: new Date().toISOString() };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function apiLogin(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const users = readTableSheet(ss, SHEET_NAMES.USERS);
    const uClean = String(username || '').trim().toLowerCase();
    const pClean = String(password || '').trim();

    const user = users.find(u => String(u.username || '').toLowerCase() === uClean);
    if (!user) {
      return { status: 'error', message: 'Username tidak ditemukan!' };
    }
    if (String(user.password || '').trim() !== pClean) {
      return { status: 'error', message: 'Kata sandi salah!' };
    }
    if (user.active === false || String(user.active).toLowerCase() === 'false') {
      return { status: 'error', message: 'Akun Anda dinonaktifkan oleh Administrator.' };
    }

    // Update lastLogin di sheet
    user.lastLogin = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH.mm');
    writeTableSheet(ss, SHEET_NAMES.USERS, users, ['id', 'username', 'code', 'name', 'role', 'warehouse', 'password', 'active', 'lastLogin']);

    // Log login
    appendAuditLogServer(ss, {
      user: user.name,
      action: 'LOGIN',
      entity: 'Sesi',
      ref: user.username,
      description: `Pengguna berhasil login (${user.role})`
    });

    return {
      status: 'success',
      user: {
        id: user.id,
        username: user.username,
        code: user.code,
        name: user.name,
        role: String(user.role || 'STAFF').toUpperCase(),
        warehouse: user.warehouse || 'Semua Gudang',
        lastLogin: user.lastLogin
      },
      message: 'Login berhasil!'
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function apiAppendTransaction(txPayload) {
  return handleAppendTransactionServer(txPayload);
}

function apiSaveAll(dataPayload) {
  try {
    const data = typeof dataPayload === 'string' ? JSON.parse(dataPayload) : dataPayload;
    return saveAllDataToSpreadsheet(data);
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function apiPing() {
  return { status: 'success', message: 'Koneksi ke Database Google Spreadsheet berhasil!', timestamp: new Date().toISOString() };
}

function apiMigrate() {
  try {
    const msg = migrateDatabase();
    return { status: 'success', message: msg };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Handle HTTP POST requests from frontend
 */
function doPost(e) {
  try {
    let payload = null;
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    if (!payload || !payload.action) {
      return jsonResponse({ status: 'error', message: 'Payload POST tidak valid' });
    }

    // 1. Login verifikasi server-side
    if (payload.action === 'login') {
      const res = apiLogin(payload.username, payload.password);
      return jsonResponse(res);
    }

    // 2. Append Transaksi Granular (Atomik & Aman dari Concurrency Overwrite)
    if (payload.action === 'appendTransaction') {
      const res = handleAppendTransactionServer(payload.data);
      return jsonResponse(res);
    }

    // 3. Simpan seluruh data store dengan Script Lock (tetap didukung untuk full-backup / batch setting)
    if (payload.action === 'saveAll') {
      saveAllDataToSpreadsheet(payload.data);

      return jsonResponse({
        status: 'success',
        message: 'Seluruh data berhasil disimpan ke Google Spreadsheet.',
        savedAt: new Date().toISOString()
      });
    }

    // 4. Inisialisasi skema awal
    if (payload.action === 'init') {
      setupDatabase();
      return jsonResponse({
        status: 'success',
        message: 'Struktur sheet Google Spreadsheet berhasil diinisialisasi.'
      });
    }

    // 5. Migrasi kolom
    if (payload.action === 'migrate') {
      const resultMsg = migrateDatabase();
      return jsonResponse({
        status: 'success',
        message: resultMsg
      });
    }

    return jsonResponse({ status: 'error', message: 'Action POST tidak dikenali: ' + payload.action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString(), stack: err.stack });
  }
}

/**
 * Helper pembungkus respons JSON
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// HELPER VALIDASI & SANITASI DATA
// =============================================================================

function getSheetByAliases(ss, aliases) {
  if (!Array.isArray(aliases)) aliases = [aliases];
  for (let i = 0; i < aliases.length; i++) {
    const s = ss.getSheetByName(aliases[i]);
    if (s) return s;
  }
  return null;
}

function parseNumeric(val, defaultVal) {
  if (val === undefined || val === null || val === '') {
    return defaultVal !== undefined ? defaultVal : 0;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? (defaultVal !== undefined ? defaultVal : 0) : val;
  }
  const clean = String(val).trim().replace(/,/g, '');
  const num = Number(clean);
  return isNaN(num) ? (defaultVal !== undefined ? defaultVal : 0) : num;
}

function parseBoolean(val, defaultVal) {
  if (val === undefined || val === null || val === '') {
    return defaultVal !== undefined ? defaultVal : true;
  }
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'ya' || s === 'yes' || s === 'aktif') return true;
  if (s === 'false' || s === '0' || s === 'tidak' || s === 'no' || s === 'nonaktif') return false;
  return defaultVal !== undefined ? defaultVal : true;
}

function columnToLetter(col) {
  let temp;
  let letter = '';
  let c = col;
  while (c > 0) {
    temp = (c - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    c = Math.floor((c - temp - 1) / 26);
  }
  return letter;
}

function cleanWarehouseName(name) {
  if (!name) return '';
  let str = String(name).trim();
  if (/^(stok|stock)\s*[:\-]?\s*/i.test(str)) {
    str = str.replace(/^(stok|stock)\s*[:\-]?\s*/i, '').trim();
  }
  return str;
}

function getWarehouseNames(ss, products, warehouses) {
  const whSet = [];
  const addName = (name) => {
    if (!name) return;
    const clean = cleanWarehouseName(name);
    if (clean && !whSet.includes(clean)) {
      whSet.push(clean);
    }
  };

  if (Array.isArray(warehouses)) {
    warehouses.forEach(w => {
      if (w && w.name) addName(w.name);
    });
  }

  try {
    const whSheet = ss.getSheetByName(SHEET_NAMES.WAREHOUSES);
    if (whSheet && whSheet.getLastRow() > 1) {
      const vals = whSheet.getDataRange().getValues();
      const headers = vals[0].map(h => String(h || '').trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      if (nameIdx !== -1) {
        for (let i = 1; i < vals.length; i++) {
          const n = vals[i][nameIdx];
          if (n) addName(n);
        }
      }
    }
  } catch (e) {}

  if (Array.isArray(products)) {
    products.forEach(p => {
      if (p && p.stocks && typeof p.stocks === 'object') {
        Object.keys(p.stocks).forEach(k => addName(k));
      }
    });
  }

  if (whSet.length === 0) {
    return ['Gudang Utama'];
  }

  return whSet;
}

/**
 * Parser pendukung teks lama (backward-compatibility jika ada teks gabungan lama)
 */
function parseItemDetailsText(val) {
  if (!val) return [];
  const str = String(val).trim();
  if (!str) return [];

  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object') return [parsed];
    } catch (e) {}
  }

  const parts = str.split(/[|\n;]+/).map(s => s.trim()).filter(Boolean);
  const details = [];

  parts.forEach((partStr, idx) => {
    let pStr = partStr;
    let sku = '';
    let name = '';
    let qty = 1;
    let unit = 'Pcs';

    const skuMatch = pStr.match(/^\[([^\]]+)\]\s*(.*)/);
    if (skuMatch) {
      sku = skuMatch[1].trim();
      pStr = skuMatch[2].trim();
    }

    const qtyMatch = pStr.match(/(.*?)(?::|x|\-|\s)\s*([0-9.,]+)\s*([a-zA-Z]*)$/);
    if (qtyMatch) {
      name = qtyMatch[1].trim();
      qty = parseNumeric(qtyMatch[2], 1);
      unit = qtyMatch[3].trim() || 'Pcs';
    } else {
      const bracketMatch = pStr.match(/(.*?)\(([0-9.,]+)\s*([a-zA-Z]*)\)/);
      if (bracketMatch) {
        name = bracketMatch[1].trim();
        qty = parseNumeric(bracketMatch[2], 1);
        unit = bracketMatch[3].trim() || 'Pcs';
      } else {
        name = pStr;
      }
    }

    details.push({
      productId: sku || ('P' + String(idx + 1).padStart(3, '0')),
      sku: sku,
      name: name || 'Barang',
      qty: qty,
      unit: unit
    });
  });

  return details;
}

// =============================================================================
// DATABASE READERS (MEMBACA DATA DARI SPREADSHEET KE APLIKASI)
// =============================================================================

function readAllDataFromSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  return {
    settings: readSettingsSheet(ss),
    categories: readCategoriesSheet(ss),
    warehouses: readTableSheet(ss, SHEET_NAMES.WAREHOUSES),
    products: readProductsSheet(ss),
    users: readTableSheet(ss, SHEET_NAMES.USERS),
    transactions: readAllTransactions(ss),
    transfers: readTransfersSheet(ss),
    opnames: readOpnamesSheet(ss),
    damagedItems: sortLatestFirst(readTableSheet(ss, SHEET_NAMES.DAMAGED_ITEMS)),
    stockLedger: sortLatestFirst(readTableSheet(ss, SHEET_NAMES.STOCK_LEDGER)),
    auditLogs: sortLatestFirst(readTableSheet(ss, SHEET_NAMES.AUDIT_LOGS))
  };
}

function readSettingsSheet(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    const val = values[i][1];
    if (key) {
      const strVal = String(val !== undefined && val !== null ? val : '').trim();
      // Kunci yang wajib bertipe teks/string (agar awalan angka 0 seperti nomor telepon tidak terpotong)
      if (key === 'phone' || key === 'businessName' || key === 'address' || key === 'timezone' || key === 'googleSheetsUrl' || key.startsWith('txPrefix') || key === 'txNumberFormat') {
        settings[key] = strVal;
      } else if (strVal.toLowerCase() === 'true' || val === true) {
        settings[key] = true;
      } else if (strVal.toLowerCase() === 'false' || val === false) {
        settings[key] = false;
      } else if (!isNaN(val) && strVal !== '' && typeof val !== 'boolean') {
        settings[key] = Number(val);
      } else {
        settings[key] = val;
      }
    }
  }
  return settings;
}

function readCategoriesSheet(ss) {
  const list = readTableSheet(ss, SHEET_NAMES.CATEGORIES);
  return list.map(c => ({
    id: c.id || '',
    code: c.code || '',
    name: c.name || '',
    description: c.description || c.desc || ''
  }));
}

/**
 * Mengurutkan data secara kronologis (tanggal terlama di atas, terbaru di baris paling bawah).
 * Memastikan penambahan data baru di spreadsheet selalu diletakkan dari bawah.
 */
function sortChronological(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = parseDateTimeToSort(a.date || a.time || a.createdAt || '');
    const timeB = parseDateTimeToSort(b.date || b.time || b.createdAt || '');
    if (timeA !== timeB) return timeA - timeB;
    return String(a.transaction_no || a.no || a.id || '').localeCompare(String(b.transaction_no || b.no || b.id || ''));
  });
}

/**
 * Mengurutkan data transaksi secara terbalik / descending:
 * Data yang baru diinput selalu ditampilkan paling awal (di urutan teratas).
 */
function sortLatestFirst(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = parseDateTimeToSort(a.date || a.time || a.createdAt || a.approvalDate || '');
    const timeB = parseDateTimeToSort(b.date || b.time || b.createdAt || b.approvalDate || '');
    if (timeA !== timeB) return timeB - timeA;
    return String(b.transaction_no || b.no || b.id || '').localeCompare(String(a.transaction_no || a.no || a.id || ''), undefined, { numeric: true });
  });
}

function parseDateTimeToSort(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const s = String(str).trim();
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})[:\.](\d{1,2}))?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    return new Date(year, month, day, hour, min).getTime();
  }
  const parsed = Date.parse(s);
  return isNaN(parsed) ? 0 : parsed;
}

function readTableSheet(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h || '').trim());
  const list = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === '' || cell === null)) continue;
    const item = {};
    for (let h = 0; h < headers.length; h++) {
      const headerKey = headers[h];
      let val = row[h];
      if (headerKey.toLowerCase() === 'active') {
        val = parseBoolean(val, true);
      } else if (val === 'true' || val === true) {
        val = true;
      } else if (val === 'false' || val === false) {
        val = false;
      }
      item[headerKey] = val !== undefined && val !== null ? val : '';

      // Normalisasi alias kolom agar aman jika user mengetik snake_case atau spasi
      const cleanKey = headerKey.toLowerCase().replace(/[\s_\-]+/g, '');
      if (cleanKey === 'refno' && !item.refNo) item.refNo = item[headerKey];
      if (cleanKey === 'productid' && !item.productId) item.productId = item[headerKey];
      if (cleanKey === 'productname' && !item.productName) item.productName = item[headerKey];
      if (cleanKey === 'issuetype' && !item.issueType) item.issueType = item[headerKey];
      if (cleanKey === 'balanceafter' && !item.balanceAfter) item.balanceAfter = parseNumeric(item[headerKey], 0);
      if (cleanKey === 'lastlogin' && !item.lastLogin) item.lastLogin = item[headerKey];
      if (cleanKey === 'approvedby' && !item.approvedBy) item.approvedBy = item[headerKey];
      if (cleanKey === 'approvedat' && !item.approvedAt) item.approvedAt = item[headerKey];
      if ((cleanKey === 'foto' || cleanKey === 'photo' || cleanKey === 'image' || cleanKey === 'buktifoto') && !item.photo) {
        item.photo = item[headerKey];
        item.foto = item[headerKey];
      }
    }

    // Auto-generate ID jika sel id kosong
    if (!item.id) {
      item.id = sheetName.substring(0, 3).toUpperCase() + String(i).padStart(4, '0');
    }

    // Sinkronisasi transaction_no dan no agar kompatibel dua arah
    if (item.transaction_no && !item.no) item.no = item.transaction_no;
    if (item.no && !item.transaction_no) item.transaction_no = item.no;

    list.push(item);
  }
  return list;
}

/**
 * Membaca sheet PRODUCTS dengan kolom terpisah per gudang
 */
function readProductsSheet(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const rawHeaders = values[0];
  const headers = rawHeaders.map(h => String(h || '').trim());
  const lowerHeaders = headers.map(h => h.toLowerCase());

  const knownBaseCols = [
    'id', 'sku', 'barcode', 'name', 'category', 'unit', 'min', 'minstock', 'min_stock',
    'active', 'foto', 'photo', 'image', 'gambar', 'stocks_json', 'total', 'total_stock', 'totalstok', 'total stok'
  ];

  const idIdx = lowerHeaders.indexOf('id');
  const skuIdx = lowerHeaders.indexOf('sku');
  const barcodeIdx = lowerHeaders.findIndex(h => ['barcode', 'kode_barcode', 'bar_code'].includes(h));
  const nameIdx = lowerHeaders.indexOf('name');
  const catIdx = lowerHeaders.indexOf('category');
  const unitIdx = lowerHeaders.indexOf('unit');
  const minIdx = lowerHeaders.indexOf('min') !== -1 ? lowerHeaders.indexOf('min') : lowerHeaders.indexOf('minstock');
  const activeIdx = lowerHeaders.indexOf('active');
  const photoIdx = lowerHeaders.findIndex(h => ['foto', 'photo', 'image', 'gambar'].includes(h));
  const stocksJsonIdx = lowerHeaders.indexOf('stocks_json');

  const warehouseCols = [];
  for (let h = 0; h < headers.length; h++) {
    const low = lowerHeaders[h];
    if (low && !knownBaseCols.includes(low)) {
      const whName = cleanWarehouseName(headers[h]);
      if (whName) {
        warehouseCols.push({ index: h, name: whName });
      }
    }
  }

  const list = [];
  let hasOldJsonCol = (stocksJsonIdx !== -1);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === '' || cell === null)) continue;

    const idVal = idIdx !== -1 ? String(row[idIdx] || '').trim() : '';
    const skuVal = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : '';
    const nameVal = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const photoVal = photoIdx !== -1 ? String(row[photoIdx] || '').trim() : '';

    if (!idVal && !skuVal && !nameVal) continue;

    const item = {
      id: idVal || ('P' + String(i).padStart(3, '0')),
      sku: skuVal,
      barcode: barcodeIdx !== -1 ? String(row[barcodeIdx] || '').trim() : skuVal,
      name: nameVal,
      category: catIdx !== -1 ? String(row[catIdx] || '').trim() : 'Umum',
      unit: unitIdx !== -1 ? String(row[unitIdx] || '').trim() : 'Pcs',
      min: minIdx !== -1 ? parseNumeric(row[minIdx], 0) : 0,
      active: activeIdx !== -1 ? parseBoolean(row[activeIdx], true) : true,
      photo: photoVal,
      foto: photoVal,
      stocks: {}
    };
    item.minStock = item.min;

    warehouseCols.forEach(col => {
      item.stocks[col.name] = parseNumeric(row[col.index], 0);
    });

    if (stocksJsonIdx !== -1 && row[stocksJsonIdx]) {
      try {
        const parsed = JSON.parse(row[stocksJsonIdx]);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(wh => {
            const cleanWh = cleanWarehouseName(wh);
            if (item.stocks[cleanWh] === undefined) {
              item.stocks[cleanWh] = parseNumeric(parsed[wh], 0);
            }
          });
        }
      } catch (e) {}
    }

    list.push(item);
  }

  if (hasOldJsonCol && list.length > 0) {
    try {
      writeProductsSheet(ss, list);
    } catch (e) {
      Logger.log('Auto-migration notice: ' + e);
    }
  }

  return list;
}

/**
 * Membaca sheet transaksi dengan kolom terpisah data barang (sku, nama_barang, qty, satuan).
 * Mengelompokkan multi-baris dengan nomor transaksi yang sama menjadi satu transaksi utuh.
 */
function readSingleTransactionSheet(sheet, defaultType) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h || '').trim());
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Cari index kolom header transaksi
  const idIdx = lowerHeaders.indexOf('id');
  let noIdx = lowerHeaders.indexOf('transaction_no');
  if (noIdx === -1) noIdx = lowerHeaders.indexOf('no');
  if (noIdx === -1) noIdx = lowerHeaders.indexOf('nomor');
  const dateIdx = lowerHeaders.indexOf('date') !== -1 ? lowerHeaders.indexOf('date') : lowerHeaders.indexOf('tanggal');
  const whIdx = lowerHeaders.indexOf('warehouse') !== -1 ? lowerHeaders.indexOf('warehouse') : lowerHeaders.indexOf('gudang');
  const userIdx = lowerHeaders.indexOf('user') !== -1 ? lowerHeaders.indexOf('user') : lowerHeaders.indexOf('petugas');
  const statusIdx = lowerHeaders.indexOf('status');
  const refIdx = lowerHeaders.indexOf('refno') !== -1 ? lowerHeaders.indexOf('refno') : lowerHeaders.indexOf('ref_no');
  const notesIdx = lowerHeaders.indexOf('notes') !== -1 ? lowerHeaders.indexOf('notes') : lowerHeaders.indexOf('catatan');
  const typeIdx = lowerHeaders.indexOf('type') !== -1 ? lowerHeaders.indexOf('type') : lowerHeaders.indexOf('jenis');

  // Cari index kolom pihak terkait (supplier / customer / party)
  let partyIdx = lowerHeaders.indexOf('supplier');
  if (partyIdx === -1) partyIdx = lowerHeaders.indexOf('pemasok');
  if (partyIdx === -1) partyIdx = lowerHeaders.indexOf('customer');
  if (partyIdx === -1) partyIdx = lowerHeaders.indexOf('pelanggan');
  if (partyIdx === -1) partyIdx = lowerHeaders.indexOf('party');
  if (partyIdx === -1) partyIdx = lowerHeaders.indexOf('tujuan');

  // Cari index kolom terpisah data barang
  const skuIdx = lowerHeaders.indexOf('sku') !== -1 ? lowerHeaders.indexOf('sku') : lowerHeaders.indexOf('kode_barang');
  let nameIdx = lowerHeaders.indexOf('nama_barang');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('namabarang');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('item_name');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('product_name');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('name');

  let qtyIdx = lowerHeaders.indexOf('qty');
  if (qtyIdx === -1) qtyIdx = lowerHeaders.indexOf('kuantitas');
  if (qtyIdx === -1) qtyIdx = lowerHeaders.indexOf('jumlah');

  let unitIdx = lowerHeaders.indexOf('satuan');
  if (unitIdx === -1) unitIdx = lowerHeaders.indexOf('unit');

  let photoIdx = lowerHeaders.indexOf('foto');
  if (photoIdx === -1) photoIdx = lowerHeaders.indexOf('image');
  if (photoIdx === -1) photoIdx = lowerHeaders.indexOf('photo');
  if (photoIdx === -1) photoIdx = lowerHeaders.indexOf('bukti_foto');

  // Format lama (items_detail) jika ada
  let itemsDetailIdx = lowerHeaders.indexOf('items_detail');
  if (itemsDetailIdx === -1) itemsDetailIdx = lowerHeaders.indexOf('details_json');

  const txMap = {};
  const txList = [];
  let lastTxNo = '';

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === '' || cell === null)) continue;

    let rowNo = noIdx !== -1 ? String(row[noIdx] || '').trim() : '';
    let rowId = idIdx !== -1 ? String(row[idIdx] || '').trim() : '';

    // Jika baris tidak memiliki nomor transaksi tetapi baris sebelumnya punya (lanjutan baris item)
    if (!rowNo && !rowId && lastTxNo) {
      rowNo = lastTxNo;
    }

    if (!rowNo && !rowId) continue;
    const txKey = rowNo || rowId;
    lastTxNo = txKey;

    const rowPhoto = photoIdx !== -1 ? String(row[photoIdx] || '').trim() : '';

    let tx = txMap[txKey];
    if (!tx) {
      const rowParty = partyIdx !== -1 ? String(row[partyIdx] || '').trim() : '';
      const rowDate = dateIdx !== -1 ? String(row[dateIdx] || '').trim() : '';
      const rowWh = whIdx !== -1 ? String(row[whIdx] || '').trim() : '';
      const rowUser = userIdx !== -1 ? String(row[userIdx] || '').trim() : '';
      const rowStatus = statusIdx !== -1 ? String(row[statusIdx] || '').trim() : 'Posted';
      const rowRef = refIdx !== -1 ? String(row[refIdx] || '').trim() : '';
      const rowNotes = notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '';
      const rowType = typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : defaultType;

      tx = {
        id: rowId || ('TX' + String(txList.length + 1).padStart(4, '0')),
        transaction_no: rowNo || rowId,
        no: rowNo || rowId,
        type: rowType,
        date: rowDate,
        warehouse: rowWh,
        party: rowParty,
        supplier: rowParty,
        customer: rowParty,
        refNo: rowRef,
        user: rowUser,
        status: rowStatus || 'Posted',
        notes: rowNotes,
        photo: rowPhoto,
        details: [],
        items: 0,
        qty: 0
      };
      txMap[txKey] = tx;
      txList.push(tx);
    } else if (!tx.photo && rowPhoto) {
      tx.photo = rowPhoto;
    }

    // 1. Ekstrak data barang dari kolom terpisah (sku, nama_barang, qty, satuan)
    const itemSku = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : '';
    const itemName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const itemQty = qtyIdx !== -1 ? parseNumeric(row[qtyIdx], 0) : 0;
    const itemUnit = unitIdx !== -1 ? String(row[unitIdx] || '').trim() : 'Pcs';

    if (itemSku || itemName || itemQty > 0) {
      tx.details.push({
        productId: itemSku || ('P' + String(tx.details.length + 1).padStart(3, '0')),
        sku: itemSku,
        name: itemName || itemSku || 'Barang',
        qty: itemQty,
        unit: itemUnit || 'Pcs'
      });
    }

    // 2. Dukungan format lama items_detail jika ada
    if (itemsDetailIdx !== -1 && row[itemsDetailIdx]) {
      const parsedOld = parseItemDetailsText(row[itemsDetailIdx]);
      if (Array.isArray(parsedOld)) {
        parsedOld.forEach(p => tx.details.push(p));
      }
    }
  }

  // Hitung ulang total items dan total kuantitas per transaksi
  txList.forEach(t => {
    t.items = t.details.length;
    t.qty = t.details.reduce((sum, d) => sum + (Number(d.qty) || 0), 0);
  });

  return txList;
}

/**
 * Membaca seluruh transaksi dengan menggabungkan sheet BARANG_MASUK dan BARANG_KELUAR
 */
function readAllTransactions(ss) {
  const list = [];

  const inSheet = getSheetByAliases(ss, [SHEET_NAMES.TRANSACTIONS_IN, 'TRANSACTIONS_IN', 'BARANG_MASUK']);
  if (inSheet) {
    const inItems = readSingleTransactionSheet(inSheet, 'Barang Masuk');
    inItems.forEach(item => {
      item.type = 'Barang Masuk';
      list.push(item);
    });
  }

  const outSheet = getSheetByAliases(ss, [SHEET_NAMES.TRANSACTIONS_OUT, 'TRANSACTIONS_OUT', 'BARANG_KELUAR']);
  if (outSheet) {
    const outItems = readSingleTransactionSheet(outSheet, 'Barang Keluar');
    outItems.forEach(item => {
      item.type = 'Barang Keluar';
      list.push(item);
    });
  }

  if (list.length === 0) {
    const oldSheet = ss.getSheetByName('TRANSACTIONS');
    if (oldSheet && oldSheet.getLastRow() > 1) {
      const oldItems = readSingleTransactionSheet(oldSheet, 'Barang Masuk');
      list.push(...oldItems);
    }
  }

  return sortLatestFirst(list);
}

/**
 * Membaca sheet TRANSFERS dengan kolom terpisah data barang
 */
function readTransfersSheet(ss) {
  const sheet = getSheetByAliases(ss, [SHEET_NAMES.TRANSFERS, 'TRANSFERS', 'MUTASI_GUDANG', 'TRANSFER_GUDANG']);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h || '').trim());
  const lowerHeaders = headers.map(h => h.toLowerCase());

  const idIdx = lowerHeaders.indexOf('id');
  let noIdx = lowerHeaders.indexOf('transaction_no');
  if (noIdx === -1) noIdx = lowerHeaders.indexOf('no');
  if (noIdx === -1) noIdx = lowerHeaders.indexOf('nomor');
  const dateIdx = lowerHeaders.indexOf('date');
  const fromWhIdx = lowerHeaders.indexOf('fromwarehouse') !== -1 ? lowerHeaders.indexOf('fromwarehouse') : lowerHeaders.indexOf('asal');
  const toWhIdx = lowerHeaders.indexOf('towarehouse') !== -1 ? lowerHeaders.indexOf('towarehouse') : lowerHeaders.indexOf('tujuan');
  const refIdx = lowerHeaders.indexOf('refno');
  const userIdx = lowerHeaders.indexOf('user');
  const statusIdx = lowerHeaders.indexOf('status');
  const notesIdx = lowerHeaders.indexOf('notes');

  const skuIdx = lowerHeaders.indexOf('sku') !== -1 ? lowerHeaders.indexOf('sku') : lowerHeaders.indexOf('kode_barang');
  let nameIdx = lowerHeaders.indexOf('nama_barang');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('namabarang');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('name');

  let qtyIdx = lowerHeaders.indexOf('qty');
  if (qtyIdx === -1) qtyIdx = lowerHeaders.indexOf('kuantitas');

  let unitIdx = lowerHeaders.indexOf('satuan');
  if (unitIdx === -1) unitIdx = lowerHeaders.indexOf('unit');

  let photoIdx = lowerHeaders.indexOf('foto');
  if (photoIdx === -1) photoIdx = lowerHeaders.indexOf('image');
  if (photoIdx === -1) photoIdx = lowerHeaders.indexOf('photo');
  if (photoIdx === -1) photoIdx = lowerHeaders.indexOf('bukti_foto');

  let itemsDetailIdx = lowerHeaders.indexOf('items_detail');
  if (itemsDetailIdx === -1) itemsDetailIdx = lowerHeaders.indexOf('lines_json');

  const trMap = {};
  const trList = [];
  let lastTrNo = '';

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === '' || cell === null)) continue;

    let rowNo = noIdx !== -1 ? String(row[noIdx] || '').trim() : '';
    let rowId = idIdx !== -1 ? String(row[idIdx] || '').trim() : '';

    if (!rowNo && !rowId && lastTrNo) rowNo = lastTrNo;
    if (!rowNo && !rowId) continue;
    const key = rowNo || rowId;
    lastTrNo = key;

    const rowPhoto = photoIdx !== -1 ? String(row[photoIdx] || '').trim() : '';

    let tr = trMap[key];
    if (!tr) {
      tr = {
        id: rowId || ('TRF' + String(trList.length + 1).padStart(4, '0')),
        transaction_no: rowNo || rowId,
        no: rowNo || rowId,
        type: 'Transfer',
        date: dateIdx !== -1 ? String(row[dateIdx] || '').trim() : '',
        fromWarehouse: fromWhIdx !== -1 ? String(row[fromWhIdx] || '').trim() : '',
        toWarehouse: toWhIdx !== -1 ? String(row[toWhIdx] || '').trim() : '',
        refNo: refIdx !== -1 ? String(row[refIdx] || '').trim() : '',
        user: userIdx !== -1 ? String(row[userIdx] || '').trim() : '',
        status: statusIdx !== -1 ? String(row[statusIdx] || '').trim() : 'In Transit',
        notes: notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '',
        photo: rowPhoto,
        lines: [],
        details: [],
        items: 0,
        qty: 0
      };
      trMap[key] = tr;
      trList.push(tr);
    } else if (!tr.photo && rowPhoto) {
      tr.photo = rowPhoto;
    }

    const itemSku = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : '';
    const itemName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const itemQty = qtyIdx !== -1 ? parseNumeric(row[qtyIdx], 0) : 0;
    const itemUnit = unitIdx !== -1 ? String(row[unitIdx] || '').trim() : 'Pcs';

    if (itemSku || itemName || itemQty > 0) {
      const lineItem = {
        productId: itemSku || ('P' + String(tr.lines.length + 1).padStart(3, '0')),
        sku: itemSku,
        name: itemName || itemSku || 'Barang',
        qty: itemQty,
        unit: itemUnit || 'Pcs'
      };
      tr.lines.push(lineItem);
      tr.details.push(lineItem);
    }

    if (itemsDetailIdx !== -1 && row[itemsDetailIdx]) {
      const oldLines = parseItemDetailsText(row[itemsDetailIdx]);
      if (Array.isArray(oldLines)) {
        oldLines.forEach(l => {
          tr.lines.push(l);
          tr.details.push(l);
        });
      }
    }
  }

  trList.forEach(tr => {
    tr.items = tr.lines.length;
    tr.qty = tr.lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  });

  return sortLatestFirst(trList);
}

/**
 * Membaca sheet STOK_OPNAME dengan kolom terpisah: sku, nama_barang, stok_sistem, stok_fisik, selisih, satuan
 */
function readOpnamesSheet(ss) {
  const sheet = getSheetByAliases(ss, [SHEET_NAMES.OPNAMES, 'STOK_OPNAME', 'OPNAMES']);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h || '').trim());
  const lowerHeaders = headers.map(h => h.toLowerCase());

  const idIdx = lowerHeaders.indexOf('id');
  let noIdx = lowerHeaders.indexOf('transaction_no');
  if (noIdx === -1) noIdx = lowerHeaders.indexOf('no');
  if (noIdx === -1) noIdx = lowerHeaders.indexOf('nomor');
  const dateIdx = lowerHeaders.indexOf('date');
  const whIdx = lowerHeaders.indexOf('warehouse');
  const userIdx = lowerHeaders.indexOf('user');
  const statusIdx = lowerHeaders.indexOf('status');
  const appByIdx = lowerHeaders.indexOf('approvedby');
  const appAtIdx = lowerHeaders.indexOf('approvedat');
  const notesIdx = lowerHeaders.indexOf('notes');

  const skuIdx = lowerHeaders.indexOf('sku') !== -1 ? lowerHeaders.indexOf('sku') : lowerHeaders.indexOf('kode_barang');
  let nameIdx = lowerHeaders.indexOf('nama_barang');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('namabarang');
  if (nameIdx === -1) nameIdx = lowerHeaders.indexOf('name');

  const sysIdx = lowerHeaders.indexOf('stok_sistem') !== -1 ? lowerHeaders.indexOf('stok_sistem') : lowerHeaders.indexOf('systemqty');
  const physIdx = lowerHeaders.indexOf('stok_fisik') !== -1 ? lowerHeaders.indexOf('stok_fisik') : lowerHeaders.indexOf('physicalqty');
  const diffIdx = lowerHeaders.indexOf('selisih') !== -1 ? lowerHeaders.indexOf('selisih') : lowerHeaders.indexOf('diff');
  const unitIdx = lowerHeaders.indexOf('satuan') !== -1 ? lowerHeaders.indexOf('satuan') : lowerHeaders.indexOf('unit');

  let itemsDetailIdx = lowerHeaders.indexOf('items_detail');
  if (itemsDetailIdx === -1) itemsDetailIdx = lowerHeaders.indexOf('items_json');

  const opMap = {};
  const opList = [];
  let lastOpNo = '';

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === '' || cell === null)) continue;

    let rowNo = noIdx !== -1 ? String(row[noIdx] || '').trim() : '';
    let rowId = idIdx !== -1 ? String(row[idIdx] || '').trim() : '';

    if (!rowNo && !rowId && lastOpNo) rowNo = lastOpNo;
    if (!rowNo && !rowId) continue;
    const key = rowNo || rowId;
    lastOpNo = key;

    let op = opMap[key];
    if (!op) {
      op = {
        id: rowId || ('OP' + String(opList.length + 1).padStart(4, '0')),
        transaction_no: rowNo || rowId,
        no: rowNo || rowId,
        date: dateIdx !== -1 ? String(row[dateIdx] || '').trim() : '',
        warehouse: whIdx !== -1 ? String(row[whIdx] || '').trim() : '',
        user: userIdx !== -1 ? String(row[userIdx] || '').trim() : '',
        status: statusIdx !== -1 ? String(row[statusIdx] || '').trim() : 'Posted',
        approvedBy: appByIdx !== -1 ? String(row[appByIdx] || '').trim() : '',
        approvedAt: appAtIdx !== -1 ? String(row[appAtIdx] || '').trim() : '',
        notes: notesIdx !== -1 ? String(row[notesIdx] || '').trim() : '',
        items: [],
        itemsCount: 0,
        totalDiff: 0
      };
      opMap[key] = op;
      opList.push(op);
    }

    const itemSku = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : '';
    const itemName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const sysQty = sysIdx !== -1 ? parseNumeric(row[sysIdx], 0) : 0;
    const physQty = physIdx !== -1 ? parseNumeric(row[physIdx], 0) : 0;
    const diffQty = diffIdx !== -1 ? parseNumeric(row[diffIdx], 0) : (physQty - sysQty);
    const itemUnit = unitIdx !== -1 ? String(row[unitIdx] || '').trim() : 'Rim';

    if (itemSku || itemName) {
      op.items.push({
        productId: itemSku || ('P' + String(op.items.length + 1).padStart(3, '0')),
        sku: itemSku,
        name: itemName || itemSku || 'Barang',
        systemQty: sysQty,
        physicalQty: physQty,
        diff: diffQty,
        qty: diffQty,
        unit: itemUnit || 'Rim'
      });
    }

    if (itemsDetailIdx !== -1 && row[itemsDetailIdx]) {
      const oldItems = parseItemDetailsText(row[itemsDetailIdx]);
      if (Array.isArray(oldItems)) {
        oldItems.forEach(it => op.items.push(it));
      }
    }
  }

  opList.forEach(op => {
    op.itemsCount = op.items.length;
    op.totalDiff = op.items.reduce((sum, it) => sum + (Number(it.diff) || 0), 0);
  });

  return sortLatestFirst(opList);
}

// =============================================================================
// DATABASE WRITERS (MENYIMPAN DATA KE SPREADSHEET DENGAN KOLOM TERPISAH)
// =============================================================================

/**
 * Menyimpan data gambar Base64 ke Google Drive dan mengembalikan URL publik,
 * atau menyimpan teks base64 langsung jika Drive tidak tersedia dan ukuran aman (<45.000 karakter).
 */
function saveBase64ImageToDriveOrCell(base64Data, fileNamePrefix) {
  if (!base64Data || typeof base64Data !== 'string') return '';
  const str = base64Data.trim();
  if (!str) return '';
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  if (!str.startsWith('data:image')) return str.length < 45000 ? str : '';

  try {
    if (typeof DriveApp !== 'undefined') {
      const folderName = 'StokKita_Bukti_Foto';
      const folders = DriveApp.getFoldersByName(folderName);
      const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

      const mimeTypeMatch = str.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
      const cleanBase64 = str.replace(/^data:image\/[a-zA-Z0-9\+\-\.]+;base64,/, '');
      const decodedBytes = Utilities.base64Decode(cleanBase64);
      const ext = mimeType.includes('png') ? '.png' : (mimeType.includes('webp') ? '.webp' : '.jpg');
      const pfx = fileNamePrefix || 'FOTO';
      const fileName = `${pfx}_${Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmmss')}_${Math.floor(Math.random() * 1000)}${ext}`;
      const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
      const file = folder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}
      return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1200`;
    }
  } catch (err) {
    Logger.log('Gagal menyimpan gambar ke Drive: ' + err);
  }

  if (str.length < 45000) {
    return str;
  }
  return '';
}

function saveAllDataToSpreadsheet(data) {
  if (!data) return;
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000); // Kunci script hingga 30 detik untuk keamanan data multi-user
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Settings
    if (data.settings) writeSettingsSheet(ss, data.settings);

    // 2. Categories
    if (data.categories) {
      writeTableSheet(ss, SHEET_NAMES.CATEGORIES, data.categories.map(c => ({
        id: c.id || '',
        code: c.code || '',
        name: c.name || '',
        description: c.description || c.desc || ''
      })), ['id', 'code', 'name', 'description']);
    }

    // 3. Warehouses
    if (data.warehouses) {
      writeTableSheet(ss, SHEET_NAMES.WAREHOUSES, data.warehouses, ['id', 'code', 'name', 'address', 'active']);
    }

    // 4. Products (KOLOM TERPISAH PER GUDANG)
    if (data.products) {
      writeProductsSheet(ss, data.products, data.warehouses);
    }

    // 5. Users
    if (data.users) {
      writeTableSheet(ss, SHEET_NAMES.USERS, data.users, ['id', 'username', 'code', 'name', 'role', 'warehouse', 'password', 'active', 'lastLogin']);
    }

    // 6. Transaksi Barang Masuk (KOLOM TERPISAH: sku, nama_barang, qty, satuan, foto)
    // 7. Transaksi Barang Keluar (KOLOM TERPISAH: sku, nama_barang, qty, satuan, foto)
    if (data.transactions) {
      writeTransactionsInSheet(ss, data.transactions);
      writeTransactionsOutSheet(ss, data.transactions);
    }

    // 8. Transfers (KOLOM TERPISAH: sku, nama_barang, qty, satuan, foto)
    if (data.transfers) writeTransfersSheet(ss, data.transfers);

    // 9. Stok Opname (KOLOM TERPISAH: sku, nama_barang, stok_sistem, stok_fisik, selisih, satuan)
    if (data.opnames) writeOpnamesSheet(ss, data.opnames);

    // 10. Damaged Items (KOLOM transaction_no, foto & Urutan Kronologis)
    if (data.damagedItems) {
      const preparedDamaged = (data.damagedItems || []).map(d => ({
        ...d,
        foto: saveBase64ImageToDriveOrCell(d.photo || d.foto, 'DMG_' + (d.transaction_no || d.no || 'item'))
      }));
      writeTableSheet(ss, SHEET_NAMES.DAMAGED_ITEMS, sortChronological(preparedDamaged), [
        'id', 'transaction_no', 'date', 'warehouse', 'productId', 'productName', 'sku', 'qty', 'unit', 'issueType', 'action', 'refNo', 'status', 'notes', 'user', 'foto'
      ]);
    }

    // 11. Stock Ledger (Kartu Stok - Urutan Kronologis)
    if (data.stockLedger) {
      writeTableSheet(ss, SHEET_NAMES.STOCK_LEDGER, sortChronological(data.stockLedger), [
        'id', 'date', 'productId', 'warehouse', 'type', 'qty', 'balanceAfter', 'refNo', 'user', 'notes'
      ]);
    }

    // 12. Audit Logs (Urutan Kronologis)
    if (data.auditLogs) {
      writeTableSheet(ss, SHEET_NAMES.AUDIT_LOGS, sortChronological(data.auditLogs), ['id', 'time', 'user', 'action', 'entity', 'ref', 'description']);
    }
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function writeSettingsSheet(ss, settings) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.SETTINGS);
  sheet.clear();
  const rows = [['SettingKey', 'SettingValue']];
  Object.keys(settings).forEach(key => {
    rows.push([key, String(settings[key])]);
  });
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  formatHeaderRow(sheet, 2);
}

function writeTableSheet(ss, sheetName, items, columns) {
  const sheet = getOrCreateSheet(ss, sheetName);
  sheet.clear();
  if (!items || items.length === 0) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    formatHeaderRow(sheet, columns.length);
    return;
  }
  const rows = [columns];
  const prefix = sheetName.substring(0, 3).toUpperCase();
  const usedIds = new Set();

  items.forEach((item, idx) => {
    let itemId = item.id;
    if (!itemId || usedIds.has(itemId)) {
      itemId = prefix + String(idx + 1).padStart(4, '0');
      let counter = 1;
      while (usedIds.has(itemId)) {
        itemId = prefix + String(idx + 1 + counter).padStart(4, '0');
        counter++;
      }
    }
    usedIds.add(itemId);

    const row = columns.map(col => {
      if (col === 'id') return itemId;
      if (col === 'transaction_no') return item.transaction_no || item.no || '';
      const val = item[col];
      return val !== undefined && val !== null ? val : '';
    });
    rows.push(row);
  });
  sheet.getRange(1, 1, rows.length, columns.length).setValues(rows);
  formatHeaderRow(sheet, columns.length);
}

function writeProductsSheet(ss, products, warehouses) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.PRODUCTS);
  sheet.clear();

  const warehouseNames = getWarehouseNames(ss, products, warehouses);
  const baseCols = ['id', 'sku', 'barcode', 'name', 'category', 'unit', 'min', 'active', 'foto'];
  const cols = [...baseCols, ...warehouseNames, 'total_stock'];
  const rows = [cols];

  const firstWhColIdx = baseCols.length + 1;
  const lastWhColIdx = baseCols.length + warehouseNames.length;
  const firstWhLetter = columnToLetter(firstWhColIdx);
  const lastWhLetter = columnToLetter(lastWhColIdx);

  (products || []).forEach((p, idx) => {
    const rowNum = idx + 2;
    const minVal = parseNumeric(p.min !== undefined ? p.min : p.minStock, 0);
    const activeVal = parseBoolean(p.active, true);
    const photoVal = saveBase64ImageToDriveOrCell(p.photo || p.foto || '', 'Produk_' + (p.sku || p.id || 'item'));

    const row = [
      p.id || ('P' + String(idx + 1).padStart(3, '0')),
      p.sku || '',
      p.barcode || p.sku || '',
      p.name || '',
      p.category || '',
      p.unit || '',
      minVal,
      activeVal,
      photoVal
    ];

    let sumStock = 0;
    warehouseNames.forEach(wh => {
      const stockVal = parseNumeric(p.stocks && p.stocks[wh] !== undefined ? p.stocks[wh] : 0, 0);
      row.push(stockVal);
      sumStock += stockVal;
    });

    if (warehouseNames.length > 0) {
      row.push(`=SUM(${firstWhLetter}${rowNum}:${lastWhLetter}${rowNum})`);
    } else {
      row.push(sumStock);
    }

    rows.push(row);
  });

  if (rows.length === 1) {
    sheet.getRange(1, 1, 1, cols.length).setValues(rows);
  } else {
    sheet.getRange(1, 1, rows.length, cols.length).setValues(rows);
  }

  formatHeaderRow(sheet, cols.length);

  if (rows.length > 1) {
    sheet.getRange(2, 6, rows.length - 1, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
    sheet.getRange(2, 7, rows.length - 1, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 8, rows.length - 1, 1).setWrap(false);
    if (warehouseNames.length > 0) {
      sheet.getRange(2, firstWhColIdx, rows.length - 1, warehouseNames.length + 1)
           .setNumberFormat('#,##0')
           .setHorizontalAlignment('right');
    }
  }
}

/**
 * Menulis sheet BARANG_MASUK dengan kolom terpisah: sku, nama_barang, qty, satuan
 * Setiap item dicatat sebagai baris tersendiri dengan ID unik dan urutan kronologis dari atas ke bawah (data baru di bawah).
 */
function writeTransactionsInSheet(ss, transactions) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.TRANSACTIONS_IN);
  sheet.clear();

  // Urutkan transaksi secara kronologis (tanggal terlama di atas, terbaru di baris paling bawah)
  const inTx = sortChronological((transactions || []).filter(t => {
    const tp = String(t.type || '').toLowerCase();
    return tp.includes('masuk') || tp === 'in';
  }));

  const cols = ['id', 'transaction_no', 'date', 'warehouse', 'supplier', 'refNo', 'user', 'status', 'notes', 'sku', 'nama_barang', 'qty', 'satuan', 'foto'];
  const rows = [cols];

  let seqId = 1;
  inTx.forEach(t => {
    const baseId = t.id || ('IN' + String(seqId).padStart(4, '0'));
    const txNo = t.transaction_no || t.no || ('IN-' + String(seqId).padStart(4, '0'));
    const details = Array.isArray(t.details) && t.details.length > 0 ? t.details : [{ sku: '', name: '', qty: t.qty || 0, unit: 'Pcs' }];
    const photoVal = saveBase64ImageToDriveOrCell(t.photo || t.foto, 'IN_' + txNo);

    details.forEach((d, dIdx) => {
      const rowId = dIdx === 0 ? baseId : (baseId + '-' + (dIdx + 1));
      rows.push([
        rowId,
        txNo,
        t.date || '',
        t.warehouse || '',
        t.supplier || t.party || '',
        t.refNo || '',
        t.user || '',
        t.status || 'Posted',
        t.notes || '',
        d.sku || d.productId || '',
        d.name || '',
        parseNumeric(d.qty, 0),
        d.unit || 'Pcs',
        dIdx === 0 ? photoVal : ''
      ]);
      seqId++;
    });
  });

  sheet.getRange(1, 1, rows.length, cols.length).setValues(rows);
  formatHeaderRow(sheet, cols.length);

  if (rows.length > 1) {
    // Format angka pada kolom qty (kolom 12)
    sheet.getRange(2, 12, rows.length - 1, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
  }
}

/**
 * Menulis sheet BARANG_KELUAR dengan kolom terpisah: sku, nama_barang, qty, satuan, foto
 * Setiap item dicatat sebagai baris tersendiri dengan ID unik dan urutan kronologis dari atas ke bawah.
 */
function writeTransactionsOutSheet(ss, transactions) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.TRANSACTIONS_OUT);
  sheet.clear();

  // Urutkan transaksi secara kronologis (tanggal terlama di atas, terbaru di baris paling bawah)
  const outTx = sortChronological((transactions || []).filter(t => {
    const tp = String(t.type || '').toLowerCase();
    return tp.includes('keluar') || tp === 'out';
  }));

  const cols = ['id', 'transaction_no', 'date', 'warehouse', 'customer', 'refNo', 'user', 'status', 'notes', 'sku', 'nama_barang', 'qty', 'satuan', 'foto'];
  const rows = [cols];

  let seqId = 1;
  outTx.forEach(t => {
    const baseId = t.id || ('OUT' + String(seqId).padStart(4, '0'));
    const txNo = t.transaction_no || t.no || ('OUT-' + String(seqId).padStart(4, '0'));
    const details = Array.isArray(t.details) && t.details.length > 0 ? t.details : [{ sku: '', name: '', qty: t.qty || 0, unit: 'Pcs' }];
    const photoVal = saveBase64ImageToDriveOrCell(t.photo || t.foto, 'OUT_' + txNo);

    details.forEach((d, dIdx) => {
      const rowId = dIdx === 0 ? baseId : (baseId + '-' + (dIdx + 1));
      rows.push([
        rowId,
        txNo,
        t.date || '',
        t.warehouse || '',
        t.customer || t.party || '',
        t.refNo || '',
        t.user || '',
        t.status || 'Posted',
        t.notes || '',
        d.sku || d.productId || '',
        d.name || '',
        parseNumeric(d.qty, 0),
        d.unit || 'Pcs',
        dIdx === 0 ? photoVal : ''
      ]);
      seqId++;
    });
  });

  sheet.getRange(1, 1, rows.length, cols.length).setValues(rows);
  formatHeaderRow(sheet, cols.length);

  if (rows.length > 1) {
    // Format angka pada kolom qty (kolom 12)
    sheet.getRange(2, 12, rows.length - 1, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
  }
}

/**
 * Menulis sheet TRANSFERS dengan kolom terpisah: sku, nama_barang, qty, satuan, foto
 * Setiap item dicatat sebagai baris tersendiri dengan ID unik dan urutan kronologis.
 */
function writeTransfersSheet(ss, transfers) {
  if (!transfers || transfers.length === 0) {
    const existing = getSheetByAliases(ss, [SHEET_NAMES.TRANSFERS, 'TRANSFERS', 'MUTASI_GUDANG', 'TRANSFER_GUDANG']);
    if (!existing) return;
  }
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.TRANSFERS);
  sheet.clear();

  const sorted = sortChronological(transfers || []);
  const cols = ['id', 'transaction_no', 'date', 'fromWarehouse', 'toWarehouse', 'refNo', 'user', 'status', 'notes', 'sku', 'nama_barang', 'qty', 'satuan', 'foto'];
  const rows = [cols];

  let seqId = 1;
  sorted.forEach(tr => {
    const baseId = tr.id || ('TRF' + String(seqId).padStart(4, '0'));
    const txNo = tr.transaction_no || tr.no || ('TRF-' + String(seqId).padStart(4, '0'));
    const lines = Array.isArray(tr.lines || tr.details) && (tr.lines || tr.details).length > 0 ? (tr.lines || tr.details) : [{ sku: '', name: '', qty: tr.qty || 0, unit: 'Pcs' }];
    const photoVal = saveBase64ImageToDriveOrCell(tr.photo || tr.foto, 'TRF_' + txNo);

    lines.forEach((d, dIdx) => {
      const rowId = dIdx === 0 ? baseId : (baseId + '-' + (dIdx + 1));
      rows.push([
        rowId,
        txNo,
        tr.date || '',
        tr.fromWarehouse || '',
        tr.toWarehouse || '',
        tr.refNo || '',
        tr.user || '',
        tr.status || 'In Transit',
        tr.notes || '',
        d.sku || d.productId || '',
        d.name || '',
        parseNumeric(d.qty, 0),
        d.unit || 'Pcs',
        dIdx === 0 ? photoVal : ''
      ]);
      seqId++;
    });
  });

  sheet.getRange(1, 1, rows.length, cols.length).setValues(rows);
  formatHeaderRow(sheet, cols.length);

  if (rows.length > 1) {
    sheet.getRange(2, 12, rows.length - 1, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
  }
}

/**
 * Menulis sheet STOK_OPNAME dengan kolom terpisah: sku, nama_barang, stok_sistem, stok_fisik, selisih, satuan
 * Setiap item dicatat sebagai baris tersendiri dengan ID unik dan urutan kronologis.
 */
function writeOpnamesSheet(ss, opnames) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.OPNAMES);
  sheet.clear();

  const sorted = sortChronological(opnames || []);
  const cols = ['id', 'transaction_no', 'date', 'warehouse', 'user', 'status', 'approvedBy', 'approvedAt', 'notes', 'sku', 'nama_barang', 'stok_sistem', 'stok_fisik', 'selisih', 'satuan'];
  const rows = [cols];

  let seqId = 1;
  sorted.forEach(op => {
    const baseId = op.id || ('OP' + String(seqId).padStart(4, '0'));
    const txNo = op.transaction_no || op.no || ('SO-' + String(seqId).padStart(4, '0'));
    const items = Array.isArray(op.items || op.lines) && (op.items || op.lines).length > 0 ? (op.items || op.lines) : [{ sku: '', name: '', systemQty: 0, physicalQty: 0, diff: 0, unit: 'Rim' }];

    items.forEach((d, dIdx) => {
      const sysVal = parseNumeric(d.systemQty, 0);
      const physVal = parseNumeric(d.physicalQty !== undefined ? d.physicalQty : (sysVal + parseNumeric(d.diff, 0)), sysVal);
      const diffVal = parseNumeric(d.diff !== undefined ? d.diff : (physVal - sysVal), 0);
      const rowId = dIdx === 0 ? baseId : (baseId + '-' + (dIdx + 1));

      rows.push([
        rowId,
        txNo,
        op.date || '',
        op.warehouse || '',
        op.user || '',
        op.status || 'Posted',
        op.approvedBy || '',
        op.approvedAt || '',
        op.notes || '',
        d.sku || d.productId || '',
        d.name || '',
        sysVal,
        physVal,
        diffVal,
        d.unit || 'Rim'
      ]);
      seqId++;
    });
  });

  sheet.getRange(1, 1, rows.length, cols.length).setValues(rows);
  formatHeaderRow(sheet, cols.length);

  if (rows.length > 1) {
    // Format angka pada kolom stok_sistem (12), stok_fisik (13), selisih (14)
    sheet.getRange(2, 12, rows.length - 1, 3).setNumberFormat('#,##0').setHorizontalAlignment('right');
  }
}

/**
 * Format baris header tabel
 */
function formatHeaderRow(sheet, colCount) {
  const headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground('#176b57')
             .setFontColor('#ffffff')
             .setFontWeight('bold')
             .setFontFamily('Arial')
             .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

// =============================================================================
// FUNGSI MIGRASI OTOMATIS (MIGRASI KE STRUKTUR KOLOM TERPISAH BARU)
// =============================================================================

/**
 * Jalankan fungsi ini 1 kali untuk memisahkan seluruh kolom gabungan lama
 * menjadi kolom-kolom baru terpisah yang rapi.
 */
function migrateDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];

  // 1. Migrasi sheet PRODUCTS
  const prodSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  if (prodSheet && prodSheet.getLastRow() > 1) {
    const products = readProductsSheet(ss);
    if (products.length > 0) {
      writeProductsSheet(ss, products);
      results.push(`PRODUCTS: ${products.length} barang berhasil dipisahkan ke kolom gudang masing-masing.`);
    }
  }

  // 2. Migrasi transaksi ke BARANG_MASUK & BARANG_KELUAR dengan kolom terpisah
  const allTx = readAllTransactions(ss);
  if (allTx.length > 0) {
    writeTransactionsInSheet(ss, allTx);
    writeTransactionsOutSheet(ss, allTx);
    results.push(`TRANSAKSI: ${allTx.length} transaksi berhasil dipisahkan ke sheet BARANG_MASUK & BARANG_KELUAR dengan kolom terpisah (sku, nama_barang, qty, satuan).`);
  }

  // 3. Migrasi sheet TRANSFERS
  const trSheet = ss.getSheetByName(SHEET_NAMES.TRANSFERS);
  if (trSheet && trSheet.getLastRow() > 1) {
    const tr = readTransfersSheet(ss);
    if (tr.length > 0) {
      writeTransfersSheet(ss, tr);
      results.push(`TRANSFERS: ${tr.length} mutasi transfer berhasil diperbarui ke kolom terpisah.`);
    }
  }

  // 4. Migrasi sheet STOK_OPNAME
  const opSheet = getSheetByAliases(ss, [SHEET_NAMES.OPNAMES, 'STOK_OPNAME', 'OPNAMES']);
  if (opSheet && opSheet.getLastRow() > 1) {
    const op = readOpnamesSheet(ss);
    if (op.length > 0) {
      writeOpnamesSheet(ss, op);
      results.push(`STOK_OPNAME: ${op.length} opname berhasil diperbarui ke kolom terpisah & transaction_no.`);
    }
  }

  // 5. Migrasi sheet DAMAGED_ITEMS
  const dmgSheet = ss.getSheetByName(SHEET_NAMES.DAMAGED_ITEMS);
  if (dmgSheet && dmgSheet.getLastRow() > 1) {
    const dmg = readTableSheet(ss, SHEET_NAMES.DAMAGED_ITEMS);
    if (dmg.length > 0) {
      writeTableSheet(ss, SHEET_NAMES.DAMAGED_ITEMS, sortChronological(dmg), [
        'id', 'transaction_no', 'date', 'warehouse', 'productId', 'productName', 'sku', 'qty', 'unit', 'issueType', 'action', 'refNo', 'status', 'notes', 'user', 'foto'
      ]);
      results.push(`DAMAGED_ITEMS: ${dmg.length} catatan barang rusak berhasil diperbarui ke transaction_no.`);
    }
  }

  // 6. Hapus sheet lama yang sudah usang dan digantikan (TRANSACTIONS dan OPNAMES)
  const deletedOldSheets = [];
  const oldTransactionsSheet = ss.getSheetByName('TRANSACTIONS');
  if (oldTransactionsSheet) {
    try {
      ss.deleteSheet(oldTransactionsSheet);
      deletedOldSheets.push('TRANSACTIONS (sudah digantikan BARANG_MASUK & BARANG_KELUAR)');
    } catch (e) {
      Logger.log('Gagal menghapus sheet TRANSACTIONS: ' + e);
    }
  }
  const oldOpnamesSheet = ss.getSheetByName('OPNAMES');
  if (oldOpnamesSheet) {
    try {
      ss.deleteSheet(oldOpnamesSheet);
      deletedOldSheets.push('OPNAMES (sudah digantikan STOK_OPNAME)');
    } catch (e) {
      Logger.log('Gagal menghapus sheet OPNAMES: ' + e);
    }
  }
  if (deletedOldSheets.length > 0) {
    results.push(`PEMBERSIHAN: Sheet lama yang sudah usang berhasil dihapus: ${deletedOldSheets.join(', ')}`);
  }

  const msg = results.length > 0
    ? 'Migrasi database berhasil diselesaikan!\n- ' + results.join('\n- ')
    : 'Seluruh sheet sudah menggunakan skema kolom terpisah terbaru.';

  Logger.log(msg);
  return msg;
}

/**
 * Fungsi khusus untuk menghapus sheet-sheet lama yang sudah tidak diperlukan (TRANSACTIONS & OPNAMES).
 * Jalankan fungsi ini dari menu dropdown Google Apps Script jika ingin membersihkan sheet lama secara instan.
 */
function deleteObsoleteSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const deleted = [];

  const oldTx = ss.getSheetByName('TRANSACTIONS');
  if (oldTx) {
    try {
      ss.deleteSheet(oldTx);
      deleted.push('TRANSACTIONS');
    } catch (e) {
      Logger.log('Gagal menghapus sheet TRANSACTIONS: ' + e);
    }
  }

  const oldOp = ss.getSheetByName('OPNAMES');
  if (oldOp) {
    try {
      ss.deleteSheet(oldOp);
      deleted.push('OPNAMES');
    } catch (e) {
      Logger.log('Gagal menghapus sheet OPNAMES: ' + e);
    }
  }

  const msg = deleted.length > 0
    ? 'Berhasil menghapus sheet lama dari Google Spreadsheet: ' + deleted.join(', ')
    : 'Tidak ada sheet usang yang ditemukan (sheet TRANSACTIONS dan OPNAMES sudah tidak ada).';

  Logger.log(msg);
  return msg;
}

// =============================================================================
// INISIALISASI DATABASE AMAN (DATA TIDAK AKAN TERTAMPA / TERHAPUS)
// =============================================================================

/**
 * Inisialisasi struktur database secara AMAN TANPA MENGHAPUS / MENIMPA DATA LAMA.
 * - Jika sheet sudah ada dan berisi data, data akan dipertahankan 100%.
 * - Hanya sheet yang belum ada atau masih kosong yang akan dibuatkan baris headernya.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summary = [];

  // Helper untuk inisialisasi sheet secara aman
  function ensureSheetSafe(sheetName, defaultHeaders, defaultRowsIfEmpty) {
    if (!defaultRowsIfEmpty) defaultRowsIfEmpty = [];
    let sheet = ss.getSheetByName(sheetName);
    let isNew = false;
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      isNew = true;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      // Sheet masih kosong / baru dibuat -> Pasang header dan data default jika ada
      sheet.clear();
      const allRows = [defaultHeaders, ...defaultRowsIfEmpty];
      sheet.getRange(1, 1, allRows.length, defaultHeaders.length).setValues(allRows);
      formatHeaderRow(sheet, defaultHeaders.length);
      summary.push(`[BARU] Sheet ${sheetName} diinisialisasi (${defaultRowsIfEmpty.length} baris default).`);
    } else {
      // Sheet SUDAH BERISI DATA -> JANGAN HAPUS ATAU TIMPA!
      summary.push(`[AMAN] Sheet ${sheetName} sudah berisi ${lastRow - 1} baris data. Data dipertahankan utuh.`);
    }
    return sheet;
  }

  // 1. SETTINGS
  let setSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!setSheet || setSheet.getLastRow() <= 1) {
    writeSettingsSheet(ss, {
      businessName: 'StokKita Inventori',
      phone: '',
      address: '',
      timezone: 'Asia/Jakarta (WIB)',
      rejectNegativeStock: true,
      autoLogoutEnabled: true,
      autoLogoutMinutes: 15,
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash'
    });
    summary.push(`[BARU] Sheet SETTINGS diinisialisasi.`);
  } else {
    summary.push(`[AMAN] Sheet SETTINGS sudah ada. Data pengaturan dipertahankan.`);
  }

  // 2. CATEGORIES
  ensureSheetSafe(SHEET_NAMES.CATEGORIES, ['id', 'code', 'name', 'description']);

  // 3. WAREHOUSES
  const defaultWarehouses = [
    ['W01', 'GDG-01', 'Gudang Utama', '', true]
  ];
  ensureSheetSafe(SHEET_NAMES.WAREHOUSES, ['id', 'code', 'name', 'address', 'active'], defaultWarehouses);

  // 4. PRODUCTS
  let prodSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  if (!prodSheet || prodSheet.getLastRow() <= 1) {
    const defaultWhObj = [{ id: 'W01', code: 'GDG-01', name: 'Gudang Utama', address: '', active: true }];
    writeProductsSheet(ss, [], defaultWhObj);
    summary.push(`[BARU] Sheet PRODUCTS diinisialisasi.`);
  } else {
    summary.push(`[AMAN] Sheet PRODUCTS sudah berisi ${prodSheet.getLastRow() - 1} barang. Data dipertahankan utuh.`);
  }

  // 5. USERS
  const defaultUsers = [
    ['U01', 'admin', 'ADM', 'Administrator', 'ADMIN', 'Semua Gudang', 'admin', true, '']
  ];
  ensureSheetSafe(SHEET_NAMES.USERS, ['id', 'username', 'code', 'name', 'role', 'warehouse', 'password', 'active', 'lastLogin'], defaultUsers);

  // 6. BARANG_MASUK
  ensureSheetSafe(SHEET_NAMES.TRANSACTIONS_IN, ['id', 'transaction_no', 'date', 'warehouse', 'supplier', 'refNo', 'user', 'status', 'notes', 'sku', 'nama_barang', 'qty', 'satuan', 'foto']);

  // 7. BARANG_KELUAR
  ensureSheetSafe(SHEET_NAMES.TRANSACTIONS_OUT, ['id', 'transaction_no', 'date', 'warehouse', 'customer', 'refNo', 'user', 'status', 'notes', 'sku', 'nama_barang', 'qty', 'satuan', 'foto']);

  // 8. TRANSFERS
  ensureSheetSafe(SHEET_NAMES.TRANSFERS, ['id', 'transaction_no', 'date', 'fromWarehouse', 'toWarehouse', 'refNo', 'status', 'user', 'notes', 'sku', 'nama_barang', 'qty', 'satuan']);

  // 9. STOK_OPNAME
  ensureSheetSafe(SHEET_NAMES.OPNAMES, ['id', 'transaction_no', 'date', 'warehouse', 'user', 'notes', 'sku', 'nama_barang', 'stok_sistem', 'stok_fisik', 'selisih', 'satuan']);

  // 10. DAMAGED_ITEMS
  ensureSheetSafe(SHEET_NAMES.DAMAGED_ITEMS, ['id', 'transaction_no', 'date', 'warehouse', 'productId', 'productName', 'sku', 'qty', 'unit', 'issueType', 'action', 'refNo', 'status', 'notes', 'user', 'foto']);

  // 11. STOCK_LEDGER
  ensureSheetSafe(SHEET_NAMES.STOCK_LEDGER, ['id', 'date', 'productId', 'warehouse', 'type', 'qty', 'balanceAfter', 'refNo', 'user', 'notes']);

  // 12. AUDIT_LOGS
  ensureSheetSafe(SHEET_NAMES.AUDIT_LOGS, ['id', 'time', 'user', 'action', 'entity', 'ref', 'description']);

  // Hapus "Sheet1" kosong bawaan spreadsheet jika ada sheet lain
  ['Sheet1', 'Sheet 1'].forEach(oldName => {
    const s = ss.getSheetByName(oldName);
    if (s && ss.getSheets().length > 1 && s.getLastRow() <= 1) {
      try { ss.deleteSheet(s); } catch (e) {}
    }
  });

  const report = summary.join('\n');
  Logger.log('=== HASIL SETUP DATABASE (AMAN) ===\n' + report);
  return report;
}

/**
 * Backup seluruh database ke file spreadsheet baru di Google Drive sebelum melakukan perubahan.
 */
function backupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeStr = Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmm');
  const backupName = `BACKUP_STOKKITA_${timeStr}_${ss.getName()}`;
  const copy = ss.copy(backupName);
  const msg = `Backup database berhasil dibuat! Tersimpan di Google Drive dengan nama: "${backupName}" (ID: ${copy.getId()})`;
  Logger.log(msg);
  return msg;
}

/**
 * PERINGATAN: FUNGSI INI MENGHAPUS SELURUH DATA SPREADSHEET (FACTORY RESET)!
 * Hanya jalankan jika Anda benar-benar ingin mengosongkan seluruh isi data.
 */
function resetDatabaseTotalBersih_HATI_HATI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. SETTINGS
  writeSettingsSheet(ss, {
    businessName: 'StokKita Inventori',
    phone: '',
    address: '',
    timezone: 'Asia/Jakarta (WIB)',
    rejectNegativeStock: true,
    autoLogoutEnabled: true,
    autoLogoutMinutes: 15,
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash'
  });

  // 2. CATEGORIES
  writeTableSheet(ss, SHEET_NAMES.CATEGORIES, [], ['id', 'code', 'name', 'description']);

  // 3. WAREHOUSES
  const defaultWarehouses = [
    { id: 'W01', code: 'GDG-01', name: 'Gudang Utama', address: '', active: true }
  ];
  writeTableSheet(ss, SHEET_NAMES.WAREHOUSES, defaultWarehouses, ['id', 'code', 'name', 'address', 'active']);

  // 4. PRODUCTS
  writeProductsSheet(ss, [], defaultWarehouses);

  // 5. USERS
  const defaultUsers = [
    { id: 'U01', username: 'admin', code: 'ADM', name: 'Administrator', role: 'ADMIN', warehouse: 'Semua Gudang', password: 'admin', active: true, lastLogin: '' }
  ];
  writeTableSheet(ss, SHEET_NAMES.USERS, defaultUsers, ['id', 'username', 'code', 'name', 'role', 'warehouse', 'password', 'active', 'lastLogin']);

  // 6. BARANG_MASUK
  writeTransactionsInSheet(ss, []);

  // 7. BARANG_KELUAR
  writeTransactionsOutSheet(ss, []);

  // 8. TRANSFERS
  writeTransfersSheet(ss, []);

  // 9. STOK_OPNAME
  writeOpnamesSheet(ss, []);

  // 10. DAMAGED_ITEMS
  writeTableSheet(ss, SHEET_NAMES.DAMAGED_ITEMS, [], [
    'id', 'transaction_no', 'date', 'warehouse', 'productId', 'productName', 'sku', 'qty', 'unit', 'issueType', 'action', 'refNo', 'status', 'notes', 'user', 'foto'
  ]);

  // 11. STOCK_LEDGER
  writeTableSheet(ss, SHEET_NAMES.STOCK_LEDGER, [], [
    'id', 'date', 'productId', 'warehouse', 'type', 'qty', 'balanceAfter', 'refNo', 'user', 'notes'
  ]);

  // 12. AUDIT_LOGS
  writeTableSheet(ss, SHEET_NAMES.AUDIT_LOGS, [], ['id', 'time', 'user', 'action', 'entity', 'ref', 'description']);

  // Hapus "Sheet1" dan sheet-sheet lama jika ada
  ['Sheet1', 'Sheet 1', 'TRANSACTIONS', 'OPNAMES'].forEach(oldName => {
    const s = ss.getSheetByName(oldName);
    if (s && ss.getSheets().length > 1) {
      try { ss.deleteSheet(s); } catch (e) {}
    }
  });

  return 'Database berhasil direset bersih ke pengaturan pabrik.';
}

// =============================================================================
// GRANULAR DATABASE WRITERS (APPEND TRANSAKSI TANPA OVERWRITE TOTAL)
// =============================================================================

function appendAuditLogServer(ss, log) {
  if (!log) return;
  try {
    const sheet = getOrCreateSheet(ss, SHEET_NAMES.AUDIT_LOGS);
    const lastRow = sheet.getLastRow();
    const cols = ['id', 'time', 'user', 'action', 'entity', 'ref', 'description'];
    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
      formatHeaderRow(sheet, cols.length);
    }
    const logId = 'A' + Date.now();
    const logTime = log.time || Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH.mm');
    sheet.appendRow([
      logId,
      logTime,
      log.user || 'Sistem',
      log.action || 'ACTION',
      log.entity || '—',
      log.ref || '—',
      log.description || ''
    ]);
  } catch (err) {
    Logger.log('Gagal append audit log: ' + err);
  }
}

/**
 * Menyimpan transaksi secara atomik dan granular menggunakan sheet.appendRow.
 * Memperbarui saldo produk dan kartu stok langsung di spreadsheet tanpa membersihkan sheet (sheet.clear()).
 */
function handleAppendTransactionServer(payload) {
  if (!payload || !payload.transaction) {
    return { status: 'error', message: 'Payload transaksi tidak valid' };
  }

  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    return { status: 'error', message: 'Server database sedang sibuk melayani transaksi lain. Coba beberapa saat lagi.' };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tx = payload.transaction;
    const isOut = String(tx.type || '').toLowerCase().includes('keluar') || tx.type === 'out';
    const targetSheetName = isOut ? SHEET_NAMES.TRANSACTIONS_OUT : SHEET_NAMES.TRANSACTIONS_IN;
    const txSheet = getOrCreateSheet(ss, targetSheetName);

    // 1. Baca atau inisialisasi baris transaksi
    const lastRow = txSheet.getLastRow();
    const baseCols = isOut
      ? ['id', 'transaction_no', 'date', 'warehouse', 'customer', 'refNo', 'user', 'status', 'notes', 'sku', 'nama_barang', 'qty', 'satuan', 'foto']
      : ['id', 'transaction_no', 'date', 'warehouse', 'supplier', 'refNo', 'user', 'status', 'notes', 'sku', 'nama_barang', 'qty', 'satuan', 'foto'];

    if (lastRow === 0) {
      txSheet.getRange(1, 1, 1, baseCols.length).setValues([baseCols]);
      formatHeaderRow(txSheet, baseCols.length);
    }

    const txNo = tx.transaction_no || tx.no || ('TX-' + Date.now());
    const baseId = tx.id || ((isOut ? 'OUT' : 'IN') + Date.now());
    const photoVal = saveBase64ImageToDriveOrCell(tx.photo || tx.foto, (isOut ? 'OUT_' : 'IN_') + txNo);
    const details = Array.isArray(tx.details) && tx.details.length > 0 ? tx.details : [{ sku: '', name: '', qty: tx.qty || 0, unit: 'Pcs' }];

    // Append baris ke sheet transaksi
    details.forEach((d, dIdx) => {
      const rowId = dIdx === 0 ? baseId : (baseId + '-' + (dIdx + 1));
      txSheet.appendRow([
        rowId,
        txNo,
        tx.date || Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH.mm'),
        tx.warehouse || 'Gudang Utama',
        tx.customer || tx.supplier || tx.party || '',
        tx.refNo || '',
        tx.user || 'Staf',
        tx.status || 'Posted',
        tx.notes || '',
        d.sku || d.productId || '',
        d.name || '',
        parseNumeric(d.qty, 0),
        d.unit || 'Pcs',
        dIdx === 0 ? photoVal : ''
      ]);
    });

    // 2. Perbarui saldo di sheet PRODUCTS secara granular
    const prodSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    if (prodSheet && prodSheet.getLastRow() > 1) {
      const prodValues = prodSheet.getDataRange().getValues();
      const headers = prodValues[0].map(h => String(h || '').trim());
      const lowerHeaders = headers.map(h => h.toLowerCase());

      const skuIdx = lowerHeaders.indexOf('sku');
      const idIdx = lowerHeaders.indexOf('id');
      const targetWh = cleanWarehouseName(tx.warehouse || 'Gudang Utama');
      let whColIdx = headers.findIndex(h => cleanWarehouseName(h).toLowerCase() === targetWh.toLowerCase());

      if (whColIdx !== -1) {
        details.forEach(lineItem => {
          const lSku = String(lineItem.sku || '').trim().toLowerCase();
          const lId = String(lineItem.productId || '').trim().toLowerCase();
          const lQty = parseNumeric(lineItem.qty, 0);

          for (let r = 1; r < prodValues.length; r++) {
            const rowSku = skuIdx !== -1 ? String(prodValues[r][skuIdx] || '').trim().toLowerCase() : '';
            const rowId = idIdx !== -1 ? String(prodValues[r][idIdx] || '').trim().toLowerCase() : '';

            if ((lSku && rowSku === lSku) || (lId && rowId === lId)) {
              const currentStock = parseNumeric(prodValues[r][whColIdx], 0);
              const newStock = isOut ? Math.max(0, currentStock - lQty) : (currentStock + lQty);
              prodSheet.getRange(r + 1, whColIdx + 1).setValue(newStock);
              prodValues[r][whColIdx] = newStock;
              break;
            }
          }
        });
      }
    }

    // 3. Append ke STOCK_LEDGER
    const ledgerSheet = getOrCreateSheet(ss, SHEET_NAMES.STOCK_LEDGER);
    if (ledgerSheet.getLastRow() === 0) {
      const lCols = ['id', 'date', 'productId', 'warehouse', 'type', 'qty', 'balanceAfter', 'refNo', 'user', 'notes'];
      ledgerSheet.getRange(1, 1, 1, lCols.length).setValues([lCols]);
      formatHeaderRow(ledgerSheet, lCols.length);
    }

    if (Array.isArray(payload.ledgerEntries) && payload.ledgerEntries.length > 0) {
      payload.ledgerEntries.forEach(entry => {
        ledgerSheet.appendRow([
          entry.id || ('L' + Date.now()),
          entry.date || Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH.mm'),
          entry.productId || '',
          entry.warehouse || tx.warehouse,
          entry.type || (isOut ? 'OUT' : 'IN'),
          parseNumeric(entry.qty, 0),
          parseNumeric(entry.balanceAfter, 0),
          txNo,
          entry.user || tx.user,
          entry.notes || (isOut ? 'Pengeluaran barang' : 'Penerimaan barang')
        ]);
      });
    }

    // 4. Catat Audit Log
    appendAuditLogServer(ss, {
      user: tx.user,
      action: 'POST',
      entity: `Transaksi ${isOut ? 'OUT' : 'IN'}`,
      ref: txNo,
      description: `Mencatat ${details.length} barang (${tx.qty} unit) di ${tx.warehouse}`
    });

    return {
      status: 'success',
      transaction_no: txNo,
      message: 'Transaksi berhasil disimpan dan stok langsung diperbarui di cloud.'
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

