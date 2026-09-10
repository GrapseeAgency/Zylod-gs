-- ============================================================
-- Zylod B2B Wholesale Marketplace
-- Initial Schema Migration
-- Supabase / PostgreSQL
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. TABLES
-- ============================================================

-- ============================================================
-- Core Identity
-- ============================================================

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_type TEXT NOT NULL CHECK (user_type IN ('buyer', 'supplier', 'admin')),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  auth_provider TEXT NOT NULL CHECK (auth_provider IN ('phone_otp', 'google', 'email')),
  google_id TEXT,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned')),
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  is_phone_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_user_type ON users (user_type);
CREATE INDEX idx_users_account_status ON users (account_status);

CREATE TABLE otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  phone_or_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_otp_codes_user_id ON otp_codes (user_id);
CREATE INDEX idx_otp_codes_phone_or_email ON otp_codes (phone_or_email);

-- ============================================================
-- Buyer
-- ============================================================

CREATE TABLE buyer_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  business_name TEXT,
  business_type TEXT NOT NULL DEFAULT 'individual' CHECK (business_type IN ('individual', 'retailer', 'distributor', 'wholesaler', 'manufacturer')),
  default_address_id UUID UNIQUE REFERENCES addresses (id),
  profile_completion_pct INTEGER NOT NULL DEFAULT 0,
  is_profile_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Bangladesh',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_addresses_user_id ON addresses (user_id);
CREATE INDEX idx_addresses_district ON addresses (district);

-- ============================================================
-- Supplier (KYC)
-- ============================================================

CREATE TABLE supplier_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  nid_number TEXT NOT NULL,
  nid_front_image_url TEXT NOT NULL,
  nid_back_image_url TEXT NOT NULL,
  trade_license_number TEXT NOT NULL,
  trade_license_image_url TEXT NOT NULL,
  tin_number TEXT NOT NULL,
  bank_account_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  warehouse_address_id UUID UNIQUE REFERENCES addresses (id),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  verified_by UUID REFERENCES users (id),
  verified_at TIMESTAMPTZ,
  rating_avg DOUBLE PRECISION NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_profiles_verification_status ON supplier_profiles (verification_status);

CREATE TABLE supplier_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id) ON DELETE CASCADE,
  agreement_type TEXT NOT NULL CHECK (agreement_type IN ('terms_of_service', 'nda', 'supplier_contract', 'quality_agreement')),
  document_url TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_supplier_agreements_supplier_id ON supplier_agreements (supplier_id);

-- ============================================================
-- Catalog
-- ============================================================

CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES categories (id),
  icon_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent_id ON categories (parent_id);
CREATE INDEX idx_categories_is_active ON categories (is_active);

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id),
  category_id UUID NOT NULL REFERENCES categories (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  brand TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs' CHECK (unit IN ('pcs', 'dozen', 'kg', 'carton', 'box', 'set')),
  moq INTEGER NOT NULL DEFAULT 1,
  max_order_qty INTEGER,
  base_price DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  stock_quantity INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_supplier_id ON products (supplier_id);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_is_active ON products (is_active);
CREATE INDEX idx_products_is_approved ON products (is_approved);
CREATE INDEX idx_products_base_price ON products (base_price);
CREATE INDEX idx_products_created_at ON products (created_at);

CREATE TABLE product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_product_images_product_id ON product_images (product_id);

CREATE TABLE product_price_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  min_qty INTEGER NOT NULL,
  max_qty INTEGER,
  price_per_unit DOUBLE PRECISION NOT NULL
);

CREATE INDEX idx_product_price_tiers_product_id ON product_price_tiers (product_id);

CREATE TABLE product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  variant_value TEXT NOT NULL,
  sku TEXT,
  stock_quantity INTEGER NOT NULL,
  price_override DOUBLE PRECISION
);

CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);

CREATE TABLE product_specifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  spec_name TEXT NOT NULL,
  spec_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_product_specifications_product_id ON product_specifications (product_id);

CREATE TABLE product_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_product_tags_slug ON product_tags (slug);

CREATE TABLE product_tag_relations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES product_tags (id) ON DELETE CASCADE,
  UNIQUE (product_id, tag_id)
);

CREATE INDEX idx_product_tag_relations_product_id ON product_tag_relations (product_id);
CREATE INDEX idx_product_tag_relations_tag_id ON product_tag_relations (tag_id);

CREATE TABLE product_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_product_videos_product_id ON product_videos (product_id);

CREATE TABLE product_certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  cert_name TEXT NOT NULL,
  cert_number TEXT,
  issued_by TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  document_url TEXT
);

CREATE INDEX idx_product_certifications_product_id ON product_certifications (product_id);
CREATE INDEX idx_product_certifications_cert_name ON product_certifications (cert_name);

-- ============================================================
-- Cart & Orders
-- ============================================================

CREATE TABLE carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_carts_buyer_id ON carts (buyer_id);

CREATE TABLE cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id),
  variant_id UUID REFERENCES product_variants (id),
  quantity INTEGER NOT NULL,
  supplier_id UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cart_items_cart_id ON cart_items (cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items (product_id);

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id),
  order_number TEXT NOT NULL UNIQUE,
  total_amount DOUBLE PRECISION NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  shipping_address_id UUID REFERENCES addresses (id),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_buyer_id ON orders (buyer_id);
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_payment_status ON orders (payment_status);
CREATE INDEX idx_orders_placed_at ON orders (placed_at);

CREATE TABLE sub_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL,
  subtotal DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned')),
  tracking_number TEXT,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_orders_order_id ON sub_orders (order_id);
CREATE INDEX idx_sub_orders_supplier_id ON sub_orders (supplier_id);
CREATE INDEX idx_sub_orders_status ON sub_orders (status);

CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_order_id UUID NOT NULL REFERENCES sub_orders (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id),
  variant_id UUID REFERENCES product_variants (id),
  quantity INTEGER NOT NULL,
  unit_price DOUBLE PRECISION NOT NULL,
  total_price DOUBLE PRECISION NOT NULL
);

