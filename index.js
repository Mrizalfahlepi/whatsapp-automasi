const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const moment = require('moment-timezone');
const config = require('./config');
const db = require('./supabase');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
let receiptGen = null;
try { receiptGen = require('./receipt'); } catch (e) { console.log('[WARN] receipt.js not loaded:', e.message); }

// ═══ GEMINI AI SETUP ═══
const genAI = config.GEMINI_API_KEY ? new GoogleGenerativeAI(config.GEMINI_API_KEY) : null;
let geminiModel = null;
if (genAI) {
    geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json',
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    insertTransaksi: {
                        type: SchemaType.ARRAY, items: {
                            type: SchemaType.OBJECT, properties: {
                                tipe: { type: SchemaType.STRING, description: "'masuk' atau 'keluar'" },
                                jumlah: { type: SchemaType.NUMBER },
                                ket: { type: SchemaType.STRING }
                            }, required: ['tipe', 'jumlah', 'ket']
                        }
                    },
                    updateStok: {
                        type: SchemaType.ARRAY, items: {
                            type: SchemaType.OBJECT, properties: {
                                aksi: { type: SchemaType.STRING, description: "'tambah' atau 'kurang'" },
                                nama_barang: { type: SchemaType.STRING },
                                qty: { type: SchemaType.NUMBER, description: "Angka desimal. Contoh: 0.5 untuk setengah" },
                                satuan: { type: SchemaType.STRING }
                            }, required: ['aksi', 'nama_barang', 'qty', 'satuan']
                        }
                    },
                    manageReminders: {
                        type: SchemaType.ARRAY, items: {
                            type: SchemaType.OBJECT, properties: {
                                aksi: { type: SchemaType.STRING, description: "'tambah' atau 'hapus'" },
                                teks: { type: SchemaType.STRING, description: "Isi pengingat" },
                                id: { type: SchemaType.NUMBER, description: "ID reminder untuk dihapus" }
                            }, required: ['aksi', 'teks']
                        }
                    },
                    aksiReset: { type: SchemaType.STRING, description: "HANYA 'RESET_HARIAN' atau 'RESET_TOTAL' jika user tegas YAKIN HAPUS. Kosongkan jika belum konfirmasi." },
                    reply: { type: SchemaType.STRING, description: "Balasan teks ke user. Santuy, rapih, pakai emoji. Format tabel mobile-friendly jika laporan." }
                },
                required: ['reply']
            }
        }
    });
}

// ═══ WHATSAPP CLIENT ═══
const os = require('os');
const isWindows = os.platform() === 'win32';
const chromePaths = isWindows
    ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
const chromePath = chromePaths.find(p => { try { return fs.existsSync(p); } catch { return false; } });

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'], ...(chromePath ? { executablePath: chromePath } : {}) }
});

const ADMIN_ID = config.NOMOR_ADMIN + '@c.us';
const TZ = config.TIMEZONE || 'Asia/Jakarta';
const FOLDER_STRUK = config.FOLDER_STRUK || './struk';
if (!fs.existsSync(FOLDER_STRUK)) fs.mkdirSync(FOLDER_STRUK, { recursive: true });

const botSentMessages = new Set();
const formatRupiah = (n) => new Intl.NumberFormat('id-ID').format(n);
const getTanggal = () => moment().tz(TZ).format('YYYY-MM-DD');
const getTanggalLengkap = () => moment().tz(TZ).format('dddd, DD MMMM YYYY');
const getWaktu = () => moment().tz(TZ).format('HH:mm [WIB]');

// ═══ HELPER: Smart Reply with typing indicator ═══
async function smartReply(msg, text) {
    try {
        const tagged = `*_${config.NAMA_BISNIS}:_*\n${text}`;
        botSentMessages.add(text.trim());
        botSentMessages.add(tagged.trim());
        setTimeout(() => { botSentMessages.delete(text.trim()); botSentMessages.delete(tagged.trim()); }, 60000);
        // Typing indicator with timeout (prevents hang on LID numbers)
        await Promise.race([
            (async () => {
                const chat = await msg.getChat();
                await chat.sendSeen();
                await chat.sendStateTyping();
                await new Promise(r => setTimeout(r, 1500));
                await chat.clearState();
            })(),
            new Promise(r => setTimeout(r, 5000)) // 5s timeout fallback
        ]);
    } catch (e) { console.error('[TYPING ERROR]', e.message); }
    return msg.reply(`*_${config.NAMA_BISNIS}:_*\n${text}`);
}

// ═══ HELPER: Normalize phone number ═══
function normalizePhone(input) {
    let p = input.replace(/[^0-9]/g, '');
    if (p.startsWith('08')) p = '62' + p.substring(1);
    if (p.startsWith('+62')) p = '62' + p.substring(3);
    return p;
}

// ═══ HELPER: Parse nominal ═══
function parseNominal(str) {
    let s = str.toLowerCase().replace(/\s/g, '');
    if (s.includes('juta') || s.includes('jt') || s.includes('m')) return parseFloat(s.replace(/juta|jt|m/g, '').replace(/\./g, '').replace(/,/g, '.')) * 1000000;
    if (s.includes('ribu') || s.includes('rb') || s.includes('k')) return parseFloat(s.replace(/ribu|rb|k/g, '').replace(/\./g, '').replace(/,/g, '.')) * 1000;
    return Math.round(parseFloat(s.replace(/\./g, '').replace(/,/g, '.')));
}

// ═══ PERSONA CONFIG ═══
const PERSONA_LIST = {
    warung: { label: 'Warung / Toko', terms: 'jual, kulak, dagangan, stok, lapak' },
    laundry: { label: 'Laundry', terms: 'cucian masuk, cucian selesai, setrika, ongkos cuci' },
    toko_bangunan: { label: 'Toko Bangunan', terms: 'jual material, stok semen, orderan, proyek' },
    pribadi: { label: 'Catatan Pribadi', terms: 'pengeluaran, pemasukan, tabungan, belanja, cicilan' },
    catering: { label: 'Catering', terms: 'orderan, menu, bahan baku, porsi, pesanan' },
    umum: { label: 'Catatan Umum', terms: 'masuk, keluar, catat, stok, laporan' }
};
const PERSONA_MENU = `Pilih *jenis catatan* kamu:\n\n1️⃣ Warung / Toko Kelontong\n2️⃣ Laundry\n3️⃣ Toko Bangunan\n4️⃣ Catatan Pribadi / Belanja\n5️⃣ Catering / Makanan\n6️⃣ Lainnya\n\nBalas dengan *angka* (1-6):`;
const PERSONA_MAP = { '1': 'warung', '2': 'laundry', '3': 'toko_bangunan', '4': 'pribadi', '5': 'catering', '6': 'umum' };

