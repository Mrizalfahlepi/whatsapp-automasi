const { createCanvas } = require('canvas');

function fmtRp(n) { return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function generateReceipt(opts) {
    const {
        storeName = 'Toko', address = '', storePhone = '',
        items = [], total = 0, paid = 0, change = 0,
        cashier = 'Kasir', footer = 'Terima kasih!',
        date = '', receiptWidth = '58'
    } = opts;

    const W = receiptWidth === '80' ? 500 : 360;
    const PAD = 16;
    const LH = 22;
    const headerLines = 1 + (address ? 1 : 0) + (storePhone ? 1 : 0);
    const H = (headerLines + items.length + 12) * LH + 40;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';

    let y = 28;
    const cx = W / 2;

    // Store name
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(storeName.substring(0, 30), cx, y); y += LH;

    if (address) { ctx.font = '12px monospace'; ctx.fillText(address.substring(0, 40), cx, y); y += LH - 4; }
    if (storePhone) { ctx.font = '12px monospace'; ctx.fillText(storePhone, cx, y); y += LH - 4; }

    // Dashed line
    y += 8;
    drawDash(ctx, PAD, y, W - PAD); y += LH;

    // Date + Cashier
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(date, PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText(`Kasir: ${cashier.substring(0, 15)}`, W - PAD, y); y += LH;

    drawDash(ctx, PAD, y, W - PAD); y += LH;

    // Items
    ctx.font = '13px monospace';
    for (const item of items) {
        ctx.textAlign = 'left';
        ctx.fillText(item.nama.substring(0, 22), PAD, y);
        ctx.textAlign = 'right';
        ctx.fillText(`Rp${fmtRp(item.harga)}`, W - PAD, y);
        y += LH;
    }

    drawDash(ctx, PAD, y, W - PAD); y += LH;

    // Totals
    ctx.font = 'bold 14px monospace';
    drawRow(ctx, 'TOTAL', `Rp${fmtRp(total)}`, PAD, W - PAD, y); y += LH;
    ctx.font = '14px monospace';
    drawRow(ctx, 'BAYAR', `Rp${fmtRp(paid)}`, PAD, W - PAD, y); y += LH;
    ctx.font = 'bold 14px monospace';
    drawRow(ctx, 'KEMBALI', `Rp${fmtRp(change)}`, PAD, W - PAD, y); y += LH;

    drawDash(ctx, PAD, y, W - PAD); y += LH + 4;

    // Footer
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(footer.substring(0, 35), cx, y); y += LH;
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText('Powered by Dhelpi POS', cx, y);

    return canvas.toBuffer('image/png');
}

function drawDash(ctx, x1, y, x2) {
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawRow(ctx, left, right, lx, rx, y) {
    ctx.textAlign = 'left'; ctx.fillText(left, lx, y);
    ctx.textAlign = 'right'; ctx.fillText(right, rx, y);
}

module.exports = { generateReceipt };
