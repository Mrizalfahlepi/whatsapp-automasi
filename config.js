/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           ⚙️ PENGATURAN UTAMA BOT KASIR PINTAR ⚙️               ║
 * ║                                                                  ║
 * ║   File ini adalah SATU-SATUNYA file yang perlu Anda ubah         ║
 * ║   untuk setiap klien / toko baru.                                ║
 * ║   JANGAN sentuh file index.js kecuali Anda developer.            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

module.exports = {

    // ───────────────────────────────────────────────────────────────
    // 1. IDENTITAS TOKO
    // ───────────────────────────────────────────────────────────────
    // Nama toko yang akan muncul di laporan dan sapaan bot.
    NAMA_TOKO: 'Toko Kelontong Makmur',

    // Nama owner/pemilik toko. Bot akan menyapa dengan nama ini.
    NAMA_OWNER: 'Bos',

    // ───────────────────────────────────────────────────────────────
    // 2. WHATSAPP ADMIN (WAJIB DIISI)
    // ───────────────────────────────────────────────────────────────
    // Nomor WA owner toko yang berhak mengoperasikan bot ini.
    // FORMAT: Kode negara + Nomor, TANPA tanda + atau angka 0 di depan.
    // Contoh: 6281234567890 (Indonesia = 62)
    NOMOR_ADMIN: '6281234567890',

    // ───────────────────────────────────────────────────────────────
    // 3. KUNCI API GEMINI / AI (WAJIB DIISI)
    // ───────────────────────────────────────────────────────────────
    // Dapatkan GRATIS di: https://aistudio.google.com/apikey
    // Pilih model: Gemini 2.5 Flash (gratis & cepat)
    // Setiap klien BISA pakai API Key yang sama atau berbeda.
    GEMINI_API_KEY: 'isi-dengan-api-key-gemini',

    // ───────────────────────────────────────────────────────────────
    // 4. PENGATURAN LAPORAN OTOMATIS
    // ───────────────────────────────────────────────────────────────
    // Jam pengiriman laporan harian otomatis ke WA admin (format 24 jam).
    // Default: '00:00' = tepat tengah malam.
    // Contoh lain: '06:00' = jam 6 pagi, '23:00' = jam 11 malam.
    JAM_LAPORAN: '00:00',

    // Zona waktu. Sesuaikan dengan lokasi toko.
    // Indonesia:  'Asia/Jakarta' (WIB) | 'Asia/Makassar' (WITA) | 'Asia/Jayapura' (WIT)
    TIMEZONE: 'Asia/Jakarta',

    // ───────────────────────────────────────────────────────────────
    // 5. PENGATURAN JARINGAN (SERVER)
    // ───────────────────────────────────────────────────────────────
    // Port untuk halaman scan QR Code di browser.
    // Jika menjalankan BANYAK bot di 1 VPS, setiap bot WAJIB port BERBEDA.
    // Contoh: Toko A = 8080, Toko B = 8081, Toko C = 8082
    PORT_WEB_QR: 8080,

    // ───────────────────────────────────────────────────────────────
    // 6. PENYIMPANAN DATA
    // ───────────────────────────────────────────────────────────────
    // Nama file database keuangan (JSON).
    FILE_DATABASE: 'keuangan.json',

    // Folder untuk menyimpan foto-foto struk/nota.
    FOLDER_STRUK: './struk',

    // File backup database dalam format teks biasa (bisa dibuka Notepad).
    FILE_BACKUP_TXT: './laporan_database.txt'
};
