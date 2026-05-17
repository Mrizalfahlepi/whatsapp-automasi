# 🛠️ PROMPT LENGKAP v2: Web KasirBot SaaS (Design Premium Dark + Amber)

> **Instruksi:** Copy-paste seluruh prompt ini ke Replit AI / Cursor / ChatGPT / AI manapun.
> Hasilnya: website lengkap siap deploy ke Vercel. Hanya setting environment variables.
>
> **REFERENSI VISUAL:** Gaya dashboard POS premium — dark theme, amber/gold accent, circular icon menu, card layout bersih, spacing lega. Mirip dashboard "Owner Command Center" modern.

---

## PROMPT MULAI DARI SINI ⬇️

---

Buatkan web app **Next.js 14+ (App Router)** lengkap untuk platform "KasirBot" — SaaS chatbot WhatsApp kasir pintar untuk UMKM Indonesia. Website ini untuk pendaftaran, informasi produk, dan cek status akun. Penggunaan sehari-hari 100% via WhatsApp.

**PENTING:** Bot KasirBot menggunakan **WhatsApp Business API resmi dari Meta** (Cloud API), BUKAN library tidak resmi. Ini berarti bot mendukung **Interactive Buttons** (tombol klik) dan **List Messages** (menu pilihan). Tampilkan keunggulan ini di website sebagai nilai jual utama — user TIDAK perlu mengetik, cukup klik tombol.

## TECH STACK (WAJIB)

- **Framework:** Next.js 14+ (App Router, `src/app/`)
- **Styling:** Vanilla CSS dengan CSS Modules (file `.module.css` per komponen). TIDAK BOLEH pakai Tailwind CSS.
- **Database:** Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Deploy target:** Vercel
- **Font:** Google Fonts — `Inter` (body, weight 400/500/600) + `Outfit` (heading, weight 600/700/800)
- **Bahasa UI:** 100% Bahasa Indonesia
- **Responsive:** Mobile-first (360px) → Tablet (768px) → Desktop (1200px+)
- **Icon:** Lucide React (`lucide-react` package) untuk semua icon — JANGAN pakai emoji sebagai icon UI kecuali di konten teks chat demo.