function getHelpMenu(persona, role) {
    const p = PERSONA_LIST[persona] || PERSONA_LIST.umum;
    let menu = `📋 *PANDUAN ${config.NAMA_BISNIS}*\n━━━━━━━━━━━━━━━━━━━\n\n💰 *Catat Pemasukan*\n_Contoh: jual rokok 50rb_\n\n💸 *Catat Pengeluaran*\n_Contoh: kulak telur 100rb 10kg_\n\n📦 *Tambah/Kurangi Stok*\n_Contoh: tambah stok rokok 100 pcs_\n\n📊 *Laporan*\n• _laporan hari ini_\n• _rekap stok_\n\n🧾 *Cetak Struk*\n_Ketik: struk_\n\n📷 *Kirim Foto Struk*\nFoto struk → kirim ke sini\n\n🔔 *Pengingat*\n_Contoh: ingatkan jika stok rokok di bawah 10_\n\n❓ *Bantuan*\n_Ketik: menu_\n\n_Jenis: ${p.label}${role === 'staff' ? ' (Staff)' : ''}_`;
    if (role === 'staff') {
        menu += `\n\n🚪 *Keluar dari toko*\n_Ketik: keluar toko_`;
    }
    return menu;
}

function getOwnerMenu() {
    return `👑 *MENU OWNER*\n━━━━━━━━━━━━━━━━━━━\n\n👥 *Kelola Karyawan*\n• _tambah karyawan 08xxx Nama_\n• _hapus karyawan 08xxx_\n• _list karyawan_\n\n📊 *Laporan Staff*\n• _laporan staff Budi_\n• _laporan staff semua_\n\n⚙️ *Setting Profil Struk*\n_Ketik: setting_\n\n🔄 *Reset Data*\n_Ketik: reset data_\n\n🎭 *Ubah Persona*\n_Ketik: ubah persona_\n\n📋 *Menu Umum*\n_Ketik: menu_`;
}

// ═══ ADMIN COMMANDS HANDLER ═══
async function handleAdminCommand(msg, text) {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === '#menu' || cmd === '#help') {
        return smartReply(msg, `👑 *ADMIN PANEL*\n━━━━━━━━━━━━━━━━━━━━\n\n📋 *Pelanggan*\n• #list — Daftar semua\n• #info [nomor] — Detail\n• #stats — Statistik\n\n⚡ *Kelola*\n• #aktifkan [nomor] [hari]\n• #trial [nomor]\n• #ban [nomor]\n• #hapus [nomor]\n\n📢 *Komunikasi*\n• #broadcast [pesan]\n\n⏰ *Auto-Reminder*\nOtomatis H-1 sebelum expired`);
    }

    if (cmd === '#stats') {
        const users = await db.getAllUsers();
        const active = users.filter(u => db.isUserActive(u)).length;
        const trial = users.filter(u => u.status === 'trial').length;
        const paid = users.filter(u => u.status === 'active').length;
        const expired = users.filter(u => !db.isUserActive(u) && u.status !== 'banned').length;
        const banned = users.filter(u => u.status === 'banned').length;
        return smartReply(msg, `📊 *STATISTIK ${config.NAMA_BISNIS}*\n━━━━━━━━━━━━━━━━━━━━\n\n👥 Total Pelanggan: *${users.length}*\n🟢 Aktif: *${active}*\n⏳ Trial: *${trial}*\n💳 Berbayar: *${paid}*\n🔴 Expired: *${expired}*\n⛔ Banned: *${banned}*`);
    }

    if (cmd === '#list') {
        const users = await db.getAllUsers();
        if (users.length === 0) return smartReply(msg, '📋 Belum ada pelanggan terdaftar.');
        let reply = `📋 *DAFTAR PELANGGAN* (${users.length})\n━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const u of users) {
            const active = db.isUserActive(u);
            const icon = active ? '🟢' : (u.status === 'banned' ? '⛔' : '🔴');
            const endDate = u.paid_until ? moment(u.paid_until).format('DD/MM') : (u.trial_end ? moment(u.trial_end).format('DD/MM') : '-');
            reply += `${icon} *${u.store_name}*\n   📱 ${u.phone} | ${u.status} | s/d ${endDate}\n`;
        }
        return smartReply(msg, reply);
    }

    if (cmd === '#info' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Pelanggan ${phone} tidak ditemukan.`);
        const saldo = await db.getSaldo(phone);
        const trx = await db.getTransactions(phone);
        const stok = await db.getStock(phone);
        const staffList = await db.getStaffList(phone);
        let reply = `📊 *INFO PELANGGAN*\n━━━━━━━━━━━━━━━━━━━━━\n`;
        reply += `🏪 *${user.store_name}*\n👤 ${user.owner_name}\n📱 ${user.phone}\n🎭 ${user.persona || 'warung'}\n`;
        reply += `📌 Status: ${user.status}\n`;
        reply += `⏰ Trial: ${user.trial_end ? moment(user.trial_end).format('DD MMM YYYY') : '-'}\n`;
        reply += `💳 Bayar s/d: ${user.paid_until ? moment(user.paid_until).format('DD MMM YYYY') : '-'}\n`;
        reply += `💰 Saldo: Rp${formatRupiah(saldo)}\n📝 Transaksi: ${trx.length}\n📦 Stok: ${stok.length}\n👥 Staff: ${staffList.length}`;
        return smartReply(msg, reply);
    }

    if (cmd === '#aktifkan' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Pelanggan ${phone} tidak ditemukan.`);
        const days = parseInt(parts[2]) || 30;
        const paidUntil = moment().tz(TZ).add(days, 'days').toISOString();
        await db.updateUserStatus(phone, 'active', paidUntil);
        return smartReply(msg, `✅ *${user.store_name}* (${phone}) diaktifkan ${days} hari.\nAktif sampai: ${moment(paidUntil).format('DD MMM YYYY')}`);
    }

    if (cmd === '#trial' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Pelanggan ${phone} tidak ditemukan.`);
        const trialEnd = moment().tz(TZ).add(config.TRIAL_HARI || 7, 'days').toISOString();
        await db.supabase.from('users').update({ status: 'trial', trial_end: trialEnd, updated_at: new Date().toISOString() }).eq('phone', phone);
        return smartReply(msg, `✅ Trial *${user.store_name}* (${phone}) direset ${config.TRIAL_HARI || 7} hari.`);
    }

    if (cmd === '#ban' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Pelanggan ${phone} tidak ditemukan.`);
        await db.updateUserStatus(phone, 'banned');
        return smartReply(msg, `⛔ *${user.store_name}* (${phone}) diblokir.`);
    }

    if (cmd === '#hapus' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Pelanggan ${phone} tidak ditemukan.`);
        await db.deleteUser(phone);
        return smartReply(msg, `🗑️ *${user.store_name}* (${phone}) dihapus total.`);
    }

    if (cmd === '#broadcast') {
        const pesan = parts.slice(1).join(' ');
        if (!pesan) return smartReply(msg, '❌ Format: *#broadcast [pesan]*');
        const users = await db.getAllUsers();
        const activeUsers = users.filter(u => db.isUserActive(u));
        let sent = 0;
        for (const u of activeUsers) {
            try {
                await client.sendMessage(u.phone + '@c.us', `📢 *${config.NAMA_BISNIS}*\n━━━━━━━━━━━━━━━━\n${pesan}`);
                sent++;
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) { console.error(`[BROADCAST ERROR] ${u.phone}:`, e.message); }
        }
        return smartReply(msg, `✅ Broadcast terkirim ke ${sent}/${activeUsers.length} pelanggan aktif.`);
    }

    return false;
}

