-- =========================================================
-- Sewing Module Readiness Tracker - Supabase SQL Schema
-- =========================================================
-- Execute this script in your Supabase project's SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Create table for Sewing Plan (Pre Work Plan)
CREATE TABLE IF NOT EXISTS sewing_plan (
    id BIGSERIAL PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    customer VARCHAR(100) DEFAULT '',
    style VARCHAR(255) DEFAULT '',
    product_type VARCHAR(100) DEFAULT '',
    cw VARCHAR(255) DEFAULT '',
    so_li VARCHAR(100) NOT NULL,
    smv NUMERIC DEFAULT 0,
    planned_date DATE NOT NULL,
    qty NUMERIC NOT NULL,
    sah NUMERIC DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table for Knitting WIP Plan
CREATE TABLE IF NOT EXISTS knitting_plan (
    id BIGSERIAL PRIMARY KEY,
    so_li VARCHAR(100) NOT NULL,
    sales_order VARCHAR(100) DEFAULT '',
    line_item VARCHAR(50) DEFAULT '',
    sm_wip_total NUMERIC DEFAULT 0,
    order_qty_total NUMERIC DEFAULT 0,
    knit_qty_total NUMERIC DEFAULT 0,
    pkin_qty_total NUMERIC DEFAULT 0,
    qc_qty_total NUMERIC DEFAULT 0,
    shipped_qty_total NUMERIC DEFAULT 0,
    size_count INTEGER DEFAULT 1,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create table for Trims Readiness Plan
CREATE TABLE IF NOT EXISTS trims_plan (
    id BIGSERIAL PRIMARY KEY,
    soli VARCHAR(100) NOT NULL,
    module VARCHAR(50) DEFAULT '',
    customer VARCHAR(100) DEFAULT '',
    product VARCHAR(255) DEFAULT '',
    cw VARCHAR(255) DEFAULT '',
    status VARCHAR(50) DEFAULT 'NO',
    psd DATE,
    ped DATE,
    delivery_date DATE,
    days_late NUMERIC DEFAULT 0,
    rm_comments TEXT DEFAULT '',
    merch_comments TEXT DEFAULT '',
    total_qty NUMERIC DEFAULT 0,
    sheet_name VARCHAR(100) DEFAULT '',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create table for Upload History & Metadata
CREATE TABLE IF NOT EXISTS upload_metadata (
    id BIGSERIAL PRIMARY KEY,
    file_type VARCHAR(50) NOT NULL, -- 'sewing', 'knitting', 'trims'
    file_name VARCHAR(255) NOT NULL,
    sheet_used VARCHAR(100) DEFAULT '',
    row_count INTEGER DEFAULT 0,
    unique_so_lis INTEGER DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Fast Indexing for Join Lookups
CREATE INDEX IF NOT EXISTS idx_sewing_so_li ON sewing_plan (so_li);
CREATE INDEX IF NOT EXISTS idx_sewing_module ON sewing_plan (module);
CREATE INDEX IF NOT EXISTS idx_sewing_date ON sewing_plan (planned_date);
CREATE INDEX IF NOT EXISTS idx_knitting_so_li ON knitting_plan (so_li);
CREATE INDEX IF NOT EXISTS idx_trims_soli ON trims_plan (soli);
CREATE INDEX IF NOT EXISTS idx_trims_module ON trims_plan (module);

-- 6. Enable Row Level Security (RLS) & Allow Public Read Access
ALTER TABLE sewing_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE knitting_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE trims_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_metadata ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access for public floor dashboard viewing
DROP POLICY IF EXISTS "Public read access for sewing_plan" ON sewing_plan;
CREATE POLICY "Public read access for sewing_plan" ON sewing_plan FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for knitting_plan" ON knitting_plan;
CREATE POLICY "Public read access for knitting_plan" ON knitting_plan FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for trims_plan" ON trims_plan;
CREATE POLICY "Public read access for trims_plan" ON trims_plan FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for upload_metadata" ON upload_metadata;
CREATE POLICY "Public read access for upload_metadata" ON upload_metadata FOR SELECT USING (true);

-- Allow authenticated/service-role insert & delete operations
DROP POLICY IF EXISTS "Allow insert for sewing_plan" ON sewing_plan;
CREATE POLICY "Allow insert for sewing_plan" ON sewing_plan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert for knitting_plan" ON knitting_plan;
CREATE POLICY "Allow insert for knitting_plan" ON knitting_plan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert for trims_plan" ON trims_plan;
CREATE POLICY "Allow insert for trims_plan" ON trims_plan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert for upload_metadata" ON upload_metadata;
CREATE POLICY "Allow insert for upload_metadata" ON upload_metadata FOR ALL USING (true) WITH CHECK (true);
