-- ═══ JALANKAN SQL INI DI SUPABASE SQL EDITOR ═══

CREATE TABLE IF NOT EXISTS store_staff (
    id BIGSERIAL PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    staff_phone TEXT NOT NULL UNIQUE,
    staff_name TEXT NOT NULL DEFAULT 'Staff',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_owner ON store_staff(owner_phone);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON store_staff(staff_phone);
