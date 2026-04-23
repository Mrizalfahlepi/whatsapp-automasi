const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const moment = require('moment-timezone');
const cron = require('node-cron');
const config = require('./config');

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const genAI = config.GEMINI_API_KEY ? new GoogleGenerativeAI(config.GEMINI_API_KEY) : null;
let geminiModel = null;

if (genAI) {
    geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
            temperature: 0.2, // Supaya AI tidak berkhayal dan logis
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    insertTransaksi: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                tipe: { type: SchemaType.STRING, description: "'masuk' atau 'keluar'" },
                                jumlah: { type: SchemaType.NUMBER },
                                ket: { type: SchemaType.STRING }
                            },
                            required: ["tipe", "jumlah", "ket"]
                        }
                    },
                    updateStok: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                aksi: { type: SchemaType.STRING, description: "'tambah' atau 'kurang'" },
                                nama_barang: { type: SchemaType.STRING },
                                qty: { type: SchemaType.NUMBER },
                                satuan: { type: SchemaType.STRING, description: "Contoh: pcs, kardus, pak, renteng, dll" }
                            },
                            required: ["aksi", "nama_barang", "qty", "satuan"]
                        }
                    },
                    aksiReset: {
                         type: SchemaType.STRING,
                         description: "HANYA diisi 'RESET_HARIAN' atau 'RESET_TOTAL' jika user tegas berkata YAKIN HAPUS. Kosongkan apabila sekadar tanya atau belum konfirmasi."
                    },
                    reply: {
                        type: SchemaType.STRING,
                        description: "Balasan text. Gunakan bahasa kasir asik, pakai tabel rapi (====, |) bila diminta rekap/laporan. Bila user beli borongan tanpa detail, wajib ditanya balik pakai string ini."
                    }
                },
                required: ["reply"]
            }
        }
    });
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    }
});

const DB_FILE = config.FILE_DATABASE;
const NOMOR_ADMIN = config.NOMOR_ADMIN + '@c.us';
const FOLDER_STRUK = config.FOLDER_STRUK;
const TZ = config.TIMEZONE || 'Asia/Jakarta';
const BACKUP_TXT = config.FILE_BACKUP_TXT || './laporan_database.txt';

if (!fs.existsSync(FOLDER_STRUK)) fs.mkdirSync(FOLDER_STRUK);
let db = { transaksi: [], stok: {} };
const botSentMessages = new Set(); // ANTI-LOOP SYSTEM
const knownSelfChatIds = new Set(); // Cache ID Saved Messages yang sudah tervalidasi

if (fs.existsSync(DB_FILE)) {
    const raw = JSON.parse(fs.readFileSync(DB_FILE));
    db.transaksi = raw.transaksi || [];
    db.stok = raw.stok || {};
}

const formatRupiah = (angka) => new Intl.NumberFormat('id-ID').format(angka);
const getTanggal = () => moment().tz(TZ).format('YYYY-MM-DD');
const getTanggalLengkap = () => moment().tz(TZ).format('dddd, DD MMMM YYYY');
const getWaktu = () => moment().tz(TZ).format('HH:mm WIB');
const hitungSaldo = () => db.transaksi.reduce((a, b) => a + (b.tipe === 'masuk' ? b.jumlah : -b.jumlah), 0);

const saveDB = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        
        // BACKUP DB SEBAGAI TXT (Sesuai Permintaan)
        let txtDump = `======================================\n`;
        txtDump += `   DATABASE KASIR & STOK - BACKUP TXT\n`;
        txtDump += `   Update: ${getTanggalLengkap()} ${getWaktu()}\n`;
        txtDump += `======================================\n\n`;
        
        txtDump += `[ SALDO TOTAL BERJALAN ]\n`;
        txtDump += `Rp ${formatRupiah(hitungSaldo())}\n\n`;
        
        txtDump += `[ SISA INVENTARIS STOK (GUDANG) ]\n`;
        const keys = Object.keys(db.stok);
        if(keys.length === 0) txtDump += `- Kosong\n`;
        else keys.forEach(k => { txtDump += `- ${db.stok[k].nama.toUpperCase()}: ${db.stok[k].qty} ${db.stok[k].satuan}\n`; });
        
        txtDump += `\n[ HISTORI TRANSAKSI ]\n`;
        if(db.transaksi.length === 0) txtDump += `- Belum ada data transaksi\n`;
        else db.transaksi.forEach((t, i) => { txtDump += `${i+1}. ${t.tanggal} | [${t.tipe.toUpperCase()}] Rp${formatRupiah(t.jumlah)} - ${t.ket}\n`; });
        
        fs.writeFileSync(BACKUP_TXT, txtDump, 'utf8');
    } catch (e) {
        console.error('[SAVE DB ERROR]', e.message);
    }
};
saveDB(); // Run 1x untuk bikin file txt