CREATE INDEX idx_order_items_sub_order_id ON order_items (sub_order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

-- ============================================================
-- Payments
-- ============================================================

CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cod', 'bank_transfer', 'card', 'mobile_banking', 'wallet')),
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  transaction_id TEXT,
  gateway_response TEXT,
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_order_id ON payments (order_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_transaction_id ON payments (transaction_id);

CREATE TABLE wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallets_user_id ON wallets (user_id);

CREATE TABLE wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund', 'cashback')),
  amount DOUBLE PRECISION NOT NULL,
  balance_after DOUBLE PRECISION NOT NULL,
  description TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions (wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions (type);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions (created_at);

CREATE TABLE escrow_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders (id),
  buyer_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'partial_release', 'released', 'refunded')),
  held_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escrow_accounts_order_id ON escrow_accounts (order_id);
CREATE INDEX idx_escrow_accounts_buyer_id ON escrow_accounts (buyer_id);
CREATE INDEX idx_escrow_accounts_supplier_id ON escrow_accounts (supplier_id);
CREATE INDEX idx_escrow_accounts_status ON escrow_accounts (status);

CREATE TABLE credit_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id),
  supplier_id UUID REFERENCES users (id),
  credit_limit DOUBLE PRECISION NOT NULL,
  used_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
  available_credit DOUBLE PRECISION NOT NULL,
  interest_rate DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_lines_buyer_id ON credit_lines (buyer_id);
CREATE INDEX idx_credit_lines_supplier_id ON credit_lines (supplier_id);
CREATE INDEX idx_credit_lines_status ON credit_lines (status);

-- ============================================================
-- Negotiation
-- ============================================================

CREATE TABLE quote_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id),
  supplier_id UUID NOT NULL REFERENCES users (id),
  product_id UUID REFERENCES products (id),
  requested_qty INTEGER NOT NULL,
  message TEXT NOT NULL,
  quoted_price DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'accepted', 'rejected', 'expired')),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_requests_buyer_id ON quote_requests (buyer_id);
CREATE INDEX idx_quote_requests_supplier_id ON quote_requests (supplier_id);
CREATE INDEX idx_quote_requests_status ON quote_requests (status);

-- ============================================================
-- Chat
-- ============================================================

CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id),
  supplier_id UUID NOT NULL REFERENCES users (id),
  product_id UUID REFERENCES products (id),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_buyer_id ON conversations (buyer_id);
CREATE INDEX idx_conversations_supplier_id ON conversations (supplier_id);
CREATE INDEX idx_conversations_last_message_at ON conversations (last_message_at);

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users (id),
  message_text TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_sent_at ON messages (sent_at);

-- ============================================================
-- Reviews
-- ============================================================

CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id),
  buyer_id UUID NOT NULL REFERENCES users (id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_product_id ON reviews (product_id);
CREATE INDEX idx_reviews_buyer_id ON reviews (buyer_id);
CREATE INDEX idx_reviews_rating ON reviews (rating);

CREATE TABLE supplier_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id),
  buyer_id UUID NOT NULL REFERENCES users (id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_reviews_supplier_id ON supplier_reviews (supplier_id);
CREATE INDEX idx_supplier_reviews_buyer_id ON supplier_reviews (buyer_id);

-- ============================================================
-- Supporting
-- ============================================================

CREATE TABLE wishlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id),
  product_id UUID NOT NULL REFERENCES products (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wishlists_buyer_id ON wishlists (buyer_id);
CREATE INDEX idx_wishlists_product_id ON wishlists (product_id);

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order', 'payment', 'promotion', 'system', 'chat', 'review')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_is_read ON notifications (is_read);
CREATE INDEX idx_notifications_created_at ON notifications (created_at);

CREATE TABLE browsing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_browsing_history_buyer_id ON browsing_history (buyer_id);
CREATE INDEX idx_browsing_history_product_id ON browsing_history (product_id);
CREATE INDEX idx_browsing_history_viewed_at ON browsing_history (viewed_at);

CREATE TABLE compare_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compare_items_buyer_id ON compare_items (buyer_id);
CREATE INDEX idx_compare_items_product_id ON compare_items (product_id);

CREATE TABLE coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_percent DOUBLE PRECISION NOT NULL,
  max_discount DOUBLE PRECISION,
  min_order_amount DOUBLE PRECISION,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_coupons_code ON coupons (code);
CREATE INDEX idx_coupons_is_active ON coupons (is_active);
CREATE INDEX idx_coupons_valid_from ON coupons (valid_from);
CREATE INDEX idx_coupons_valid_until ON coupons (valid_until);

CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES users (id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX idx_blog_posts_is_published ON blog_posts (is_published);
CREATE INDEX idx_blog_posts_published_at ON blog_posts (published_at);

CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES users (id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs (entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

CREATE TABLE push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens (user_id);
CREATE INDEX idx_push_tokens_token ON push_tokens (token);

CREATE TABLE reported_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES users (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'review', 'user', 'message', 'order')),
  entity_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES users (id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reported_issues_reporter_id ON reported_issues (reporter_id);
CREATE INDEX idx_reported_issues_entity_type ON reported_issues (entity_type);
CREATE INDEX idx_reported_issues_status ON reported_issues (status);
CREATE INDEX idx_reported_issues_created_at ON reported_issues (created_at);

CREATE TABLE search_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('product', 'category', 'supplier')),
  result_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_suggestions_query ON search_suggestions (query);
CREATE INDEX idx_search_suggestions_type ON search_suggestions (type);
CREATE INDEX idx_search_suggestions_click_count ON search_suggestions (click_count);

-- ============================================================
-- Flash Deals & Promotions
-- ============================================================

CREATE TABLE flash_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  deal_price DOUBLE PRECISION NOT NULL,
  discount_percent DOUBLE PRECISION NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  total_stock INTEGER NOT NULL,
  sold_count INTEGER NOT NULL DEFAULT 0,
  max_per_buyer INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flash_deals_product_id ON flash_deals (product_id);
CREATE INDEX idx_flash_deals_is_active ON flash_deals (is_active);
CREATE INDEX idx_flash_deals_start_at ON flash_deals (start_at);
CREATE INDEX idx_flash_deals_end_at ON flash_deals (end_at);

CREATE TABLE daily_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  deal_price DOUBLE PRECISION NOT NULL,
  discount_percent DOUBLE PRECISION NOT NULL,
  day_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_deals_product_id ON daily_deals (product_id);
CREATE INDEX idx_daily_deals_day_date ON daily_deals (day_date);
CREATE INDEX idx_daily_deals_is_active ON daily_deals (is_active);

CREATE TABLE banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_page_id TEXT,
  link_params TEXT,
  position TEXT NOT NULL DEFAULT 'home_top' CHECK (position IN ('home_top', 'home_middle', 'category_top', 'sidebar')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_banners_position ON banners (position);
CREATE INDEX idx_banners_is_active ON banners (is_active);
CREATE INDEX idx_banners_sort_order ON banners (sort_order);

CREATE TABLE promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'bogo', 'bundle')),
  value DOUBLE PRECISION NOT NULL,
  min_order_amount DOUBLE PRECISION,
  max_discount DOUBLE PRECISION,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotions_type ON promotions (type);
CREATE INDEX idx_promotions_is_active ON promotions (is_active);
CREATE INDEX idx_promotions_valid_from ON promotions (valid_from);
CREATE INDEX idx_promotions_valid_until ON promotions (valid_until);

CREATE TABLE promotion_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES promotions (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE
);

CREATE INDEX idx_promotion_products_promotion_id ON promotion_products (promotion_id);
CREATE INDEX idx_promotion_products_product_id ON promotion_products (product_id);

-- ============================================================
-- Shipping & Logistics
-- ============================================================

CREATE TABLE shipping_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  districts JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipping_zones_is_active ON shipping_zones (is_active);

CREATE TABLE shipping_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  estimated_days TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_shipping_methods_is_active ON shipping_methods (is_active);

CREATE TABLE shipping_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id UUID NOT NULL REFERENCES shipping_zones (id) ON DELETE CASCADE,
  method_id UUID NOT NULL REFERENCES shipping_methods (id) ON DELETE CASCADE,
  weight_min DOUBLE PRECISION NOT NULL DEFAULT 0,
  weight_max DOUBLE PRECISION,
  price DOUBLE PRECISION NOT NULL,
  free_above DOUBLE PRECISION
);

CREATE INDEX idx_shipping_rates_zone_id ON shipping_rates (zone_id);
CREATE INDEX idx_shipping_rates_method_id ON shipping_rates (method_id);

CREATE TABLE order_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_order_id UUID NOT NULL REFERENCES sub_orders (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered')),
  location TEXT,
  note TEXT,
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_tracking_sub_order_id ON order_tracking (sub_order_id);
CREATE INDEX idx_order_tracking_tracked_at ON order_tracking (tracked_at);

CREATE TABLE warehouse_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouse_locations_supplier_id ON warehouse_locations (supplier_id);
CREATE INDEX idx_warehouse_locations_district ON warehouse_locations (district);

-- ============================================================
-- RFQ System
-- ============================================================

CREATE TABLE rfq_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_slug TEXT,
  quantity INTEGER,
  unit TEXT NOT NULL DEFAULT 'pcs' CHECK (unit IN ('pcs', 'dozen', 'kg', 'carton', 'box', 'set')),
  target_price DOUBLE PRECISION,
  delivery_city TEXT,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'awarded', 'closed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfq_requests_buyer_id ON rfq_requests (buyer_id);
CREATE INDEX idx_rfq_requests_category_slug ON rfq_requests (category_slug);
CREATE INDEX idx_rfq_requests_status ON rfq_requests (status);
CREATE INDEX idx_rfq_requests_deadline ON rfq_requests (deadline);

CREATE TABLE rfq_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES rfq_requests (id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  specifications TEXT,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs' CHECK (unit IN ('pcs', 'dozen', 'kg', 'carton', 'box', 'set')),
  target_price DOUBLE PRECISION
);

CREATE INDEX idx_rfq_items_rfq_id ON rfq_items (rfq_id);

CREATE TABLE rfq_quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfq_id UUID NOT NULL REFERENCES rfq_requests (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id),
  price_per_unit DOUBLE PRECISION NOT NULL,
  total_price DOUBLE PRECISION NOT NULL,
  delivery_days INTEGER,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfq_quotes_rfq_id ON rfq_quotes (rfq_id);
CREATE INDEX idx_rfq_quotes_supplier_id ON rfq_quotes (supplier_id);
CREATE INDEX idx_rfq_quotes_status ON rfq_quotes (status);

-- ============================================================
-- Sample Orders
-- ============================================================

CREATE TABLE sample_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id),
  product_id UUID NOT NULL REFERENCES products (id),
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'shipped', 'delivered', 'cancelled')),
  sample_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  shipping_address_id UUID REFERENCES addresses (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sample_orders_buyer_id ON sample_orders (buyer_id);
CREATE INDEX idx_sample_orders_supplier_id ON sample_orders (supplier_id);
CREATE INDEX idx_sample_orders_product_id ON sample_orders (product_id);
CREATE INDEX idx_sample_orders_status ON sample_orders (status);

-- ============================================================
-- Inspection & Certification
-- ============================================================

CREATE TABLE inspection_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders (id),
  buyer_id UUID NOT NULL REFERENCES users (id),
  inspector_type TEXT NOT NULL CHECK (inspector_type IN ('self', 'third_party')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'failed')),
  report_url TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspection_requests_order_id ON inspection_requests (order_id);
CREATE INDEX idx_inspection_requests_buyer_id ON inspection_requests (buyer_id);
CREATE INDEX idx_inspection_requests_status ON inspection_requests (status);

-- ============================================================
-- Loyalty & Rewards
-- ============================================================

CREATE TABLE buyer_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_redeemed INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_rewards_buyer_id ON buyer_rewards (buyer_id);
CREATE INDEX idx_buyer_rewards_tier ON buyer_rewards (tier);

CREATE TABLE reward_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'expire')),
  points INTEGER NOT NULL,
  description TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_transactions_buyer_id ON reward_transactions (buyer_id);
CREATE INDEX idx_reward_transactions_type ON reward_transactions (type);
CREATE INDEX idx_reward_transactions_created_at ON reward_transactions (created_at);

