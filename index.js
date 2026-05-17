const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const moment = require('moment-timezone');
const config = require('./config');
const db = require('./supabase');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

// ═══ GEMINI AI SETUP ═══
const genAI = config.GEMINI_API_KEY ? new GoogleGenerativeAI(config.GEMINI_API_KEY) : null;
let geminiModel = null;
if (genAI) {
    geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.2,
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
                                qty: { type: SchemaType.NUMBER },
                                satuan: { type: SchemaType.STRING }
                            }, required: ['aksi', 'nama_barang', 'qty', 'satuan']
                        }
                    },
                    aksiReset: { type: SchemaType.STRING, description: "HANYA 'RESET_HARIAN' atau 'RESET_TOTAL' jika user tegas YAKIN HAPUS. Kosongkan jika belum konfirmasi." },
                    reply: { type: SchemaType.STRING, description: "Balasan teks ke user. Gunakan bahasa kasir santuy, tabel rapi jika diminta rekap." }
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

// ═══ ADMIN COMMANDS HANDLER ═══
async function handleAdminCommand(msg, text) {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === '#list') {
        const users = await db.getAllUsers();
        if (users.length === 0) return smartReply(msg, '📋 Belum ada warung terdaftar.');
        let reply = `📋 *DAFTAR WARUNG* (${users.length})\n━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const u of users) {
            const active = db.isUserActive(u);
            const icon = active ? '🟢' : (u.status === 'banned' ? '⛔' : '🔴');
            reply += `${icon} *${u.store_name}*\n   ${u.phone} | ${u.owner_name}\n   Status: ${u.status} | ${active ? 'Aktif' : 'Expired'}\n\n`;
        }
        return smartReply(msg, reply);
    }

    if (cmd === '#info' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Warung ${phone} tidak ditemukan.`);
        const saldo = await db.getSaldo(phone);
        const trx = await db.getTransactions(phone);
        const stok = await db.getStock(phone);
        let reply = `📊 *INFO WARUNG*\n━━━━━━━━━━━━━━━━━━━━━\n`;
        reply += `🏪 *${user.store_name}*\n👤 ${user.owner_name}\n📱 ${user.phone}\n`;
        reply += `📌 Status: ${user.status}\n`;
        reply += `⏰ Trial: ${user.trial_end ? moment(user.trial_end).format('DD MMM YYYY') : '-'}\n`;
        reply += `💳 Bayar s/d: ${user.paid_until ? moment(user.paid_until).format('DD MMM YYYY') : '-'}\n`;
        reply += `💰 Saldo: Rp${formatRupiah(saldo)}\n📝 Transaksi: ${trx.length}\n📦 Item stok: ${stok.length}`;
        return smartReply(msg, reply);
    }

    if (cmd === '#aktifkan' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Warung ${phone} tidak ditemukan.`);
        const days = parseInt(parts[2]) || 30;
        const paidUntil = moment().tz(TZ).add(days, 'days').toISOString();
        await db.updateUserStatus(phone, 'active', paidUntil);
        return smartReply(msg, `✅ *${user.store_name}* (${phone}) diaktifkan ${days} hari.\nAktif sampai: ${moment(paidUntil).format('DD MMM YYYY')}`);
    }

    if (cmd === '#trial' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Warung ${phone} tidak ditemukan.`);
        const trialEnd = moment().tz(TZ).add(config.TRIAL_HARI || 7, 'days').toISOString();
        await db.supabase.from('users').update({ status: 'trial', trial_end: trialEnd, updated_at: new Date().toISOString() }).eq('phone', phone);
        return smartReply(msg, `✅ Trial *${user.store_name}* (${phone}) direset ${config.TRIAL_HARI || 7} hari.`);
    }

    if (cmd === '#ban' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Warung ${phone} tidak ditemukan.`);
        await db.updateUserStatus(phone, 'banned');
        return smartReply(msg, `⛔ *${user.store_name}* (${phone}) diblokir.`);
    }

    if (cmd === '#hapus' && parts[1]) {
        const phone = normalizePhone(parts[1]);
        const user = await db.getUser(phone);
        if (!user) return smartReply(msg, `❌ Warung ${phone} tidak ditemukan.`);
        await db.deleteUser(phone);
        return smartReply(msg, `🗑️ *${user.store_name}* (${phone}) dihapus total (user + transaksi + stok).`);
    }

    return false;
}

// ═══ REGISTRATION FLOW HANDLER ═══
async function handleRegistration(msg, phone, text, session) {
    const state = session?.state;

    if (!state || state === 'idle' || state === 'active') {
        if (text.toLowerCase() === 'daftar') {
            await db.setSession(phone, 'reg_store');
            return smartReply(msg, `📝 *Pendaftaran ${config.NAMA_BISNIS}*\n\nLangkah 1/3\nKirimkan *Nama Toko* kamu:\n\n_Contoh: Warung Berkah Bu Amin_`);
        }
        return null;
    }

    if (state === 'reg_store') {
        await db.setSession(phone, 'reg_owner', { store_name: text.trim() });
        return smartReply(msg, `✅ Nama toko: *${text.trim()}*\n\nLangkah 2/3\nSekarang kirim *Nama Pemilik*:\n\n_Contoh: Bu Amin_`);
    }

    if (state === 'reg_owner') {
        const prevData = session?.data || {};
        await db.setSession(phone, 'reg_pin', { ...prevData, owner_name: text.trim() });
        return smartReply(msg, `✅ Nama pemilik: *${text.trim()}*\n\nLangkah 3/3\nBuat *PIN 6 digit* untuk login di website:\n\n_Contoh: 123456_`);
    }

    if (state === 'reg_pin') {
        const pin = text.replace(/\D/g, '');
        if (pin.length < 4 || pin.length > 8) {
            return smartReply(msg, '❌ PIN harus 4-8 digit angka. Coba lagi:');
        }
        const temp = session?.data || {};
        try {
            await db.registerUser(phone, temp.store_name || 'Toko Baru', temp.owner_name || 'Owner', pin);
            await db.setSession(phone, 'active', null);
            const trialEnd = moment().tz(TZ).add(config.TRIAL_HARI || 7, 'days').format('DD MMMM YYYY');
            return smartReply(msg, `🎉 *Pendaftaran Berhasil!*\n━━━━━━━━━━━━━━━━━━━━━\n🏪 Toko: *${temp.store_name}*\n👤 Pemilik: *${temp.owner_name}*\n🔑 PIN: *${pin}*\n⏰ Trial GRATIS sampai: *${trialEnd}*\n\n📌 Kamu juga bisa login di:\n🌐 ${config.WEBSITE}/kasir\n\nMulai sekarang, langsung chat untuk catat penjualan!\n_Contoh: masuk 50k jual rokok_`);
        } catch (err) {
            console.error('[REG ERROR]', err);
            if (err.code === '23505') return smartReply(msg, '❌ Nomor ini sudah terdaftar!');
            return smartReply(msg, '❌ Gagal mendaftar. Coba lagi nanti.');
        }
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

        const prompt = `Anda adalah "KasirBot", asisten kasir cerdas untuk "${user.store_name}". Owner bernama "${user.owner_name}". Anda santuy tapi AKURAT. Paham bahasa gaul, Sunda, Jawa, Madura, Melayu, dll.
Sekarang: ${getTanggalLengkap()} ${getWaktu()}.

--- ATURAN KETAT ---
1. PENJUALAN: Jika user jual barang, masukkan "masuk" dan KURANGI stok.
2. PEMBELIAN STOK: Jika user kulakan, "keluar" uang dan TAMBAH stok.
3. JIKA TIDAK JELAS: Tanya balik di "reply", JANGAN entry data.
4. LAPORAN: Buat TABEL ASCII rapi. Pisah hari ini vs total.
5. STOK DISPLAY: Konversi ke penjelasan manusia.
6. RESET: Jika user minta reset, KONFIRMASI dulu. Baru isi aksiReset jika user bilang "YA HAPUS DATA".
7. GAMBAR/STRUK: Jika ada gambar, BACA teks/struk belanja di dalamnya. Pahami total uangnya (masuk/keluar) beserta daftar barangnya, lalu otomatis catat transaksi DAN stoknya secara rinci.

Data Realtime:
[Saldo]: Rp${formatRupiah(saldo)}
[Stok]: ${JSON.stringify(stokObj)}
[Transaksi Terakhir]: ${JSON.stringify(recentTrx.slice(0, 40))}

Chat dari ${user.owner_name}: "${text || '[Mengirim Gambar/Struk]'}"`;

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

        // Process transactions
        if (res.insertTransaksi && res.insertTransaksi.length > 0) {
            for (const trx of res.insertTransaksi) {
                await db.insertTransaction(phone, trx.tipe === 'masuk' ? 'masuk' : 'keluar', Number(trx.jumlah) || 0, trx.ket || '');
            }
        }

        // Process stock
        if (res.updateStok && res.updateStok.length > 0) {
            for (const stk of res.updateStok) {
                await db.upsertStock(phone, stk.nama_barang, stk.qty, stk.satuan, stk.aksi);
            }
        }

        if (res.reply) return smartReply(msg, res.reply);
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
    if (!msg.body || msg.fromMe) return;
    if (botSentMessages.has(msg.body.trim())) return;
    if (msg.from.endsWith('@g.us')) return; // Ignore groups

    let phone = msg.from.replace('@c.us', '').replace('@lid', '');
    try {
        const contact = await msg.getContact();
        if (contact && contact.number) {
            phone = contact.number;
        }
    } catch (e) {}
    const text = msg.body.trim();
    console.log(`[MSG] ${phone}: ${text}`);

    try {
        // Check session for registration flow
        const session = await db.getSession(phone);
        if (session && session.state && session.state.startsWith('reg_')) {
            const handled = await handleRegistration(msg, phone, text, session);
            if (handled) return;
        }

        // Check user registration
        const user = await db.getUser(phone);

        if (!user) {
            // Not registered - show registration menu
            if (text.toLowerCase() === 'daftar') {
                return handleRegistration(msg, phone, text, null);
            }
            return smartReply(msg, `👋 Halo! Selamat datang di *${config.NAMA_BISNIS}*\n\nNomor kamu belum terdaftar.\n\n*Pilih cara daftar:*\n\n1️⃣ Daftar di *website*:\n🌐 ${config.WEBSITE}/daftar\n\n2️⃣ Daftar *di sini*:\nKetik *DAFTAR*`);
        }

        // Check if active
        if (!db.isUserActive(user)) {
            return smartReply(msg, `⏰ Masa aktif *${user.store_name}* sudah habis.\n\nUntuk perpanjang, hubungi admin:\n📱 wa.me/${config.NOMOR_ADMIN}\n\nAtau cek di:\n🌐 ${config.WEBSITE}/kasir`);
        }

        // Active user - process message
        await handleWarungMessage(msg, phone, text, user);

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