client.on('qr', (qr) => {
    fs.writeFileSync('qr.txt', qr);
    console.log(`SCAN QR INI PAKE WA BOT/PELAYAN (Nomor Admin: ${config.NOMOR_ADMIN}):`);
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ Bot Keuangan Toko Siap! Login sebagai:', client.info.pushname);
    console.log('   Bot WID:', client.info.wid._serialized);
    // Pre-cache: Tambahkan adminId sendiri ke known self chat IDs
    knownSelfChatIds.add(NOMOR_ADMIN);
    knownSelfChatIds.add(client.info.wid._serialized);
});

client.on('auth_failure', msg => { console.error('AUTH GAGAL:', msg); });
client.on('disconnected', (reason) => { console.log('Client terputus:', reason); });

client.on('message_create', async msg => {
    if (msg.body && botSentMessages.has(msg.body.trim())) return; // ANTI-LOOP FILTER

    const originalReply = msg.reply.bind(msg);
    msg.reply = async (text) => {
        try {
            if (text) {
                botSentMessages.add(text.trim());
                setTimeout(() => botSentMessages.delete(text.trim()), 60000);
            }
            const chat = await msg.getChat();
            await new Promise(r => setTimeout(r, 1000));
            await chat.sendSeen();
            await new Promise(r => setTimeout(r, 1000));
            await chat.sendStateTyping();
            await new Promise(r => setTimeout(r, 2000)); 
            await chat.clearState();
        } catch (e) {
            console.error("Gagal meniru manusia:", e);
        }
        return originalReply(text);
    };
    
    // ===================== FILTER KEAMANAN =====================
    const adminId = NOMOR_ADMIN; // "6282159895420@c.us"
    
    // 1) Blokir pesan yang bukan dari akun sendiri
    if (!msg.fromMe) return;
    
    // 2) Blokir grup
    if (msg.to.endsWith('@g.us')) return;
    
    // 3) Blokir pesan ke kontak @c.us lain (selain diri sendiri)
    if (msg.to.endsWith('@c.us') && msg.to !== adminId) return;
    
    // 4) Untuk pesan ke @lid: cek apakah ini Saved Messages (diri sendiri) atau chat teman
    if (msg.to.endsWith('@lid')) {
        if (!knownSelfChatIds.has(msg.to)) {
            // ID ini belum dikenal, cek via getChat() satu kali saja
            try {
                const chat = await msg.getChat();
                // Di Saved Messages: chat.name biasanya "You" atau nama akun sendiri
                // atau chat.id.user sama dengan nomor kita
                const myNumber = client.info.wid.user; // "6282159895420"
                const chatNumber = chat.id?.user || '';
                const chatName = (chat.name || '').toLowerCase();
                const myName = (client.info.pushname || '').toLowerCase();
                
                const isSelf = chatNumber === myNumber 
                    || chatName === 'you' 
                    || chatName === 'me'
                    || chatName === myName
                    || chat.id?._serialized === adminId
                    || msg.to === client.info.wid._serialized;
                
                if (isSelf) {
                    knownSelfChatIds.add(msg.to); // Cache biar next time langsung lolos
                    console.log(`[CACHE] ${msg.to} terdeteksi sebagai self-chat. Di-cache.`);
                } else {
                    console.log(`[BLOKIR] Pesan ke ${msg.to} (${chat.name}) bukan self-chat.`);
                    return;
                }
            } catch(e) {
                console.error('[FILTER ERROR]', e.message);
                return;
            }
        }
    }
    
    console.log(`[+] DIPROSES -> Dari: ${msg.from} | Ke: ${msg.to} | Teks: ${msg.body}`);

    const text = msg.body.trim();
    const textLower = text.toLowerCase();
    const hariIni = getTanggal();

    try {
        let uploadedStruk = null;
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const timestamp = moment().tz('Asia/Jakarta').format('YYYYMMDD_HHmmss');
            const filename = `struk_${timestamp}.jpg`;
            fs.writeFileSync(`${FOLDER_STRUK}/${filename}`, media.data, 'base64');
            uploadedStruk = filename;
            
            if (!text) {
                await msg.reply(`📷 Foto struk disimpan: *${filename}*\n\nSekarang *balas pesan ini* dengan format:\n*keluar [total] [keterangan]*\n\nAtau gunakan AI (misal: "tadi pengeluaran bensin 20ribu")`);
                return;
            }
        }

        // Fast path untuk basic syntax: "masuk 50k jual bensin" supaya super cepat
        const rxFastPath = /^(\+|masuk|in|\-|keluar|out)\s+([0-9.,]+(?:[ \t]*(?:juta|jt|ribu|rb|k|m))?)(?:[ \t]+(.*))?$/i;
        const matchFastPath = text.match(rxFastPath);
        
        if (matchFastPath) {
            const cmd = matchFastPath[1].toLowerCase();
            const tipe = ['+', 'masuk', 'in'].includes(cmd) ? 'masuk' : 'keluar';
            
            let amountStr = matchFastPath[2];
            let ket = matchFastPath[3] || '-';

            let numStr = amountStr.toLowerCase().replace(/\s/g, '');
            let jumlah = NaN;
            if (numStr.includes('juta') || numStr.includes('jt') || numStr.includes('m')) {
                jumlah = parseFloat(numStr.replace(/juta|jt|m/g, '').replace(/\./g, '').replace(/,/g, '.')) * 1000000;
            } else if (numStr.includes('ribu') || numStr.includes('rb') || numStr.includes('k')) {
                jumlah = parseFloat(numStr.replace(/ribu|rb|k/g, '').replace(/\./g, '').replace(/,/g, '.')) * 1000;
            } else {
                jumlah = Math.round(parseFloat(numStr.replace(/\./g, '').replace(/,/g, '.')));
            }

            if (isNaN(jumlah) || jumlah <= 0) return msg.reply(`❌ Nominal manual tidak valid 🤔\nContoh: *${cmd} 50k cemilan*`);

            let namaFileStruk = uploadedStruk;
            if (!namaFileStruk && tipe === 'keluar' && msg.hasQuotedMsg) {
                const quoted = await msg.getQuotedMessage();
                if (quoted.body) {
                    const matchFilename = quoted.body.match(/struk_\d{8}_\d{6}\.jpg/i);
                    if (matchFilename) namaFileStruk = matchFilename[0];
                }
                if (!namaFileStruk && quoted.hasMedia) {
                    const files = fs.readdirSync(FOLDER_STRUK).sort();
                    if (files.length > 0) namaFileStruk = files[files.length - 1];
                }
            }

            db.transaksi.push({ tipe, jumlah, ket, tanggal: hariIni, id: Date.now(), struk: namaFileStruk });
            saveDB();

            let reply = `✅ ${tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran'} dicatat\n${formatRupiah(jumlah)} - ${ket}`;
            if (namaFileStruk) reply += ` 📷`;
            reply += `\nSaldo: Rp${formatRupiah(hitungSaldo())}`;
            msg.reply(reply);
        }

        // HAK PENUH DIBERIKAN KEPADA GEMINI AI (TERMASUK LAPORAN, STOK, RESET DATA, DLL)
        else {
            if (geminiModel) {
               const recentTrx = db.transaksi.slice(-40);
               const prompt = `Anda adalah "KasirBot", asisten kasir cerdas untuk "${config.NAMA_TOKO || 'Toko Kelontong'}". Owner bernama "${config.NAMA_OWNER || 'Bos'}". Anda santuy tapi AKURAT. Anda paham bahasa gaul, Sunda, Jawa ngoko/krama, Madura, Melayu, dll.
Sekarang: ${getTanggalLengkap()} ${getWaktu()}.

--- ATURAN SUPER KETAT ---
1. TANGKAP PENJUALAN/KULAKAN: JIKA user bilang terjual (ex: "jual rokok 50rb"), masukkan sbg "masuk" (uang), dan pastikan KURANGI stok di "updateStok".
2. TANGKAP PEMBELIAN STOK: JIKA user kulakan nambah barang (ex: "beli indomie kardus"), tambah isi stok "tambah" di "updateStok" dan potong uang "keluar" (kalo bayar uang).
3. KONFIRMASI JIKA TEKS TIDAK JELAS: JIKA detail hilang (cth: "Beli mie indomie 1 kardus" TAPI harganya nggak ada, ATAU 1 kardusnya bakal di ecer tak bilang isi brp pcs), ANDA DILARANG ENTRY insertTransaksi / updateStok. Balas di text "reply" saja ngerocos pake logat manusia/daerah: "Duh punten, indomie harganya berapa? Trus sekardus isi berapa biji nih biar gampang direkap?".
4. FORMAT LAPORAN/REKAP (HARI INI / TOTAL): Jika dimintai hasil / laporan harian / database dll, pamerkan kehebatanmu bikin TABEL ASCII pakai simbol ===, |, dll. Pastikan pisah tabel HARI INI vs LAPORAN TOTAL PERIODE kalau diminta. Tampilkan uang masuk/keluar dan rincian Sisa Stok.
5. SISA STOK DISPLAY: AI yang bertugas mengonversi/menjelaskan "sisa 2 kardus 2 pcs" jika relevan murni dari akal sehat saat ngetik reply. Di database updateStok pecah murni aja.
6. FITUR RESET / MENGHAPUS: JIKA user berkata "reset harian", "hapus data semua", atau mirip. Cek niatnya! JIKA user belum bilang YAKIN (hanya niat), cukup reply konfirmasi dengan peringatan keras. "Bro, yakin mau hapus data total? Ketik YA RESET TOTAL kalo yakin banget". JIKA mereka jawab YAKIN kuat, isi field \`aksiReset\` dengan "RESET_HARIAN" atau "RESET_TOTAL".

Data Realtime Store saat ini Anda pegang (dibutuhkan agar balasanmu konkrit):
[Saldo Store]: Rp${formatRupiah(hitungSaldo())}
[DB Stok Saat Ini]: ${JSON.stringify(db.stok)}
[DB Transaksi Berjalan]: ${JSON.stringify(recentTrx)}

Chat terbaru dari Bos (User): "${text}"`;
               
               try {
                   const result = await geminiModel.generateContent(prompt);
                   const responseJSON = JSON.parse(result.response.text());
                   let isDBSaved = false;

                   // 1) HAPUS DATA KEUANGAN / RESET SYSTEM
                   if (responseJSON.aksiReset === 'RESET_TOTAL') {
                        db.transaksi = [];
                        db.stok = {};
                        isDBSaved = true;
                   } else if (responseJSON.aksiReset === 'RESET_HARIAN') {
                        db.transaksi = db.transaksi.filter(t => t.tanggal !== hariIni);
                        // Logika sederhana reset stok harian agak pelik jika tak ada stempel waktu di stok. 
                        // Anggap bot mereset transaksi uang saja.
                        isDBSaved = true;
                   }

                   // 2) KELOLA KEUANGAN
                   if (responseJSON.insertTransaksi && responseJSON.insertTransaksi.length > 0) {
                       let offset = 0;
                       for (const trx of responseJSON.insertTransaksi) {
                            db.transaksi.push({
                                tipe: trx.tipe === 'masuk' ? 'masuk' : 'keluar',
                                jumlah: Number(trx.jumlah) || 0,
                                ket: trx.ket || '',
                                tanggal: hariIni,
                                id: Date.now() + offset++,
                                struk: null
                            });
                       }
                       isDBSaved = true;
                   }

                   // 3) KELOLA STOK BARANG
                   if (responseJSON.updateStok && responseJSON.updateStok.length > 0) {
                        for (const stk of responseJSON.updateStok) {
                             const key = `${stk.nama_barang.toLowerCase()}__${stk.satuan.toLowerCase()}`;
                             if (!db.stok[key]) db.stok[key] = { nama: stk.nama_barang, satuan: stk.satuan, qty: 0 };
                             
                             if (stk.aksi === 'tambah') db.stok[key].qty += stk.qty;
                             else if (stk.aksi === 'kurang') {
                                 db.stok[key].qty -= stk.qty;
                                 if (db.stok[key].qty < 0) db.stok[key].qty = 0; 
                             }
                        }
                        isDBSaved = true;
                   }

                   if (isDBSaved) saveDB();
                   if (responseJSON.reply) msg.reply(responseJSON.reply);

               } catch (err) {
                   console.error("Gemini Parse Error:", err);
                   msg.reply("❌ Error memecah jawaban AI. Silakan modif omonganmu.");
               }
            }
        }
    } catch (e) {
        console.error('Error handle message:', e);
        msg.reply('❌ Terjadi error sistem (bukan AI). Coba lagi besok.');
    }
});