CREATE TABLE referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  used_count INTEGER NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_codes_buyer_id ON referral_codes (buyer_id);
CREATE INDEX idx_referral_codes_code ON referral_codes (code);

CREATE TABLE referral_uses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id UUID NOT NULL REFERENCES referral_codes (id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users (id),
  reward_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_uses_referral_code_id ON referral_uses (referral_code_id);
CREATE INDEX idx_referral_uses_referred_user_id ON referral_uses (referred_user_id);

-- ============================================================
-- Supplier Enhancements
-- ============================================================

CREATE TABLE supplier_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  coverage_radius DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_supplier_locations_supplier_id ON supplier_locations (supplier_id);
CREATE INDEX idx_supplier_locations_is_active ON supplier_locations (is_active);

CREATE TABLE supplier_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discount', 'bogo', 'free_shipping')),
  value DOUBLE PRECISION NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_campaigns_supplier_id ON supplier_campaigns (supplier_id);
CREATE INDEX idx_supplier_campaigns_type ON supplier_campaigns (type);
CREATE INDEX idx_supplier_campaigns_is_active ON supplier_campaigns (is_active);
CREATE INDEX idx_supplier_campaigns_valid_from ON supplier_campaigns (valid_from);
CREATE INDEX idx_supplier_campaigns_valid_until ON supplier_campaigns (valid_until);

CREATE TABLE supplier_loyalty_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles (id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  min_purchase DOUBLE PRECISION NOT NULL,
  discount_percent DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_loyalty_tiers_supplier_id ON supplier_loyalty_tiers (supplier_id);

-- ============================================================
-- Cross Border & Customs
-- ============================================================

CREATE TABLE cross_border_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES orders (id) ON DELETE CASCADE,
  origin_country TEXT NOT NULL,
  destination_country TEXT NOT NULL DEFAULT 'Bangladesh',
  hs_code TEXT,
  declared_value DOUBLE PRECISION NOT NULL,
  customs_status TEXT NOT NULL DEFAULT 'pending' CHECK (customs_status IN ('pending', 'cleared', 'held', 'rejected')),
  customs_documents JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cross_border_orders_order_id ON cross_border_orders (order_id);
CREATE INDEX idx_cross_border_orders_customs_status ON cross_border_orders (customs_status);

CREATE TABLE customs_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cross_border_order_id UUID NOT NULL REFERENCES cross_border_orders (id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('commercial_invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin', 'customs_declaration')),
  document_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customs_documents_cross_border_order_id ON customs_documents (cross_border_order_id);
CREATE INDEX idx_customs_documents_document_type ON customs_documents (document_type);

-- ============================================================
-- Market Insights
-- ============================================================

CREATE TABLE market_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_slug TEXT REFERENCES categories (slug),
  title TEXT NOT NULL,
  summary TEXT,
  report_data JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_reports_category_slug ON market_reports (category_slug);
CREATE INDEX idx_market_reports_published_at ON market_reports (published_at);

-- ============================================================
-- Admin & Content
-- ============================================================

CREATE TABLE admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_settings_key ON admin_settings (key);
CREATE INDEX idx_admin_settings_category ON admin_settings (category);

CREATE TABLE content_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_pages_slug ON content_pages (slug);
CREATE INDEX idx_content_pages_is_published ON content_pages (is_published);

CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions JSONB,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);


-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE browsing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE compare_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reported_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_border_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper: auth.uid() returns current user's UUID
-- auth.jwt() contains claims including user_type

-- USERS
CREATE POLICY "users_select_own_or_admin" ON users FOR SELECT
  USING (id = auth.uid() OR (auth.jwt() ->> 'user_type') = 'admin');

CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (id = auth.uid());

-- OTP_CODES
CREATE POLICY "otp_codes_own_or_admin" ON otp_codes FOR SELECT
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'user_type') = 'admin');

CREATE POLICY "otp_codes_insert_own" ON otp_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- BUYER_PROFILES
CREATE POLICY "buyer_profiles_read_own" ON buyer_profiles FOR SELECT
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'user_type') = 'admin');

CREATE POLICY "buyer_profiles_insert_own" ON buyer_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "buyer_profiles_update_own" ON buyer_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- ADDRESSES
CREATE POLICY "addresses_read_own" ON addresses FOR SELECT
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'user_type') = 'admin');

CREATE POLICY "addresses_insert_own" ON addresses FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "addresses_update_own" ON addresses FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "addresses_delete_own" ON addresses FOR DELETE
  USING (user_id = auth.uid());

-- SUPPLIER_PROFILES
CREATE POLICY "supplier_profiles_read_own" ON supplier_profiles FOR SELECT
  USING (user_id = auth.uid() OR (auth.jwt() ->> 'user_type') = 'admin' OR verification_status = 'approved');

CREATE POLICY "supplier_profiles_insert_own" ON supplier_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "supplier_profiles_update_own" ON supplier_profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "supplier_profiles_admin_all" ON supplier_profiles FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SUPPLIER_AGREEMENTS
CREATE POLICY "supplier_agreements_supplier_own" ON supplier_agreements FOR SELECT
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "supplier_agreements_supplier_insert" ON supplier_agreements FOR INSERT
  WITH CHECK (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "supplier_agreements_admin_all" ON supplier_agreements FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- CATEGORIES
CREATE POLICY "categories_read_all" ON categories FOR SELECT
  USING (true);

CREATE POLICY "categories_admin_manage" ON categories FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCTS
CREATE POLICY "products_read_active_approved" ON products FOR SELECT
  USING (is_active = true AND is_approved = true);

CREATE POLICY "products_supplier_manage_own" ON products FOR ALL
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "products_admin_manage_all" ON products FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_IMAGES
CREATE POLICY "product_images_read_with_product" ON product_images FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_active = true AND is_approved = true));

CREATE POLICY "product_images_manage_own" ON product_images FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "product_images_admin_all" ON product_images FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_PRICE_TIERS
CREATE POLICY "product_price_tiers_read_with_product" ON product_price_tiers FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_active = true AND is_approved = true));

CREATE POLICY "product_price_tiers_manage_own" ON product_price_tiers FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "product_price_tiers_admin_all" ON product_price_tiers FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_VARIANTS
CREATE POLICY "product_variants_read_with_product" ON product_variants FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_active = true AND is_approved = true));