## ENVIRONMENT VARIABLES (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=isi_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=isi_anon_key
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key
NEXT_PUBLIC_NOMOR_BOT=6282298597141
NEXT_PUBLIC_HARGA_BULANAN=50000
NEXT_PUBLIC_NAMA_BANK=BCA
NEXT_PUBLIC_NOMOR_REKENING=0882362581
NEXT_PUBLIC_NAMA_REKENING=Muhamad Rizal Fahlepi
```

---

## DESIGN SYSTEM: WARNA, TIPOGRAFI, SPACING

### Palet Warna (WAJIB PERSIS)

```css
:root {
  /* === BACKGROUND === */
  --bg-base: #0A0A0F;              /* Latar utama paling gelap */
  --bg-surface: #12121A;           /* Card / panel */
  --bg-surface-hover: #1A1A25;     /* Card hover state */
  --bg-elevated: #1E1E2A;          /* Elemen yang lebih tinggi (modal, dropdown) */
  --bg-input: #16161F;             /* Background input field */

  /* === ACCENT (AMBER/GOLD — WARNA UTAMA) === */
  --accent: #F59E0B;               /* Amber utama — untuk tombol, icon aktif, link */
  --accent-hover: #D97706;         /* Amber gelap — hover state */
  --accent-light: #FCD34D;         /* Amber terang — badge, highlight */
  --accent-glow: rgba(245, 158, 11, 0.15);  /* Glow effect di belakang icon */
  --accent-subtle: rgba(245, 158, 11, 0.08); /* Background subtle */

  /* === TEXT === */
  --text-primary: #F5F5F7;         /* Putih hangat — heading, body utama */
  --text-secondary: #9CA3AF;       /* Abu medium — subtext, label */
  --text-muted: #4B5563;           /* Abu gelap — placeholder, disabled */
  --text-on-accent: #0A0A0F;       /* Teks gelap di atas accent (tombol amber) */

  /* === STATUS === */
  --success: #22C55E;              /* Hijau — aktif, berhasil */
  --warning: #F59E0B;              /* Amber — trial, peringatan (sama dgn accent) */
  --danger: #EF4444;               /* Merah — expired, error */
  --info: #3B82F6;                 /* Biru — informasi */

  /* === BORDER & GLASS === */
  --border: rgba(255, 255, 255, 0.06);       /* Border default */
  --border-hover: rgba(255, 255, 255, 0.12); /* Border hover */
  --border-accent: rgba(245, 158, 11, 0.3);  /* Border amber */
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-blur: blur(16px);

  /* === SHADOW === */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-accent: 0 4px 20px rgba(245, 158, 11, 0.2);  /* Glow shadow amber */

  /* === TYPOGRAPHY === */
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-heading: 'Outfit', var(--font-body);
  --fs-xs: 0.75rem;    /* 12px */
  --fs-sm: 0.875rem;   /* 14px */
  --fs-base: 1rem;     /* 16px */
  --fs-lg: 1.125rem;   /* 18px */
  --fs-xl: 1.25rem;    /* 20px */
  --fs-2xl: 1.5rem;    /* 24px */
  --fs-3xl: 2rem;      /* 32px */
  --fs-4xl: 2.5rem;    /* 40px — hero heading mobile */
  --fs-5xl: 3.5rem;    /* 56px — hero heading desktop */

  /* === SPACING === */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;

  /* === RADIUS === */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;  /* Circular */

  /* === TRANSITION === */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --transition-fast: 150ms var(--ease-out);
  --transition-normal: 250ms var(--ease-out);
  --transition-slow: 400ms var(--ease-out);
}
```

### Prinsip Visual (WAJIB DIIKUTI)

1. **Spacing lega** — Jarak antar elemen MINIMAL 16px. Antar section MINIMAL 64px. Jangan buat UI yang sesak.
2. **Card TIDAK boleh bertabrakan** — Setiap card punya padding internal minimal 24px dan gap antar card minimal 16px.
3. **Satu warna aksen** — Amber `#F59E0B` untuk SEMUA elemen interaktif (tombol, link, icon aktif, border highlight). Jangan mix dengan warna aksen lain.
4. **Icon dalam lingkaran** — Fitur-fitur ditampilkan sebagai icon Lucide di dalam lingkaran berwarna `--accent-glow` background dengan border `--border-accent`. Ukuran lingkaran: 64px (mobile), 72px (tablet), 80px (desktop).
5. **Teks kontras tinggi** — Body text selalu `--text-primary` atau `--text-secondary`. Jangan pernah pakai warna yang kontrasnya rendah.
6. **No clutter** — Setiap section HANYA punya 1 tujuan. Jangan gabung konten yang beda konteks dalam 1 card.

---

## LOGO KASIRBOT (Custom SVG — WAJIB PAKAI INI)

Buat komponen `Logo.js` dengan inline SVG berikut. JANGAN pakai emoji atau teks biasa untuk logo.

```jsx
// src/components/Logo.js
export default function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Robot head body */}
      <rect x="10" y="14" width="28" height="24" rx="6" fill="#F59E0B" />
      {/* Antenna */}
      <line x1="24" y1="14" x2="24" y2="6" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="24" cy="5" r="3" fill="#FCD34D"/>
      {/* Eyes */}
      <rect x="16" y="21" width="6" height="5" rx="2" fill="#0A0A0F"/>
      <rect x="26" y="21" width="6" height="5" rx="2" fill="#0A0A0F"/>
      {/* Eye shine */}
      <circle cx="17.5" cy="22.5" r="1" fill="#FCD34D"/>
      <circle cx="27.5" cy="22.5" r="1" fill="#FCD34D"/>
      {/* Mouth / receipt slot */}
      <rect x="18" y="30" width="12" height="2" rx="1" fill="#0A0A0F"/>
      {/* Receipt paper coming out */}
      <rect x="20" y="32" width="8" height="8" rx="1" fill="#F5F5F7" opacity="0.9"/>
      <line x1="22" y1="34" x2="26" y2="34" stroke="#D1D5DB" strokeWidth="1"/>
      <line x1="22" y1="36" x2="25" y2="36" stroke="#D1D5DB" strokeWidth="1"/>
      <line x1="22" y1="38" x2="27" y2="38" stroke="#D1D5DB" strokeWidth="1"/>
    </svg>
  );
}
```

Gunakan `<Logo />` di Navbar dan Footer. Di samping logo, tulis teks **"KasirBot"** dengan font `Outfit`, weight 700, warna `--text-primary`, ukuran `--fs-xl`.

---

## STRUKTUR FILE

