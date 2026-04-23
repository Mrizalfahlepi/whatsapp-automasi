# 📦 Panduan Lengkap — Sistem Bot Kasir Pintar (WhatsApp + AI Gemini)

> **Versi:** 2.0 — April 2026  
> **Teknologi:** Node.js + WhatsApp Web + Google Gemini 2.5 Flash AI  
> **Lisensi:** Produk siap jual. 1 folder = 1 klien toko.

---

## 📋 DAFTAR ISI

1. [Apa Itu Sistem Ini?](#-apa-itu-sistem-ini)
2. [Kebutuhan Sistem](#-kebutuhan-sistem)
3. [Cara Instalasi (Klien Baru)](#-cara-instalasi-klien-baru)
4. [Pengaturan config.js](#-pengaturan-configjs)
5. [Menjalankan Bot 24/7 dengan PM2](#-menjalankan-bot-247-dengan-pm2)
6. [Scan QR Code WhatsApp](#-scan-qr-code-whatsapp)
7. [Cara Menggunakan Bot](#-cara-menggunakan-bot)
8. [Troubleshooting (Masalah Umum)](#-troubleshooting-masalah-umum)
9. [Rekomendasi Hosting / Server](#-rekomendasi-hosting--server)
10. [Struktur File Proyek](#-struktur-file-proyek)

---

## 🤖 Apa Itu Sistem Ini?

Sistem Bot Kasir Pintar adalah chatbot WhatsApp berbasis AI yang berfungsi sebagai:

- **Kasir digital** — Mencatat pemasukan & pengeluaran toko secara otomatis.
- **Manajer stok** — Melacak jumlah barang dagangan (kulakan masuk, barang terjual).
- **Pembuat laporan** — Menghasilkan laporan harian/total dalam format tabel rapi.
- **Asisten pintar** — Memahami bahasa sehari-hari, bahasa daerah (Jawa, Sunda, Madura), dan bahasa gaul.

**Contoh penggunaan:**
```
Anda  : "jual rokok surya 2 bungkus 40rb"
Bot   : ✅ Pemasukan dicatat! Rokok Surya 2 bungkus = Rp40.000. Stok berkurang 2 pcs.

Anda  : "beli indomie 1 kardus"
Bot   : "Punten Bos, Indomie 1 kardusnya harga berapa? Isinya berapa bungkus?"

Anda  : "100rb, isi 40 bungkus"
Bot   : ✅ Pengeluaran Rp100.000 dicatat. Stok Indomie +40 pcs.
```

---

## 💻 Kebutuhan Sistem

| Komponen | Minimum | Keterangan |
|---|---|---|
| **OS** | Windows 10/11, Linux | Bisa VPS atau PC lokal |
| **Node.js** | v18+ | Download: https://nodejs.org |
| **Google Chrome** | Terbaru | Wajib terinstall (untuk WhatsApp Web engine) |
| **PM2** | Latest | Install global: `npm install -g pm2` |
| **RAM** | 2 GB+ | Tiap bot butuh ~300-500 MB |
| **HP WhatsApp** | 1 nomor per bot | Nomor khusus bot (bisa nomor lama/baru) |
| **API Key Gemini** | Gratis | Daftar di https://aistudio.google.com/apikey |

---

## 🚀 Cara Instalasi (Klien Baru)

### Langkah 1: Siapkan Folder Klien

```cmd
:: Copy folder master
xcopy C:\bot-kasir-wa C:\bot-klien-andi /E /I

:: Masuk ke folder klien baru
cd C:\bot-klien-andi
```

### Langkah 2: Bersihkan Data Lama

**WAJIB dilakukan agar klien baru mulai dari nol:**

```cmd
:: Hapus sesi WA lama (WAJIB!)
rmdir /S /Q .wwebjs_auth

:: Hapus database lama
del keuangan.json

:: Hapus QR lama
del qr.txt

:: Hapus file cache WA
rmdir /S /Q .wwebjs_cache
```

### Langkah 3: Edit Konfigurasi

Buka file **`config.js`** dengan Notepad atau VS Code. Ubah sesuai data klien.
(Lihat bagian [Pengaturan config.js](#-pengaturan-configjs) di bawah)

### Langkah 4: Install Modul

```cmd
cd C:\bot-klien-andi
npm install
```
Tunggu 1–2 menit hingga selesai.

---

## ⚙️ Pengaturan config.js

File `config.js` adalah **SATU-SATUNYA file yang perlu diubah** untuk setiap klien baru.

```javascript
module.exports = {
    // ─── IDENTITAS TOKO ─────────────────────────
    NAMA_TOKO: 'Toko Kelontong Makmur',    // Nama toko (muncul di laporan)
    NAMA_OWNER: 'Pak Andi',                 // Nama owner (sapaan bot)

    // ─── WHATSAPP (WAJIB) ───────────────────────
    NOMOR_ADMIN: '6281234567890',           // Nomor WA owner (62 = Indonesia)

    // ─── AI / GEMINI (WAJIB) ────────────────────
    GEMINI_API_KEY: 'masukkan-api-key-anda', // Dari https://aistudio.google.com

    // ─── LAPORAN OTOMATIS ───────────────────────
    JAM_LAPORAN: '00:00',                   // Jam kirim laporan (24h format)
    TIMEZONE: 'Asia/Jakarta',               // WIB / WITA / WIT

    // ─── SERVER ─────────────────────────────────
    PORT_WEB_QR: 8080,                      // Port QR scanner (unik per bot!)

    // ─── PENYIMPANAN ────────────────────────────
    FILE_DATABASE: 'keuangan.json',         // Database transaksi
    FOLDER_STRUK: './struk',                // Folder foto struk
    FILE_BACKUP_TXT: './laporan_database.txt'  // Backup TXT
};
```

### Panduan Pengisian:

| Field | Aturan | Contoh |
|---|---|---|
| `NAMA_TOKO` | Bebas, muncul di laporan AI | `'Warung Sari Rasa'` |
| `NAMA_OWNER` | Sapaan bot ke pemilik | `'Bu Sari'` |
| `NOMOR_ADMIN` | Kode negara + nomor, TANPA `+` atau `0` | `'6281234567890'` |
| `GEMINI_API_KEY` | Copy-paste dari Google AI Studio | `'AIza...'` |
| `JAM_LAPORAN` | Format `HH:MM` (24 jam) | `'06:00'` = jam 6 pagi |
| `TIMEZONE` | Pilih: `Asia/Jakarta` / `Asia/Makassar` / `Asia/Jayapura` | `'Asia/Jakarta'` |
| `PORT_WEB_QR` | Angka unik per bot di 1 server | `8080`, `8081`, `8082`... |

---

## 🔄 Menjalankan Bot 24/7 dengan PM2

```cmd
:: 1. Masuk ke folder klien
cd C:\bot-klien-andi

:: 2. Jalankan bot via PM2 (ganti nama sesuai klien)
pm2 start index.js --name bot-andi

:: 3. Cek status (harus "online" hijau)
pm2 list

:: 4. PENTING: Simpan agar auto-start saat server reboot
pm2 save
```

### Perintah PM2 Berguna:

| Perintah | Fungsi |
|---|---|
| `pm2 list` | Lihat semua bot yang berjalan |
| `pm2 logs bot-andi` | Lihat log realtime |
| `pm2 restart bot-andi` | Restart bot |
| `pm2 stop bot-andi` | Hentikan bot |
| `pm2 delete bot-andi` | Hapus bot dari PM2 |
| `pm2 logs bot-andi --err --lines 30 --nostream` | Lihat error terakhir |

---

## 📱 Scan QR Code WhatsApp

1. Pastikan bot sudah berjalan via PM2 (`pm2 list` → status `online`).
2. Buka browser (Chrome) di server/VPS Anda.
3. Ketik di address bar:
   ```
   http://localhost:8080
   ```
   *(Sesuaikan port dengan `PORT_WEB_QR` di config.js)*
4. QR Code akan muncul dan auto-refresh setiap 5 detik.
5. Di HP yang akan dijadikan bot: **WhatsApp → ⋮ → Linked Devices → Link a Device → Scan QR**.
6. Setelah berhasil, terminal akan menampilkan: `✅ Bot Keuangan Toko Siap!`

---

## 💬 Cara Menggunakan Bot

### Penting: Bot HANYA merespon pesan di "Saved Messages" (Chat ke Diri Sendiri)

Buka WhatsApp → cari chat **"You"** atau **"Me"** (Pesan ke Diri Sendiri) → ketik pesan di situ.

### Perintah Cepat (Tanpa AI):

| Format | Contoh | Fungsi |
|---|---|---|
| `masuk [nominal] [ket]` | `masuk 50k jual bensin` | Catat pemasukan |
| `keluar [nominal] [ket]` | `keluar 25rb beli es` | Catat pengeluaran |
| `+ [nominal] [ket]` | `+ 100rb titipan` | Shortcut pemasukan |
| `- [nominal] [ket]` | `- 15k ongkir` | Shortcut pengeluaran |

### Perintah via AI (Bahasa Bebas):

| Anda Ketik | Bot Akan |
|---|---|
| `"jual rokok surya 2 bungkus 40rb"` | Catat pemasukan + kurangi stok |
| `"beli indomie 1 kardus"` | Tanya harga & isi per kardus dulu |
| `"berapa saldo hari ini?"` | Tampilkan rekap tabel |
| `"minta laporan total"` | Laporan lengkap semua periode |
| `"cek stok rokok"` | Tampilkan sisa stok |
| `"reset harian"` | Konfirmasi dulu → hapus transaksi hari ini |
| `"reset total"` | Konfirmasi 2x → hapus SEMUA data |

### Bahasa Daerah? Bisa!

```
"Kang, barusan payu rokok sagepok 25ewu" → ✅ Dicatat
"Mas, tuku indomie sak kardus" → Bot tanya harga dulu
"Juragan, jual batagor 5, hargana 10rb" → ✅ Dicatat
```

### Fitur Foto Struk:
- Kirim foto struk → Bot simpan otomatis.
- Kirim foto + caption `"keluar 50k belanja"` → Langsung tercatat dengan lampiran.

### Laporan Otomatis:
- Bot mengirim laporan harian ke WA Anda setiap jam yang diatur di `JAM_LAPORAN`.
- Format: Tabel ASCII rapi dengan emoji dan simbol garis.

---

## 🔧 Troubleshooting (Masalah Umum)

### Bot tidak merespon pesan
1. Cek status: `pm2 list` → harus `online`
2. Cek log error: `pm2 logs bot-andi --err --lines 30 --nostream`
3. Pastikan chat di **"Saved Messages"** (bukan ke kontak lain!)
4. Restart: `pm2 restart bot-andi`

### Bot crash berulang (↻ banyak)
```cmd
pm2 stop bot-andi
rmdir /S /Q .wwebjs_auth
pm2 restart bot-andi
:: Scan QR ulang di browser
```

### Error "EPERM" pada keuangan.json
File database terkunci. Solusi:
```cmd
pm2 stop bot-andi
icacls keuangan.json /grant Everyone:F
pm2 restart bot-andi
```

### QR Code tidak muncul di browser
- Port sudah dipakai? Ganti `PORT_WEB_QR` di config.js
- Cek: `netstat -ano | findstr :8080`

### Error "Unexpected token" pada keuangan.json
File JSON rusak. Reset database:
```cmd
pm2 stop bot-andi
echo {"transaksi":[],"stok":{}} > keuangan.json
pm2 restart bot-andi
```
⚠️ **Gunakan Notepad untuk menulis file ini, BUKAN PowerShell `Out-File`** (karena encoding BOM).

---

## 🌐 Rekomendasi Hosting / Server

### 🏆 Opsi Terbaik (VPS Windows)

| Platform | Harga/Bulan | RAM | Kelebihan | Kekurangan |
|---|---|---|---|---|
| **Google Cloud (GCP)** | ~$15-25 (Rp240-400rb) | 2-4 GB | Stabil, gratis $300 awal | Butuh setup manual |
| **Contabo VPS** | €4.99 (~Rp85rb) | 4 GB | MURAH, RAM besar | Server di Eropa (agak lambat) |
| **Hetzner Cloud** | €3.79 (~Rp65rb) | 2 GB | Termurah berkualitas | Hanya Linux (butuh VNC) |
| **Hostinger VPS** | Rp55rb/bln | 2 GB | Murah, ada server Asia | Support terbatas |
| **DigitalOcean** | $6 (~Rp95rb) | 1 GB | Mudah dipakai | RAM kecil |

### 🆓 Opsi Gratis (Dengan Keterbatasan)

| Platform | Cocok? | Alasan |
|---|---|---|
| **Replit** | ❌ TIDAK | Tidak support Puppeteer/Chrome headless. Bot butuh Chrome untuk menjalankan WhatsApp Web. Replit melarang proses berat seperti ini. |
| **Railway.app** | ⚠️ TERBATAS | Gratis $5/bulan. Bisa jalan tapi sering sleep/restart. Tidak cocok untuk bot 24/7. |
| **Render.com** | ⚠️ TERBATAS | Free tier sleep setelah 15 menit idle. Bot akan mati. |
| **Oracle Cloud Free** | ✅ BISA! | **GRATIS SELAMANYA** (Always Free tier). 1 GB RAM, ARM processor. Cukup untuk 1 bot. Butuh setup Linux. |
| **Google Cloud Free** | ✅ BISA! | **e2-micro GRATIS** selamanya (US region). 1 GB RAM. |
| **PC/Laptop sendiri** | ✅ BISA | Gratis tapi harus nyala 24 jam. Cocok untuk testing. |

### 💡 Rekomendasi Final:
- **Untuk jualan**: Pakai **Contabo** (Rp85rb/bulan, 4GB RAM = bisa 5+ bot sekaligus!)
- **Untuk testing gratis**: Pakai **Oracle Cloud Always Free** atau **GCP e2-micro**
- **JANGAN** pakai Replit, Vercel, atau Netlify — mereka tidak support Chrome headless.

---

## 📂 Struktur File Proyek

```
bot-kasir-wa/
├── config.js              ← ⚙️ SATU-SATUNYA FILE YANG DIEDIT PER KLIEN
├── index.js               ← 🧠 Otak bot (JANGAN DIUBAH)
├── package.json           ← 📦 Daftar modul
├── keuangan.json          ← 💾 Database transaksi (auto-generated)
├── laporan_database.txt   ← 📋 Backup database format teks
├── qr.txt                 ← 📱 QR code terakhir (auto-generated)
├── PANDUAN_INSTALASI.md   ← 📖 File ini
├── struk/                 ← 📷 Folder foto-foto struk/nota
├── .wwebjs_auth/          ← 🔐 Sesi login WA (auto-generated)
├── .wwebjs_cache/         ← 💾 Cache WA (auto-generated)
└── node_modules/          ← 📦 Modul Node.js (auto dari npm install)
```

**File yang HARUS dihapus saat klien baru:** `.wwebjs_auth/`, `keuangan.json`, `qr.txt`  
**File yang TIDAK BOLEH dihapus:** `config.js`, `index.js`, `package.json`

---

*Dibuat oleh Fahlevy — Sistem Bot Kasir Pintar v2.0 🚀*  
*Produk digital siap jual. 1 kali develop, berkali-kali cuan.*