CREATE POLICY "product_variants_manage_own" ON product_variants FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "product_variants_admin_all" ON product_variants FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_SPECIFICATIONS
CREATE POLICY "product_specifications_read_with_product" ON product_specifications FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_active = true AND is_approved = true));

CREATE POLICY "product_specifications_manage_own" ON product_specifications FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "product_specifications_admin_all" ON product_specifications FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_TAGS
CREATE POLICY "product_tags_read_all" ON product_tags FOR SELECT
  USING (true);

CREATE POLICY "product_tags_admin_manage" ON product_tags FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_TAG_RELATIONS
CREATE POLICY "product_tag_relations_read_with_product" ON product_tag_relations FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_active = true AND is_approved = true));

CREATE POLICY "product_tag_relations_manage_own" ON product_tag_relations FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "product_tag_relations_admin_all" ON product_tag_relations FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_VIDEOS
CREATE POLICY "product_videos_read_with_product" ON product_videos FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_active = true AND is_approved = true));

CREATE POLICY "product_videos_manage_own" ON product_videos FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "product_videos_admin_all" ON product_videos FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PRODUCT_CERTIFICATIONS
CREATE POLICY "product_certifications_read_with_product" ON product_certifications FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE is_active = true AND is_approved = true));

CREATE POLICY "product_certifications_manage_own" ON product_certifications FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "product_certifications_admin_all" ON product_certifications FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- CARTS
CREATE POLICY "carts_buyer_manage_own" ON carts FOR ALL
  USING (buyer_id = auth.uid());

-- CART_ITEMS
CREATE POLICY "cart_items_buyer_manage_own" ON cart_items FOR ALL
  USING (cart_id IN (SELECT id FROM carts WHERE buyer_id = auth.uid()));

-- ORDERS
CREATE POLICY "orders_buyer_read_own" ON orders FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "orders_admin_all" ON orders FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

CREATE POLICY "orders_insert_buyer" ON orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- SUB_ORDERS
CREATE POLICY "sub_orders_buyer_read_own" ON sub_orders FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid()));

CREATE POLICY "sub_orders_supplier_read_own" ON sub_orders FOR SELECT
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "sub_orders_admin_all" ON sub_orders FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

CREATE POLICY "sub_orders_supplier_update_own" ON sub_orders FOR UPDATE
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

-- ORDER_ITEMS
CREATE POLICY "order_items_buyer_read_own" ON order_items FOR SELECT
  USING (sub_order_id IN (SELECT id FROM sub_orders WHERE order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())));

CREATE POLICY "order_items_supplier_read_own" ON order_items FOR SELECT
  USING (sub_order_id IN (SELECT id FROM sub_orders WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "order_items_admin_all" ON order_items FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PAYMENTS
CREATE POLICY "payments_buyer_read_own" ON payments FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid()));

CREATE POLICY "payments_admin_all" ON payments FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- WALLETS
CREATE POLICY "wallets_owner_read" ON wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "wallets_admin_all" ON wallets FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- WALLET_TRANSACTIONS
CREATE POLICY "wallet_transactions_owner_read" ON wallet_transactions FOR SELECT
  USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

CREATE POLICY "wallet_transactions_admin_all" ON wallet_transactions FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- ESCROW_ACCOUNTS
CREATE POLICY "escrow_accounts_buyer_read" ON escrow_accounts FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "escrow_accounts_supplier_read" ON escrow_accounts FOR SELECT
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "escrow_accounts_admin_all" ON escrow_accounts FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- CREDIT_LINES
CREATE POLICY "credit_lines_buyer_read_own" ON credit_lines FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "credit_lines_supplier_read_own" ON credit_lines FOR SELECT
  USING (supplier_id = auth.uid());

CREATE POLICY "credit_lines_admin_all" ON credit_lines FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- QUOTE_REQUESTS
CREATE POLICY "quote_requests_buyer_manage_own" ON quote_requests FOR ALL
  USING (buyer_id = auth.uid());

CREATE POLICY "quote_requests_supplier_read" ON quote_requests FOR SELECT
  USING (supplier_id = auth.uid());

CREATE POLICY "quote_requests_admin_all" ON quote_requests FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- CONVERSATIONS
CREATE POLICY "conversations_participants" ON conversations FOR SELECT
  USING (buyer_id = auth.uid() OR supplier_id = auth.uid());

CREATE POLICY "conversations_insert_buyer" ON conversations FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "conversations_update_participants" ON conversations FOR UPDATE
  USING (buyer_id = auth.uid() OR supplier_id = auth.uid());

-- MESSAGES
CREATE POLICY "messages_participants_read" ON messages FOR SELECT
  USING (conversation_id IN (SELECT id FROM conversations WHERE buyer_id = auth.uid() OR supplier_id = auth.uid()));

CREATE POLICY "messages_participants_insert" ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT id FROM conversations WHERE buyer_id = auth.uid() OR supplier_id = auth.uid()));

-- REVIEWS
CREATE POLICY "reviews_read_all" ON reviews FOR SELECT
  USING (true);

CREATE POLICY "reviews_buyer_create_own" ON reviews FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "reviews_buyer_update_own" ON reviews FOR UPDATE
  USING (buyer_id = auth.uid());

CREATE POLICY "reviews_buyer_delete_own" ON reviews FOR DELETE
  USING (buyer_id = auth.uid());

CREATE POLICY "reviews_admin_manage" ON reviews FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SUPPLIER_REVIEWS
CREATE POLICY "supplier_reviews_read_all" ON supplier_reviews FOR SELECT
  USING (true);