```
src/
├── app/
│   ├── layout.js              ← Root layout + font + metadata
│   ├── globals.css            ← Design tokens + global reset
│   ├── page.js                ← Landing page
│   ├── page.module.css
│   ├── daftar/
│   │   ├── page.js            ← Form pendaftaran
│   │   └── page.module.css
│   ├── sukses/
│   │   ├── page.js            ← Halaman sukses
│   │   └── page.module.css
│   ├── cek-akun/
│   │   ├── page.js            ← Cek status akun
│   │   └── page.module.css
│   └── api/
│       ├── register/
│       │   └── route.js       ← POST: register user
│       └── check-status/
│           └── route.js       ← POST: cek status by phone
├── components/
│   ├── Logo.js + Logo.module.css
│   ├── Navbar.js + Navbar.module.css
│   ├── Footer.js + Footer.module.css
│   ├── FeatureCircle.js + FeatureCircle.module.css     ← Icon circular
│   ├── StepCard.js + StepCard.module.css               ← Langkah 1-2-3
│   ├── PricingCard.js + PricingCard.module.css
│   ├── ChatDemo.js + ChatDemo.module.css               ← Demo chat WA
│   └── StatusBadge.js + StatusBadge.module.css          ← Badge status akun
├── lib/
│   └── supabase.js            ← Supabase client
└── supabase-schema.sql        ← SQL schema (di root)
```

---

## DATABASE (Supabase)

File `supabase-schema.sql` di root project:

```sql
-- =========================================
-- KASIRBOT SAAS — DATABASE SCHEMA
-- Copy-paste ke Supabase SQL Editor
-- =========================================

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  store_name VARCHAR(100) NOT NULL,
  owner_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  trial_end TIMESTAMPTZ,
  paid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL,
  tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('masuk', 'keluar')),
  jumlah BIGINT NOT NULL,
  ket TEXT DEFAULT '',
  tanggal DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access transactions" ON transactions FOR ALL USING (true);

CREATE TABLE stock (
  id BIGSERIAL PRIMARY KEY,
  user_phone VARCHAR(20) NOT NULL,
  nama_barang VARCHAR(100) NOT NULL,
  qty INTEGER DEFAULT 0,
  satuan VARCHAR(30) DEFAULT 'pcs',
  UNIQUE(user_phone, nama_barang, satuan)
);

ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access stock" ON stock FOR ALL USING (true);
```

---

## HALAMAN 1: LANDING PAGE (`/`)

### Navbar (Fixed Top)

- Tinggi: 64px
- Background: `--bg-base` dengan opacity 0.8 + `backdrop-filter: blur(16px)` + border bawah `--border`
- Kiri: `<Logo size={32} />` + teks "KasirBot" (Outfit, 700, `--text-primary`)
- Kanan (desktop): Link "Fitur" | "Harga" | "Cek Akun" (font Inter 500, `--text-secondary`, hover `--accent`) + Tombol "Daftar Gratis" (background `--accent`, teks `--text-on-accent`, radius `--radius-full`, padding 10px 24px)
- Kanan (mobile): Hamburger icon (Menu dari lucide-react) → slide-in menu dari kanan

---

### Section 1: HERO

- Padding: `var(--space-4xl) var(--space-md)` (atas-bawah 96px, kiri-kanan 16px)
- Max-width konten: 680px, text-align center, margin auto
- **Chip/Badge** di atas heading: teks "✨ Gratis 7 Hari Trial" dalam pill shape — background `--accent-subtle`, border `--border-accent`, color `--accent-light`, font-size `--fs-sm`, padding 6px 16px, radius `--radius-full`
- **Heading (h1):** "Asisten Kasir Pintar untuk Toko Anda" — font Outfit, weight 800, size `--fs-4xl` (mobile) / `--fs-5xl` (desktop), color `--text-primary`, line-height 1.1
  - Kata "Pintar" di-highlight: color `--accent`
- **Subheading (p):** "Catat penjualan, lacak stok, dan terima laporan otomatis — cukup dari WhatsApp. Tanpa download aplikasi." — font Inter, weight 400, size `--fs-lg`, color `--text-secondary`, max-width 520px, margin auto, line-height 1.6
- **2 Tombol** (flex row, gap 12px, center, wrap di mobile):
  - "Mulai Gratis" → link `/daftar` — background `--accent`, color `--text-on-accent`, weight 600, padding 14px 32px, radius `--radius-full`, shadow `--shadow-accent`, hover: translateY(-2px)
  - "Lihat Fitur ↓" → smooth scroll ke `#fitur` — background transparent, border 1px `--border`, color `--text-primary`, padding 14px 32px, radius `--radius-full`, hover: border-color `--accent`