// ═══ REGISTRATION FLOW HANDLER ═══
async function handleRegistration(msg, phone, text, session) {
    const state = session?.state;

    if (!state || state === 'idle' || state === 'active') {
        if (text.toLowerCase() === 'daftar') {
            await db.setSession(phone, 'reg_store');
            return smartReply(msg, `📝 *Pendaftaran ${config.NAMA_BISNIS}*\n\nLangkah 1/4\nKirimkan *Nama Toko/Usaha* kamu:\n\n_Contoh: Warung Berkah Bu Amin_\n_Contoh: Laundry Express_\n_Contoh: Catatan Belanja Saya_`);
        }
        return null;
    }

    if (state === 'reg_store') {
        await db.setSession(phone, 'reg_owner', { store_name: text.trim() });
        return smartReply(msg, `✅ Nama: *${text.trim()}*\n\nLangkah 2/4\nSekarang kirim *Nama Pemilik*:\n\n_Contoh: Bu Amin_`);
    }

    if (state === 'reg_owner') {
        const prevData = session?.data || {};
        await db.setSession(phone, 'reg_pin', { ...prevData, owner_name: text.trim() });
        return smartReply(msg, `✅ Pemilik: *${text.trim()}*\n\nLangkah 3/4\nBuat *PIN 4-8 digit* untuk login di website:\n\n_Contoh: 123456_`);
    }

    if (state === 'reg_pin') {
        const pin = text.replace(/\D/g, '');
        if (pin.length < 4 || pin.length > 8) {
            return smartReply(msg, '❌ PIN harus 4-8 digit angka. Coba lagi:');
        }
        const prevData = session?.data || {};
        await db.setSession(phone, 'reg_persona', { ...prevData, pin });
        return smartReply(msg, `✅ PIN disimpan!\n\nLangkah 4/4\n${PERSONA_MENU}`);
    }

    if (state === 'reg_persona') {
        const persona = PERSONA_MAP[text.trim()];
        if (!persona) {
            return smartReply(msg, `❌ Pilih angka 1-6 saja ya!\n\n${PERSONA_MENU}`);
        }
        const temp = session?.data || {};
        try {
            await db.registerUser(phone, temp.store_name || 'Toko Baru', temp.owner_name || 'Owner', temp.pin || '123456', persona);
            await db.setSession(phone, 'active', null);
            const trialEnd = moment().tz(TZ).add(config.TRIAL_HARI || 7, 'days').format('DD MMMM YYYY');
            const pLabel = PERSONA_LIST[persona]?.label || 'Umum';
            await smartReply(msg, `🎉 *Pendaftaran Berhasil!*\n━━━━━━━━━━━━━━━━━━━━━\n🏪 Toko: *${temp.store_name}*\n👤 Pemilik: *${temp.owner_name}*\n🎭 Jenis: *${pLabel}*\n🔑 PIN: *${temp.pin}*\n⏰ Trial GRATIS sampai: *${trialEnd}*\n\n📌 Login web: ${config.WEBSITE}/kasir`);
            return smartReply(msg, getHelpMenu(persona));
        } catch (err) {
            console.error('[REG ERROR]', err);
            if (err.code === '23505') return smartReply(msg, '❌ Nomor ini sudah terdaftar!');
            return smartReply(msg, '❌ Gagal mendaftar. Coba lagi nanti.');
        }
    }

    // Handle persona change flow
    if (state === 'change_persona') {
        const persona = PERSONA_MAP[text.trim()];
        if (!persona) {
            return smartReply(msg, `❌ Pilih angka 1-6 saja ya!\n\n${PERSONA_MENU}`);
        }
        await db.updateUserPersona(phone, persona);
        await db.setSession(phone, 'change_persona_confirm', { new_persona: persona });
        const pLabel = PERSONA_LIST[persona]?.label || 'Umum';
        return smartReply(msg, `✅ Persona diubah ke *${pLabel}*!\n\nApakah data lama mau dihapus?\n\n1️⃣ *HAPUS* semua data (mulai bersih)\n2️⃣ *SIMPAN* data yang ada\n\nBalas *1* atau *2*:`);
    }

    if (state === 'change_persona_confirm') {
        const choice = text.trim();
        if (choice === '1') {
            await db.deleteTransactions(phone);
            await db.deleteStock(phone);
            await db.setSession(phone, 'active', null);
            return smartReply(msg, `🗑️ Data lama dihapus! Kamu mulai dari awal.\n\n${getHelpMenu(session?.data?.new_persona || 'umum')}`);
        } else if (choice === '2') {
            await db.setSession(phone, 'active', null);
            return smartReply(msg, `👍 Data lama tetap tersimpan!\n\n${getHelpMenu(session?.data?.new_persona || 'umum')}`);
        }
        return smartReply(msg, '❌ Pilih *1* (Hapus) atau *2* (Simpan):');
    }

    return null;
}

