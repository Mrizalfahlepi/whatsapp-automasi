/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           ⚙️ PENGATURAN BOT KASIR WA — DHELPI POS ⚙️            ║
 * ║                                                                  ║
 * ║   COPY file ini menjadi config.js lalu isi nilai-nilainya.      ║
 * ║   Jalankan: copy config.example.js config.js                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

module.exports = {

    // ───────────────────────────────────────────────────────────────
    // 1. IDENTITAS BISNIS
    // ───────────────────────────────────────────────────────────────
    NAMA_BISNIS: 'Dhelpi POS',
    WEBSITE: 'https://dhelpi.my.id',

    // ───────────────────────────────────────────────────────────────
    // 2. NOMOR ADMIN (Nomor WA Bisnis Anda)
    // ───────────────────────────────────────────────────────────────
    NOMOR_ADMIN: '62xxxxxxxxxxx',

    // ───────────────────────────────────────────────────────────────
    // 3. API KEYS (WAJIB DIISI)
    // ───────────────────────────────────────────────────────────────
    GEMINI_API_KEY: 'ISI_GEMINI_API_KEY_ANDA',
    SUPABASE_URL: 'https://xxxxx.supabase.co',
    SUPABASE_SERVICE_KEY: 'ISI_SUPABASE_SERVICE_ROLE_KEY_ANDA',

    // ───────────────────────────────────────────────────────────────
    // 4. BISNIS
    // ───────────────────────────────────────────────────────────────
    TRIAL_HARI: 7,

    // ───────────────────────────────────────────────────────────────
    // 5. PENGATURAN
    // ───────────────────────────────────────────────────────────────
    TIMEZONE: 'Asia/Jakarta',
    PORT_WEB_QR: 8080,
    FOLDER_STRUK: './struk',
};