- **Background decoration:** Radial gradient circle di tengah atas, amber very subtle (`rgba(245,158,11,0.06)`), blur 120px, z-index -1
- **Animasi:** Semua elemen fade-in-up berurutan (delay 0, 0.1, 0.2, 0.3s)

---

### Section 2: DEMO CHAT (id="demo")

- Heading: "Tanpa Ketik, Cukup Klik!" — Outfit 700, `--fs-2xl`, center
- Subtext: "Bot KasirBot pakai WhatsApp Business resmi. Ada tombol interaktif — tidak perlu mengetik." — center, `--text-secondary`

- **2 Tab toggle** di atas demo: "Mode Tombol" (default aktif) | "Mode Chat" — gunakan state React. Tab aktif: border-bottom 2px `--accent`, color `--accent`. Tab tidak aktif: color `--text-muted`.

- **ChatDemo component — Tab 1: Mode Tombol (Interactive Buttons)**
  Simulasi tampilan WA Business API dengan tombol klik:
  ```
  ┌──────────────────────────────────┐
  │  [bot bubble, kiri]              │
  │  "Halo Bu Marni! 👋              │
  │   Mau input apa hari ini?"       │
  │                                  │
  │  ┌────────────────────────┐      │
  │  │  💰 Catat Penjualan    │      │  ← tombol 1 (rounded, border accent)
  │  ├────────────────────────┤      │
  │  │  📦 Cek Stok           │      │  ← tombol 2
  │  ├────────────────────────┤      │
  │  │  📊 Laporan Hari Ini   │      │  ← tombol 3
  │  └────────────────────────┘      │
  │                                  │
  │  [user tapped: "💰 Catat         │  ← bubble hijau, seolah user klik
  │   Penjualan"]                    │
  │                                  │
  │  [bot bubble]                    │
  │  "Oke! Ketik jualan Anda,        │
  │   contoh: rokok surya 2bks 40rb" │
  │                                  │
  │  [user bubble]                   │
  │  "rokok surya 2bks 40rb"         │
  │                                  │
  │  [bot bubble]                    │
  │  "✅ Pemasukan dicatat!           │
  │   Rokok Surya 2bks = Rp40.000   │
  │   Stok berkurang 2 pcs           │
  │   Saldo: Rp540.000"             │
  └──────────────────────────────────┘
  ```
  - **Tombol interaktif** di dalam bot bubble: styled sebagai rounded buttons, background transparent, border 1px `--border`, color `--text-primary`, padding 10px 16px, full-width di dalam bubble, hover background `--accent-subtle`. Pisahkan antar tombol dengan garis tipis (`--border`). Ini HANYA visual simulasi (tidak klikable secara fungsional).

- **ChatDemo component — Tab 2: Mode Chat (Ketik Bebas)**
  Simulasi percakapan bahasa natural:
  ```
  ┌──────────────────────────────────┐
  │  [user bubble, kanan, hijau WA]  │
  │  "jual rokok surya 2bks 40rb"   │
  │                                  │
  │  [bot bubble, kiri, dark]        │
  │  "✅ Pemasukan dicatat!          │
  │   Rokok Surya 2bks = Rp40.000   │
  │   Stok berkurang 2 pcs           │
  │   Saldo: Rp540.000"             │
  │                                  │
  │  [user bubble]                   │
  │  "laporan hari ini"              │
  │                                  │
  │  [bot bubble]                    │
  │  "📊 LAPORAN 26 April 2026      │
  │   Masuk:   Rp540.000            │
  │   Keluar:  Rp100.000            │
  │   Saldo:   Rp440.000"           │
  └──────────────────────────────────┘
  ```

