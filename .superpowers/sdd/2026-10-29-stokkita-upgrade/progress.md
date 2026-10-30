# SDD ledger — plan: docs/superpowers/plans/2026-10-29-stokkita-upgrade.md
Pre-flight: no shared interfaces conflict

## Task 1: Camera Sandbox Bypass (Pop-up Window Injection)
- Status: COMPLETED
- Commit: `78d3c2a` ("feat: implement out-of-sandbox camera popup with dual-channel return")
- Verification: Camera modal tested with window.open + top-level navigator.mediaDevices.getUserMedia, flip camera, JPEG 0.80 canvas compression, postMessage + localStorage fallback polling.

## Task 2: Menu & Halaman Kartu Stok (Stock Card)
- Status: COMPLETED
- Commit: `44a4e36` ("feat: implement stock card menu, slow moving report, and top outbound dashboard")
- Verification: Added 'stockcard' route, sidebar items for ADMIN and STAFF, filter by product, warehouse, period/dates, running balance calculation (saldoAwal + mutations = saldoAkhir), print styling, and Excel (.xlsx) export.

## Task 3: Laporan Analisis Slow Moving & Dead Stock
- Status: COMPLETED
- Commit: `44a4e36`
- Verification: Added 'slow-moving' option in reportsPage, threshold selector (30, 60, 90, 180 days), stuck asset calculation (Rp value tied up), KPI summary cards, and Excel export.

## Task 4: Dashboard Barang Paling Banyak Keluar (Top Outbound)
- Status: COMPLETED
- Commit: `44a4e36`
- Verification: Upgraded dashboard ranking with podium medals, dynamic percentage bars, unit labels, transaction count, and direct link to Kartu Stok with product pre-selection.

## Deployment:
- Clasp Push: SUCCESS (appsscript.json, index.html, Kode.js, TABCAMERA.js)
- Deployment ID: `AKfycbzXOcMfPvPRbT9mmBYZNxivglG4n3_2I9EuIArJ1327bPqobwzI4hyUKjc3GKjkGZZu3w` (@5)
- Web App URL: https://script.google.com/macros/s/AKfycbzXOcMfPvPRbT9mmBYZNxivglG4n3_2I9EuIArJ1327bPqobwzI4hyUKjc3GKjkGZZu3w/exec
- Verification: HTTP 200 OK, live site loaded.