// ═══ WARUNG TRANSACTION HANDLER ═══
async function handleWarungMessage(msg, phone, text, user) {
    const hariIni = getTanggal();

    // Handle media/struk
    let uploadedStruk = null;
    let geminiImage = null;
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            const ts = moment().tz(TZ).format('YYYYMMDD_HHmmss');
            const filename = `struk_${phone}_${ts}.jpg`;
            fs.writeFileSync(`${FOLDER_STRUK}/${filename}`, media.data, 'base64');
            uploadedStruk = filename;
            geminiImage = {
                inlineData: {
                    data: media.data,
                    mimeType: media.mimetype
                }
            };
        } catch (e) { console.error('[MEDIA ERROR]', e.message); }
    }

    if (!text && !geminiImage) return; // Ignore if no text and no image


    // Fast path: masuk/keluar/+/-
    const rxFast = /^(\+|masuk|in|-|keluar|out)\s*(?:rp\.?\s*)?([0-9.,]+(?:\s*(?:juta|jt|ribu|rb|k|m))?)(?:\s+(.+))?$/i;
    const match = text.match(rxFast);
    if (match) {
        const cmd = match[1].toLowerCase();
        const tipe = ['+', 'masuk', 'in'].includes(cmd) ? 'masuk' : 'keluar';
        const jumlah = parseNominal(match[2]);
        const ket = match[3] || '-';
        if (isNaN(jumlah) || jumlah <= 0) return smartReply(msg, `❌ Nominal tidak valid.\nContoh: *${cmd} 50k jual rokok*`);
        await db.insertTransaction(phone, tipe, jumlah, ket);
        const saldo = await db.getSaldo(phone);
        let reply = `✅ ${tipe === 'masuk' ? '💰 Pemasukan' : '💸 Pengeluaran'} dicatat\n*Rp${formatRupiah(jumlah)}* — ${ket}`;
        if (uploadedStruk) reply += ` 📷`;
        reply += `\n\n💰 Saldo: *Rp${formatRupiah(saldo)}*`;
        return smartReply(msg, reply);
    }

    // AI Path: Gemini
    if (!geminiModel) return smartReply(msg, '❌ AI tidak tersedia. Gunakan format manual:\n*masuk 50k jual rokok*');

    try {
        const saldo = await db.getSaldo(phone);
        const recentTrx = await db.getTransactions(phone);
        const stokData = await db.getStock(phone);
        const stokObj = {};
        stokData.forEach(s => { stokObj[`${s.nama_barang}__${s.satuan}`] = { nama: s.nama_barang, satuan: s.satuan, qty: s.qty }; });

        // Load chat memory
        const history = await db.getChatHistory(phone, 10);
        const chatHistoryLines = history.map(h => h.role === 'user' ? `[User]: ${h.content}` : `[Bot]: ${h.content}`);

        // Load reminders
        const reminders = await db.getReminders(phone);
        const remindersText = reminders.length > 0
            ? reminders.map(r => `- [ID:${r.id}] ${r.reminder}`).join('\n')
            : '(Belum ada pengingat)';

        // Persona config
        const persona = user.persona || 'warung';
        const pCfg = PERSONA_LIST[persona] || PERSONA_LIST.umum;

        const prompt = `Anda adalah "${config.NAMA_BISNIS}", asisten pencatatan cerdas.
Toko: "${user.store_name}" (${pCfg.label}) | Pemilik: "${user.owner_name}"
Waktu: ${getTanggalLengkap()} ${getWaktu()}

═══ KEPRIBADIAN ═══
- Santuy, ramah, paham bahasa gaul/daerah (Sunda, Jawa, Madura, Melayu)
- PROAKTIF: Beri info jika melihat pola penting (stok menipis, rugi, dll)
- JANGAN halusinasi atau ngarang data. Jika ragu, TANYA BALIK
- Sesuaikan istilah dengan jenis usaha: ${pCfg.terms}

═══ ATURAN TRANSAKSI ═══
1. JUAL/PEMASUKAN → tipe "masuk" + KURANGI stok otomatis
2. KULAK/BELI → tipe "keluar" + TAMBAH stok otomatis
3. Jika user sebut barang TANPA harga → TANYA harganya, JANGAN ngarang
4. SELALU isi insertTransaksi DAN updateStok bersamaan jika ada barang

═══ ATURAN STOK (SANGAT PENTING!) ═══
- PECAHAN: "½ kg" = 0.5, "setengah" = 0.5, "1/4" = 0.25, "3/4" = 0.75
- KONVERSI: stok "kg" tapi jual "gram" → konversi (500g = 0.5kg)
- Qty di updateStok HARUS angka desimal yang benar
- Jika stok tidak cukup → PERINGATKAN tapi tetap proses jika user yakin
- SELALU sertakan updateStok saat ada penjualan/pembelian barang

═══ FORMAT LAPORAN (WAJIB RAPIH!) ═══
Gunakan format sederhana ini untuk WA:
📊 *LAPORAN [JUDUL]*
━━━━━━━━━━━━━━━━
💰 Pemasukan
• Rokok     Rp 50.000
• Telur     Rp 25.000
─────────────────
  Total     Rp 75.000

💸 Pengeluaran
• Kulak     Rp 100.000
─────────────────
  Total     Rp 100.000

📈 *Laba/Rugi: -Rp 25.000*
💰 *Saldo: Rp xxx*

- Maks 25 karakter per baris, jangan terlalu lebar
- Pakai emoji untuk mempercantik
- Pisahkan hari ini vs total jika diminta

═══ RESET ═══
- KONFIRMASI dulu: "Yakin hapus semua data?"
- HANYA isi aksiReset jika user bilang YA/YAKIN

═══ GAMBAR/STRUK ═══
- Baca SEMUA item: nama, qty, harga
- WAJIB catat ke insertTransaksi DAN updateStok per item
- Tampilkan rincian di reply

═══ PENGINGAT USER ═══
${remindersText}
Jika kondisi pengingat terpenuhi (cek data stok), SERTAKAN ⚠️ di reply.
Jika user minta tambah/hapus pengingat, gunakan manageReminders.

═══ DATA REALTIME ═══
[Saldo]: Rp${formatRupiah(saldo)}
[Stok]: ${JSON.stringify(stokObj)}
[20 Transaksi Terakhir]: ${JSON.stringify(recentTrx.slice(0, 20))}
${chatHistoryLines.length > 0 ? `[Riwayat Chat]:\n${chatHistoryLines.join('\n')}` : ''}

Chat dari ${user._staffName || user.owner_name} (${user._role === 'staff' ? 'Staff' : 'Owner'}): "${text || '[Mengirim Gambar/Struk]'}"`;

        const requestContent = geminiImage ? [prompt, geminiImage] : prompt;
        const result = await geminiModel.generateContent(requestContent);
        const res = JSON.parse(result.response.text());

        // Process reset
        if (res.aksiReset === 'RESET_TOTAL') {
            await db.deleteTransactions(phone);
            await db.deleteStock(phone);
        } else if (res.aksiReset === 'RESET_HARIAN') {
            await db.supabase.from('transactions').delete().eq('user_phone', phone).eq('tanggal', hariIni);
        }

        // Process transactions + save receipt data
        const receiptItems = [];
        if (res.insertTransaksi && res.insertTransaksi.length > 0) {
            const staffTag = user._staffName ? ` [${user._staffName}]` : '';
            for (const trx of res.insertTransaksi) {
                await db.insertTransaction(phone, trx.tipe === 'masuk' ? 'masuk' : 'keluar', Number(trx.jumlah) || 0, (trx.ket || '') + staffTag);
                if (trx.tipe === 'masuk') receiptItems.push({ nama: trx.ket || 'Item', harga: Number(trx.jumlah) || 0 });
            }
        }
        // Save last receipt for struk command
        if (receiptItems.length > 0) {
            const receiptTotal = receiptItems.reduce((a, i) => a + i.harga, 0);
            const curSession = await db.getSession(phone);
            await db.setSession(phone, curSession?.state || 'active', { ...(curSession?.data || {}), last_receipt: { items: receiptItems, total: receiptTotal } });
        }

        // Process stock
        if (res.updateStok && res.updateStok.length > 0) {
            for (const stk of res.updateStok) {
                await db.upsertStock(phone, stk.nama_barang, Number(stk.qty) || 0, stk.satuan, stk.aksi);
            }
        }

        // Process reminders
        if (res.manageReminders && res.manageReminders.length > 0) {
            for (const rm of res.manageReminders) {
                if (rm.aksi === 'tambah' && rm.teks) {
                    await db.addReminder(phone, rm.teks);
                } else if (rm.aksi === 'hapus' && rm.id) {
                    await db.deleteReminder(rm.id);
                }
            }
        }

        // Save chat history
        await db.addChatHistory(phone, 'user', text || '[Gambar/Struk]');
        if (res.reply) {
            await db.addChatHistory(phone, 'bot', res.reply.substring(0, 500));
            return smartReply(msg, res.reply);
        }
    } catch (err) {
        console.error('[GEMINI ERROR]', err.message);
        return smartReply(msg, '❌ Error AI. Coba format manual:\n*masuk 50k jual rokok*');
    }
}