- **Styling umum kedua tab:**
  - Container: max-width 400px, margin auto, background `--bg-surface`, border `--border`, radius `--radius-lg`, padding 20px
  - Header bar di atas chat: hijau tua `#075E54`, padding 12px 16px, radius atas `--radius-lg`, teks putih "KasirBot 🤖" (simulasi header WA), font-size `--fs-sm`, weight 600
  - User bubbles: background `#1B5E20` (WhatsApp dark green), radius 16px 16px 4px 16px, align right, padding 10px 14px
  - Bot bubbles: background `--bg-elevated`, radius 16px 16px 16px 4px, align left, padding 10px 14px
  - Teks bubble: `--fs-sm`, line-height 1.5
  - Timestamp kecil di kanan bawah setiap bubble: `--fs-xs`, `--text-muted`, "09:41"
  - Animasi: Bubble muncul satu per satu dengan delay 0.5s antar bubble (cascade effect), pakai IntersectionObserver agar hanya animasi saat masuk viewport

---

### Section 3: FITUR (id="fitur")

- Heading: "Fitur Lengkap" — Outfit 700, `--fs-2xl`, center
- Subtext: "Semua yang dibutuhkan toko Anda dalam satu bot." — center, `--text-secondary`
- **Grid FeatureCircle:** 3 kolom (desktop), 2 kolom (tablet), 2 kolom (mobile)
  - Gap: `var(--space-xl)` (32px)
  - Setiap item: flex column, align center, text-align center
  - **Lingkaran icon:** width/height 72px, background `--accent-subtle`, border 1.5px `--border-accent`, border-radius `--radius-full`, display flex align/justify center
    - Icon dari lucide-react: size 28px, color `--accent`, strokeWidth 2
    - Hover: background `--accent`, icon color `--text-on-accent`, transform scale(1.08), shadow `--shadow-accent`, transition `--transition-normal`
  - **Label** di bawah icon: font Inter 500, size `--fs-sm`, color `--text-primary`, margin-top 12px
  - **Deskripsi** di bawah label: font Inter 400, size `--fs-xs`, color `--text-secondary`, margin-top 4px, max-width 140px

- **7 Item Fitur (icon dari lucide-react):**
  1. Icon: `MousePointerClick` — Label: "Klik, Bukan Ketik" — Desc: "Tombol interaktif resmi WhatsApp Business"
  2. Icon: `Wallet` — Label: "Catat Keuangan" — Desc: "Pemasukan & pengeluaran otomatis"
  3. Icon: `Package` — Label: "Lacak Stok" — Desc: "Stok update otomatis saat jual/beli"
  4. Icon: `BarChart3` — Label: "Laporan Harian" — Desc: "Rekap dikirim otomatis tiap malam"
  5. Icon: `Camera` — Label: "Simpan Struk" — Desc: "Foto struk tersimpan rapi"
  6. Icon: `Brain` — Label: "AI Pintar" — Desc: "Paham bahasa daerah & gaul"
  7. Icon: `ShieldCheck` — Label: "Data Aman" — Desc: "Terisolasi, tidak bisa dilihat orang lain"

---

### Section 4: CARA KERJA (id="cara-kerja")

- Heading: "3 Langkah Mulai" — Outfit 700, `--fs-2xl`, center
- **3 StepCard** dalam flex row (desktop) / column (mobile):
  - Setiap card: background `--bg-surface`, border `--border`, radius `--radius-lg`, padding 28px, text-align center
  - **Nomor langkah:** Lingkaran 40px, background `--accent`, color `--text-on-accent`, font Outfit 700, size `--fs-lg`
  - **Judul:** font Outfit 600, size `--fs-lg`, color `--text-primary`, margin-top 16px
  - **Deskripsi:** font Inter 400, size `--fs-sm`, color `--text-secondary`, margin-top 8px
  - Gap antar card: 20px
  - Di antara card desktop: garis horizontal dashed (border-top dashed `--border`, posisi tengah vertical) — TIDAK di mobile

  **3 Langkah:**
  1. "Daftar" — "Isi nama toko & nomor HP Anda. 30 detik, gratis."
  2. "Terima Pesan Bot" — "Bot langsung kirim menu utama ke WhatsApp Anda."
  3. "Mulai Jualan" — "Klik tombol atau ketik jualan, bot catat otomatis."

---

### Section 5: HARGA (id="harga")