CREATE POLICY "supplier_reviews_buyer_create_own" ON supplier_reviews FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "supplier_reviews_admin_manage" ON supplier_reviews FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- WISHLISTS
CREATE POLICY "wishlists_buyer_manage_own" ON wishlists FOR ALL
  USING (buyer_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "notifications_owner_read_write" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_owner_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "notifications_owner_delete" ON notifications FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT
  WITH CHECK (true); -- system can insert notifications for any user

-- BROWSING_HISTORY
CREATE POLICY "browsing_history_buyer_manage_own" ON browsing_history FOR ALL
  USING (buyer_id = auth.uid());

-- COMPARE_ITEMS
CREATE POLICY "compare_items_buyer_manage_own" ON compare_items FOR ALL
  USING (buyer_id = auth.uid());

-- COUPONS
CREATE POLICY "coupons_read_active" ON coupons FOR SELECT
  USING (is_active = true AND valid_from <= now() AND valid_until >= now());

CREATE POLICY "coupons_admin_manage" ON coupons FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- BLOG_POSTS
CREATE POLICY "blog_posts_read_published" ON blog_posts FOR SELECT
  USING (is_published = true);

CREATE POLICY "blog_posts_admin_manage" ON blog_posts FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- AUDIT_LOGS
CREATE POLICY "audit_logs_admin_all" ON audit_logs FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PUSH_TOKENS
CREATE POLICY "push_tokens_owner_manage" ON push_tokens FOR ALL
  USING (user_id = auth.uid());

-- REPORTED_ISSUES
CREATE POLICY "reported_issues_reporter_create" ON reported_issues FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reported_issues_reporter_read_own" ON reported_issues FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "reported_issues_admin_all" ON reported_issues FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SEARCH_SUGGESTIONS
CREATE POLICY "search_suggestions_read_all" ON search_suggestions FOR SELECT
  USING (true);

CREATE POLICY "search_suggestions_admin_manage" ON search_suggestions FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- FLASH_DEALS
CREATE POLICY "flash_deals_read_active" ON flash_deals FOR SELECT
  USING (is_active = true AND start_at <= now() AND end_at >= now());

CREATE POLICY "flash_deals_admin_manage" ON flash_deals FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- DAILY_DEALS
CREATE POLICY "daily_deals_read_active" ON daily_deals FOR SELECT
  USING (is_active = true AND day_date = CURRENT_DATE);

CREATE POLICY "daily_deals_admin_manage" ON daily_deals FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- BANNERS
CREATE POLICY "banners_read_active" ON banners FOR SELECT
  USING (is_active = true AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()));

CREATE POLICY "banners_admin_manage" ON banners FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PROMOTIONS
CREATE POLICY "promotions_read_active" ON promotions FOR SELECT
  USING (is_active = true AND valid_from <= now() AND valid_until >= now());

CREATE POLICY "promotions_admin_manage" ON promotions FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- PROMOTION_PRODUCTS
CREATE POLICY "promotion_products_read_with_promotion" ON promotion_products FOR SELECT
  USING (promotion_id IN (SELECT id FROM promotions WHERE is_active = true AND valid_from <= now() AND valid_until >= now()));

CREATE POLICY "promotion_products_admin_manage" ON promotion_products FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SHIPPING_ZONES
CREATE POLICY "shipping_zones_read_all" ON shipping_zones FOR SELECT
  USING (is_active = true);

CREATE POLICY "shipping_zones_admin_manage" ON shipping_zones FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SHIPPING_METHODS
CREATE POLICY "shipping_methods_read_all" ON shipping_methods FOR SELECT
  USING (is_active = true);

CREATE POLICY "shipping_methods_admin_manage" ON shipping_methods FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SHIPPING_RATES
CREATE POLICY "shipping_rates_read_all" ON shipping_rates FOR SELECT
  USING (zone_id IN (SELECT id FROM shipping_zones WHERE is_active = true) AND method_id IN (SELECT id FROM shipping_methods WHERE is_active = true));

CREATE POLICY "shipping_rates_admin_manage" ON shipping_rates FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- ORDER_TRACKING
CREATE POLICY "order_tracking_buyer_read" ON order_tracking FOR SELECT
  USING (sub_order_id IN (SELECT id FROM sub_orders WHERE order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())));

CREATE POLICY "order_tracking_supplier_read" ON order_tracking FOR SELECT
  USING (sub_order_id IN (SELECT id FROM sub_orders WHERE supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid())));

CREATE POLICY "order_tracking_admin_all" ON order_tracking FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- WAREHOUSE_LOCATIONS
CREATE POLICY "warehouse_locations_supplier_own" ON warehouse_locations FOR SELECT
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "warehouse_locations_supplier_manage" ON warehouse_locations FOR ALL
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "warehouse_locations_admin_all" ON warehouse_locations FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- RFQ_REQUESTS
CREATE POLICY "rfq_requests_buyer_manage_own" ON rfq_requests FOR ALL
  USING (buyer_id = auth.uid());

CREATE POLICY "rfq_requests_suppliers_read_open" ON rfq_requests FOR SELECT
  USING (status = 'open');

CREATE POLICY "rfq_requests_admin_all" ON rfq_requests FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- RFQ_ITEMS
CREATE POLICY "rfq_items_buyer_manage_own" ON rfq_items FOR ALL
  USING (rfq_id IN (SELECT id FROM rfq_requests WHERE buyer_id = auth.uid()));

CREATE POLICY "rfq_items_suppliers_read_open" ON rfq_items FOR SELECT
  USING (rfq_id IN (SELECT id FROM rfq_requests WHERE status = 'open'));

CREATE POLICY "rfq_items_admin_all" ON rfq_items FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- RFQ_QUOTES
CREATE POLICY "rfq_quotes_supplier_manage_own" ON rfq_quotes FOR ALL
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "rfq_quotes_buyer_read_own" ON rfq_quotes FOR SELECT
  USING (rfq_id IN (SELECT id FROM rfq_requests WHERE buyer_id = auth.uid()));

CREATE POLICY "rfq_quotes_admin_all" ON rfq_quotes FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SAMPLE_ORDERS
CREATE POLICY "sample_orders_buyer_own" ON sample_orders FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "sample_orders_buyer_create" ON sample_orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "sample_orders_supplier_own" ON sample_orders FOR SELECT
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "sample_orders_supplier_update" ON sample_orders FOR UPDATE
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "sample_orders_admin_all" ON sample_orders FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- INSPECTION_REQUESTS
CREATE POLICY "inspection_requests_buyer_own" ON inspection_requests FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "inspection_requests_buyer_create" ON inspection_requests FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "inspection_requests_admin_all" ON inspection_requests FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- BUYER_REWARDS
CREATE POLICY "buyer_rewards_owner_read" ON buyer_rewards FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "buyer_rewards_owner_update" ON buyer_rewards FOR UPDATE
  USING (buyer_id = auth.uid());