// ═══ WHATSAPP EVENTS ═══
client.on('qr', (qr) => {
    fs.writeFileSync('qr.txt', qr);
    console.log(`\nSCAN QR CODE INI PAKAI WA BISNIS (${config.NOMOR_ADMIN}):`);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`\n✅ ${config.NAMA_BISNIS} Bot Siap!`);
    console.log(`   Login: ${client.info.pushname}`);
    console.log(`   WID: ${client.info.wid._serialized}`);
    console.log(`   Admin: ${config.NOMOR_ADMIN}\n`);
});

client.on('auth_failure', msg => console.error('AUTH GAGAL:', msg));
client.on('disconnected', reason => console.log('Terputus:', reason));

// ═══ HANDLE ADMIN MESSAGES (Saved Messages / Self-chat) ═══
client.on('message_create', async msg => {
    if (!msg.fromMe || !msg.body) return;
    if (botSentMessages.has(msg.body.trim())) return;
    if (msg.to.endsWith('@g.us')) return;

    // Only process self-chat (Saved Messages)
    const myWid = client.info.wid._serialized;
    const isSelfChat = msg.to === ADMIN_ID || msg.to === myWid;
    if (!isSelfChat) {
        // Check if it's a @lid self-chat
        if (msg.to.endsWith('@lid')) {
            try {
                const chat = await msg.getChat();
                const chatName = (chat.name || '').toLowerCase();
                const myName = (client.info.pushname || '').toLowerCase();
                if (chatName !== 'you' && chatName !== 'me' && chatName !== myName) return;
            } catch { return; }
        } else return;
    }

    const text = msg.body.trim();
    if (text.startsWith('#')) {
        console.log(`[ADMIN] ${text}`);
        const handled = await handleAdminCommand(msg, text);
        if (handled) return;
    }
});