- Heading: "Harga Terjangkau" — Outfit 700, `--fs-2xl`, center
- Subtext: "Mulai gratis, bayar kalau cocok." — center, `--text-secondary`
- **2 PricingCard** berdampingan (desktop) / stack (mobile):
  - Gap: 20px
  - Max-width total: 700px, margin auto

  **Card 1 — Trial:**
  - Background: `--bg-surface`, border: `--border`, radius: `--radius-lg`
  - Badge atas: "GRATIS" — background `--accent-subtle`, color `--accent`, font-size `--fs-xs`, weight 700, radius `--radius-full`, padding 4px 12px
  - Harga: "Rp 0" — font Outfit 800, size `--fs-3xl`, color `--text-primary`
  - Durasi: "/ 7 hari" — `--text-secondary`, `--fs-sm`
  - Checklist (6 item): icon `Check` (lucide, color `--accent`, 16px) + teks `--text-secondary` `--fs-sm`
    - Semua fitur KasirBot
    - Tombol interaktif WhatsApp
    - Transaksi unlimited
    - Lacak stok barang
    - Laporan otomatis
    - Support bahasa daerah
  - Tombol: "Coba Gratis →" → `/daftar` — background transparent, border 1px `--border-accent`, color `--accent`, radius `--radius-full`, hover: background `--accent-subtle`

  **Card 2 — Bulanan (HIGHLIGHTED):**
  - Background: `--bg-surface`, border: 1.5px `--accent` (solid amber!), radius: `--radius-lg`
  - Shadow: `--shadow-accent` (glow amber)
  - Transform: scale(1.03) di desktop
  - Badge atas: "TERLARIS ⭐" — background `--accent`, color `--text-on-accent`, weight 700
  - Harga: "Rp 50.000" — font Outfit 800, size `--fs-3xl`, color `--accent`
    - Ambil dari env `NEXT_PUBLIC_HARGA_BULANAN`, format pakai `Intl.NumberFormat('id-ID')`
  - Durasi: "/ bulan" — `--text-secondary`
  - Checklist: sama seperti Trial + 2 tambahan:
    - ✅ Perpanjang mudah via WA
    - ✅ Prioritas bantuan teknis
  - Tombol: "Daftar Sekarang →" → `/daftar` — background `--accent`, color `--text-on-accent`, radius `--radius-full`, hover: shadow `--shadow-accent`, translateY(-2px)

---

### Section 6: CTA AKHIR

- Background: gradient linear dari `rgba(245,158,11,0.08)` ke `transparent`
- Padding: `var(--space-4xl)`
- Text-align center
- Heading: "Siap Punya Kasir Pintar?" — Outfit 700, `--fs-3xl`
- Subtext: "Daftar sekarang, langsung pakai dari WhatsApp." — `--text-secondary`
- Tombol besar: "Mulai Gratis Sekarang 🚀" → `/daftar` — background `--accent`, large padding (16px 40px), font-size `--fs-lg`, radius `--radius-full`

---

### Footer

- Border atas: 1px `--border`
- Padding: `var(--space-2xl) var(--space-md)`
- Flex row (desktop) / column center (mobile)
- Kiri: `<Logo size={28} />` + "KasirBot" + "© 2026"
- Tengah (desktop): Link "Beranda" | "Daftar" | "Cek Akun" — `--text-secondary`, hover `--accent`
- Kanan: "WA: 0822-9859-7141" — `--text-muted`

---

## HALAMAN 2: FORM PENDAFTARAN (`/daftar`)

- Navbar tetap ada di atas
- **Container:** max-width 440px, margin auto, padding-top 120px (di bawah navbar)
- **Card form:** background `--bg-surface`, border `--border`, radius `--radius-xl`, padding 36px
- **Heading di card:** "Daftar KasirBot" — Outfit 700, `--fs-2xl`, center
- **Subtext:** "Gratis 7 hari, tanpa kartu kredit." — `--text-secondary`, center, `--fs-sm`

### Fields (stack vertical, gap 20px):

1. **Nama Toko**
   - Label: "Nama Toko" — Inter 500, `--fs-sm`, `--text-secondary`, margin-bottom 6px
   - Icon kiri di dalam input: `Store` (lucide, 18px, `--text-muted`)
   - Input: background `--bg-input`, border `--border`, radius `--radius-md`, padding 14px 14px 14px 44px (ruang untuk icon), font-size `--fs-base`, color `--text-primary`
   - Placeholder: "Contoh: Warung Madura Bu Sari"
   - Focus: border-color `--accent`, box-shadow `0 0 0 3px var(--accent-glow)`
   - Error state: border-color `--danger`, error text di bawah (merah, `--fs-xs`)

2. **Nama Pemilik**
   - Icon: `User` (lucide)
   - Placeholder: "Contoh: Bu Sari"