CREATE POLICY "buyer_rewards_admin_all" ON buyer_rewards FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- REWARD_TRANSACTIONS
CREATE POLICY "reward_transactions_owner_read" ON reward_transactions FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "reward_transactions_admin_all" ON reward_transactions FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- REFERRAL_CODES
CREATE POLICY "referral_codes_buyer_manage_own" ON referral_codes FOR ALL
  USING (buyer_id = auth.uid());

CREATE POLICY "referral_codes_read_active" ON referral_codes FOR SELECT
  USING (is_active = true);

-- REFERRAL_USES
CREATE POLICY "referral_uses_buyer_read_own" ON referral_uses FOR SELECT
  USING (referral_code_id IN (SELECT id FROM referral_codes WHERE buyer_id = auth.uid()) OR referred_user_id = auth.uid());

CREATE POLICY "referral_uses_admin_all" ON referral_uses FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SUPPLIER_LOCATIONS
CREATE POLICY "supplier_locations_supplier_own" ON supplier_locations FOR ALL
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "supplier_locations_admin_all" ON supplier_locations FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SUPPLIER_CAMPAIGNS
CREATE POLICY "supplier_campaigns_supplier_own" ON supplier_campaigns FOR ALL
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "supplier_campaigns_admin_all" ON supplier_campaigns FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- SUPPLIER_LOYALTY_TIERS
CREATE POLICY "supplier_loyalty_tiers_supplier_own" ON supplier_loyalty_tiers FOR ALL
  USING (supplier_id IN (SELECT id FROM supplier_profiles WHERE user_id = auth.uid()));

CREATE POLICY "supplier_loyalty_tiers_admin_all" ON supplier_loyalty_tiers FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- CROSS_BORDER_ORDERS
CREATE POLICY "cross_border_orders_buyer_read" ON cross_border_orders FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid()));

CREATE POLICY "cross_border_orders_admin_all" ON cross_border_orders FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- CUSTOMS_DOCUMENTS
CREATE POLICY "customs_documents_buyer_read" ON customs_documents FOR SELECT
  USING (cross_border_order_id IN (SELECT id FROM cross_border_orders WHERE order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())));

CREATE POLICY "customs_documents_admin_all" ON customs_documents FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- MARKET_REPORTS
CREATE POLICY "market_reports_read_all" ON market_reports FOR SELECT
  USING (true);

CREATE POLICY "market_reports_admin_manage" ON market_reports FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- ADMIN_SETTINGS
CREATE POLICY "admin_settings_admin_only" ON admin_settings FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

CREATE POLICY "admin_settings_read_public" ON admin_settings FOR SELECT
  USING (true); -- some settings like site_name are public

-- CONTENT_PAGES
CREATE POLICY "content_pages_read_published" ON content_pages FOR SELECT
  USING (is_published = true);

CREATE POLICY "content_pages_admin_manage" ON content_pages FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');

-- API_KEYS
CREATE POLICY "api_keys_owner_manage" ON api_keys FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "api_keys_admin_all" ON api_keys FOR ALL
  USING ((auth.jwt() ->> 'user_type') = 'admin');


-- ============================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================

-- set_updated_at() trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply set_updated_at to all tables with updated_at column
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_buyer_profiles_updated_at BEFORE UPDATE ON buyer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_supplier_profiles_updated_at BEFORE UPDATE ON supplier_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sub_orders_updated_at BEFORE UPDATE ON sub_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_credit_lines_updated_at BEFORE UPDATE ON credit_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rfq_requests_updated_at BEFORE UPDATE ON rfq_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sample_orders_updated_at BEFORE UPDATE ON sample_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_buyer_rewards_updated_at BEFORE UPDATE ON buyer_rewards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_admin_settings_updated_at BEFORE UPDATE ON admin_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_content_pages_updated_at BEFORE UPDATE ON content_pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_blog_posts_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- generate_order_number() function
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  seq_val INTEGER;
  order_num TEXT;
BEGIN
  seq_val := nextval('order_number_seq');
  order_num := 'BD-' || lpad(seq_val::TEXT, 6, '0');
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 100000;

-- update_product_rating() trigger function
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DOUBLE PRECISION;
  rating_count INTEGER;
BEGIN
  -- Recalculate average rating for the affected product
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO avg_rating, rating_count
  FROM reviews
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id);

  -- Note: products table doesn't have rating columns in current schema
  -- This trigger is for future use when rating columns are added to products
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for product rating updates
CREATE TRIGGER trg_update_product_rating AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- update_supplier_rating() trigger function
CREATE OR REPLACE FUNCTION update_supplier_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DOUBLE PRECISION;
  rating_count INTEGER;
  target_supplier_id UUID;
BEGIN
  target_supplier_id := COALESCE(NEW.supplier_id, OLD.supplier_id);

  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO avg_rating, rating_count
  FROM supplier_reviews
  WHERE supplier_id = target_supplier_id;

  UPDATE supplier_profiles
  SET rating_avg = avg_rating,
      rating_count = rating_count
  WHERE id = target_supplier_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for supplier rating updates
CREATE TRIGGER trg_update_supplier_rating AFTER INSERT OR UPDATE OR DELETE ON supplier_reviews
  FOR EACH ROW EXECUTE FUNCTION update_supplier_rating();