// ═══ HANDLE INCOMING MESSAGES FROM WARUNG ═══
client.on('message', async msg => {
    if ((!msg.body && !msg.hasMedia) || msg.fromMe) return;
    if (msg.body && botSentMessages.has(msg.body.trim())) return;
    if (msg.from.endsWith('@g.us')) return;

    let phone = msg.from.replace('@c.us', '').replace('@lid', '');
    try {
        const contact = await msg.getContact();
        if (contact && contact.number) { phone = contact.number; }
    } catch (e) {}
    const text = (msg.body || '').trim();
    const lowerText = text.toLowerCase();
    console.log(`[MSG] ${phone}: ${text || '[MEDIA]'}`);

    try {
        // Check session flows (registration, persona change)
        const session = await db.getSession(phone);
        if (session && session.state) {
            const s = session.state;
            if (s.startsWith('reg_') || s === 'change_persona' || s === 'change_persona_confirm') {
                const handled = await handleRegistration(msg, phone, text, session);
                if (handled) return;
            }
            // Struk payment flow
            if (s === 'struk_payment') {
                const rd = session.data || {};
                if (lowerText === 'batal') {
                    await db.setSession(phone, 'active', null);
                    return smartReply(msg, '❌ Struk dibatalkan.');
                }
                const match = text.match(/^([0-9.,]+)\s*print$/i) || (lowerText === 'print' ? ['', '0'] : null);
                if (!match) return smartReply(msg, '❌ Format: *[jumlah] print*\n_Contoh: 150000 print_\nAtau ketik *print* jika uang pas.\nKetik *batal* untuk batal.');
                let bayar = lowerText === 'print' ? rd.total : parseFloat(match[1].replace(/\./g, '').replace(/,/g, '.'));
                if (bayar < rd.total) return smartReply(msg, `❌ Uang kurang! Total: Rp${formatRupiah(rd.total)}\nKetik ulang: *[jumlah] print*`);
                const change = bayar - rd.total;
                // Get store profile
                const storeUser = await db.getUser(rd.ownerPhone || phone);
                if (!receiptGen) { await db.setSession(phone, 'active', null); return smartReply(msg, '❌ Fitur struk belum tersedia di server.'); }
                try {
                    const imgBuf = receiptGen.generateReceipt({
                        storeName: storeUser?.store_name || 'Toko',
                        address: storeUser?.alamat || '',
                        storePhone: storeUser?.no_hp_display || '',
                        items: rd.items || [],
                        total: rd.total, paid: bayar, change,
                        cashier: rd.cashier || storeUser?.owner_name || 'Kasir',
                        footer: storeUser?.footer_struk || 'Terima kasih!',
                        date: moment().tz(TZ).format('DD/MM/YYYY HH:mm'),
                        receiptWidth: storeUser?.ukuran_struk || '58'
                    });
                    const media = new MessageMedia('image/png', imgBuf.toString('base64'), 'struk.png');
                    await msg.reply(media, undefined, { caption: `🧾 *STRUK*\nTotal: Rp${formatRupiah(rd.total)}\nBayar: Rp${formatRupiah(bayar)}\nKembali: Rp${formatRupiah(change)}` });
                    await db.setSession(phone, 'active', null);
                } catch (e) { console.error('[STRUK ERROR]', e); await db.setSession(phone, 'active', null); return smartReply(msg, '❌ Gagal buat struk. Coba lagi.'); }
                return;
            }
        }

        // ═══ CHECK: Is this a registered OWNER? ═══
        const user = await db.getUser(phone);

        if (user) {
            if (!db.isUserActive(user)) {
                return smartReply(msg, `⏰ Masa aktif *${user.store_name}* sudah habis.\n\nHubungi admin: wa.me/${config.NOMOR_ADMIN}`);
            }

            // Menu umum
            if (['menu', 'bantuan', 'help', '?'].includes(lowerText)) {
                return smartReply(msg, getHelpMenu(user.persona || 'umum'));
            }
            // Menu owner
            if (lowerText === 'menu owner' || lowerText === 'owner menu') {
                return smartReply(msg, getOwnerMenu());
            }
            // Ubah persona
            if (lowerText.includes('ubah persona') || lowerText.includes('ganti persona')) {
                await db.setSession(phone, 'change_persona');
                return smartReply(msg, `🎭 *Ubah Jenis Bot*\n\n${PERSONA_MENU}`);
            }

            // --- STAFF MANAGEMENT (OWNER ONLY) ---
            if (lowerText.startsWith('tambah karyawan')) {
                const parts = text.split(/\s+/);
                const staffPhone = normalizePhone(parts[2] || '');
                const staffName = parts.slice(3).join(' ') || 'Staff';
                if (!staffPhone || staffPhone.length < 10) {
                    return smartReply(msg, '❌ Format: *tambah karyawan [nomor] [nama]*\n_Contoh: tambah karyawan 08123456789 Budi_');
                }
                if (user.status === 'trial') {
                    const existing = await db.getStaffList(phone);
                    if (existing.length >= 2) {
                        return smartReply(msg, `❌ Akun *Trial* maks 2 karyawan.\n\nUntuk unlimited, hubungi admin:\n📱 wa.me/${config.NOMOR_ADMIN}`);
                    }
                }
                const existingUser = await db.getUser(staffPhone);
                if (existingUser) return smartReply(msg, `❌ Nomor ${staffPhone} sudah terdaftar sebagai pemilik toko lain.`);
                try {
                    await db.addStaff(phone, staffPhone, staffName);
                    return smartReply(msg, `✅ *${staffName}* (${staffPhone}) ditambahkan sebagai staff!\n\nMereka tinggal chat bot ini.`);
                } catch (err) {
                    if (err.code === '23505') return smartReply(msg, '❌ Nomor sudah terdaftar sebagai staff di toko lain.');
                    return smartReply(msg, '❌ Gagal menambahkan. Coba lagi.');
                }
            }
            if (lowerText.startsWith('hapus karyawan')) {
                const staffPhone = normalizePhone(text.split(/\s+/)[2] || '');
                if (!staffPhone) return smartReply(msg, '❌ Format: *hapus karyawan [nomor]*');
                await db.removeStaff(phone, staffPhone);
                return smartReply(msg, `✅ Staff ${staffPhone} dihapus.`);
            }
            if (lowerText === 'list karyawan' || lowerText === 'daftar karyawan') {
                const staffList = await db.getStaffList(phone);
                if (staffList.length === 0) return smartReply(msg, '📋 Belum ada karyawan.\n\n_Tambah: tambah karyawan 08xxx Nama_');
                let reply = `👥 *STAFF ${user.store_name}*\n━━━━━━━━━━━━━━━━\n`;
                staffList.forEach((s, i) => { reply += `${i + 1}. 👤 *${s.staff_name}*\n   📱 ${s.staff_phone}\n`; });
                const limit = user.status === 'trial' ? ' (maks 2 - Trial)' : ' (unlimited)';
                reply += `\n_Total: ${staffList.length}${limit}_`;
                return smartReply(msg, reply);
            }
            if (lowerText.startsWith('laporan staff')) {
                const staffName = text.split(/\s+/).slice(2).join(' ').trim();
                if (!staffName || staffName.toLowerCase() === 'semua') {
                    const staffList = await db.getStaffList(phone);
                    if (staffList.length === 0) return smartReply(msg, '📋 Belum ada karyawan.');
                    let reply = `📊 *LAPORAN SEMUA STAFF*\n━━━━━━━━━━━━━━━━\n`;
                    for (const s of staffList) {
                        const trxs = await db.getStaffTransactions(phone, s.staff_name);
                        const masuk = trxs.filter(t => t.tipe === 'masuk').reduce((a, t) => a + t.jumlah, 0);
                        const keluar = trxs.filter(t => t.tipe === 'keluar').reduce((a, t) => a + t.jumlah, 0);
                        reply += `\n👤 *${s.staff_name}*\n   📝 ${trxs.length} transaksi\n   💰 Masuk: Rp${formatRupiah(masuk)}\n   💸 Keluar: Rp${formatRupiah(keluar)}\n`;
                    }
                    return smartReply(msg, reply);
                } else {
                    const trxs = await db.getStaffTransactions(phone, staffName);
                    if (trxs.length === 0) return smartReply(msg, `📋 Belum ada transaksi dari *${staffName}*.`);
                    let reply = `📊 *STAFF: ${staffName}*\n━━━━━━━━━━━━━━━━\n`;
                    let totalM = 0, totalK = 0;
                    trxs.slice(0, 15).forEach(t => {
                        const icon = t.tipe === 'masuk' ? '💰' : '💸';
                        if (t.tipe === 'masuk') totalM += t.jumlah; else totalK += t.jumlah;
                        reply += `${icon} Rp${formatRupiah(t.jumlah)} ${t.ket}\n`;
                    });
                    reply += `─────────────────\n💰 Masuk: Rp${formatRupiah(totalM)}\n💸 Keluar: Rp${formatRupiah(totalK)}\n📈 Net: Rp${formatRupiah(totalM - totalK)}`;
                    return smartReply(msg, reply);
                }
            }

            // --- SETTINGS PROFIL ---
            if (lowerText === 'setting' || lowerText === 'setting profil') {
                return smartReply(msg, `⚙️ *SETTING PROFIL STRUK*\n━━━━━━━━━━━━━━━━\n🏪 Nama: *${user.store_name}*\n📍 Alamat: *${user.alamat || '(belum diisi)'}*\n📱 HP: *${user.no_hp_display || '(belum diisi)'}*\n📝 Footer: *${user.footer_struk || 'Terima kasih!'}*\n📐 Ukuran: *${user.ukuran_struk || '58'}mm*\n\n_Ubah dengan:_\n• setting nama [nama toko]\n• setting alamat [alamat]\n• setting hp [nomor]\n• setting footer [teks]\n• setting ukuran [58/80]`);
            }
            if (lowerText.startsWith('setting ') && !lowerText.startsWith('setting profil')) {
                const setParts = text.split(/\s+/);
                const setKey = (setParts[1] || '').toLowerCase();
                const setVal = setParts.slice(2).join(' ');
                if (!setVal) return smartReply(msg, '❌ Format: *setting [field] [nilai]*');
                const fieldMap = { nama: 'store_name', alamat: 'alamat', hp: 'no_hp_display', footer: 'footer_struk', ukuran: 'ukuran_struk' };
                const dbField = fieldMap[setKey];
                if (!dbField) return smartReply(msg, '❌ Field tidak dikenal. Pilih: nama, alamat, hp, footer, ukuran');
                if (setKey === 'ukuran' && !['58', '80'].includes(setVal)) return smartReply(msg, '❌ Ukuran hanya 58 atau 80 (mm)');
                await db.updateUserProfile(phone, { [dbField]: setVal });
                return smartReply(msg, `✅ ${setKey} diubah ke: *${setVal}*`);
            }

            // --- STRUK COMMAND ---
            if (lowerText === 'struk') {
                const ses = await db.getSession(phone);
                const lr = ses?.data?.last_receipt;
                if (!lr || !lr.items || lr.items.length === 0) return smartReply(msg, '❌ Tidak ada transaksi terbaru.\nLakukan transaksi dulu, lalu ketik *struk*.');
                let konfirmasi = `🧾 *KONFIRMASI STRUK*\n━━━━━━━━━━━━━━━━\n`;
                lr.items.forEach(i => { konfirmasi += `• ${i.nama}  Rp${formatRupiah(i.harga)}\n`; });
                konfirmasi += `━━━━━━━━━━━━━━━━\n💰 *TOTAL: Rp${formatRupiah(lr.total)}*\n\n_Input uang pelanggan:_\n• *150000 print* → hitung kembalian\n• *print* → uang pas\n• *batal* → batalkan`;
                await db.setSession(phone, 'struk_payment', { ...lr, ownerPhone: phone, cashier: user.owner_name });
                return smartReply(msg, konfirmasi);
            }

            // Owner - normal message
            await handleWarungMessage(msg, phone, text, user);
            return;
        }

        // ═══ CHECK: Is this a STAFF member? ═══
        const staffInfo = await db.getStaffByPhone(phone);
        if (staffInfo) {
            const owner = await db.getUser(staffInfo.owner_phone);
            if (!owner) return smartReply(msg, '❌ Toko tidak ditemukan. Hubungi pemilik.');
            if (!db.isUserActive(owner)) return smartReply(msg, `⏰ Toko *${owner.store_name}* sudah habis masa aktifnya.\nHubungi pemilik.`);

            if (['menu', 'bantuan', 'help', '?'].includes(lowerText)) {
                return smartReply(msg, getHelpMenu(owner.persona || 'umum', 'staff'));
            }
            // Block restricted commands
            if (lowerText.includes('reset') || lowerText.includes('ubah persona') || lowerText.includes('ganti persona') ||
                lowerText.startsWith('tambah karyawan') || lowerText.startsWith('hapus karyawan') ||
                lowerText.includes('list karyawan') || lowerText.includes('daftar karyawan') ||
                lowerText === 'menu owner' || lowerText === 'owner menu') {
                return smartReply(msg, '🔒 Maaf, fitur ini hanya untuk pemilik toko.');
            }
            if (lowerText === 'keluar toko') {
                await db.removeStaffByPhone(phone);
                return smartReply(msg, `👋 Kamu sudah keluar dari *${owner.store_name}*.\n\nKetik *DAFTAR* jika ingin buat toko sendiri.`);
            }

            // Staff struk command
            if (lowerText === 'struk') {
                const ses = await db.getSession(staffInfo.owner_phone);
                const lr = ses?.data?.last_receipt;
                if (!lr || !lr.items || lr.items.length === 0) return smartReply(msg, '❌ Tidak ada transaksi terbaru.');
                let konfirmasi = `🧾 *KONFIRMASI STRUK*\n━━━━━━━━━━━━━━━━\n`;
                lr.items.forEach(i => { konfirmasi += `• ${i.nama}  Rp${formatRupiah(i.harga)}\n`; });
                konfirmasi += `━━━━━━━━━━━━━━━━\n💰 *TOTAL: Rp${formatRupiah(lr.total)}*\n\n_Input uang:_\n• *150000 print*\n• *print* → uang pas\n• *batal*`;
                await db.setSession(phone, 'struk_payment', { ...lr, ownerPhone: staffInfo.owner_phone, cashier: staffInfo.staff_name });
                return smartReply(msg, konfirmasi);
            }

            // Staff → route to owner's store data
            const staffUser = { ...owner, _role: 'staff', _staffName: staffInfo.staff_name };
            await handleWarungMessage(msg, staffInfo.owner_phone, text, staffUser);
            return;
        }

        // ═══ NOT REGISTERED ═══
        if (lowerText === 'daftar') return handleRegistration(msg, phone, text, null);
        return smartReply(msg, `👋 Halo! Selamat datang di *${config.NAMA_BISNIS}*\n\nNomor kamu belum terdaftar.\n\n1️⃣ Daftar di web: ${config.WEBSITE}/daftar\n2️⃣ Daftar di sini: Ketik *DAFTAR*`);

    } catch (err) {
        console.error('[ERROR]', err);
        smartReply(msg, '❌ Terjadi error. Coba lagi.').catch(() => { });
    }
});

