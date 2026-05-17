const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const moment = require('moment-timezone');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
const TZ = config.TIMEZONE || 'Asia/Jakarta';

// ═══ USER MANAGEMENT ═══
async function getUser(phone) {
    const { data } = await supabase.from('users').select('*').eq('phone', phone).single();
    return data;
}

async function registerUser(phone, storeName, ownerName, pin) {
    const trialEnd = moment().tz(TZ).add(config.TRIAL_HARI || 7, 'days').toISOString();
    const { data, error } = await supabase.from('users').insert({
        phone, store_name: storeName, owner_name: ownerName, pin,
        status: 'trial', trial_end: trialEnd
    }).select().single();
    if (error) throw error;
    return data;
}

async function getAllUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    return data || [];
}

async function updateUserStatus(phone, status, paidUntil) {
    const update = { status, updated_at: new Date().toISOString() };
    if (paidUntil) update.paid_until = paidUntil;
    await supabase.from('users').update(update).eq('phone', phone);
}

async function deleteUser(phone) {
    await supabase.from('transactions').delete().eq('user_phone', phone);
    await supabase.from('stock').delete().eq('user_phone', phone);
    await supabase.from('bot_sessions').delete().eq('phone', phone);
    await supabase.from('users').delete().eq('phone', phone);
}

function isUserActive(user) {
    if (!user) return false;
    if (user.status === 'banned') return false;
    if (user.status === 'active' && user.paid_until) {
        return moment().tz(TZ).isBefore(moment(user.paid_until));
    }
    if (user.status === 'trial' && user.trial_end) {
        return moment().tz(TZ).isBefore(moment(user.trial_end));
    }
    return false;
}

// ═══ TRANSACTIONS ═══
async function getTransactions(phone, dateFilter) {
    let q = supabase.from('transactions').select('*').eq('user_phone', phone).order('created_at', { ascending: false });
    if (dateFilter) q = q.eq('tanggal', dateFilter);
    const { data } = await q.limit(50);
    return data || [];
}

async function insertTransaction(phone, tipe, jumlah, ket) {
    const tanggal = moment().tz(TZ).format('YYYY-MM-DD');
    await supabase.from('transactions').insert({ user_phone: phone, tipe, jumlah: Math.round(jumlah), ket, tanggal });
}

async function getSaldo(phone) {
    const { data } = await supabase.from('transactions').select('tipe, jumlah').eq('user_phone', phone);
    if (!data) return 0;
    return data.reduce((a, b) => a + (b.tipe === 'masuk' ? b.jumlah : -b.jumlah), 0);
}

async function deleteTransactions(phone) {
    await supabase.from('transactions').delete().eq('user_phone', phone);
}

// ═══ STOCK ═══
async function getStock(phone) {
    const { data } = await supabase.from('stock').select('*').eq('user_phone', phone);
    return data || [];
}

async function upsertStock(phone, namaBarang, qty, satuan, aksi) {
    const { data: existing } = await supabase.from('stock')
        .select('*').eq('user_phone', phone).eq('nama_barang', namaBarang).eq('satuan', satuan).single();
    
    if (existing) {
        let newQty = aksi === 'tambah' ? existing.qty + qty : existing.qty - qty;
        if (newQty < 0) newQty = 0;
        await supabase.from('stock').update({ qty: newQty }).eq('id', existing.id);
    } else {
        await supabase.from('stock').insert({ user_phone: phone, nama_barang: namaBarang, qty, satuan });
    }
}

async function deleteStock(phone) {
    await supabase.from('stock').delete().eq('user_phone', phone);
}

// ═══ BOT SESSIONS ═══
async function getSession(phone) {
    const { data } = await supabase.from('bot_sessions').select('*').eq('phone', phone).single();
    return data;
}

async function setSession(phone, state, data) {
    const row = { phone, state, updated_at: new Date().toISOString() };
    if (data !== undefined) row.data = data;
    await supabase.from('bot_sessions').upsert(row, { onConflict: 'phone' });
}

async function deleteSession(phone) {
    await supabase.from('bot_sessions').delete().eq('phone', phone);
}

module.exports = {
    supabase, getUser, registerUser, getAllUsers, updateUserStatus, deleteUser, isUserActive,
    getTransactions, insertTransaction, getSaldo, deleteTransactions,
    getStock, upsertStock, deleteStock,
    getSession, setSession, deleteSession
};
