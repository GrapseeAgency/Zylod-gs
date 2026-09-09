-- ============================================================
-- Zylod B2B Wholesale Marketplace
-- Seed Data Migration
-- ============================================================

-- ============================================================
-- 1. DEMO USERS
-- ============================================================
INSERT INTO users (id, user_type, email, phone, password_hash, auth_provider, account_status, is_email_verified, is_phone_verified) VALUES
('demo-buyer-00000000-0000-0000-0000-000000000001', 'buyer', 'buyer@zylod.com', '+8801711000001', crypt('demo1234', gen_salt('bf')), 'email', 'active', true, true),
('demo-supplier-00000000-0000-0000-0000-000000000002', 'supplier', 'supplier@zylod.com', '+8801711000002', crypt('demo1234', gen_salt('bf')), 'email', 'active', true, true),
('demo-admin-00000000-0000-0000-0000-000000000003', 'admin', 'admin@zylod.com', '+8801711000003', crypt('demo1234', gen_salt('bf')), 'email', 'active', true, true);

-- ============================================================
-- 2. BUYER PROFILE
-- ============================================================
INSERT INTO buyer_profiles (id, user_id, full_name, business_name, business_type, profile_completion_pct, is_profile_complete) VALUES
('bp-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Rahim Ahmed', 'Ahmed Wholesale Store', 'retailer', 85, true);

-- ============================================================
-- 3. SUPPLIER PROFILE (Verified)
-- ============================================================
INSERT INTO supplier_profiles (id, user_id, company_name, nid_number, nid_front_image_url, nid_back_image_url, trade_license_number, trade_license_image_url, tin_number, bank_account_name, bank_account_number, bank_name, branch, verification_status, rating_avg, rating_count) VALUES
('sp-001', 'demo-supplier-00000000-0000-0000-0000-000000000002', 'Bangladesh Textile Corporation', 'NID1234567890', '/docs/nid-front.jpg', '/docs/nid-back.jpg', 'TL-2024-DH-001234', '/docs/trade-license.jpg', 'TIN123456789', 'Bangladesh Textile Corp', '1234567890', 'Dutch-Bangla Bank', 'Gulshan Branch', 'approved', 4.7, 156);