// ═══ START ═══
client.initialize();

// ═══ QR WEB SERVER ═══
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const qrText = fs.existsSync('qr.txt') ? fs.readFileSync('qr.txt', 'utf8') : '';
    res.end(`<html><head><meta http-equiv="refresh" content="5"><title>${config.NAMA_BISNIS} - QR</title></head>
<body style="font-family:Arial;text-align:center;margin-top:50px;background:#0a0a0f;color:#f5f5f7">
<h2>Scan QR Code ${config.NAMA_BISNIS}</h2>
<div id="qr" style="display:inline-block;margin-top:20px"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>if("${qrText}"){new QRCode(document.getElementById("qr"),{text:"${qrText}",width:256,height:256})}else{document.getElementById("qr").innerHTML="<p>Menunggu QR...</p>"}</script>
<p style="margin-top:20px;color:#666">Auto-refresh 5 detik</p></body></html>`);
}).listen(config.PORT_WEB_QR);

console.log('════════════════════════════════════════════');
console.log(` ${config.NAMA_BISNIS} — Bot Kasir WA Multi-Tenant`);
console.log(` QR Scanner: http://localhost:${config.PORT_WEB_QR}`);
console.log('════════════════════════════════════════════');

// ═══ AUTO-REMINDER: H-1 Trial/Subscription Expiry ═══
const DEVELOPER_WA = '6282159895420';