// Parsing JAM_LAPORAN dari config (format 'HH:MM')
const [jamLap, menitLap] = (config.JAM_LAPORAN || '00:00').split(':');
const cronExpr = `${parseInt(menitLap)} ${parseInt(jamLap)} * * *`;

cron.schedule(cronExpr, async () => {
    try {
        console.log('[CRON] Menjalankan pembuatan rekap malam...');
        if (!geminiModel) return;
        
        // At 00:00, "kemarin" adalah data yg baru saja dilewati.
        const dmyKemarin = moment().tz(TZ).subtract(1, 'minutes').format('dddd, DD MMMM YYYY');

        const prompt = `Anda adalah "KasirBot" milik "${config.NAMA_TOKO || 'Toko Kelontong'}". System trigger: LAPORAN OTOMATIS. 
Tulis laporan terstruktur untuk tanggal ${dmyKemarin}.
Buatkan TABEL ASCII yang amat memukau bos Anda.
1. Tabel 1: Laporan Khusus Hari Ini (Hari yg direkap).
2. Tabel 2: Akumulasi semua Saldo Periode berjalan & Semua Sisa STOK GUDANG Gudang saat ini.

Data untuk dianalisis:
Stok Tersedia Saat ini: ${JSON.stringify(db.stok)}
History: ${JSON.stringify(db.transaksi)}

Masukkan desain ke dalam block balasan teks (reply). Jangan ada proses manipulasi database di json mu kali ini. Beri kata-kata puitis/hangat.`;

        const result = await geminiModel.generateContent(prompt);
        const responseJSON = JSON.parse(result.response.text());
        
        if (responseJSON.reply) {
            botSentMessages.add(responseJSON.reply.trim());
            setTimeout(() => botSentMessages.delete(responseJSON.reply.trim()), 60000);
            await client.sendMessage(NOMOR_ADMIN, responseJSON.reply);
        }
    } catch(err) {
        console.error("[CRON FAILED]", err);
    }
}, { timezone: TZ });

client.initialize();

const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const qrText = fs.existsSync('qr.txt') ? fs.readFileSync('qr.txt', 'utf8') : '';
    res.end(`
        <html>
        <head>
          <meta http-equiv="refresh" content="5">
          <title>QR Scanner</title>
        </head>
        <body style="font-family: Arial; text-align: center; margin-top: 50px;">
          <h2>Scan QR Code Bot Kasir</h2>
          <div id="qrcode" style="display:inline-block; margin-top:20px;"></div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            if("${qrText}") { new QRCode(document.getElementById("qrcode"), "${qrText}"); } 
            else { document.getElementById("qrcode").innerHTML = "Menunggu QR..."; }
          </script>
          <p style="margin-top:20px; color:#666;">Otomatis refresh</p>
        </body>
        </html>
    `);
}).listen(config.PORT_WEB_QR);

console.log('====================================================');
console.log(' BUKA GOOGLE CHROME DI VM ANDA DAN KETIK ALAMAT:');
console.log(`                 http://localhost:${config.PORT_WEB_QR}`);
console.log('====================================================');