3. **Nomor WhatsApp**
   - Icon: `Phone` (lucide)
   - Input type: `tel`
   - Placeholder: "Contoh: 081234567890"
   - Validasi client-side: harus mulai `08` atau `62`, minimal 10 digit, hanya angka
   - Auto-normalize saat submit: `08xxx` → `628xxx`

### Tombol Submit:
- Full width
- Background: `--accent`, color `--text-on-accent`, font Outfit 600, `--fs-base`
- Padding: 14px
- Radius: `--radius-md`
- Normal: "Daftar Gratis →"
- Loading: spinner SVG animasi + "Mendaftar..."
- Disabled saat loading

### Respons:
- **Sukses:** Redirect ke `/sukses?phone=628xxx&store=NamaToko&owner=NamaOwner`
- **Sudah terdaftar:** Tampilkan alert box di atas form — background `rgba(239,68,68,0.1)`, border `--danger`, icon `AlertCircle`, teks: "Nomor ini sudah terdaftar." + link "Cek status akun →" ke `/cek-akun`

### API: `POST /api/register`
```javascript
// Request body: { phone, storeName, ownerName }
// 1. Normalize: 08xxx → 628xxx, strip spaces dan dash
// 2. Validasi: phone format, storeName dan ownerName tidak kosong
// 3. Cek apakah user sudah ada di Supabase tabel users
//    → Jika ya: return { error: 'already_registered' }
// 4. Insert user baru: status='pending', trial_end = NOW() + 7 days
// 5. Return { success: true, trialEnd: '2026-05-03T...' }
```

---

## HALAMAN 3: SUKSES (`/sukses`)

- Max-width 480px card, center
- **Confetti effect:** Buat dengan CSS @keyframes. 20-30 elemen `<span>` kecil (6px x 6px) berwarna amber, gold, putih yang jatuh dari atas dengan animasi fall + rotate. Durasi 3 detik, lalu hilang (opacity 0). Pakai `position: fixed` agar overlay seluruh viewport.

### Konten card:
- **Icon besar centang:** Lingkaran 64px, background `rgba(34,197,94,0.15)`, border `--success`, center icon `CheckCircle` (lucide, 32px, `--success`)
- **Heading:** "Pendaftaran Berhasil!" — Outfit 700, `--fs-2xl`
- **Subtext:** "Halo {ownerName}! Toko **{storeName}** sudah terdaftar." — `--text-secondary` (ambil dari URL query params `?owner=X&store=Y`)

- **Box instruksi:** background `--bg-elevated`, radius `--radius-md`, padding 20px
  ```
  📱 Langkah selanjutnya:

  1. Simpan nomor ini di kontak HP Anda:
     ┌─────────────────────────────────┐
     │  0822-9859-7141     [📋 Copy]  │
     └─────────────────────────────────┘
     (format nomor dari env, tombol copy ke clipboard)

  2. Buka WhatsApp dan chat ke nomor di atas.
     Bot akan langsung menyapa Anda dengan menu tombol!

  3. Klik tombol "💰 Catat Penjualan" dan mulai jualan!
  ```
  - Nomor bot ambil dari `NEXT_PUBLIC_NOMOR_BOT`, format jadi `0822-9859-7141`
  - Tombol copy: icon `Copy` (lucide), onClick → `navigator.clipboard.writeText()`, setelah copy berubah jadi icon `Check` + teks "Tersalin!" selama 2 detik

- **Tombol utama:** "Buka WhatsApp →" — background `#25D366` (hijau WA), color white, radius `--radius-full`, link ke `https://wa.me/{NOMOR_BOT}?text=HALO`, icon `MessageCircle` (lucide)
- **Tombol sekunder:** "Kembali ke Beranda" — outline, link `/`

- **Info trial:** ⏰ Masa trial GRATIS: 7 hari — `--text-secondary`, `--fs-sm`

---

## HALAMAN 4: CEK AKUN (`/cek-akun`)

- Container max-width 440px, center
- Card form seperti halaman daftar

### Form:
- Heading: "Cek Status Akun" — Outfit 700, `--fs-2xl`
- Input: Nomor WhatsApp (icon `Phone`, placeholder "Masukkan nomor WA Anda")
- Tombol: "Cek Status →" — background `--accent`

### API: `POST /api/check-status`
```javascript
// Body: { phone }
// 1. Normalize phone
// 2. Query user by phone dari Supabase
// 3. Return user data: { storeName, ownerName, status, trialEnd, paidUntil }
//    atau { error: 'not_found' }
```

