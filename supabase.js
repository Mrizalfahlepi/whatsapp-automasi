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

async function registerUser(phone, storeName, ownerName, pin, persona) {
    const trialEnd = moment().tz(TZ).add(config.TRIAL_HARI || 7, 'days').toISOString();
    const { data, error } = await supabase.from('users').insert({
        phone, store_name: storeName, owner_name: ownerName, pin,
        status: 'trial', trial_end: trialEnd, persona: persona || 'warung'
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

async function updateUserPersona(phone, persona) {
    await supabase.from('users').update({ persona, updated_at: new Date().toISOString() }).eq('phone', phone);
}

async function deleteUser(phone) {
    await supabase.from('transactions').delete().eq('user_phone', phone);
    await supabase.from('stock').delete().eq('user_phone', phone);
    await supabase.from('bot_sessions').delete().eq('phone', phone);
    await supabase.from('chat_history').delete().eq('phone', phone);
    await supabase.from('user_reminders').delete().eq('phone', phone);
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

// ═══ CHAT HISTORY (MEMORY) ═══
async function getChatHistory(phone, limit = 10) {
    const { data } = await supabase.from('chat_history')
        .select('role, content')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(limit);
    return (data || []).reverse();
}

async function addChatHistory(phone, role, content) {
    const trimmed = (content || '').substring(0, 500); // Max 500 chars per message
    await supabase.from('chat_history').insert({
        phone, role, content: trimmed
    });
    // Auto-cleanup: keep max 20 per user
    const { data } = await supabase.from('chat_history')
        .select('id').eq('phone', phone)
        .order('created_at', { ascending: false });
    if (data && data.length > 20) {
        const idsToDelete = data.slice(20).map(d => d.id);
        await supabase.from('chat_history').delete().in('id', idsToDelete);
    }
}

// ═══ USER REMINDERS ═══
async function getReminders(phone) {
    const { data } = await supabase.from('user_reminders')
        .select('*').eq('phone', phone)
        .order('created_at', { ascending: false });
    return data || [];
}

async function addReminder(phone, reminder) {
    await supabase.from('user_reminders').insert({ phone, reminder });
}

async function deleteReminder(id) {
    await supabase.from('user_reminders').delete().eq('id', id);
}

// ═══ STORE STAFF ═══
async function getStaffByPhone(staffPhone) {
    const { data } = await supabase.from('store_staff')
        .select('*').eq('staff_phone', staffPhone).single();
    return data;
}

async function getStaffList(ownerPhone) {
    const { data } = await supabase.from('store_staff')
        .select('*').eq('owner_phone', ownerPhone)
        .order('created_at', { ascending: false });
    return data || [];
}

async function addStaff(ownerPhone, staffPhone, staffName) {
    const { data, error } = await supabase.from('store_staff')
        .insert({ owner_phone: ownerPhone, staff_phone: staffPhone, staff_name: staffName })
        .select().single();
    if (error) throw error;
    return data;
}

async function removeStaff(ownerPhone, staffPhone) {
    await supabase.from('store_staff')
        .delete().eq('owner_phone', ownerPhone).eq('staff_phone', staffPhone);
}

async function removeStaffByPhone(staffPhone) {
    await supabase.from('store_staff').delete().eq('staff_phone', staffPhone);
}

async function getStaffTransactions(ownerPhone, staffName) {
    // Get transactions with keterangan containing staff name tag
    const { data } = await supabase.from('transactions')
        .select('*').eq('user_phone', ownerPhone)
        .ilike('ket', `%[${staffName}]%`)
        .order('created_at', { ascending: false }).limit(30);
    return data || [];
}

// ═══ STORE PROFILE ═══
async function updateUserProfile(phone, fields) {
    fields.updated_at = new Date().toISOString();
    await supabase.from('users').update(fields).eq('phone', phone);
}

module.exports = {
    supabase, getUser, registerUser, getAllUsers, updateUserStatus, updateUserPersona, deleteUser, isUserActive,
    getTransactions, insertTransaction, getSaldo, deleteTransactions,
    getStock, upsertStock, deleteStock,
    getSession, setSession, deleteSession,
    getChatHistory, addChatHistory,
    getReminders, addReminder, deleteReminder,
    getStaffByPhone, getStaffList, addStaff, removeStaff, removeStaffByPhone, getStaffTransactions,
    updateUserProfile
};