-- notify_order_status_change() trigger function
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  order_buyer_id UUID;
  order_id_val UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get buyer_id from the parent order
    SELECT buyer_id INTO order_buyer_id
    FROM orders
    WHERE id = NEW.order_id;

    notification_title := 'Order Status Updated';
    notification_body := 'Your sub-order status has been updated to: ' || NEW.status;

    INSERT INTO notifications (user_id, type, title, body, related_entity_id)
    VALUES (
      order_buyer_id,
      'order',
      notification_title,
      notification_body,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order status change notifications
CREATE TRIGGER trg_notify_order_status_change AFTER UPDATE ON sub_orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();


-- ============================================================
-- 5. SEED DATA (Basic / Admin Defaults)
-- ============================================================

-- Demo Users with fixed UUIDs
INSERT INTO users (id, user_type, email, phone, password_hash, auth_provider, account_status, is_email_verified, is_phone_verified) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'buyer', 'buyer@zylod.com', '+8801711000001', crypt('demo1234', gen_salt('bf')), 'email', 'active', true, true),
  ('a0000000-0000-0000-0000-000000000002', 'supplier', 'supplier@zylod.com', '+8801711000002', crypt('demo1234', gen_salt('bf')), 'email', 'active', true, true),
  ('a0000000-0000-0000-0000-000000000003', 'admin', 'admin@zylod.com', '+8801711000003', crypt('demo1234', gen_salt('bf')), 'email', 'active', true, true);

-- 20 Categories
INSERT INTO categories (id, name, slug, parent_id, is_active, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Electronics', 'electronics', NULL, true, 1),
  ('c0000000-0000-0000-0000-000000000002', 'Textiles & Garments', 'textiles-garments', NULL, true, 2),
  ('c0000000-0000-0000-0000-000000000003', 'Agriculture & Food', 'agriculture-food', NULL, true, 3),
  ('c0000000-0000-0000-0000-000000000004', 'Construction Materials', 'construction-materials', NULL, true, 4),
  ('c0000000-0000-0000-0000-000000000005', 'Jute & Jute Products', 'jute-products', NULL, true, 5),
  ('c0000000-0000-0000-0000-000000000006', 'Leather & Footwear', 'leather-footwear', NULL, true, 6),
  ('c0000000-0000-0000-0000-000000000007', 'Chemicals & Pharma', 'chemicals-pharma', NULL, true, 7),
  ('c0000000-0000-0000-0000-000000000008', 'Automotive & Parts', 'automotive-parts', NULL, true, 8),
  ('c0000000-0000-0000-0000-000000000009', 'Home & Kitchen', 'home-kitchen', NULL, true, 9),
  ('c0000000-0000-0000-0000-000000000010', 'Medical Supplies', 'medical-supplies', NULL, true, 10),
  ('c0000000-0000-0000-0000-000000000011', 'Stationery & Office', 'stationery-office', NULL, true, 11),
  ('c0000000-0000-0000-0000-000000000012', 'Sports & Fitness', 'sports-fitness', NULL, true, 12),
  ('c0000000-0000-0000-0000-000000000013', 'Beauty & Personal Care', 'beauty-personal-care', NULL, true, 13),
  ('c0000000-0000-0000-0000-000000000014', 'Packaging & Printing', 'packaging-printing', NULL, true, 14),
  ('c0000000-0000-0000-0000-000000000015', 'Machinery & Equipment', 'machinery-equipment', NULL, true, 15),
  ('c0000000-0000-0000-0000-000000000016', 'Furniture & Wood', 'furniture-wood', NULL, true, 16),
  ('c0000000-0000-0000-0000-000000000017', 'Plastics & Rubber', 'plastics-rubber', NULL, true, 17),
  ('c0000000-0000-0000-0000-000000000018', 'Glass & Ceramics', 'glass-ceramics', NULL, true, 18),
  ('c0000000-0000-0000-0000-000000000019', 'IT & Software', 'it-software', NULL, true, 19),
  ('c0000000-0000-0000-0000-000000000020', 'Toys & Games', 'toys-games', NULL, true, 20);

-- Admin Settings Defaults
INSERT INTO admin_settings (key, value, category, description) VALUES
  ('site_name', 'Zylod', 'general', 'Site display name'),
  ('site_description', 'Bangladesh B2B Wholesale Marketplace', 'general', 'Site meta description'),
  ('default_currency', 'BDT', 'general', 'Default currency code'),
  ('min_order_amount', '1000', 'orders', 'Minimum order amount in BDT'),
  ('max_order_amount', '10000000', 'orders', 'Maximum order amount in BDT'),
  ('escrow_enabled', 'true', 'payments', 'Whether escrow payment protection is enabled'),
  ('escrow_hold_days', '7', 'payments', 'Default escrow hold period in days'),
  ('commission_rate', '3', 'payments', 'Platform commission percentage'),
  ('otp_expiry_minutes', '5', 'auth', 'OTP code expiry time in minutes'),
  ('max_login_attempts', '5', 'auth', 'Maximum login attempts before lockout'),
  ('review_min_length', '20', 'reviews', 'Minimum review comment length'),
  ('review_max_length', '500', 'reviews', 'Maximum review comment length'),
  ('flash_deal_max_per_buyer', '5', 'promotions', 'Maximum flash deal items per buyer'),
  ('daily_deal_refresh_hour', '0', 'promotions', 'Hour to refresh daily deals (0-23)'),
  ('shipping_free_threshold', '5000', 'shipping', 'Free shipping threshold in BDT'),
  ('default_shipping_days', '3-5', 'shipping', 'Default estimated shipping days'),
  ('rfq_expiry_days', '7', 'rfq', 'RFQ default expiry in days'),
  ('sample_order_max_qty', '10', 'samples', 'Maximum sample order quantity'),
  ('referral_reward_points', '100', 'loyalty', 'Points awarded for successful referral'),
  ('buyer_tier_bronze_threshold', '0', 'loyalty', 'Bronze tier minimum points'),
  ('buyer_tier_silver_threshold', '500', 'loyalty', 'Silver tier minimum points'),
  ('buyer_tier_gold_threshold', '2000', 'loyalty', 'Gold tier minimum points'),
  ('buyer_tier_platinum_threshold', '5000', 'loyalty', 'Platinum tier minimum points'),
  ('credit_line_max_interest', '15', 'finance', 'Maximum credit line interest rate'),
  ('credit_line_default_limit', '50000', 'finance', 'Default credit line limit in BDT'),
  ('notification_batch_size', '100', 'system', 'Batch size for notification processing'),
  ('search_suggestion_limit', '10', 'search', 'Maximum search suggestions returned'),
  ('product_image_max_count', '10', 'products', 'Maximum product images allowed'),
  ('product_video_max_count', '3', 'products', 'Maximum product videos allowed'),
  ('blog_post_auto_publish', 'false', 'content', 'Auto-publish blog posts after review');