### Hasil (muncul di bawah form):

**Jika ditemukan — tampilkan Status Card:**
- Background `--bg-surface`, border sesuai status, radius `--radius-lg`, padding 24px

- **Header card:** Nama toko (Outfit 600) + StatusBadge component:
  - `trial` → badge hijau: "🟢 Trial Aktif"
  - `active` → badge biru: "🔵 Aktif (Berbayar)"
  - `expired` → badge merah: "🔴 Expired"
  - `pending` → badge kuning: "🟡 Menunggu Aktivasi"
  - `banned` → badge abu: "⛔ Diblokir"

- **Detail:**
  - Nama Pemilik
  - Terdaftar sejak: [tanggal]
  - Trial sampai / Aktif sampai: [tanggal]

- **Jika expired → Tampilkan Payment Info Box:**
  ```
  ┌──────────────────────────────────────┐
  │  💰 Perpanjang Langganan             │
  │                                      │
  │  Transfer Rp 50.000 ke:              │
  │                                      │
  │  🏦 Bank: BCA                        │
  │  🔢 No Rek: 0882362581              │
  │  👤 a.n. Muhamad Rizal Fahlepi      │
  │                                      │
  │  Setelah transfer, kirim bukti ke:   │
  │  📱 WA: 0822-9859-7141              │
  │                                      │
  │  [Hubungi via WhatsApp →]            │
  └──────────────────────────────────────┘
  ```
  - Semua value ambil dari env variables
  - Tombol WhatsApp: link ke `wa.me/{NOMOR_BOT}?text=BAYAR`

**Jika tidak ditemukan:**
- Alert: "❌ Nomor tidak ditemukan." + link "Daftar sekarang →" ke `/daftar`

---

## ANIMASI (globals.css)

```css
/* Fade in up — untuk semua section saat masuk viewport */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Confetti — untuk halaman sukses */
@keyframes confettiFall {
  0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* Pulse — untuk elemen yang perlu perhatian */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Slide in — untuk mobile menu */
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

Gunakan `IntersectionObserver` di setiap section untuk trigger `fadeInUp` animation saat elemen masuk viewport. Buat custom hook `useInView` atau langsung implement di tiap page.

---

## ATURAN PENTING (CHECKLIST)

- [x] SEMUA teks Bahasa Indonesia
- [x] Dark theme ONLY (tidak ada light mode)
- [x] TIDAK BOLEH pakai Tailwind CSS — hanya CSS Modules
- [x] TIDAK BOLEH pakai library UI (shadcn, MUI, Chakra, dll)
- [x] Icon: HANYA dari `lucide-react`
- [x] Logo: pakai komponen SVG `Logo.js` yang sudah diberikan
- [x] Warna aksen: HANYA amber `#F59E0B` dan variannya
- [x] Mobile-first responsive (360px → 768px → 1200px)
- [x] Spacing lega, card tidak bertabrakan, konten tidak sesak
- [x] Semua tombol submit punya loading state (spinner)
- [x] Semua API call di-try-catch, tampilkan error user-friendly
- [x] Nomor HP auto-normalize: `08xxx` → `628xxx`
- [x] Format Rupiah: `Intl.NumberFormat('id-ID')`
- [x] Smooth scroll untuk navigasi landing page
- [x] IntersectionObserver untuk animasi scroll
- [x] File `supabase-schema.sql` di root
- [x] Semua env variable publik pakai prefix `NEXT_PUBLIC_`
- [x] Supabase client di `src/lib/supabase.js`
- [x] SEO: title, description, Open Graph metadata di layout.js

---

## SEO METADATA

```javascript
export const metadata = {
  title: 'KasirBot — Asisten Kasir WhatsApp Berbasis AI untuk UMKM',
  description: 'Catat penjualan, lacak stok, dan terima laporan otomatis langsung dari WhatsApp. Gratis 7 hari. Untuk warung, toko kelontong, dan UMKM Indonesia.',
  keywords: 'kasir whatsapp, bot kasir, UMKM, toko kelontong, stok barang, laporan harian, AI kasir',
  openGraph: {
    title: 'KasirBot — Asisten Kasir WhatsApp untuk UMKM',
    description: 'Catat penjualan & stok langsung dari WhatsApp. Gratis 7 hari!',
    type: 'website',
  },
};
```

---

## PROMPT SELESAI ⬆️