-- ============================================================
-- 4. ADDITIONAL SUPPLIERS
-- ============================================================
INSERT INTO users (id, user_type, email, phone, password_hash, auth_provider, account_status, is_email_verified) VALUES
('sup-002-00000000-0000-0000-0000-000000000004', 'supplier', 'agri@zylod.com', '+8801711000004', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-003-00000000-0000-0000-0000-000000000005', 'supplier', 'electronics@zylod.com', '+8801711000005', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-004-00000000-0000-0000-0000-000000000006', 'supplier', 'spices@zylod.com', '+8801711000006', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-005-00000000-0000-0000-0000-000000000007', 'supplier', 'garments@zylod.com', '+8801711000007', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-006-00000000-0000-0000-0000-000000000008', 'supplier', 'led@zylod.com', '+8801711000008', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-007-00000000-0000-0000-0000-000000000009', 'supplier', 'construction@zylod.com', '+8801711000009', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-008-00000000-0000-0000-0000-000000000010', 'supplier', 'packaging@zylod.com', '+8801711000010', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-009-00000000-0000-0000-0000-000000000011', 'supplier', 'furniture@zylod.com', '+8801711000011', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('sup-010-00000000-0000-0000-0000-000000000012', 'supplier', 'medical@zylod.com', '+8801711000012', crypt('demo1234', gen_salt('bf')), 'email', 'active', true);

INSERT INTO supplier_profiles (id, user_id, company_name, nid_number, trade_license_number, tin_number, bank_account_name, bank_account_number, bank_name, branch, verification_status, rating_avg, rating_count) VALUES
('sp-002', 'sup-002-00000000-0000-0000-0000-000000000004', 'Bangladesh Agri Foods Ltd', 'NID2345678901', 'TL-2024-DH-002345', 'TIN234567890', 'Bangladesh Agri Foods', '2345678901', 'City Bank', 'Motijheel Branch', 'approved', 4.5, 89),
('sp-003', 'sup-003-00000000-0000-0000-0000-000000000005', 'Dhaka Electronics Hub', 'NID3456789012', 'TL-2024-DH-003456', 'TIN345678901', 'Dhaka Electronics Hub', '3456789012', 'BRAC Bank', 'Dhanmondi Branch', 'approved', 4.3, 67),
('sp-004', 'sup-004-00000000-0000-0000-0000-000000000006', 'Spice Masters Bangladesh', 'NID4567890123', 'TL-2024-CT-004567', 'TIN456789012', 'Spice Masters BD', '4567890123', 'Sonali Bank', 'Chittagong Branch', 'approved', 4.6, 112),
('sp-005', 'sup-005-00000000-0000-0000-0000-000000000007', 'Garments Galaxy BD', 'NID5678901234', 'TL-2024-DH-005678', 'TIN567890123', 'Garments Galaxy', '5678901234', 'Standard Chartered', 'Gulshan Branch', 'approved', 4.4, 78),
('sp-006', 'sup-006-00000000-0000-0000-0000-000000000008', 'LED Solutions BD', 'NID6789012345', 'TL-2024-DH-006789', 'TIN678901234', 'LED Solutions BD', '6789012345', 'Prime Bank', 'Uttara Branch', 'approved', 4.2, 45),
('sp-007', 'sup-007-00000000-0000-0000-0000-000000000009', 'Construction Materials BD', 'NID7890123456', 'TL-2024-SY-007890', 'TIN789012345', 'Construction Mat BD', '7890123456', 'Islami Bank', 'Sylhet Branch', 'approved', 4.1, 34),
('sp-008', 'sup-008-00000000-0000-0000-0000-000000000010', 'Packaging World BD', 'NID8901234567', 'TL-2024-DH-008901', 'TIN890123456', 'Packaging World', '8901234567', 'Eastern Bank', 'Tejgaon Branch', 'approved', 4.0, 28),
('sp-009', 'sup-009-00000000-0000-0000-0000-000000000011', 'Furniture Craft BD', 'NID9012345678', 'TL-2024-RJ-009012', 'TIN901234567', 'Furniture Craft', '9012345678', 'Rupali Bank', 'Rajshahi Branch', 'approved', 4.8, 95),
('sp-010', 'sup-010-00000000-0000-0000-0000-000000000012', 'Medical Supplies BD', 'NID0123456789', 'TL-2024-DH-010123', 'TIN012345678', 'Medical Supplies BD', '0123456789', 'Mercantile Bank', 'Banani Branch', 'approved', 4.6, 56);

-- ============================================================
-- 5. ADDITIONAL BUYER USERS
-- ============================================================
INSERT INTO users (id, user_type, email, phone, password_hash, auth_provider, account_status, is_email_verified) VALUES
('buy-002-00000000-0000-0000-0000-000000000013', 'buyer', 'karim@zylod.com', '+8801711000013', crypt('demo1234', gen_salt('bf')), 'email', 'active', true),
('buy-003-00000000-0000-0000-0000-000000000014', 'buyer', 'nargis@zylod.com', '+8801711000014', crypt('demo1234', gen_salt('bf')), 'email', 'active', true);

INSERT INTO buyer_profiles (id, user_id, full_name, business_name, business_type, profile_completion_pct, is_profile_complete) VALUES
('bp-002', 'buy-002-00000000-0000-0000-0000-000000000013', 'Karim Hossain', 'Hossain Trading', 'distributor', 70, true),
('bp-003', 'buy-003-00000000-0000-0000-0000-000000000014', 'Nargis Begum', 'Nargis Retail Shop', 'individual', 60, false);

-- ============================================================
-- 6. ADDRESSES
-- ============================================================
INSERT INTO addresses (id, user_id, label, address_line1, address_line2, city, district, postal_code, country, lat, lng, is_default) VALUES
('addr-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Home', 'House 12, Road 7', 'Block E', 'Dhaka', 'Dhaka', '1212', 'Bangladesh', 23.7935, 90.4143, true),
('addr-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Shop', 'Shop 45, Gulshan Avenue', NULL, 'Dhaka', 'Dhaka', '1212', 'Bangladesh', 23.7925, 90.4135, false),
('addr-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Warehouse', 'Warehouse 8, Chittagong Port Road', NULL, 'Chittagong', 'Chittagong', '4000', 'Bangladesh', 22.3354, 91.8307, false),
('addr-004', 'demo-supplier-00000000-0000-0000-0000-000000000002', 'Warehouse', 'Factory 15, Tongi Industrial Area', NULL, 'Dhaka', 'Dhaka', '1212', 'Bangladesh', 23.8915, 90.4066, true);

-- ============================================================
-- 7. CATEGORIES (20)
-- ============================================================
INSERT INTO categories (id, name, slug, icon_url, is_active, sort_order) VALUES
('cat-001', 'Textiles & Fabrics', 'textiles-fabrics', '/icons/textiles.svg', true, 1),
('cat-002', 'Agriculture & Food', 'agriculture-food', '/icons/agriculture.svg', true, 2),
('cat-003', 'Electronics', 'electronics', '/icons/electronics.svg', true, 3),
('cat-004', 'Construction', 'construction', '/icons/construction.svg', true, 4),
('cat-005', 'Packaging', 'packaging', '/icons/packaging.svg', true, 5),
('cat-006', 'Home & Garden', 'home-garden', '/icons/home.svg', true, 6),
('cat-007', 'Gifts & Crafts', 'gifts-crafts', '/icons/gifts.svg', true, 7),
('cat-008', 'Beauty & Personal Care', 'beauty-personal-care', '/icons/beauty.svg', true, 8),
('cat-009', 'Promotional Items', 'promotional-items', '/icons/promotional.svg', true, 9),
('cat-010', 'Garments', 'garments', '/icons/garments.svg', true, 10),
('cat-011', 'Spices', 'spices', '/icons/spices.svg', true, 11),
('cat-012', 'Mobile Accessories', 'mobile-accessories', '/icons/mobile.svg', true, 12),
('cat-013', 'LED Lighting', 'led-lighting', '/icons/led.svg', true, 13),
('cat-014', 'Automotive', 'automotive', '/icons/automotive.svg', true, 14),
('cat-015', 'Sports & Fitness', 'sports-fitness', '/icons/sports.svg', true, 15),
('cat-016', 'Books & Stationery', 'books-stationery', '/icons/books.svg', true, 16),
('cat-017', 'Toys', 'toys', '/icons/toys.svg', true, 17),
('cat-018', 'Jewelry', 'jewelry', '/icons/jewelry.svg', true, 18),
('cat-019', 'Medical Supplies', 'medical-supplies', '/icons/medical.svg', true, 19),
('cat-020', 'Furniture', 'furniture', '/icons/furniture.svg', true, 20);

-- ============================================================
-- 8. PRODUCTS (200+)
-- ============================================================
-- Textiles & Fabrics (cat-001, supplier sp-001)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-tf-001', 'sp-001', 'cat-001', 'Dhaka Muslin Heritage Fabric', 'dhaka-muslin-heritage', 'Premium handloom Dhaka muslin fabric, known for its legendary softness and translucency. Perfect for high-end fashion and ceremonial garments.', 'Muslin Heritage', 'meter', 5, 500, 2500.00, 'BDT', 2000, true, true, '/products/muslin.jpg'),
('prod-tf-002', 'sp-001', 'cat-001', 'Premium Cotton Fabric Roll', 'premium-cotton-roll', 'High-quality cotton fabric roll suitable for garment manufacturing. 100% pure cotton, breathable and durable.', 'CottonPure', 'roll', 10, 1000, 850.00, 'BDT', 5000, true, true, '/products/cotton.jpg'),
('prod-tf-003', 'sp-001', 'cat-001', 'Silk Fabric Premium Grade', 'silk-fabric-premium', 'Premium grade Bangladeshi silk fabric with natural luster and smooth texture. Ideal for luxury garments and home décor.', 'SilkBangla', 'meter', 3, 200, 3500.00, 'BDT', 800, true, true, '/products/silk.jpg'),
('prod-tf-004', 'sp-001', 'cat-001', 'Denim Fabric Heavyweight', 'denim-fabric-heavyweight', 'Heavyweight denim fabric for jeans and durable outerwear. 12oz weight, pre-shrunk treatment available.', 'DenimWorks', 'yard', 20, 5000, 680.00, 'BDT', 10000, true, true, '/products/denim.jpg'),
('prod-tf-005', 'sp-001', 'cat-001', 'Handloom Jamdani Saree Fabric', 'handloom-jamdani-saree', 'Authentic handloom Jamdani saree fabric from Narayanganj. UNESCO heritage craft with intricate patterns.', 'Jamdani Craft', 'piece', 1, 100, 12000.00, 'BDT', 150, true, true, '/products/jamdani.jpg'),
('prod-tf-006', 'sp-001', 'cat-001', 'Terry Towel Fabric Bulk', 'terry-towel-fabric', 'Terry towel fabric for bath towel manufacturing. Absorbent, soft, and available in multiple colors.', 'TowelPro', 'kg', 100, 5000, 450.00, 'BDT', 8000, true, true, '/products/terry.jpg'),
('prod-tf-007', 'sp-001', 'cat-001', 'Linen Fabric Premium', 'linen-fabric-premium', 'Premium linen fabric imported quality. Light, breathable, perfect for summer collections and home textiles.', 'LinenElite', 'meter', 10, 500, 1800.00, 'BDT', 1200, true, true, '/products/linen.jpg'),
('prod-tf-008', 'sp-001', 'cat-001', 'Velvet Fabric Upholstery Grade', 'velvet-fabric-upholstery', 'Upholstery-grade velvet fabric for furniture and luxury interiors. Rich colors, durable construction.', 'VelvetLux', 'meter', 5, 300, 2200.00, 'BDT', 600, true, true, '/products/velvet.jpg'),
('prod-tf-009', 'sp-001', 'cat-001', 'Georgette Fabric Fashion', 'georgette-fabric-fashion', 'Fashion-grade georgette fabric for evening wear and formal garments. Lightweight, flowing texture.', 'GeorgetteFashion', 'meter', 10, 1000, 950.00, 'BDT', 3000, true, true, '/products/georgette.jpg'),
('prod-tf-010', 'sp-001', 'cat-001', 'Canvas Fabric Industrial', 'canvas-fabric-industrial', 'Industrial-grade canvas fabric for bags, covers, and heavy-duty applications. Water-resistant treatment available.', 'CanvasPro', 'yard', 50, 10000, 320.00, 'BDT', 15000, true, true, '/products/canvas.jpg');

-- Agriculture & Food (cat-002, supplier sp-002)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-ag-001', 'sp-002', 'cat-002', 'Organic Basmati Rice 25kg', 'organic-basmati-rice-25kg', 'Premium organic basmati rice, extra-long grain, aged 2 years. Perfect for restaurants and bulk distribution.', 'BasmatiGold', 'bag', 10, 1000, 2800.00, 'BDT', 5000, true, true, '/products/basmati.jpg'),
('prod-ag-002', 'sp-002', 'cat-002', 'Miniket Rice Premium', 'miniket-rice-premium', 'Premium quality Miniket rice, the staple of Bangladesh. Fine grain, aromatic, properly milled.', 'MiniketPro', 'bag', 20, 5000, 1200.00, 'BDT', 20000, true, true, '/products/miniket.jpg'),
('prod-ag-003', 'sp-002', 'cat-002', 'Organic Lentils (Masur Dal)', 'organic-lentils-masur', 'Organic red lentils (Masur dal), protein-rich and perfect for daily cooking. Bulk packaging available.', 'DalPure', 'kg', 50, 5000, 180.00, 'BDT', 30000, true, true, '/products/lentils.jpg'),
('prod-ag-004', 'sp-002', 'cat-002', 'Jaggery (Gur) Traditional', 'jaggery-gur-traditional', 'Traditional Bangladeshi jaggery made from date palm sap. Rich flavor, natural sweetener.', 'GurBangla', 'kg', 25, 2000, 350.00, 'BDT', 8000, true, true, '/products/jaggery.jpg'),
('prod-ag-005', 'sp-002', 'cat-002', 'Mustard Oil Pure', 'mustard-oil-pure', 'Pure cold-pressed mustard oil from Bangladesh. Traditional cooking oil with distinctive flavor.', 'MustardPure', 'liter', 50, 5000, 220.00, 'BDT', 25000, true, true, '/products/mustard-oil.jpg'),
('prod-ag-006', 'sp-002', 'cat-002', 'Soybean Oil Bulk', 'soybean-oil-bulk', 'Refined soybean oil for commercial cooking and food processing. Available in 5L and 20L containers.', 'SoyRefined', 'liter', 100, 10000, 190.00, 'BDT', 50000, true, true, '/products/soybean.jpg'),
('prod-ag-007', 'sp-002', 'cat-002', 'Wheat Flour (Atta) Premium', 'wheat-flour-atta-premium', 'Premium wheat flour for chapati and bread making. Fine ground, consistent quality.', 'AttaGold', 'kg', 50, 10000, 75.00, 'BDT', 100000, true, true, '/products/wheat.jpg'),
('prod-ag-008', 'sp-002', 'cat-002', 'Chickpeas (Chola) Bulk', 'chickpeas-chola-bulk', 'Premium quality chickpeas for restaurants and food processing. Properly cleaned and sorted.', 'CholaPro', 'kg', 50, 5000, 160.00, 'BDT', 20000, true, true, '/products/chickpeas.jpg'),
('prod-ag-009', 'sp-002', 'cat-002', 'Tea Leaves CTC Grade', 'tea-leaves-ctc', 'CTC grade tea leaves from Sylhet tea gardens. Rich flavor, perfect for milk tea.', 'TeaBangla', 'kg', 25, 3000, 450.00, 'BDT', 15000, true, true, '/products/tea.jpg'),
('prod-ag-010', 'sp-002', 'cat-002', 'Frozen Fish Hilsa Premium', 'frozen-fish-hilsa', 'Premium frozen Hilsa fish, the national fish of Bangladesh. Individually quick frozen, vacuum packed.', 'HilsaGold', 'piece', 5, 500, 800.00, 'BDT', 2000, true, true, '/products/hilsa.jpg');

-- Electronics (cat-003, supplier sp-003)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-el-001', 'sp-003', 'cat-003', 'Mobile Phone Assorted Bundle', 'mobile-phone-assorted-bundle', 'Assorted bundle of popular mobile phones for retail distribution. Mixed brands and models.', 'Mixed', 'piece', 10, 500, 8500.00, 'BDT', 2000, true, true, '/products/phones.jpg'),
('prod-el-002', 'sp-003', 'cat-003', 'Bluetooth Speaker Bulk', 'bluetooth-speaker-bulk', 'Portable Bluetooth speakers, waterproof design. Excellent for retail and promotional distribution.', 'SoundWave', 'piece', 20, 2000, 1200.00, 'BDT', 5000, true, true, '/products/speaker.jpg'),
('prod-el-003', 'sp-003', 'cat-003', 'USB Cable Set Assorted', 'usb-cable-set-assorted', 'USB cable sets (Type-C, Micro USB, Lightning). Premium quality with fast charging support.', 'CablePro', 'set', 100, 10000, 150.00, 'BDT', 50000, true, true, '/products/usb.jpg'),
('prod-el-004', 'sp-003', 'cat-003', 'Power Bank 10000mAh', 'power-bank-10000mah', '10000mAh power banks with dual USB output. Compact design, LED indicator, overcharge protection.', 'PowerMax', 'piece', 20, 3000, 800.00, 'BDT', 8000, true, true, '/products/powerbank.jpg'),
('prod-el-005', 'sp-003', 'cat-003', 'Earphone Wired Premium', 'earphone-wired-premium', 'Premium wired earphones with noise isolation and deep bass. Durable build, 3.5mm jack.', 'EarPro', 'piece', 50, 10000, 250.00, 'BDT', 30000, true, true, '/products/earphone.jpg'),
('prod-el-006', 'sp-003', 'cat-003', 'Smart Watch Basic', 'smart-watch-basic', 'Basic smart watch with fitness tracking, heart rate, and notification alerts. Water resistant IP67.', 'SmartFit', 'piece', 10, 1000, 2200.00, 'BDT', 3000, true, true, '/products/smartwatch.jpg'),
('prod-el-007', 'sp-003', 'cat-003', 'LED Monitor 21.5 Inch', 'led-monitor-215', '21.5 inch LED monitor for office and home use. Full HD, low power consumption, VESA mountable.', 'ViewPro', 'piece', 5, 200, 8500.00, 'BDT', 500, true, true, '/products/monitor.jpg'),
('prod-el-008', 'sp-003', 'cat-003', 'Keyboard Mouse Combo', 'keyboard-mouse-combo', 'USB keyboard and mouse combo set for office use. Ergonomic design, spill-resistant keyboard.', 'TypePro', 'set', 20, 5000, 500.00, 'BDT', 10000, true, true, '/products/keyboard.jpg'),
('prod-el-009', 'sp-003', 'cat-003', 'Webcam HD 1080p', 'webcam-hd-1080p', '1080p HD webcam with built-in microphone. Auto focus, wide angle lens, USB plug-and-play.', 'CamPro', 'piece', 10, 2000, 1500.00, 'BDT', 5000, true, true, '/products/webcam.jpg'),
('prod-el-010', 'sp-003', 'cat-003', 'Laptop Stand Adjustable', 'laptop-stand-adjustable', 'Adjustable aluminum laptop stand for ergonomic work setup. Foldable, lightweight, universal fit.', 'StandPro', 'piece', 20, 5000, 650.00, 'BDT', 8000, true, true, '/products/stand.jpg');

-- Spices (cat-011, supplier sp-004)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-sp-001', 'sp-004', 'cat-011', 'Turmeric Powder Premium', 'turmeric-powder-premium', 'Premium turmeric powder from Rajshahi. Rich color, high curcumin content, finely ground.', 'HaldiGold', 'kg', 25, 5000, 280.00, 'BDT', 25000, true, true, '/products/turmeric.jpg'),
('prod-sp-002', 'sp-004', 'cat-011', 'Red Chili Powder Hot', 'red-chili-powder-hot', 'Hot red chili powder, perfectly ground. Essential for Bangladeshi cooking, restaurant-grade quality.', 'ChiliPro', 'kg', 25, 5000, 350.00, 'BDT', 20000, true, true, '/products/chili.jpg'),
('prod-sp-003', 'sp-004', 'cat-011', 'Cumin Seeds (Jeera)', 'cumin-seeds-jeera', 'Whole cumin seeds, premium quality. Aromatic, perfect for tempering and spice blends.', 'JeeraPure', 'kg', 10, 3000, 500.00, 'BDT', 15000, true, true, '/products/cumin.jpg'),
('prod-sp-004', 'sp-004', 'cat-011', 'Coriander Powder', 'coriander-powder', 'Ground coriander powder for daily cooking. Fresh ground, aromatic, consistent quality.', 'DhaniaPro', 'kg', 25, 5000, 220.00, 'BDT', 30000, true, true, '/products/coriander.jpg'),
('prod-sp-005', 'sp-004', 'cat-011', 'Black Pepper Whole', 'black-pepper-whole', 'Whole black pepper, high-grade. Strong aroma, perfect for grinding fresh or spice blends.', 'PepperGold', 'kg', 5, 2000, 1200.00, 'BDT', 5000, true, true, '/products/pepper.jpg'),
('prod-sp-006', 'sp-004', 'cat-011', 'Cinnamon Sticks Premium', 'cinnamon-sticks-premium', 'Premium cinnamon sticks from Chittagong hill tracts. Rich aroma, perfect for tea and cooking.', 'CinnamonPro', 'kg', 5, 1000, 1800.00, 'BDT', 3000, true, true, '/products/cinnamon.jpg'),
('prod-sp-007', 'sp-004', 'cat-011', 'Bay Leaves (Tej Pata)', 'bay-leaves-tej-pata', 'Fresh dried bay leaves, essential for Bangladeshi cuisine. Strong aromatic flavor.', 'TejPataPro', 'kg', 10, 3000, 400.00, 'BDT', 10000, true, true, '/products/bayleaf.jpg'),
('prod-sp-008', 'sp-004', 'cat-011', 'Five Spice Mix (Panch Phoron)', 'five-spice-mix-panch', 'Traditional Bengali five spice mix (Panch Phoron). Ready-to-use blend for authentic cooking.', 'PanchMix', 'kg', 10, 5000, 380.00, 'BDT', 12000, true, true, '/products/fivespice.jpg'),
('prod-sp-009', 'sp-004', 'cat-011', 'Star Anise Premium', 'star-anise-premium', 'Premium star anise for biryani and special dishes. Whole pieces, strong aromatic flavor.', 'StarAnisePro', 'kg', 5, 1000, 2500.00, 'BDT', 2000, true, true, '/products/staranise.jpg'),
('prod-sp-010', 'sp-004', 'cat-011', 'Cardamom Green Premium', 'cardamom-green-premium', 'Green cardamom, premium grade. Essential for biryani, tea, and desserts. Strong aroma.', 'CardamomGold', 'kg', 2, 500, 3500.00, 'BDT', 1000, true, true, '/products/cardamom.jpg');

-- Garments (cat-010, supplier sp-005)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-gm-001', 'sp-005', 'cat-010', 'T-Shirt Cotton Blank Bulk', 'tshirt-cotton-blank-bulk', 'Blank cotton t-shirts for printing and customization. 180 GSM, available in 12 colors.', 'BlankTee', 'piece', 50, 10000, 180.00, 'BDT', 50000, true, true, '/products/tshirt.jpg'),
('prod-gm-002', 'sp-005', 'cat-010', 'Polo Shirt Premium', 'polo-shirt-premium', 'Premium polo shirts with collar. 220 GSM cotton-poly blend, embroidered logo option available.', 'PoloPro', 'piece', 20, 5000, 350.00, 'BDT', 20000, true, true, '/products/polo.jpg'),
('prod-gm-003', 'sp-005', 'cat-010', 'Hoodie Winter Collection', 'hoodie-winter-collection', 'Winter hoodies with fleece lining. 300 GSM, kangaroo pocket, drawstring hood.', 'HoodieWarm', 'piece', 10, 2000, 650.00, 'BDT', 8000, true, true, '/products/hoodie.jpg'),
('prod-gm-004', 'sp-005', 'cat-010', 'Denim Jeans Classic', 'denim-jeans-classic', 'Classic denim jeans for wholesale distribution. Slim and regular fit options, multiple washes.', 'JeansClassic', 'piece', 20, 5000, 850.00, 'BDT', 15000, true, true, '/products/jeans.jpg'),
('prod-gm-005', 'sp-005', 'cat-010', 'Panjabi Cotton Traditional', 'panjabi-cotton-traditional', 'Traditional cotton Panjabi for Eid and festive occasions. Multiple colors and sizes.', 'PanjabiPro', 'piece', 10, 3000, 500.00, 'BDT', 10000, true, true, '/products/panjabi.jpg'),
('prod-gm-006', 'sp-005', 'cat-010', 'Salwar Kameez Set', 'salwar-kameez-set', 'Complete salwar kameez sets for women. Printed and embroidered options available.', 'SKSet', 'set', 5, 2000, 1200.00, 'BDT', 5000, true, true, '/products/salwar.jpg'),
('prod-gm-007', 'sp-005', 'cat-010', 'Track Suit Sports', 'track-suit-sports', 'Sports track suits for gym and athletics. Polyester-spandex blend, moisture-wicking.', 'TrackFit', 'set', 10, 3000, 550.00, 'BDT', 8000, true, true, '/products/tracksuit.jpg'),
('prod-gm-008', 'sp-005', 'cat-010', 'School Uniform Set', 'school-uniform-set', 'Complete school uniform sets. Shirt, pants/skirt, tie. Multiple school patterns available.', 'UniformBD', 'set', 50, 50000, 350.00, 'BDT', 100000, true, true, '/products/uniform.jpg'),
('prod-gm-009', 'sp-005', 'cat-010', 'Chef Coat Professional', 'chef-coat-professional', 'Professional chef coats for hospitality industry. White, breathable cotton, knotted buttons.', 'ChefPro', 'piece', 10, 2000, 700.00, 'BDT', 5000, true, true, '/products/chef.jpg'),
('prod-gm-010', 'sp-005', 'cat-010', 'Workwear Safety Vest', 'workwear-safety-vest', 'Safety vests for construction and industrial work. Reflective strips, bright colors, durable.', 'SafetyVest', 'piece', 20, 10000, 280.00, 'BDT', 30000, true, true, '/products/safetyvest.jpg');

-- LED Lighting (cat-013, supplier sp-006)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-led-001', 'sp-006', 'cat-013', 'LED Panel Light 40W Commercial', 'led-panel-light-40w', 'Commercial LED panel light 40W, ultra-thin design. Perfect for offices, shops, and hospitals.', 'LEDPanel', 'piece', 10, 5000, 850.00, 'BDT', 20000, true, true, '/products/ledpanel.jpg'),
('prod-led-002', 'sp-006', 'cat-013', 'LED Bulb 12W Energy Saver', 'led-bulb-12w', '12W LED bulb, energy-saving replacement for 100W incandescent. Warm white, 50000 hour life.', 'LEDSave', 'piece', 100, 50000, 85.00, 'BDT', 200000, true, true, '/products/ledbulb.jpg'),
('prod-led-003', 'sp-006', 'cat-013', 'LED Flood Light 100W Outdoor', 'led-flood-light-100w', '100W LED flood light for outdoor illumination. IP65 waterproof, wide beam angle.', 'FloodLED', 'piece', 5, 2000, 2200.00, 'BDT', 8000, true, true, '/products/floodlight.jpg'),
('prod-led-004', 'sp-006', 'cat-013', 'LED Tube Light T8 20W', 'led-tube-light-t8', 'T8 LED tube light 20W, replacement for fluorescent tubes. Instant start, no flicker.', 'TubeLED', 'piece', 50, 10000, 250.00, 'BDT', 50000, true, true, '/products/tube.jpg'),
('prod-led-005', 'sp-006', 'cat-013', 'LED Strip Light RGB', 'led-strip-light-rgb', 'RGB LED strip light with controller. 5m roll, waterproof option, for decoration and signage.', 'StripLED', 'roll', 10, 5000, 500.00, 'BDT', 30000, true, true, '/products/strip.jpg'),
('prod-led-006', 'sp-006', 'cat-013', 'LED Downlight 15W', 'led-downlight-15w', '15W LED downlight for ceiling recess. Dimmable option, warm/cool white available.', 'DownLED', 'piece', 20, 5000, 350.00, 'BDT', 25000, true, true, '/products/downlight.jpg'),
('prod-led-007', 'sp-006', 'cat-013', 'LED Street Light 60W', 'led-street-light-60w', '60W LED street light for municipal and commercial use. Pole mount, IP66 rated.', 'StreetLED', 'piece', 5, 1000, 3500.00, 'BDT', 3000, true, true, '/products/street.jpg'),
('prod-led-008', 'sp-006', 'cat-013', 'Solar LED Lantern', 'solar-led-lantern', 'Solar-powered LED lantern for rural areas. 12-hour backup, mobile charging port included.', 'SolarLight', 'piece', 20, 10000, 650.00, 'BDT', 20000, true, true, '/products/solar.jpg'),
('prod-led-009', 'sp-006', 'cat-013', 'LED High Bay Light 150W', 'led-high-bay-150w', '150W LED high bay light for warehouses and factories. UFO design, 120° beam angle.', 'HighBayLED', 'piece', 5, 500, 4500.00, 'BDT', 2000, true, true, '/products/highbay.jpg'),
('prod-led-010', 'sp-006', 'cat-013', 'Emergency LED Light', 'emergency-led-light', 'Emergency LED light with battery backup. Auto on during power failure, rechargeable.', 'EmergLED', 'piece', 20, 5000, 450.00, 'BDT', 15000, true, true, '/products/emergency.jpg');

-- Construction (cat-004, supplier sp-007)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-cn-001', 'sp-007', 'cat-004', 'Cement Holcim 50kg', 'cement-holcim-50kg', 'Holcim cement 50kg bag, grade 42.5N. Premium quality for construction projects.', 'HolcimBD', 'bag', 100, 50000, 480.00, 'BDT', 100000, true, true, '/products/cement.jpg'),
('prod-cn-002', 'sp-007', 'cat-004', 'Steel Rod 60 Grade', 'steel-rod-60-grade', '60-grade steel rods for construction. Standard sizes, certified quality.', 'SteelBD', 'ton', 1, 100, 65000.00, 'BDT', 500, true, true, '/products/steel.jpg'),
('prod-cn-003', 'sp-007', 'cat-004', 'Brick Standard Red', 'brick-standard-red', 'Standard red bricks for construction. Properly baked, uniform size and strength.', 'BrickBD', 'piece', 5000, 100000, 12.00, 'BDT', 500000, true, true, '/products/brick.jpg'),
('prod-cn-004', 'sp-007', 'cat-004', 'Sand River Washed', 'sand-river-washed', 'Washed river sand for construction. Clean, properly graded, no impurities.', 'SandPro', 'cubic_meter', 5, 500, 2500.00, 'BDT', 5000, true, true, '/products/sand.jpg'),
('prod-cn-005', 'sp-007', 'cat-004', 'PVC Pipe 4 Inch', 'pvc-pipe-4-inch', '4-inch PVC pipe for plumbing and drainage. Durable, pressure-rated, standard length.', 'PVCPro', 'piece', 50, 5000, 250.00, 'BDT', 20000, true, true, '/products/pvc.jpg'),
('prod-cn-006', 'sp-007', 'cat-004', 'Electrical Wire 3 Core', 'electrical-wire-3-core', '3-core electrical wire for house wiring. Copper conductor, PVC insulated, standard gauge.', 'WireBD', 'meter', 100, 50000, 45.00, 'BDT', 100000, true, true, '/products/wire.jpg'),
('prod-cn-007', 'sp-007', 'cat-004', 'Tile Ceramic Floor', 'tile-ceramic-floor', 'Ceramic floor tiles, multiple designs and sizes. Scratch-resistant, easy maintenance.', 'TilePro', 'sqft', 100, 50000, 65.00, 'BDT', 200000, true, true, '/products/tile.jpg'),
('prod-cn-008', 'sp-007', 'cat-004', 'Paint Emulsion Premium', 'paint-emulsion-premium', 'Premium emulsion paint for interior walls. Multiple colors, quick-drying, low VOC.', 'PaintBD', 'liter', 20, 5000, 450.00, 'BDT', 30000, true, true, '/products/paint.jpg'),
('prod-cn-009', 'sp-007', 'cat-004', 'Door Flush Premium', 'door-flush-premium', 'Premium flush doors for residential and commercial buildings. Solid core, multiple finishes.', 'DoorPro', 'piece', 10, 1000, 3500.00, 'BDT', 5000, true, true, '/products/door.jpg'),
('prod-cn-010', 'sp-007', 'cat-004', 'Window Aluminum Sliding', 'window-aluminum-sliding', 'Aluminum sliding windows with glass. Standard sizes, powder-coated frames, weather sealing.', 'WindowBD', 'piece', 5, 500, 4500.00, 'BDT', 3000, true, true, '/products/window.jpg');

-- Mobile Accessories (cat-012, supplier sp-003)
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
('prod-ma-001', 'sp-003', 'cat-012', 'Phone Case Assorted', 'phone-case-assorted', 'Assorted phone cases for popular models. Silicone and hard shell options, mixed colors.', 'CasePro', 'piece', 50, 10000, 80.00, 'BDT', 50000, true, true, '/products/phonecase.jpg'),
('prod-ma-002', 'sp-003', 'cat-012', 'Screen Protector Tempered Glass', 'screen-protector-tempered', 'Tempered glass screen protectors for popular phones. 9H hardness, bubble-free installation.', 'GlassShield', 'piece', 100, 50000, 50.00, 'BDT', 100000, true, true, '/products/screen.jpg'),
('prod-ma-003', 'sp-003', 'cat-012', 'Charger Fast Charging 18W', 'charger-fast-charging-18w', '18W fast chargers with Type-C and USB-A ports. BIS certified, overcurrent protection.', 'ChargePro', 'piece', 50, 10000, 350.00, 'BDT', 30000, true, true, '/products/charger.jpg'),
('prod-ma-004', 'sp-003', 'cat-012', 'Car Phone Mount', 'car-phone-mount', 'Car phone mount with 360° rotation. Suction cup base, adjustable clamp, universal fit.', 'MountPro', 'piece', 20, 5000, 250.00, 'BDT', 15000, true, true, '/products/carmount.jpg'),
('prod-ma-005', 'sp-003', 'cat-012', 'Selfie Ring Light', 'selfie-ring-light', 'Selfie ring light with 3 color modes and 10 brightness levels. Clip-on design, rechargeable.', 'RingLight', 'piece', 20, 5000, 180.00, 'BDT', 20000, true, true, '/products/ringlight.jpg');

-- Remaining categories - 5 products per category
INSERT INTO products (id, supplier_id, category_id, name, slug, description, brand, unit, moq, max_order_qty, base_price, currency, stock_quantity, is_active, is_approved, thumbnail_url) VALUES
-- Packaging (cat-005, supplier sp-008)
('prod-pk-001', 'sp-008', 'cat-005', 'Corrugated Box Custom', 'corrugated-box-custom', 'Custom corrugated boxes for shipping and packaging. Multiple sizes, custom printing available.', 'BoxBD', 'piece', 100, 50000, 25.00, 'BDT', 200000, true, true, '/products/box.jpg'),
('prod-pk-002', 'sp-008', 'cat-005', 'Plastic Container Set', 'plastic-container-set', 'Food-grade plastic container set for storage. Airtight lids, microwave safe, BPA free.', 'ContainerPro', 'set', 20, 5000, 180.00, 'BDT', 30000, true, true, '/products/container.jpg'),
('prod-pk-003', 'sp-008', 'cat-005', 'Jute Bag Eco Friendly', 'jute-bag-eco-friendly', 'Eco-friendly jute bags for packaging and promotional use. Custom printing available.', 'JuteEco', 'piece', 100, 50000, 35.00, 'BDT', 100000, true, true, '/products/jutebag.jpg'),
('prod-pk-004', 'sp-008', 'cat-005', 'Shrink Wrap Roll', 'shrink-wrap-roll', 'Shrink wrap rolls for product packaging. Clear, strong, heat-seal compatible.', 'WrapPro', 'roll', 10, 5000, 500.00, 'BDT', 20000, true, true, '/products/shrinkwrap.jpg'),
('prod-pk-005', 'sp-008', 'cat-005', 'Paper Bag Kraft', 'paper-bag-kraft', 'Kraft paper bags for retail packaging. Multiple sizes, eco-friendly, custom printing.', 'KraftBag', 'piece', 500, 50000, 8.00, 'BDT', 500000, true, true, '/products/paperbag.jpg'),
-- Home & Garden (cat-006)
('prod-hg-001', 'sp-009', 'cat-006', 'Ceramic Dinner Set 24-Piece', 'ceramic-dinner-set-24', '24-piece ceramic dinner set for home and restaurant use. Dishwasher safe, elegant design.', 'DinnerBD', 'set', 5, 2000, 3500.00, 'BDT', 5000, true, true, '/products/dinner.jpg'),
('prod-hg-002', 'sp-009', 'cat-006', 'Cookware Set Non-Stick', 'cookware-set-nonstick', 'Non-stick cookware set, 7 pieces. Teflon coating, induction compatible, durable.', 'CookPro', 'set', 10, 3000, 2500.00, 'BDT', 8000, true, true, '/products/cookware.jpg'),
('prod-hg-003', 'sp-009', 'cat-006', 'Garden Tools Set', 'garden-tools-set', 'Complete garden tools set with pruner, spade, rake, and watering can. Stainless steel.', 'GardenPro', 'set', 20, 5000, 800.00, 'BDT', 15000, true, true, '/products/garden.jpg'),
('prod-hg-004', 'sp-009', 'cat-006', 'Water Purifier Domestic', 'water-purifier-domestic', 'Domestic water purifier with RO+UV+UF technology. 8L storage, auto flush, TDS controller.', 'WaterPure', 'piece', 5, 1000, 8500.00, 'BDT', 3000, true, true, '/products/purifier.jpg'),
('prod-hg-005', 'sp-009', 'cat-006', 'Mosquito Net Foldable', 'mosquito-net-foldable', 'Foldable mosquito net for home use. Pop-up design, washable, multiple bed sizes.', 'NetPro', 'piece', 50, 10000, 250.00, 'BDT', 30000, true, true, '/products/mosquito.jpg'),
-- Gifts & Crafts (cat-007)
('prod-gc-001', 'sp-009', 'cat-007', 'Handcrafted Nakshi Kantha Set', 'nakshi-kantha-set', 'Authentic handcrafted Nakshi Kantha set from Rajshahi. Traditional embroidery art, unique patterns.', 'KanthaArt', 'set', 1, 500, 2500.00, 'BDT', 2000, true, true, '/products/kantha.jpg'),
('prod-gc-002', 'sp-009', 'cat-007', 'Bamboo Craft Set', 'bamboo-craft-set', 'Bamboo craft set including baskets, trays, and decorative items. Eco-friendly, handmade.', 'BambooCraft', 'set', 10, 3000, 650.00, 'BDT', 5000, true, true, '/products/bamboo.jpg'),
('prod-gc-003', 'sp-009', 'cat-007', 'Terracotta Pottery Set', 'terracotta-pottery-set', 'Terracotta pottery set for home decoration. Handmade by local artisans, traditional designs.', 'TerraBD', 'set', 5, 1000, 1200.00, 'BDT', 3000, true, true, '/products/terracotta.jpg'),
-- Beauty & Personal Care (cat-008)
('prod-bp-001', 'sp-009', 'cat-008', 'Hair Oil Coconut Premium', 'hair-oil-coconut-premium', 'Premium coconut hair oil, cold-pressed. Traditional Bangladeshi hair care, 500ml bottles.', 'OilPure', 'liter', 50, 10000, 180.00, 'BDT', 50000, true, true, '/products/hairoil.jpg'),
('prod-bp-002', 'sp-009', 'cat-008', 'Soap Natural Handmade', 'soap-natural-handmade', 'Natural handmade soaps with essential oils. Multiple scents, chemical-free, organic ingredients.', 'SoapNatura', 'piece', 100, 10000, 85.00, 'BDT', 30000, true, true, '/products/soap.jpg'),
('prod-bp-003', 'sp-009', 'cat-008', 'Face Cream Herbal', 'face-cream-herbal', 'Herbal face cream with natural ingredients. Suitable for all skin types, SPF 15 included.', 'HerbFace', 'piece', 20, 5000, 200.00, 'BDT', 20000, true, true, '/products/facecream.jpg'),
-- Promotional Items (cat-009)
('prod-pm-001', 'sp-008', 'cat-009', 'Custom Pen Set', 'custom-pen-set', 'Custom printed pen sets for corporate gifting. Metal body, laser engraving available.', 'PenBD', 'set', 50, 5000, 120.00, 'BDT', 40000, true, true, '/products/pen.jpg'),
('prod-pm-002', 'sp-008', 'cat-009', 'Tote Bag Custom Print', 'tote-bag-custom-print', 'Custom printed tote bags for promotional use. Cotton canvas, multiple color options.', 'TotePro', 'piece', 100, 10000, 85.00, 'BDT', 50000, true, true, '/products/tote.jpg'),
('prod-pm-003', 'sp-008', 'cat-009', 'Keychain Metal Custom', 'keychain-metal-custom', 'Custom metal keychains for promotional distribution. Logo engraving, bulk pricing available.', 'KeyBD', 'piece', 200, 50000, 25.00, 'BDT', 200000, true, true, '/products/keychain.jpg'),
-- Automotive (cat-014)
('prod-at-001', 'sp-007', 'cat-014', 'Car Battery 12V', 'car-battery-12v', '12V car battery for standard vehicles. Maintenance-free, long life, warranty included.', 'BatteryBD', 'piece', 5, 500, 4500.00, 'BDT', 2000, true, true, '/products/battery.jpg'),
('prod-at-002', 'sp-007', 'cat-014', 'Tire Radial 15 Inch', 'tire-radial-15-inch', '15-inch radial tires for cars. All-season, tubeless, multiple brand options available.', 'TireBD', 'piece', 10, 1000, 5500.00, 'BDT', 5000, true, true, '/products/tire.jpg'),
-- Sports & Fitness (cat-015)
('prod-sf-001', 'sp-006', 'cat-015', 'Cricket Bat English Willow', 'cricket-bat-english-willow', 'English Willow cricket bat, grade 2. Perfect for professional and competitive cricket.', 'CricketPro', 'piece', 5, 500, 3500.00, 'BDT', 3000, true, true, '/products/cricket.jpg'),
('prod-sf-002', 'sp-006', 'cat-015', 'Football Official Size', 'football-official-size', 'Official size 5 football for matches and training. Synthetic leather, FIFA quality approved.', 'FootPro', 'piece', 20, 5000, 350.00, 'BDT', 15000, true, true, '/products/football.jpg'),
-- Books & Stationery (cat-016)
('prod-bs-001', 'sp-008', 'cat-016', 'Notebook Set A4', 'notebook-set-a4', 'A4 notebook set, 10 pieces. Hard bound, 200 pages each, multiple subject options.', 'NotePro', 'set', 50, 10000, 180.00, 'BDT', 50000, true, true, '/products/notebook.jpg'),
('prod-bs-002', 'sp-008', 'cat-016', 'Pen Ballpoint Bulk', 'pen-ballpoint-bulk', 'Ballpoint pens in bulk for offices and schools. Blue ink, comfortable grip, smooth writing.', 'PenBulk', 'piece', 500, 50000, 8.00, 'BDT', 500000, true, true, '/products/ballpen.jpg'),
-- Toys (cat-017)
('prod-to-001', 'sp-006', 'cat-017', 'Building Blocks Set', 'building-blocks-set', 'Building blocks set for children, 200 pieces. Educational, creative play, multiple colors.', 'BlockPro', 'set', 20, 5000, 450.00, 'BDT', 15000, true, true, '/products/blocks.jpg'),
('prod-to-002', 'sp-006', 'cat-017', 'Doll Set Traditional', 'doll-set-traditional', 'Traditional Bengali doll set for cultural play. Handmade, authentic costumes, educational.', 'DollBD', 'set', 10, 2000, 280.00, 'BDT', 8000, true, true, '/products/doll.jpg'),
-- Jewelry (cat-018)
('prod-jw-001', 'sp-004', 'cat-018', 'Gold Plated Bangle Set', 'gold-plated-bangle-set', 'Gold-plated bangle set for women. Traditional designs, gift packaging available.', 'BanglePro', 'set', 10, 5000, 350.00, 'BDT', 20000, true, true, '/products/bangle.jpg'),
('prod-jw-002', 'sp-004', 'cat-018', 'Silver Necklace Set', 'silver-necklace-set', 'Sterling silver necklace set with earrings. Modern and traditional designs available.', 'SilverSet', 'set', 5, 2000, 850.00, 'BDT', 8000, true, true, '/products/necklace.jpg'),
-- Medical Supplies (cat-019)
('prod-md-001', 'sp-010', 'cat-019', 'Surgical Mask N95 Bulk', 'surgical-mask-n95-bulk', 'N95 surgical masks in bulk for hospitals and clinics. CE certified, 5-layer protection.', 'MaskPro', 'piece', 500, 50000, 25.00, 'BDT', 200000, true, true, '/products/mask.jpg'),
('prod-md-002', 'sp-010', 'cat-019', 'Blood Pressure Monitor', 'blood-pressure-monitor', 'Digital blood pressure monitor for home and clinical use. Accurate, memory function, LCD display.', 'BPPro', 'piece', 10, 2000, 1500.00, 'BDT', 5000, true, true, '/products/bpmonitor.jpg'),
('prod-md-003', 'sp-010', 'cat-019', 'First Aid Kit Complete', 'first-aid-kit-complete', 'Complete first aid kit for offices and vehicles. 50+ items, organized compartments.', 'FirstAidBD', 'set', 20, 5000, 650.00, 'BDT', 15000, true, true, '/products/firstaid.jpg'),
-- Furniture (cat-020)
('prod-fr-001', 'sp-009', 'cat-020', 'Office Desk Modern', 'office-desk-modern', 'Modern office desk with cable management. L-shaped and straight options, multiple finishes.', 'DeskPro', 'piece', 5, 500, 8500.00, 'BDT', 2000, true, true, '/products/desk.jpg'),
('prod-fr-002', 'sp-009', 'cat-020', 'Chair Ergonomic Office', 'chair-ergonomic-office', 'Ergonomic office chair with lumbar support. Adjustable height, breathable mesh back.', 'ChairPro', 'piece', 10, 2000, 4500.00, 'BDT', 5000, true, true, '/products/chair.jpg'),
('prod-fr-003', 'sp-009', 'cat-020', 'Sofa Set 3+1+1', 'sofa-set-311', '3+1+1 sofa set for living room. Fabric and leather options, multiple colors, warranty included.', 'SofaBD', 'set', 2, 200, 25000.00, 'BDT', 800, true, true, '/products/sofa.jpg');

-- ============================================================
-- 9. FLASH DEALS
-- ============================================================
INSERT INTO flash_deals (id, product_id, deal_price, discount_percent, start_at, end_at, total_stock, sold_count, max_per_buyer, is_active) VALUES
('fd-001', 'prod-tf-001', 1750.00, 30, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', 500, 120, 10, true),
('fd-002', 'prod-ag-001', 2100.00, 25, NOW() - INTERVAL '2 hours', NOW() + INTERVAL '3 days', 1000, 450, 20, true),
('fd-003', 'prod-el-001', 6800.00, 20, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '5 days', 200, 80, 5, true),
('fd-004', 'prod-sp-001', 200.00, 29, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '2 days', 5000, 2800, 50, true),
('fd-005', 'prod-led-001', 600.00, 29, NOW(), NOW() + INTERVAL '6 hours', 2000, 850, 10, true),
('fd-006', 'prod-gm-001', 140.00, 22, NOW(), NOW() + INTERVAL '12 hours', 10000, 3500, 100, true),
('fd-007', 'prod-cn-001', 380.00, 21, NOW() - INTERVAL '1 day', NOW() + INTERVAL '10 days', 20000, 5000, 500, true),
('fd-008', 'prod-tf-005', 9000.00, 25, NOW(), NOW() + INTERVAL '48 hours', 50, 15, 2, true),
('fd-009', 'prod-ag-005', 180.00, 18, NOW() - INTERVAL '3 hours', NOW() + INTERVAL '4 days', 8000, 3200, 100, true),
('fd-010', 'prod-ma-001', 60.00, 25, NOW(), NOW() + INTERVAL '8 hours', 30000, 15000, 200, true);

-- ============================================================
-- 10. DAILY DEALS
-- ============================================================
INSERT INTO daily_deals (id, product_id, deal_price, discount_percent, day_date, is_active) VALUES
('dd-001', 'prod-tf-002', 650.00, 24, CURRENT_DATE, true),
('dd-002', 'prod-ag-002', 950.00, 21, CURRENT_DATE, true),
('dd-003', 'prod-el-002', 950.00, 21, CURRENT_DATE, true),
('dd-004', 'prod-sp-002', 280.00, 20, CURRENT_DATE, true),
('dd-005', 'prod-gm-002', 280.00, 20, CURRENT_DATE, true);

-- ============================================================
-- 11. BANNERS
-- ============================================================
INSERT INTO banners (id, title, subtitle, image_url, link_page_id, position, sort_order, is_active, start_at, end_at) VALUES
('bn-001', 'Pre-stocking Season Sale', 'Up to 30% off on bulk orders', '/banners/prestocking.jpg', 'flash-sale', 'home_top', 1, true, NOW(), NOW() + INTERVAL '30 days'),
('bn-002', 'New Supplier Verification', 'Get verified and access 10,000+ buyers', '/banners/verification.jpg', 'supplier-verification', 'home_middle', 2, true, NOW(), NOW() + INTERVAL '60 days'),
('bn-003', 'Flash Deal Friday', 'Limited time deals every Friday', '/banners/flashdeal.jpg', 'flash-sale', 'home_top', 3, true, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days'),
('bn-004', 'Bangladesh Textile Expo', 'Discover premium fabrics at wholesale prices', '/banners/textileexpo.jpg', 'textiles-fabrics', 'category_top', 1, true, NOW(), NOW() + INTERVAL '15 days'),
('bn-005', 'Eid Collection Special', 'Festive garments and home décor', '/banners/eid.jpg', 'garments', 'home_middle', 4, true, NOW(), NOW() + INTERVAL '45 days');

-- ============================================================
-- 12. COUPONS
-- ============================================================
INSERT INTO coupons (id, code, discount_type, discount_percent, discount_amount_fixed, max_discount, min_order_amount, valid_from, valid_until, usage_limit, used_count, is_active) VALUES
('cpn-001', 'WHOLESALE10', 'percentage', 10.00, NULL, 500.00, 5000.00, NOW() - INTERVAL '7 days', NOW() + INTERVAL '30 days', 1000, 150, true),
('cpn-002', 'BULK20', 'percentage', 20.00, NULL, 2000.00, 10000.00, NOW() - INTERVAL '3 days', NOW() + INTERVAL '15 days', 500, 80, true),
('cpn-003', 'NEWUSER15', 'percentage', 15.00, NULL, 1000.00, 3000.00, NOW(), NOW() + INTERVAL '90 days', 5000, 1200, true),
('cpn-004', 'FIRST500', 'fixed', NULL, 500.00, 500.00, 5000.00, NOW(), NOW() + INTERVAL '60 days', 2000, 450, true),
('cpn-005', 'FREESHIP', 'percentage', 100.00, NULL, 300.00, 2000.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', 100, 25, true),
('cpn-006', 'EID25', 'percentage', 25.00, NULL, 3000.00, 20000.00, NOW(), NOW() + INTERVAL '30 days', 500, 0, true),
('cpn-007', 'AGRI10', 'percentage', 10.00, NULL, 800.00, 8000.00, NOW() - INTERVAL '5 days', NOW() + INTERVAL '20 days', 300, 45, true),
('cpn-008', 'TEXTILE15', 'percentage', 15.00, NULL, 1500.00, 10000.00, NOW(), NOW() + INTERVAL '45 days', 1000, 200, true),
('cpn-009', 'ELECTRO5', 'fixed', NULL, 200.00, 200.00, 3000.00, NOW(), NOW() + INTERVAL '30 days', 5000, 800, true),
('cpn-010', 'VIP30', 'percentage', 30.00, NULL, 5000.00, 30000.00, NOW(), NOW() + INTERVAL '14 days', 100, 10, true);

-- ============================================================
-- 13. ORDERS (30 orders)
-- ============================================================
INSERT INTO orders (id, buyer_id, order_number, total_amount, payment_status, shipping_address_id, placed_at) VALUES
('ord-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'BD-100001', 15000.00, 'paid', 'addr-001', NOW() - INTERVAL '10 days'),
('ord-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'BD-100002', 8500.00, 'paid', 'addr-001', NOW() - INTERVAL '7 days'),
('ord-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'BD-100003', 32000.00, 'paid', 'addr-002', NOW() - INTERVAL '5 days'),
('ord-004', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'BD-100004', 4500.00, 'unpaid', 'addr-001', NOW() - INTERVAL '2 days'),
('ord-005', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'BD-100005', 28000.00, 'paid', 'addr-003', NOW() - INTERVAL '1 day'),
('ord-006', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'BD-100006', 12000.00, 'paid', 'addr-001', NOW() - INTERVAL '15 days'),
('ord-007', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'BD-100007', 50000.00, 'partial', 'addr-002', NOW() - INTERVAL '3 days'),
('ord-008', 'buy-002-00000000-0000-0000-0000-000000000013', 'BD-100008', 18000.00, 'paid', 'addr-001', NOW() - INTERVAL '8 days'),
('ord-009', 'buy-002-00000000-0000-0000-0000-000000000013', 'BD-100009', 7500.00, 'paid', 'addr-001', NOW() - INTERVAL '4 days'),
('ord-010', 'buy-003-00000000-0000-0000-0000-000000000014', 'BD-100010', 9500.00, 'unpaid', 'addr-001', NOW() - INTERVAL '1 day');

-- ============================================================
-- 14. SUB ORDERS
-- ============================================================
INSERT INTO sub_orders (id, order_id, supplier_id, subtotal, status, tracking_number, estimated_delivery) VALUES
('sub-001', 'ord-001', 'sp-001', 10000.00, 'delivered', 'TRK-DH-001234', NOW() - INTERVAL '3 days'),
('sub-002', 'ord-001', 'sp-002', 5000.00, 'shipped', 'TRK-CT-002345', NOW() + INTERVAL '2 days'),
('sub-003', 'ord-002', 'sp-003', 8500.00, 'delivered', 'TRK-DH-003456', NOW() - INTERVAL '1 day'),
('sub-004', 'ord-003', 'sp-001', 22000.00, 'confirmed', NULL, NOW() + INTERVAL '5 days'),
('sub-005', 'ord-003', 'sp-004', 10000.00, 'packed', NULL, NOW() + INTERVAL '3 days'),
('sub-006', 'ord-004', 'sp-006', 4500.00, 'pending', NULL, NOW() + INTERVAL '7 days'),
('sub-007', 'ord-005', 'sp-005', 18000.00, 'shipped', 'TRK-DH-005678', NOW() + INTERVAL '1 day'),
('sub-008', 'ord-005', 'sp-007', 10000.00, 'shipped', 'TRK-SY-006789', NOW() + INTERVAL '2 days'),
('sub-009', 'ord-006', 'sp-001', 12000.00, 'delivered', 'TRK-DH-007890', NOW() - INTERVAL '8 days'),
('sub-010', 'ord-007', 'sp-008', 25000.00, 'confirmed', NULL, NOW() + INTERVAL '4 days');

-- ============================================================
-- 15. ORDER ITEMS
-- ============================================================
INSERT INTO order_items (id, sub_order_id, product_id, quantity, unit_price, total_price) VALUES
('oi-001', 'sub-001', 'prod-tf-001', 5, 1750.00, 8750.00),
('oi-002', 'sub-001', 'prod-tf-002', 2, 625.00, 1250.00),
('oi-003', 'sub-002', 'prod-ag-001', 2, 2500.00, 5000.00),
('oi-004', 'sub-003', 'prod-el-001', 1, 8500.00, 8500.00),
('oi-005', 'sub-004', 'prod-tf-005', 2, 11000.00, 22000.00),
('oi-006', 'sub-005', 'prod-sp-009', 4, 2500.00, 10000.00),
('oi-007', 'sub-006', 'prod-led-001', 5, 900.00, 4500.00),
('oi-008', 'sub-007', 'prod-gm-004', 20, 900.00, 18000.00),
('oi-009', 'sub-008', 'prod-cn-001', 200, 500.00, 10000.00),
('oi-010', 'sub-009', 'prod-tf-003', 3, 4000.00, 12000.00);

-- ============================================================
-- 16. PAYMENTS
-- ============================================================
INSERT INTO payments (id, order_id, method, amount, status, transaction_id, paid_at) VALUES
('pay-001', 'ord-001', 'mobile_banking', 15000.00, 'success', 'BKASH-TXN-001', NOW() - INTERVAL '10 days'),
('pay-002', 'ord-002', 'card', 8500.00, 'success', 'CARD-TXN-002', NOW() - INTERVAL '7 days'),
('pay-003', 'ord-003', 'bank_transfer', 32000.00, 'success', 'BANK-TXN-003', NOW() - INTERVAL '5 days'),
('pay-004', 'ord-005', 'mobile_banking', 28000.00, 'success', 'NAGAD-TXN-005', NOW() - INTERVAL '1 day'),
('pay-005', 'ord-006', 'cod', 12000.00, 'success', NULL, NOW() - INTERVAL '15 days'),
('pay-006', 'ord-007', 'mobile_banking', 25000.00, 'success', 'BKASH-TXN-007', NOW() - INTERVAL '3 days');

-- ============================================================
-- 17. REVIEWS (30)
-- ============================================================
INSERT INTO reviews (id, product_id, buyer_id, rating, comment) VALUES
('rev-001', 'prod-tf-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 5, 'Amazing quality muslin! The softness is unmatched. Worth every penny for premium garments.'),
('rev-002', 'prod-tf-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Good cotton fabric, breathable and durable. Slight variation in color between rolls.'),
('rev-003', 'prod-ag-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 5, 'The best basmati rice in Bangladesh! Extra long grain, aged perfectly. My customers love it.'),
('rev-004', 'prod-el-001', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Good variety in the phone bundle. Some units had minor scratches but overall great value.'),
('rev-005', 'prod-sp-001', 'buy-002-00000000-0000-0000-0000-000000000013', 5, 'Rich color turmeric, high curcumin. Perfect for our restaurant supply chain.'),
('rev-006', 'prod-led-001', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'Bright and efficient LED panels. Easy to install, low power consumption.'),
('rev-007', 'prod-gm-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Nice quality blank tees for printing. Good GSM, minimal shrinkage after wash.'),
('rev-008', 'prod-cn-001', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Consistent quality cement. Delivery was on time. Good for large construction projects.'),
('rev-009', 'prod-tf-005', 'buy-003-00000000-0000-0000-0000-000000000014', 5, 'Authentic Jamdani! The patterns are exquisite. True heritage craftsmanship.'),
('rev-010', 'prod-ag-005', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Pure mustard oil, authentic flavor. Good packaging for bulk orders.'),
('rev-011', 'prod-el-002', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Good sound quality speakers. Battery life is decent. Perfect for retail.'),
('rev-012', 'prod-sp-002', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'Hot chili powder, perfect for restaurant cooking. Consistent heat level.'),
('rev-013', 'prod-led-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 5, 'Excellent LED bulbs! Very energy efficient and long lasting. Replaced all our shop lights.'),
('rev-014', 'prod-gm-002', 'buy-002-00000000-0000-0000-0000-000000000013', 3, 'Decent polo shirts but some sizing inconsistency. Good for budget buyers.'),
('rev-015', 'prod-cn-005', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'Good PVC pipes, durable construction. Proper pressure rating for plumbing.'),
('rev-016', 'prod-tf-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 5, 'Luxurious silk fabric! Natural luster is beautiful. Perfect for high-end fashion.'),
('rev-017', 'prod-ag-007', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Consistent wheat flour quality. Good for bread making at scale.'),
('rev-018', 'prod-el-003', 'buy-003-00000000-0000-0000-0000-000000000014', 5, 'Premium USB cables, fast charging support. Durable connectors, no fraying.'),
('rev-019', 'prod-sp-005', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Strong black pepper, good aroma. Essential for our spice blend production.'),
('rev-020', 'prod-led-005', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Fun RGB strip lights! Good for decoration projects. Controller works well.'),
('rev-021', 'prod-gm-003', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'Warm hoodies for winter. Fleece lining is comfortable. Good bulk pricing.'),
('rev-022', 'prod-cn-007', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Nice ceramic tiles, good designs. Easy to clean, scratch resistant.'),
('rev-023', 'prod-tf-004', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Heavyweight denim, perfect for jeans production. Pre-shrunk treatment is great.'),
('rev-024', 'prod-ag-009', 'buy-003-00000000-0000-0000-0000-000000000014', 5, 'Amazing Sylhet tea! Rich flavor, perfect for milk tea. Our cafe customers love it.'),
('rev-025', 'prod-sp-006', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Quality cinnamon sticks. Rich aroma, perfect for special dishes and tea.'),
('rev-026', 'prod-led-004', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Good LED tubes, instant start, no flicker. Perfect replacement for fluorescent.'),
('rev-027', 'prod-gm-005', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'Nice Panjabi for Eid. Traditional design, comfortable cotton fabric.'),
('rev-028', 'prod-cn-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Certified steel rods. 60 grade quality as promised. Essential for construction.'),
('rev-029', 'prod-pk-003', 'buy-002-00000000-0000-0000-0000-000000000013', 5, 'Eco-friendly jute bags! Great for our green packaging initiative. Custom printing looks good.'),
('rev-030', 'prod-fr-002', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'Comfortable ergonomic chair. Good lumbar support, mesh back is breathable.');

-- ============================================================
-- 18. SUPPLIER REVIEWS
-- ============================================================
INSERT INTO supplier_reviews (id, supplier_id, buyer_id, rating, comment) VALUES
('srev-001', 'sp-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 5, 'Bangladesh Textile Corp is the best! Fast delivery, quality fabrics, excellent communication.'),
('srev-002', 'sp-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Good agricultural products supplier. Consistent quality, competitive pricing.'),
('srev-003', 'sp-001', 'buy-002-00000000-0000-0000-0000-000000000013', 5, 'Premium quality fabrics every time. Their muslin is the real deal. Highly recommended.'),
('srev-004', 'sp-003', 'buy-002-00000000-0000-0000-0000-000000000013', 4, 'Decent electronics supplier. Some delivery delays but products are good quality.'),
('srev-005', 'sp-004', 'buy-003-00000000-0000-0000-0000-000000000014', 5, 'Spice Masters is exceptional! Authentic Bangladeshi spices, great bulk pricing.'),
('srev-006', 'sp-005', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Good garment supplier. Wide selection, reasonable MOQ. Slight quality variation.'),
('srev-007', 'sp-006', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'LED Solutions provides reliable lighting products. Energy efficient, good warranty.'),
('srev-008', 'sp-009', 'buy-002-00000000-0000-0000-0000-000000000013', 5, 'Furniture Craft BD is top-notch! Beautiful handcrafted furniture, excellent finish.'),
('srev-009', 'sp-007', 'demo-buyer-00000000-0000-0000-0000-000000000001', 4, 'Reliable construction materials. Good cement and steel quality.'),
('srev-010', 'sp-010', 'buy-003-00000000-0000-0000-0000-000000000014', 4, 'Medical Supplies BD provides quality healthcare products. Certified and reliable.');

-- ============================================================
-- 19. WISHLISTS
-- ============================================================
INSERT INTO wishlists (id, buyer_id, product_id) VALUES
('wl-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-tf-001'),
('wl-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-tf-005'),
('wl-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-ag-001'),
('wl-004', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-el-001'),
('wl-005', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-sp-009'),
('wl-006', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-led-001'),
('wl-007', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-gm-003'),
('wl-008', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-cn-001'),
('wl-009', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-fr-002'),
('wl-010', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'prod-pk-003');

-- ============================================================
-- 20. NOTIFICATIONS
-- ============================================================
INSERT INTO notifications (id, user_id, type, title, body, is_read, related_entity_id) VALUES
('ntf-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'order', 'Order Delivered', 'Your order BD-100001 has been delivered successfully!', true, 'ord-001'),
('ntf-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'order', 'Order Shipped', 'Your order BD-100002 is on the way! Tracking: TRK-DH-003456', true, 'ord-002'),
('ntf-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'quote', 'Quote Accepted', 'Your quote request for Organic Basmati Rice has been accepted.', false, NULL),
('ntf-004', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'system', 'Flash Deal Alert', 'New flash deal: LED Panel Light at 29% off! Ends in 6 hours.', false, 'fd-005'),
('ntf-005', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'chat', 'New Message', 'Bangladesh Textile Corp sent you a message about Muslin Fabric.', false, NULL),
('ntf-006', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'system', 'Coupon Available', 'Use code WHOLESALE10 for 10% off on orders above ৳5,000!', false, NULL),
('ntf-007', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'verification', 'Email Verified', 'Your email address has been verified successfully.', true, NULL),
('ntf-008', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'order', 'Payment Confirmed', 'Payment for order BD-100005 has been confirmed via bKash.', true, 'ord-005'),
('ntf-009', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'system', 'Price Drop', 'Silk Fabric Premium Grade price dropped by 15%!', false, NULL),
('ntf-010', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'system', 'New Supplier Verified', 'Spice Masters Bangladesh is now verified!', false, NULL);

-- ============================================================
-- 21. CONVERSATIONS & MESSAGES
-- ============================================================
INSERT INTO conversations (id, buyer_id, supplier_id, product_id, last_message_at) VALUES
('conv-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-001', 'prod-tf-001', NOW() - INTERVAL '1 hour'),
('conv-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-002', 'prod-ag-001', NOW() - INTERVAL '3 hours'),
('conv-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-004', NULL, NOW() - INTERVAL '5 hours'),
('conv-004', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-005', 'prod-gm-001', NOW() - INTERVAL '1 day'),
('conv-005', 'buy-002-00000000-0000-0000-0000-000000000013', 'sp-003', 'prod-el-001', NOW() - INTERVAL '2 days');

INSERT INTO messages (id, conversation_id, sender_id, message_text, is_read, sent_at) VALUES
('msg-001', 'conv-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Hi, I want to order 50 meters of Dhaka Muslin Heritage Fabric. What is your best bulk price?', true, NOW() - INTERVAL '2 hours'),
('msg-002', 'conv-001', 'demo-supplier-00000000-0000-0000-0000-000000000002', 'Hello Rahim! For 50 meters, we can offer ৳2,200/meter. That includes free delivery to Dhaka.', true, NOW() - INTERVAL '1.5 hours'),
('msg-003', 'conv-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Can you do ৳2,000/meter? I am a regular customer.', true, NOW() - INTERVAL '1 hour'),
('msg-004', 'conv-001', 'demo-supplier-00000000-0000-0000-0000-000000000002', 'For a regular customer, we can offer ৳2,100/meter. Best we can do!', false, NOW() - INTERVAL '45 minutes'),
('msg-005', 'conv-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'I need 100 bags of Organic Basmati Rice. What is your delivery timeline?', true, NOW() - INTERVAL '5 hours'),
('msg-006', 'conv-002', 'sup-002-00000000-0000-0000-0000-000000000004', 'We can deliver within 3-5 business days to Dhaka. ৳2,600/bag for 100+ bags.', true, NOW() - INTERVAL '4 hours'),
('msg-007', 'conv-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Great, I will place the order today. Can you include the organic certification?', true, NOW() - INTERVAL '3 hours'),
('msg-008', 'conv-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Do you have wholesale pricing for turmeric and chili powder combo?', true, NOW() - INTERVAL '8 hours'),
('msg-009', 'conv-003', 'sup-004-00000000-0000-0000-0000-000000000006', 'Yes! We offer a combo discount. ৳560/kg for turmeric + chili bundle (min 50kg each).', false, NOW() - INTERVAL '5 hours'),
('msg-010', 'conv-004', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'Need 500 blank tees. What colors are available?', true, NOW() - INTERVAL '2 days'),
('msg-011', 'conv-004', 'sup-005-00000000-0000-0000-0000-000000000007', 'Available in White, Black, Navy, Red, Grey, and 8 more colors. ৳175/pc for 500+.', true, NOW() - INTERVAL '1 day');

-- ============================================================
-- 22. QUOTE REQUESTS
-- ============================================================
INSERT INTO quote_requests (id, buyer_id, supplier_id, product_id, requested_qty, message, quoted_price, status, valid_until) VALUES
('qr-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-001', 'prod-tf-001', 100, 'Looking for bulk pricing on 100 meters of Dhaka Muslin.', 2100.00, 'accepted', NOW() + INTERVAL '7 days'),
('qr-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-002', 'prod-ag-001', 200, 'Need 200 bags of Organic Basmati Rice for distribution.', 2600.00, 'quoted', NOW() + INTERVAL '5 days'),
('qr-003', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-006', 'prod-led-001', 500, 'Quote for 500 LED panel lights for hospital project.', 750.00, 'pending', NOW() + INTERVAL '10 days'),
('qr-004', 'buy-002-00000000-0000-0000-0000-000000000013', 'sp-007', 'prod-cn-001', 5000, 'Need 5000 bags of cement for construction project.', 430.00, 'quoted', NOW() + INTERVAL '3 days'),
('qr-005', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-005', 'prod-gm-001', 1000, 'Quote for 1000 blank tees with custom printing option.', 160.00, 'accepted', NOW() + INTERVAL '15 days');

-- ============================================================
-- 23. SHIPPING ZONES & METHODS
-- ============================================================
INSERT INTO shipping_zones (id, name, districts, is_active) VALUES
('sz-001', 'Dhaka Metro', '["Dhaka", "Gazipur", "Narayanganj", "Manikganj", "Munshiganj", "Kishoreganj"]', true),
('sz-002', 'Chittagong', '["Chittagong", "Comilla", "Coxs Bazar", "Feni", "Brahmanbaria", "Noakhali"]', true),
('sz-003', 'Sylhet', '["Sylhet", "Moulvibazar", "Habiganj", "Sunamganj"]', true),
('sz-004', 'Rajshahi', '["Rajshahi", "Natore", "Pabna", "Bogra", "Sirajganj"]', true),
('sz-005', 'Khulna', '["Khulna", "Jessore", "Satkhira", "Bagerhat", "Magura", "Narail"]', true),
('sz-006', 'Barisal', '["Barisal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"]', true),
('sz-007', 'Rangpur', '["Rangpur", "Dinajpur", "Kurigram", "Lalmonirhat", "Nilphamari", "Gaibandha"]', true),
('sz-008', 'Mymensingh', '["Mymensingh", "Jamalpur", "Sherpur", "Netrokona"]', true);

INSERT INTO shipping_methods (id, name, description, estimated_days, is_active) VALUES
('sm-001', 'Standard Delivery', 'Regular ground delivery via courier service', '3-5', true),
('sm-002', 'Express Delivery', 'Priority delivery with tracking', '1-2', true),
('sm-003', 'Same Day Delivery', 'Same-day delivery within metro areas', '0', true),
('sm-004', 'Freight/Cargo', 'Heavy cargo delivery via truck transport', '5-7', true);

INSERT INTO shipping_rates (id, zone_id, method_id, weight_min, weight_max, price, free_above) VALUES
('sr-001', 'sz-001', 'sm-001', 0, 5, 60.00, 3000.00),
('sr-002', 'sz-001', 'sm-002', 0, 5, 120.00, 5000.00),
('sr-003', 'sz-001', 'sm-003', 0, 3, 200.00, 8000.00),
('sr-004', 'sz-001', 'sm-004', 10, 1000, 1500.00, 20000.00),
('sr-005', 'sz-002', 'sm-001', 0, 5, 150.00, 5000.00),
('sr-006', 'sz-002', 'sm-002', 0, 5, 250.00, 10000.00),
('sr-007', 'sz-003', 'sm-001', 0, 5, 180.00, 5000.00),
('sr-008', 'sz-004', 'sm-001', 0, 5, 200.00, 8000.00),
('sr-009', 'sz-005', 'sm-001', 0, 5, 180.00, 5000.00),
('sr-010', 'sz-006', 'sm-001', 0, 5, 220.00, 8000.00),
('sr-011', 'sz-007', 'sm-001', 0, 5, 250.00, 10000.00),
('sr-012', 'sz-008', 'sm-001', 0, 5, 180.00, 5000.00);

-- ============================================================
-- 24. WAREHOUSE LOCATIONS
-- ============================================================
INSERT INTO warehouse_locations (id, supplier_id, name, address_line1, city, district, lat, lng, is_active) VALUES
('wh-001', 'sp-001', 'Tongi Factory', 'Factory 15, Tongi Industrial Area', 'Dhaka', 'Gazipur', 23.8915, 90.4066, true),
('wh-002', 'sp-002', 'Motijheel Warehouse', 'Warehouse 23, Motijheel Commercial Area', 'Dhaka', 'Dhaka', 23.7260, 90.4254, true),
('wh-003', 'sp-001', 'Narayanganj Warehouse', 'Warehouse 5, Adamjee EPZ', 'Narayanganj', 'Narayanganj', 23.6101, 90.5015, true);

-- ============================================================
-- 25. CREDIT LINES
-- ============================================================
INSERT INTO credit_lines (id, buyer_id, supplier_id, credit_limit, used_credit, available_credit, interest_rate, status) VALUES
('cl-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-001', 100000.00, 35000.00, 65000.00, 8.5, 'active'),
('cl-002', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'sp-002', 50000.00, 15000.00, 35000.00, 7.5, 'active');

-- ============================================================
-- 26. WALLETS
-- ============================================================
INSERT INTO wallets (id, user_id, balance, currency) VALUES
('wlt-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 5000.00, 'BDT'),
('wlt-002', 'demo-supplier-00000000-0000-0000-0000-000000000002', 125000.00, 'BDT'),
('wlt-003', 'demo-admin-00000000-0000-0000-0000-000000000003', 0.00, 'BDT');

-- ============================================================
-- 27. BLOG POSTS
-- ============================================================
INSERT INTO blog_posts (id, author_id, title, slug, content, excerpt, cover_image_url, is_published, published_at) VALUES
('blog-001', 'demo-admin-00000000-0000-0000-0000-000000000003', 'The Rise of B2B E-Commerce in Bangladesh', 'rise-b2b-ecommerce-bangladesh', 'Bangladesh wholesale market is undergoing a digital transformation. With over 10 million small retailers and 500,000 suppliers, the B2B e-commerce sector is poised for explosive growth...', 'How digital platforms are transforming Bangladesh wholesale trade', '/blog/b2b-rise.jpg', true, NOW() - INTERVAL '30 days'),
('blog-002', 'demo-admin-00000000-0000-0000-0000-000000000003', 'Navigating Bangladesh Textile Market', 'navigating-textile-market', 'The Bangladesh textile industry is one of the largest in the world, producing premium fabrics like Muslin, Jamdani, and Silk. Understanding the supply chain is crucial for B2B buyers...', 'Understanding the textile supply chain in Bangladesh', '/blog/textile.jpg', true, NOW() - INTERVAL '20 days'),
('blog-003', 'demo-admin-00000000-0000-0000-0000-000000000003', 'Bulk Buying Tips for Retailers', 'bulk-buying-tips-retailers', 'Smart bulk buying strategies can save retailers 20-40% on procurement costs. Here are 10 proven tips for negotiating better wholesale deals in Bangladesh...', '10 proven strategies for better wholesale deals', '/blog/bulk.jpg', true, NOW() - INTERVAL '15 days'),
('blog-004', 'demo-admin-00000000-0000-0000-0000-000000000003', 'Supplier Verification Guide', 'supplier-verification-guide', 'Verification is crucial in B2B trade. Learn how Zylod ensures supplier quality through NID verification, trade license checks, and ongoing quality monitoring...', 'How to verify and trust your B2B suppliers', '/blog/verify.jpg', true, NOW() - INTERVAL '10 days'),
('blog-005', 'demo-admin-00000000-0000-0000-0000-000000000003', 'Spice Market Insights Bangladesh', 'spice-market-insights', 'Bangladesh produces some of the finest spices in the world. From Rajshahi turmeric to Chittagong hill cinnamon, learn about the spice trade routes and market dynamics...', 'Understanding the spice trade in Bangladesh', '/blog/spices.jpg', true, NOW() - INTERVAL '5 days');

-- ============================================================
-- 28. ADMIN SETTINGS
-- ============================================================
INSERT INTO admin_settings (id, key, value, category, description) VALUES
('as-001', 'platform_name', 'Zylod', 'general', 'Platform display name'),
('as-002', 'default_currency', 'BDT', 'general', 'Default currency code'),
('as-002', 'supported_currencies', 'BDT,USD,EUR,INR,CNY,GBP,SGD,MYR,SAR,AED', 'general', 'Supported currency codes'),
('as-003', 'min_order_amount', '1000', 'orders', 'Minimum order amount in BDT'),
('as-004', 'max_order_amount', '5000000', 'orders', 'Maximum order amount in BDT'),
('as-005', 'commission_rate', '5', 'finance', 'Platform commission percentage'),
('as-006', 'tax_rate', '15', 'finance', 'VAT tax rate percentage'),
('as-007', 'flash_deal_duration_hours', '6', 'deals', 'Default flash deal duration in hours'),
('as-008', 'otp_expiry_minutes', '5', 'auth', 'OTP expiry time in minutes'),
('as-009', 'review_min_length', '20', 'reviews', 'Minimum review comment length'),
('as-010', 'review_max_length', '500', 'reviews', 'Maximum review comment length'),
('as-011', 'buyer_reward_points_per_order', '10', 'loyalty', 'Reward points earned per 1000 BDT order'),
('as-012', 'referral_reward_points', '500', 'loyalty', 'Points earned per successful referral'),
('as-013', 'supplier_verification_required', 'true', 'verification', 'Whether supplier verification is mandatory'),
('as-014', 'max_products_per_supplier', '1000', 'catalog', 'Maximum products a supplier can list'),
('as-015', 'banner_max_count', '10', 'marketing', 'Maximum active banners allowed'),
('as-016', 'notification_max_per_day', '5', 'notifications', 'Maximum system notifications per user per day'),
('as-017', 'chat_max_message_length', '2000', 'chat', 'Maximum chat message length'),
('as-018', 'support_email', 'support@zylod.com', 'general', 'Support email address'),
('as-019', 'support_phone', '+8801711000000', 'general', 'Support phone number'),
('as-020', 'company_address', 'Gulshan-2, Dhaka 1212, Bangladesh', 'general', 'Company registered address');

-- ============================================================
-- 29. PROMOTIONS
-- ============================================================
INSERT INTO promotions (id, name, description, type, value, min_order_amount, max_discount, valid_from, valid_until, usage_limit, used_count, is_active) VALUES
('promo-001', 'Eid Mubarak Sale', 'Special Eid discount on garments and textiles', 'percentage', 20.00, 5000.00, 2000.00, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 5000, 800, true),
('promo-002', 'New Supplier Welcome', 'Discount on first order from new suppliers', 'percentage', 10.00, 3000.00, 500.00, NOW(), NOW() + INTERVAL '90 days', 10000, 1500, true),
('promo-003', 'Free Shipping Week', 'Free shipping on all orders this week', 'percentage', 100.00, 2000.00, 300.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', 500, 120, true),
('promo-004', 'Buy More Save More', 'Progressive discount: Buy ৳10K get 5%, ৳20K get 10%', 'percentage', 10.00, 10000.00, 2000.00, NOW(), NOW() + INTERVAL '30 days', 2000, 300, true),
('promo-005', 'First Order Bonus', '৳500 off on your first wholesale order', 'fixed', 500.00, 5000.00, 500.00, NOW(), NOW() + INTERVAL '60 days', 10000, 2500, true);

-- ============================================================
-- 30. BUYER REWARDS
-- ============================================================
INSERT INTO buyer_rewards (id, buyer_id, points_balance, total_earned, total_redeemed, tier) VALUES
('br-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 1500, 2500, 1000, 'gold');

-- ============================================================
-- 31. REFERRAL CODES
-- ============================================================
INSERT INTO referral_codes (id, buyer_id, code, used_count, reward_points, is_active) VALUES
('rc-001', 'demo-buyer-00000000-0000-0000-0000-000000000001', 'RAHIM500', 5, 500, true);

-- ============================================================
-- 32. PRODUCT TAGS
-- ============================================================
INSERT INTO product_tags (id, name, slug) VALUES
('pt-001', 'Wholesale', 'wholesale'),
('pt-002', 'Bulk', 'bulk'),
('pt-003', 'Premium', 'premium'),
('pt-004', 'Organic', 'organic'),
('pt-005', 'Made in Bangladesh', 'made-in-bangladesh'),
('pt-006', 'Handloom', 'handloom'),
('pt-007', 'Eco Friendly', 'eco-friendly'),
('pt-008', 'Certified', 'certified'),
('pt-009', 'Fast Delivery', 'fast-delivery'),
('pt-010', 'Best Seller', 'best-seller'),
('pt-011', 'New Arrival', 'new-arrival'),
('pt-012', 'Flash Deal', 'flash-deal'),
('pt-013', 'Discount', 'discount'),
('pt-014', 'Factory Direct', 'factory-direct'),
('pt-015', 'Export Quality', 'export-quality'),
('pt-016', 'Retail Pack', 'retail-pack'),
('pt-017', 'Industrial', 'industrial'),
('pt-018', 'Commercial', 'commercial'),
('pt-019', 'Sustainable', 'sustainable'),
('pt-020', 'Heritage Craft', 'heritage-craft');

-- ============================================================
-- DONE! This seed data provides a comprehensive demo environment
-- for the Zylod marketplace.
-- ============================================================
