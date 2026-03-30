-- =============================================
-- SOURCESHOP - Supabase SQL Schema
-- Jalankan di Supabase SQL Editor
-- =============================================

-- Tabel products
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- dalam Rupiah
  category VARCHAR(100) DEFAULT 'website',
  thumbnail_url TEXT,
  preview_html TEXT, -- HTML/CSS/JS untuk sandbox preview
  gdrive_url TEXT NOT NULL, -- Link Google Drive ZIP
  tech_stack TEXT[] DEFAULT '{}', -- ['Node.js', 'Express', 'Supabase']
  features TEXT[] DEFAULT '{}', -- ['Auth sistem', 'Dashboard admin']
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  buyer_name VARCHAR(255) NOT NULL,
  buyer_email VARCHAR(255) NOT NULL,
  buyer_whatsapp VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  download_token UUID UNIQUE,
  expired_at TIMESTAMPTZ,
  reject_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index biar query cepet
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(download_token);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(buyer_email);

-- RLS (Row Level Security) - products bisa dibaca publik
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: products aktif bisa dibaca siapa aja
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  USING (is_active = true);

-- Policy: orders hanya bisa dibuat user (insert)
CREATE POLICY "Anyone can create order"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Policy: user bisa lihat order mereka sendiri by email
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (true); -- difilter di aplikasi by order ID

-- =============================================
-- CONTOH DATA (opsional, buat testing)
-- =============================================
INSERT INTO products (title, description, price, category, preview_html, gdrive_url, tech_stack, features)
VALUES (
  'Anime Streaming Website',
  'Website streaming anime lengkap dengan multi-source (Samehadaku, Otakudesu), sistem user auth, voucher premium, dan panel admin.',
  150000,
  'website',
  '<!DOCTYPE html><html><head><style>body{font-family:sans-serif;background:#0f0f0f;color:#fff;margin:0;padding:20px} h1{color:#7c3aed} .badge{background:#7c3aed;padding:4px 12px;border-radius:999px;font-size:12px;display:inline-block;margin:4px}</style></head><body><h1>🎬 Anime Stream</h1><p>Website streaming anime keren dengan fitur lengkap</p><div><span class="badge">Multi-source</span><span class="badge">Auth</span><span class="badge">Premium</span><span class="badge">Admin Panel</span></div></body></html>',
  'https://drive.google.com/file/d/CONTOH_ID/view',
  ARRAY['Python', 'Flask', 'Supabase'],
  ARRAY['Multi-source anime', 'User authentication', 'Voucher premium', 'Admin panel', 'Responsive design']
);