async function checkExpiryReminders() {
    try {
        const users = await db.getAllUsers();
        const tomorrow = moment().tz(TZ).add(1, 'day').startOf('day');
        const tomorrowEnd = moment().tz(TZ).add(1, 'day').endOf('day');

        for (const u of users) {
            if (u.status === 'banned') continue;
            const expiry = u.paid_until ? moment(u.paid_until) : (u.trial_end ? moment(u.trial_end) : null);
            if (!expiry) continue;

            // Check if expiry is tomorrow (H-1)
            if (expiry.isBetween(tomorrow, tomorrowEnd, null, '[]')) {
                const isTrial = u.status === 'trial';
                const msg = isTrial
                    ? `⏰ *Reminder ${config.NAMA_BISNIS}*\n━━━━━━━━━━━━━━━━━━━\n\nHalo *${u.owner_name}*! 👋\n\nMasa trial *${u.store_name}* akan habis *besok*.\n\nJika ingin lanjut berlangganan:\n📱 Hubungi developer:\nwa.me/${DEVELOPER_WA}\n\nTerima kasih sudah menggunakan ${config.NAMA_BISNIS}! 🙏`
                    : `⏰ *Reminder ${config.NAMA_BISNIS}*\n━━━━━━━━━━━━━━━━━━━\n\nHalo *${u.owner_name}*! 👋\n\nMasa langganan *${u.store_name}* akan habis *besok*.\n\nPerpanjang sekarang:\n📱 Hubungi developer:\nwa.me/${DEVELOPER_WA}\n\nTerima kasih! 🙏`;

                try {
                    await client.sendMessage(u.phone + '@c.us', msg);
                    console.log(`[REMINDER] Sent to ${u.phone} (${u.store_name})`);
                    await new Promise(r => setTimeout(r, 2000));
                } catch (e) { console.error(`[REMINDER ERROR] ${u.phone}:`, e.message); }
            }
        }
    } catch (e) { console.error('[REMINDER CHECK ERROR]', e.message); }
}

// Run reminder check every 6 hours
setInterval(checkExpiryReminders, 6 * 60 * 60 * 1000);
// Also run once 30s after startup
setTimeout(checkExpiryReminders, 30000);
console.log('⏰ Auto-reminder aktif (cek setiap 6 jam)');
