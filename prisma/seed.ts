import { db } from '../src/lib/db'
import { hash } from 'bcryptjs'

const SALT_ROUNDS = 10

async function main() {
  console.log('🧹 Cleaning existing data...')

  // Truncate all public tables (resets identities, cascades to dependents)
  await db.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations') LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename);
      END LOOP;
    END $$;
  `)

  console.log('✅ Database cleaned')

  // ============================================================
  // 1. Categories (15+)
  // ============================================================
  console.log('📂 Seeding categories...')

  const categoriesData = [
    { name: 'Textiles & Fabrics', nameBn: 'টেক্সটাইল ও ফ্যাব্রিক', slug: 'textiles-fabrics', iconUrl: '/icons/textiles.svg', sortOrder: 1 },
    { name: 'Agriculture & Food', nameBn: 'কৃষি ও খাদ্য', slug: 'agriculture-food', iconUrl: '/icons/agriculture.svg', sortOrder: 2 },
    { name: 'Electronics', nameBn: 'ইলেকট্রনিক্স', slug: 'electronics', iconUrl: '/icons/electronics.svg', sortOrder: 3 },
    { name: 'Construction & Hardware', nameBn: 'নির্মাণ ও হার্ডওয়্যার', slug: 'construction-hardware', iconUrl: '/icons/construction.svg', sortOrder: 4 },
    { name: 'Packaging & Printing', nameBn: 'প্যাকেজিং ও প্রিন্টিং', slug: 'packaging-printing', iconUrl: '/icons/packaging.svg', sortOrder: 5 },
    { name: 'Home & Garden', nameBn: 'গৃহ ও বাগান', slug: 'home-garden', iconUrl: '/icons/home.svg', sortOrder: 6 },
    { name: 'Gifts & Crafts', nameBn: 'উপহার ও শিল্প', slug: 'gifts-crafts', iconUrl: '/icons/gifts.svg', sortOrder: 7 },
    { name: 'Beauty & Personal Care', nameBn: 'সৌন্দর্য ও ব্যক্তিগত যত্ন', slug: 'beauty-personal-care', iconUrl: '/icons/beauty.svg', sortOrder: 8 },
    { name: 'Promotional Items', nameBn: 'প্রমোশনাল আইটেম', slug: 'promotional-items', iconUrl: '/icons/promo.svg', sortOrder: 9 },
    { name: 'Automotive & Transport', nameBn: 'অটোমোটিভ ও পরিবহন', slug: 'automotive-transport', iconUrl: '/icons/automotive.svg', sortOrder: 10 },
    { name: 'Health & Medical', nameBn: 'স্বাস্থ্য ও চিকিৎসা', slug: 'health-medical', iconUrl: '/icons/health.svg', sortOrder: 11 },
    { name: 'Mobile Accessories', nameBn: 'মোবাইল এক্সেসরিজ', slug: 'mobile-accessories', iconUrl: '/icons/mobile.svg', sortOrder: 12 },
    { name: 'LED & Lighting', nameBn: 'এলইডি ও লাইটিং', slug: 'led-lighting', iconUrl: '/icons/lighting.svg', sortOrder: 13 },
    { name: 'Spices & Condiments', nameBn: 'মশলা ও আচার', slug: 'spices-condiments', iconUrl: '/icons/spices.svg', sortOrder: 14 },
    { name: 'Garments & Apparel', nameBn: 'পোশাক ও পরিধেয়', slug: 'garments-apparel', iconUrl: '/icons/garments.svg', sortOrder: 15 },
    { name: 'Jute & Jute Products', nameBn: 'পাট ও পাটজাত দ্রব্য', slug: 'jute-products', iconUrl: '/icons/jute.svg', sortOrder: 16 },
    { name: 'Leather & Footwear', nameBn: 'চামড়া ও �জুতা', slug: 'leather-footwear', iconUrl: '/icons/leather.svg', sortOrder: 17 },
  ]

  const categories = await db.$transaction(
    categoriesData.map((cat) =>
      db.categories.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          iconUrl: cat.iconUrl,
          isActive: true,
          sortOrder: cat.sortOrder,
        },
      })
    )
  )

  console.log(`  ✅ Created ${categories.length} categories`)

  // Category lookup helper
  const categoryMap = new Map<string, string>()
  categoriesData.forEach((cat, i) => {
    categoryMap.set(cat.slug, categories[i].id)
  })

  // ============================================================
  // 2. Users & Supplier Profiles
  // ============================================================
  console.log('👥 Seeding users & suppliers...')

  const passwordHash = await hash('admin123', SALT_ROUNDS)
  const buyerPasswordHash = await hash('buyer123', SALT_ROUNDS)
  const supplierPasswordHash = await hash('supplier123', SALT_ROUNDS)

  // Admin user
  const adminUser = await db.users.create({
    data: {
      userType: 'admin',
      email: 'admin@zylod.com',
      phone: '+8801700000001',
      passwordHash,
      authProvider: 'email',
      accountStatus: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  })

  // Buyer users
  const buyerUsers = await db.$transaction(
    [
      { email: 'buyer1@zylod.com', phone: '+8801710000001', name: 'Karim Hossain', business: 'Karim General Store', type: 'retailer' },
      { email: 'buyer2@zylod.com', phone: '+8801710000002', name: 'Fatima Begum', business: 'Fatima Trading Co.', type: 'wholesaler' },
      { email: 'buyer3@zylod.com', phone: '+8801710000003', name: 'Rafiq Ahmed', business: 'Rafiq Distributors', type: 'distributor' },
    ].map((b) =>
      db.users.create({
        data: {
          userType: 'buyer',
          email: b.email,
          phone: b.phone,
          passwordHash: buyerPasswordHash,
          authProvider: 'email',
          accountStatus: 'active',
          isEmailVerified: true,
          isPhoneVerified: true,
        },
      })
    )
  )

  // Buyer profiles
  const buyerProfilesData = [
    { userId: buyerUsers[0].id, fullName: 'Karim Hossain', businessName: 'Karim General Store', businessType: 'retailer' },
    { userId: buyerUsers[1].id, fullName: 'Fatima Begum', businessName: 'Fatima Trading Co.', businessType: 'wholesaler' },
    { userId: buyerUsers[2].id, fullName: 'Rafiq Ahmed', businessName: 'Rafiq Distributors', businessType: 'distributor' },
  ]
  await db.$transaction(
    buyerProfilesData.map((bp) =>
      db.buyerProfiles.create({
        data: {
          userId: bp.userId,
          fullName: bp.fullName,
          businessName: bp.businessName,
          businessType: bp.businessType,
          profileCompletionPct: 80,
          isProfileComplete: true,
        },
      })
    )
  )

  console.log('  ✅ Created admin + 3 buyer users')

  // Supplier data
  const suppliersData = [
    { companyName: 'Dhaka Textile Mills', city: 'Dhaka', district: 'Dhaka', phone: '+8801810000001', address: '23/1 Tejgaon Industrial Area, Tejgaon', nid: '1990123456781', rating: 4.7 },
    { companyName: 'Chittagong Seafoods Ltd', city: 'Chittagong', district: 'Chittagong', phone: '+8801810000002', address: '45 Fish Harbor Road, Sadarghat', nid: '1990123456782', rating: 4.5 },
    { companyName: 'Rajshahi Silk House', city: 'Rajshahi', district: 'Rajshahi', phone: '+8801810000003', address: '12 Silk Road, Sopura', nid: '1990123456783', rating: 4.8 },
    { companyName: 'Gulshan Electronics', city: 'Dhaka', district: 'Dhaka', phone: '+8801810000004', address: '78 Gulshan Avenue, Gulshan-2', nid: '1990123456784', rating: 4.3 },
    { companyName: 'Sylhet Tea Gardens', city: 'Sylhet', district: 'Sylhet', phone: '+8801810000005', address: '56 Surma Valley, Beanibazar', nid: '1990123456785', rating: 4.6 },
    { companyName: 'Khulna Shipbuilding Materials', city: 'Khulna', district: 'Khulna', phone: '+8801810000006', address: '34 Naval Road, Sonadanga', nid: '1990123456786', rating: 4.2 },
    { companyName: 'Narayanganj Garments', city: 'Narayanganj', district: 'Narayanganj', phone: '+8801810000007', address: '89 Fatullah Road, Fatullah', nid: '1990123456787', rating: 4.9 },
    { companyName: 'Comilla Agro Industries', city: 'Comilla', district: 'Comilla', phone: '+8801810000008', address: '22 Laksham Road, Kotbari', nid: '1990123456788', rating: 4.4 },
    { companyName: 'Bogra Rice Mills', city: 'Bogra', district: 'Bogra', phone: '+8801810000009', address: '15 Satmatha Road, Bogra Sadar', nid: '1990123456789', rating: 4.6 },
    { companyName: 'Barisal Fish Processing', city: 'Barisal', district: 'Barisal', phone: '+8801810000010', address: '67 Kaunia Road, Barisal Sadar', nid: '1990123456790', rating: 4.1 },
    { companyName: 'Rangpur Jute Products', city: 'Rangpur', district: 'Rangpur', phone: '+8801810000011', address: '33 Haragach Road, Rangpur Sadar', nid: '1990123456791', rating: 4.3 },
    { companyName: 'Mymensingh Cotton', city: 'Mymensingh', district: 'Mymensingh', phone: '+8801810000012', address: '18 Trishal Road, Kewatkhali', nid: '1990123456792', rating: 4.5 },
    { companyName: 'CoxBazar Salt Industries', city: "Cox's Bazar", district: "Cox's Bazar", phone: '+8801810000013', address: '90 Marine Drive, Teknaf', nid: '1990123456793', rating: 4.0 },
    { companyName: 'Tangail Saree House', city: 'Tangail', district: 'Tangail', phone: '+8801810000014', address: '44 Basail Road, Tangail Sadar', nid: '1990123456794', rating: 4.7 },
    { companyName: 'Jessore Poultry Feed', city: 'Jessore', district: 'Jessore', phone: '+8801810000015', address: '27 Benapole Road, Chaugachha', nid: '1990123456795', rating: 4.2 },
    { companyName: 'Dinajpur Wheat Processors', city: 'Dinajpur', district: 'Dinajpur', phone: '+8801810000016', address: '51 Birganj Road, Dinajpur Sadar', nid: '1990123456796', rating: 4.4 },
    { companyName: 'Faridpur Leather Works', city: 'Faridpur', district: 'Faridpur', phone: '+8801810000017', address: '36 Bhanga Road, Faridpur Sadar', nid: '1990123456797', rating: 4.3 },
    { companyName: 'Kushtia Betel Nut Traders', city: 'Kushtia', district: 'Kushtia', phone: '+8801810000018', address: '19 Kumarkhali Road, Kushtia Sadar', nid: '1990123456798', rating: 4.1 },
    { companyName: 'Pabna Dairy Farm', city: 'Pabna', district: 'Pabna', phone: '+8801810000019', address: '72 Ishwardi Road, Pabna Sadar', nid: '1990123456799', rating: 4.5 },
    { companyName: 'Manikganj Brick Fields', city: 'Manikganj', district: 'Manikganj', phone: '+8801810000020', address: '58 Saturia Road, Manikganj Sadar', nid: '1990123456800', rating: 4.0 },
  ]

  // Create supplier users (first 2 will be linked to demo accounts)
  const supplierUsers = await db.$transaction(
    suppliersData.map((s) =>
      db.users.create({
        data: {
          userType: 'supplier',
          email: `${s.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}@zylod.com`,
          phone: s.phone,
          passwordHash: supplierPasswordHash,
          authProvider: 'email',
          accountStatus: 'active',
          isEmailVerified: true,
          isPhoneVerified: true,
        },
      })
    )
  )

  // Also create 2 demo supplier accounts that are easier to remember
  const demoSupplier1 = await db.users.create({
    data: {
      userType: 'supplier',
      email: 'supplier1@zylod.com',
      phone: '+8801720000001',
      passwordHash: supplierPasswordHash,
      authProvider: 'email',
      accountStatus: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  })

  const demoSupplier2 = await db.users.create({
    data: {
      userType: 'supplier',
      email: 'supplier2@zylod.com',
      phone: '+8801720000002',
      passwordHash: supplierPasswordHash,
      authProvider: 'email',
      accountStatus: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  })

  // Create addresses for suppliers
  const supplierAddresses = await db.$transaction(
    suppliersData.map((s, i) =>
      db.addresses.create({
        data: {
          userId: supplierUsers[i].id,
          label: 'Warehouse',
          addressLine1: s.address,
          addressLine2: `${s.city}, ${s.district}`,
          city: s.city,
          district: s.district,
          postalCode: `${1000 + i}`,
          country: 'Bangladesh',
          isDefault: true,
        },
      })
    )
  )

  // Demo supplier addresses
  const demoAddr1 = await db.addresses.create({
    data: {
      userId: demoSupplier1.id,
      label: 'Warehouse',
      addressLine1: '23/1 Tejgaon Industrial Area, Tejgaon',
      addressLine2: 'Dhaka, Dhaka',
      city: 'Dhaka',
      district: 'Dhaka',
      postalCode: '1208',
      country: 'Bangladesh',
      isDefault: true,
    },
  })

  const demoAddr2 = await db.addresses.create({
    data: {
      userId: demoSupplier2.id,
      label: 'Warehouse',
      addressLine1: '89 Fatullah Road, Fatullah',
      addressLine2: 'Narayanganj, Narayanganj',
      city: 'Narayanganj',
      district: 'Narayanganj',
      postalCode: '1400',
      country: 'Bangladesh',
      isDefault: true,
    },
  })

  // Create supplier profiles
  const supplierProfiles = await db.$transaction(
    suppliersData.map((s, i) =>
      db.supplierProfiles.create({
        data: {
          userId: supplierUsers[i].id,
          companyName: s.companyName,
          nidNumber: s.nid,
          nidFrontImageUrl: `/images/suppliers/nid-front-${i + 1}.jpg`,
          nidBackImageUrl: `/images/suppliers/nid-back-${i + 1}.jpg`,
          tradeLicenseNumber: `TL-${String(2024000 + i).padStart(7, '0')}`,
          tradeLicenseImageUrl: `/images/suppliers/trade-license-${i + 1}.jpg`,
          tinNumber: `TIN-${String(1000000 + i).padStart(9, '0')}`,
          bankAccountName: s.companyName,
          bankAccountNumber: `${1000000000 + i}`,
          bankName: 'Dutch-Bangla Bank Ltd',
          branch: s.city,
          warehouseAddressId: supplierAddresses[i].id,
          verificationStatus: i < 15 ? 'approved' : 'pending',
          verifiedBy: adminUser.id,
          verifiedAt: new Date(),
          ratingAvg: s.rating,
          ratingCount: Math.floor(s.rating * 10 + 5),
        },
      })
    )
  )

  // Demo supplier profiles (linked to demo accounts)
  const demoSupplierProfile1 = await db.supplierProfiles.create({
    data: {
      userId: demoSupplier1.id,
      companyName: 'Dhaka Textile Mills',
      nidNumber: '1990123456781',
      nidFrontImageUrl: '/images/suppliers/nid-front-demo1.jpg',
      nidBackImageUrl: '/images/suppliers/nid-back-demo1.jpg',
      tradeLicenseNumber: 'TL-2024000',
      tradeLicenseImageUrl: '/images/suppliers/trade-license-demo1.jpg',
      tinNumber: 'TIN-100000000',
      bankAccountName: 'Dhaka Textile Mills',
      bankAccountNumber: '1000000000',
      bankName: 'Dutch-Bangla Bank Ltd',
      branch: 'Dhaka',
      warehouseAddressId: demoAddr1.id,
      verificationStatus: 'approved',
      verifiedBy: adminUser.id,
      verifiedAt: new Date(),
      ratingAvg: 4.7,
      ratingCount: 52,
    },
  })

  const demoSupplierProfile2 = await db.supplierProfiles.create({
    data: {
      userId: demoSupplier2.id,
      companyName: 'Narayanganj Garments',
      nidNumber: '1990123456787',
      nidFrontImageUrl: '/images/suppliers/nid-front-demo2.jpg',
      nidBackImageUrl: '/images/suppliers/nid-back-demo2.jpg',
      tradeLicenseNumber: 'TL-2024006',
      tradeLicenseImageUrl: '/images/suppliers/trade-license-demo2.jpg',
      tinNumber: 'TIN-100000006',
      bankAccountName: 'Narayanganj Garments',
      bankAccountNumber: '1000000006',
      bankName: 'Dutch-Bangla Bank Ltd',
      branch: 'Narayanganj',
      warehouseAddressId: demoAddr2.id,
      verificationStatus: 'approved',
      verifiedBy: adminUser.id,
      verifiedAt: new Date(),
      ratingAvg: 4.9,
      ratingCount: 54,
    },
  })

  console.log(`  ✅ Created ${supplierProfiles.length + 2} supplier profiles (20 regular + 2 demo)`)

  // ============================================================
  // 3. Products (100+)
  // ============================================================
  console.log('📦 Seeding products...')

  // Helper: all supplier profile IDs (regular + demo)
  const allSupplierIds = [...supplierProfiles.map((sp) => sp.id), demoSupplierProfile1.id, demoSupplierProfile2.id]

  interface ProductSeed {
    name: string
    slug: string
    description: string
    brand: string
    unit: string
    moq: number
    maxOrderQty: number
    basePrice: number
    stockQuantity: number
    categorySlug: string
    supplierIndex: number // index into allSupplierIds
    priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
    variants?: { name: string; value: string; sku: string; stock: number; priceOverride?: number }[]
  }

  const productsData: ProductSeed[] = [
    // ===== Textiles & Fabrics (10 products) =====
    { name: 'Cotton Fabric - White', slug: 'cotton-fabric-white', description: 'Premium quality 100% cotton fabric, suitable for garments and home textiles. Soft hand feel, breathable.', brand: 'Dhaka Weave', unit: 'meter', moq: 50, maxOrderQty: 5000, basePrice: 450, stockQuantity: 10000, categorySlug: 'textiles-fabrics', supplierIndex: 0,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 450 }, { minQty: 201, maxQty: 1000, pricePerUnit: 420 }, { minQty: 1001, maxQty: null, pricePerUnit: 390 }] },
    { name: 'Silk Saree - Traditional Jamdani', slug: 'silk-saree-jamdani', description: 'Handwoven Jamdani silk saree with traditional motifs. Perfect for festive occasions.', brand: 'Tangail Weave', unit: 'pcs', moq: 5, maxOrderQty: 200, basePrice: 2500, stockQuantity: 500, categorySlug: 'textiles-fabrics', supplierIndex: 13,
      priceTiers: [{ minQty: 5, maxQty: 20, pricePerUnit: 2500 }, { minQty: 21, maxQty: 100, pricePerUnit: 2300 }, { minQty: 101, maxQty: null, pricePerUnit: 2100 }] },
    { name: 'Denim Fabric - Indigo', slug: 'denim-fabric-indigo', description: 'Heavy-weight indigo denim fabric, 12oz. Ideal for jeans manufacturing.', brand: 'BD Denim', unit: 'meter', moq: 100, maxOrderQty: 10000, basePrice: 380, stockQuantity: 15000, categorySlug: 'textiles-fabrics', supplierIndex: 6,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 380 }, { minQty: 501, maxQty: 2000, pricePerUnit: 355 }, { minQty: 2001, maxQty: null, pricePerUnit: 330 }] },
    { name: 'Linen Cloth - Natural', slug: 'linen-cloth-natural', description: 'Pure linen cloth in natural color. Lightweight and breathable for summer wear.', brand: 'Mymensingh Linen', unit: 'meter', moq: 30, maxOrderQty: 3000, basePrice: 520, stockQuantity: 5000, categorySlug: 'textiles-fabrics', supplierIndex: 11,
      priceTiers: [{ minQty: 30, maxQty: 100, pricePerUnit: 520 }, { minQty: 101, maxQty: 500, pricePerUnit: 490 }, { minQty: 501, maxQty: null, pricePerUnit: 460 }] },
    { name: 'Muslin Fabric - Dhaka', slug: 'muslin-fabric-dhaka', description: 'Authentic Dhaka muslin fabric, ultra-fine weave. Heritage textile of Bangladesh.', brand: 'Dhaka Muslin', unit: 'meter', moq: 10, maxOrderQty: 500, basePrice: 1200, stockQuantity: 800, categorySlug: 'textiles-fabrics', supplierIndex: 0,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 1200 }, { minQty: 51, maxQty: 200, pricePerUnit: 1100 }, { minQty: 201, maxQty: null, pricePerUnit: 1000 }] },
    { name: 'Terry Cotton Toweling', slug: 'terry-cotton-toweling', description: 'Terry cotton towel fabric for bath towels and bathrobes.', brand: 'Dhaka Weave', unit: 'meter', moq: 50, maxOrderQty: 5000, basePrice: 350, stockQuantity: 8000, categorySlug: 'textiles-fabrics', supplierIndex: 0,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 350 }, { minQty: 201, maxQty: 1000, pricePerUnit: 325 }, { minQty: 1001, maxQty: null, pricePerUnit: 300 }] },
    { name: 'Polyester Fabric - Printed', slug: 'polyester-fabric-printed', description: 'Printed polyester fabric with vibrant patterns. Ideal for making affordable garments.', brand: 'BD Prints', unit: 'meter', moq: 100, maxOrderQty: 10000, basePrice: 180, stockQuantity: 20000, categorySlug: 'textiles-fabrics', supplierIndex: 11,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 180 }, { minQty: 501, maxQty: 2000, pricePerUnit: 165 }, { minQty: 2001, maxQty: null, pricePerUnit: 150 }] },
    { name: 'Khadi Fabric - Handspun', slug: 'khadi-fabric-handspun', description: 'Authentic handspun khadi fabric. Supports rural artisans of Bangladesh.', brand: 'Rajshahi Khadi', unit: 'meter', moq: 20, maxOrderQty: 1000, basePrice: 680, stockQuantity: 2000, categorySlug: 'textiles-fabrics', supplierIndex: 2,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 680 }, { minQty: 101, maxQty: 500, pricePerUnit: 640 }, { minQty: 501, maxQty: null, pricePerUnit: 600 }] },
    { name: 'Velvet Fabric - Maroon', slug: 'velvet-fabric-maroon', description: 'Premium maroon velvet fabric for upholstery and formal wear.', brand: 'Dhaka Weave', unit: 'meter', moq: 20, maxOrderQty: 2000, basePrice: 750, stockQuantity: 3000, categorySlug: 'textiles-fabrics', supplierIndex: 0,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 750 }, { minQty: 101, maxQty: 500, pricePerUnit: 700 }, { minQty: 501, maxQty: null, pricePerUnit: 650 }] },
    { name: 'Taffeta Fabric - Gold', slug: 'taffeta-fabric-gold', description: 'Shiny gold taffeta fabric for evening gowns and festive wear.', brand: 'BD Silks', unit: 'meter', moq: 15, maxOrderQty: 1000, basePrice: 890, stockQuantity: 1500, categorySlug: 'textiles-fabrics', supplierIndex: 2,
      priceTiers: [{ minQty: 15, maxQty: 50, pricePerUnit: 890 }, { minQty: 51, maxQty: 200, pricePerUnit: 830 }, { minQty: 201, maxQty: null, pricePerUnit: 780 }] },

    // ===== Agriculture & Food (10 products) =====
    { name: 'Basmati Rice - Premium', slug: 'basmati-rice-premium', description: 'Long-grain premium basmati rice. Aged for 2 years for optimal flavor.', brand: 'Bogra Gold', unit: 'kg', moq: 50, maxOrderQty: 50000, basePrice: 85, stockQuantity: 50000, categorySlug: 'agriculture-food', supplierIndex: 8,
      priceTiers: [{ minQty: 50, maxQty: 500, pricePerUnit: 85 }, { minQty: 501, maxQty: 5000, pricePerUnit: 80 }, { minQty: 5001, maxQty: null, pricePerUnit: 75 }] },
    { name: 'Miniket Rice - Fine', slug: 'miniket-rice-fine', description: 'Fine quality Miniket rice. Daily staple for Bangladeshi households.', brand: 'Bogra Gold', unit: 'kg', moq: 100, maxOrderQty: 100000, basePrice: 65, stockQuantity: 80000, categorySlug: 'agriculture-food', supplierIndex: 8,
      priceTiers: [{ minQty: 100, maxQty: 1000, pricePerUnit: 65 }, { minQty: 1001, maxQty: 10000, pricePerUnit: 60 }, { minQty: 10001, maxQty: null, pricePerUnit: 55 }] },
    { name: 'Lentils - Masoor Dal', slug: 'lentils-masoor-dal', description: 'Red split lentils (Masoor dal). High protein, essential for dal cuisine.', brand: 'BD Pulses', unit: 'kg', moq: 25, maxOrderQty: 10000, basePrice: 120, stockQuantity: 20000, categorySlug: 'agriculture-food', supplierIndex: 7,
      priceTiers: [{ minQty: 25, maxQty: 200, pricePerUnit: 120 }, { minQty: 201, maxQty: 1000, pricePerUnit: 112 }, { minQty: 1001, maxQty: null, pricePerUnit: 105 }] },
    { name: 'Mustard Oil - Pure', slug: 'mustard-oil-pure', description: 'Cold-pressed pure mustard oil. Traditional cooking oil of Bangladesh.', brand: 'Fresh Oil', unit: 'liter', moq: 20, maxOrderQty: 5000, basePrice: 180, stockQuantity: 15000, categorySlug: 'agriculture-food', supplierIndex: 7,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 180 }, { minQty: 101, maxQty: 500, pricePerUnit: 170 }, { minQty: 501, maxQty: null, pricePerUnit: 160 }] },
    { name: 'Soybean Oil - Refined', slug: 'soybean-oil-refined', description: 'Refined soybean oil for commercial cooking and frying.', brand: 'Fresh Oil', unit: 'liter', moq: 50, maxOrderQty: 10000, basePrice: 155, stockQuantity: 25000, categorySlug: 'agriculture-food', supplierIndex: 7,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 155 }, { minQty: 201, maxQty: 1000, pricePerUnit: 148 }, { minQty: 1001, maxQty: null, pricePerUnit: 140 }] },
    { name: 'Sugar - Refined White', slug: 'sugar-refined-white', description: 'Premium refined white sugar. Essential commodity for food businesses.', brand: 'BD Sugar', unit: 'kg', moq: 100, maxOrderQty: 50000, basePrice: 58, stockQuantity: 60000, categorySlug: 'agriculture-food', supplierIndex: 15,
      priceTiers: [{ minQty: 100, maxQty: 1000, pricePerUnit: 58 }, { minQty: 1001, maxQty: 10000, pricePerUnit: 54 }, { minQty: 10001, maxQty: null, pricePerUnit: 50 }] },
    { name: 'Wheat Flour - Ata', slug: 'wheat-flour-ata', description: 'Fine wheat flour (Ata) for chapati and bakery production.', brand: 'Dinajpur Flour', unit: 'kg', moq: 100, maxOrderQty: 50000, basePrice: 42, stockQuantity: 40000, categorySlug: 'agriculture-food', supplierIndex: 15,
      priceTiers: [{ minQty: 100, maxQty: 1000, pricePerUnit: 42 }, { minQty: 1001, maxQty: 10000, pricePerUnit: 39 }, { minQty: 10001, maxQty: null, pricePerUnit: 36 }] },
    { name: 'Poultry Feed - Layer', slug: 'poultry-feed-layer', description: 'High-quality layer poultry feed. Nutritionally balanced formula.', brand: 'Jessore Feed', unit: 'kg', moq: 500, maxOrderQty: 50000, basePrice: 48, stockQuantity: 30000, categorySlug: 'agriculture-food', supplierIndex: 14,
      priceTiers: [{ minQty: 500, maxQty: 5000, pricePerUnit: 48 }, { minQty: 5001, maxQty: 20000, pricePerUnit: 45 }, { minQty: 20001, maxQty: null, pricePerUnit: 42 }] },
    { name: 'Fish Feed - Floating', slug: 'fish-feed-floating', description: 'Floating fish feed pellets for commercial aquaculture.', brand: 'BD Aqua', unit: 'kg', moq: 200, maxOrderQty: 20000, basePrice: 55, stockQuantity: 15000, categorySlug: 'agriculture-food', supplierIndex: 9,
      priceTiers: [{ minQty: 200, maxQty: 1000, pricePerUnit: 55 }, { minQty: 1001, maxQty: 5000, pricePerUnit: 52 }, { minQty: 5001, maxQty: null, pricePerUnit: 48 }] },
    { name: 'Dried Fish - Shutki', slug: 'dried-fish-shutki', description: 'Premium quality dried fish (Shutki). Traditional Bangladeshi delicacy.', brand: 'Barisal Shutki', unit: 'kg', moq: 10, maxOrderQty: 1000, basePrice: 650, stockQuantity: 5000, categorySlug: 'agriculture-food', supplierIndex: 9,
      priceTiers: [{ minQty: 10, maxQty: 100, pricePerUnit: 650 }, { minQty: 101, maxQty: 500, pricePerUnit: 600 }, { minQty: 501, maxQty: null, pricePerUnit: 550 }] },

    // ===== Electronics (8 products) =====
    { name: 'LED Bulb 12W - Warm White', slug: 'led-bulb-12w-warm', description: 'Energy-efficient 12W LED bulb with warm white light. BESI certified.', brand: 'BD LED', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 85, stockQuantity: 25000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 85 }, { minQty: 501, maxQty: 2000, pricePerUnit: 75 }, { minQty: 2001, maxQty: null, pricePerUnit: 68 }] },
    { name: 'LED Bulb 18W - Cool White', slug: 'led-bulb-18w-cool', description: 'Bright 18W LED bulb with cool white light for commercial spaces.', brand: 'BD LED', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 120, stockQuantity: 15000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 120 }, { minQty: 501, maxQty: 2000, pricePerUnit: 108 }, { minQty: 2001, maxQty: null, pricePerUnit: 98 }] },
    { name: 'Mobile Charger - USB-C 18W', slug: 'mobile-charger-usbc-18w', description: 'Fast USB-C charger 18W with BTR certification. Compatible with most smartphones.', brand: 'Gulshan Tech', unit: 'pcs', moq: 200, maxOrderQty: 20000, basePrice: 35, stockQuantity: 40000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 200, maxQty: 1000, pricePerUnit: 35 }, { minQty: 1001, maxQty: 5000, pricePerUnit: 30 }, { minQty: 5001, maxQty: null, pricePerUnit: 26 }] },
    { name: 'USB Cable - Type C 1m', slug: 'usb-cable-typec-1m', description: 'USB-A to USB-C cable, 1 meter. Durable braided nylon cable.', brand: 'Gulshan Tech', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 25, stockQuantity: 60000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 25 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 22 }, { minQty: 10001, maxQty: null, pricePerUnit: 18 }] },
    { name: 'Power Bank 10000mAh', slug: 'power-bank-10000mah', description: 'Portable power bank 10000mAh with dual USB output.', brand: 'BD Power', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 350, stockQuantity: 8000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 350 }, { minQty: 201, maxQty: 1000, pricePerUnit: 320 }, { minQty: 1001, maxQty: null, pricePerUnit: 290 }] },
    { name: 'Ceiling Fan - 56 inch', slug: 'ceiling-fan-56inch', description: 'Decorative 56-inch ceiling fan with remote control. Energy efficient.', brand: 'National BD', unit: 'pcs', moq: 10, maxOrderQty: 500, basePrice: 2200, stockQuantity: 2000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 2200 }, { minQty: 51, maxQty: 200, pricePerUnit: 2050 }, { minQty: 201, maxQty: null, pricePerUnit: 1900 }] },
    { name: 'Voltage Stabilizer - 2KVA', slug: 'voltage-stabilizer-2kva', description: 'Automatic voltage stabilizer 2KVA for home and office appliances.', brand: 'BD Volt', unit: 'pcs', moq: 5, maxOrderQty: 200, basePrice: 3500, stockQuantity: 1000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 5, maxQty: 20, pricePerUnit: 3500 }, { minQty: 21, maxQty: 100, pricePerUnit: 3300 }, { minQty: 101, maxQty: null, pricePerUnit: 3100 }] },
    { name: 'Electric Iron - Dry 1000W', slug: 'electric-iron-dry-1000w', description: 'Dry electric iron 1000W with non-stick soleplate.', brand: 'BD Home', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 450, stockQuantity: 6000, categorySlug: 'electronics', supplierIndex: 3,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 450 }, { minQty: 201, maxQty: 1000, pricePerUnit: 420 }, { minQty: 1001, maxQty: null, pricePerUnit: 390 }] },

    // ===== Construction & Hardware (8 products) =====
    { name: 'Cement - OPC 50kg', slug: 'cement-opc-50kg', description: 'Ordinary Portland Cement 50kg bag. Grade-42.5, BSTI certified.', brand: 'Shah Cement', unit: 'bag', moq: 100, maxOrderQty: 50000, basePrice: 450, stockQuantity: 30000, categorySlug: 'construction-hardware', supplierIndex: 19,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 450 }, { minQty: 501, maxQty: 5000, pricePerUnit: 435 }, { minQty: 5001, maxQty: null, pricePerUnit: 420 }] },
    { name: 'TMT Steel Bar - 60 Grade', slug: 'tmt-steel-bar-60grade', description: 'TMT steel bar 60 grade, 20mm diameter. For RCC construction.', brand: 'BSRM', unit: 'kg', moq: 500, maxOrderQty: 100000, basePrice: 72, stockQuantity: 50000, categorySlug: 'construction-hardware', supplierIndex: 19,
      priceTiers: [{ minQty: 500, maxQty: 5000, pricePerUnit: 72 }, { minQty: 5001, maxQty: 20000, pricePerUnit: 70 }, { minQty: 20001, maxQty: null, pricePerUnit: 68 }] },
    { name: 'Brick - 1st Class', slug: 'brick-1st-class', description: 'First class red brick. Standard size 10x5x3 inches.', brand: 'Manikganj Brick', unit: 'pcs', moq: 5000, maxOrderQty: 500000, basePrice: 12, stockQuantity: 200000, categorySlug: 'construction-hardware', supplierIndex: 19,
      priceTiers: [{ minQty: 5000, maxQty: 50000, pricePerUnit: 12 }, { minQty: 50001, maxQty: 200000, pricePerUnit: 11 }, { minQty: 200001, maxQty: null, pricePerUnit: 10 }] },
    { name: 'Sand - Fine (Local)', slug: 'sand-fine-local', description: 'Fine local sand for plastering and finishing work.', brand: 'Local', unit: 'kg', moq: 1000, maxOrderQty: 100000, basePrice: 2.5, stockQuantity: 100000, categorySlug: 'construction-hardware', supplierIndex: 19,
      priceTiers: [{ minQty: 1000, maxQty: 10000, pricePerUnit: 2.5 }, { minQty: 10001, maxQty: 50000, pricePerUnit: 2.2 }, { minQty: 50001, maxQty: null, pricePerUnit: 2.0 }] },
    { name: 'PVC Pipe - 4 inch', slug: 'pvc-pipe-4inch', description: '4-inch PVC pipe for plumbing and drainage. 10 feet length.', brand: 'Partex Pipe', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 280, stockQuantity: 8000, categorySlug: 'construction-hardware', supplierIndex: 5,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 280 }, { minQty: 201, maxQty: 1000, pricePerUnit: 265 }, { minQty: 1001, maxQty: null, pricePerUnit: 250 }] },
    { name: 'GI Sheet - Corrugated', slug: 'gi-sheet-corrugated', description: 'Galvanized iron corrugated sheet for roofing. 8x3 feet.', brand: 'BD Steel', unit: 'pcs', moq: 20, maxOrderQty: 2000, basePrice: 850, stockQuantity: 5000, categorySlug: 'construction-hardware', supplierIndex: 5,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 850 }, { minQty: 101, maxQty: 500, pricePerUnit: 810 }, { minQty: 501, maxQty: null, pricePerUnit: 780 }] },
    { name: 'Nails - 3 inch', slug: 'nails-3inch', description: 'Iron wire nails, 3 inch. 1 kg pack.', brand: 'BD Hardware', unit: 'kg', moq: 50, maxOrderQty: 5000, basePrice: 95, stockQuantity: 10000, categorySlug: 'construction-hardware', supplierIndex: 5,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 95 }, { minQty: 201, maxQty: 1000, pricePerUnit: 88 }, { minQty: 1001, maxQty: null, pricePerUnit: 82 }] },
    { name: 'Cement Block - Hollow', slug: 'cement-block-hollow', description: 'Hollow cement block for wall construction. 15x8x8 inches.', brand: 'Manikganj Brick', unit: 'pcs', moq: 1000, maxOrderQty: 50000, basePrice: 28, stockQuantity: 40000, categorySlug: 'construction-hardware', supplierIndex: 19,
      priceTiers: [{ minQty: 1000, maxQty: 5000, pricePerUnit: 28 }, { minQty: 5001, maxQty: 20000, pricePerUnit: 26 }, { minQty: 20001, maxQty: null, pricePerUnit: 24 }] },

    // ===== Spices & Condiments (8 products) =====
    { name: 'Turmeric Powder', slug: 'turmeric-powder', description: 'Pure turmeric powder from Rangamati hills. No artificial color.', brand: 'PRAN Spice', unit: 'kg', moq: 10, maxOrderQty: 5000, basePrice: 220, stockQuantity: 8000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 10, maxQty: 100, pricePerUnit: 220 }, { minQty: 101, maxQty: 500, pricePerUnit: 205 }, { minQty: 501, maxQty: null, pricePerUnit: 190 }] },
    { name: 'Red Chili Powder', slug: 'red-chili-powder', description: 'Hot red chili powder. Premium grade with rich color.', brand: 'PRAN Spice', unit: 'kg', moq: 10, maxOrderQty: 3000, basePrice: 350, stockQuantity: 5000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 10, maxQty: 100, pricePerUnit: 350 }, { minQty: 101, maxQty: 500, pricePerUnit: 330 }, { minQty: 501, maxQty: null, pricePerUnit: 310 }] },
    { name: 'Cumin Seeds - Whole', slug: 'cumin-seeds-whole', description: 'Whole cumin seeds (Jeera). Aromatic and flavorful.', brand: 'Radhuni', unit: 'kg', moq: 5, maxOrderQty: 2000, basePrice: 480, stockQuantity: 3000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 5, maxQty: 50, pricePerUnit: 480 }, { minQty: 51, maxQty: 200, pricePerUnit: 455 }, { minQty: 201, maxQty: null, pricePerUnit: 430 }] },
    { name: 'Coriander Seeds - Whole', slug: 'coriander-seeds-whole', description: 'Whole coriander seeds (Dhania). Essential spice for curry.', brand: 'Radhuni', unit: 'kg', moq: 10, maxOrderQty: 5000, basePrice: 320, stockQuantity: 6000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 10, maxQty: 100, pricePerUnit: 320 }, { minQty: 101, maxQty: 500, pricePerUnit: 300 }, { minQty: 501, maxQty: null, pricePerUnit: 280 }] },
    { name: 'Mustard Seeds - Black', slug: 'mustard-seeds-black', description: 'Black mustard seeds (Kali Sarisha). For tempering and oil pressing.', brand: 'BD Spice', unit: 'kg', moq: 25, maxOrderQty: 10000, basePrice: 150, stockQuantity: 12000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 25, maxQty: 200, pricePerUnit: 150 }, { minQty: 201, maxQty: 1000, pricePerUnit: 140 }, { minQty: 1001, maxQty: null, pricePerUnit: 130 }] },
    { name: 'Fenugreek Seeds', slug: 'fenugreek-seeds', description: 'Fenugreek seeds (Methi). Used in cooking and traditional medicine.', brand: 'BD Spice', unit: 'kg', moq: 5, maxOrderQty: 1000, basePrice: 420, stockQuantity: 2000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 5, maxQty: 50, pricePerUnit: 420 }, { minQty: 51, maxQty: 200, pricePerUnit: 395 }, { minQty: 201, maxQty: null, pricePerUnit: 370 }] },
    { name: 'Bay Leaves - Dried', slug: 'bay-leaves-dried', description: 'Dried bay leaves (Tejpata). Aromatic essential for biryani and curry.', brand: 'BD Spice', unit: 'kg', moq: 5, maxOrderQty: 500, basePrice: 550, stockQuantity: 1000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 5, maxQty: 50, pricePerUnit: 550 }, { minQty: 51, maxQty: 200, pricePerUnit: 520 }, { minQty: 201, maxQty: null, pricePerUnit: 490 }] },
    { name: 'Garam Masala Blend', slug: 'garam-masala-blend', description: 'Premium garam masala blend. Ground mixed spices for authentic curry flavor.', brand: 'PRAN Spice', unit: 'kg', moq: 5, maxOrderQty: 2000, basePrice: 620, stockQuantity: 3000, categorySlug: 'spices-condiments', supplierIndex: 7,
      priceTiers: [{ minQty: 5, maxQty: 50, pricePerUnit: 620 }, { minQty: 51, maxQty: 200, pricePerUnit: 580 }, { minQty: 201, maxQty: null, pricePerUnit: 540 }] },

    // ===== Garments & Apparel (10 products) =====
    { name: 'T-Shirt Blank - Round Neck', slug: 'tshirt-blank-round-neck', description: 'Blank round neck t-shirt for printing/branding. 100% cotton, 180 GSM.', brand: 'BD Knit', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 180, stockQuantity: 25000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 180 }, { minQty: 501, maxQty: 2000, pricePerUnit: 165 }, { minQty: 2001, maxQty: null, pricePerUnit: 150 }],
      variants: [{ name: 'Size', value: 'S', sku: 'TSHIRT-RN-S', stock: 6000, priceOverride: 180 }, { name: 'Size', value: 'M', sku: 'TSHIRT-RN-M', stock: 8000, priceOverride: 180 }, { name: 'Size', value: 'L', sku: 'TSHIRT-RN-L', stock: 7000, priceOverride: 185 }, { name: 'Size', value: 'XL', sku: 'TSHIRT-RN-XL', stock: 4000, priceOverride: 195 }] },
    { name: 'Polo Shirt - Pique Cotton', slug: 'polo-shirt-pique', description: 'Pique cotton polo shirt with collar. Ideal for corporate branding.', brand: 'BD Knit', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 280, stockQuantity: 10000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 280 }, { minQty: 201, maxQty: 1000, pricePerUnit: 260 }, { minQty: 1001, maxQty: null, pricePerUnit: 240 }] },
    { name: 'Jeans - Denim Straight Fit', slug: 'jeans-denim-straight', description: 'Straight fit denim jeans. 32 waist standard. Pre-washed.', brand: 'BD Denim Wear', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 650, stockQuantity: 8000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 650 }, { minQty: 201, maxQty: 1000, pricePerUnit: 610 }, { minQty: 1001, maxQty: null, pricePerUnit: 570 }] },
    { name: 'Panjabi - Cotton', slug: 'panjabi-cotton', description: 'Traditional cotton panjabi (kurta) for men. Elegant design.', brand: 'Aarong', unit: 'pcs', moq: 20, maxOrderQty: 2000, basePrice: 850, stockQuantity: 3000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 850 }, { minQty: 101, maxQty: 500, pricePerUnit: 800 }, { minQty: 501, maxQty: null, pricePerUnit: 750 }] },
    { name: 'Salwar Kameez - Lawn', slug: 'salwar-kameez-lawn', description: '3-piece lawn salwar kameez with dupatta. Printed design.', brand: 'Aarong', unit: 'pcs', moq: 20, maxOrderQty: 2000, basePrice: 1200, stockQuantity: 2000, categorySlug: 'garments-apparel', supplierIndex: 13,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 1200 }, { minQty: 101, maxQty: 500, pricePerUnit: 1100 }, { minQty: 501, maxQty: null, pricePerUnit: 1000 }] },
    { name: 'Hoodie - Fleece', slug: 'hoodie-fleece', description: 'Fleece hoodie with kangaroo pocket. 320 GSM, unisex.', brand: 'BD Knit', unit: 'pcs', moq: 50, maxOrderQty: 3000, basePrice: 550, stockQuantity: 5000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 550 }, { minQty: 201, maxQty: 1000, pricePerUnit: 520 }, { minQty: 1001, maxQty: null, pricePerUnit: 490 }] },
    { name: 'Shorts - Cargo', slug: 'shorts-cargo', description: 'Cargo shorts with multiple pockets. 100% cotton twill.', brand: 'BD Knit', unit: 'pcs', moq: 100, maxOrderQty: 5000, basePrice: 320, stockQuantity: 6000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 320 }, { minQty: 501, maxQty: 2000, pricePerUnit: 295 }, { minQty: 2001, maxQty: null, pricePerUnit: 270 }] },
    { name: 'Track Suit - Polyester', slug: 'track-suit-polyester', description: 'Polyester track suit with jacket and pants. For sports and casual wear.', brand: 'BD Sportswear', unit: 'set', moq: 50, maxOrderQty: 3000, basePrice: 780, stockQuantity: 4000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 780 }, { minQty: 201, maxQty: 1000, pricePerUnit: 730 }, { minQty: 1001, maxQty: null, pricePerUnit: 680 }] },
    { name: 'Shirt - Formal Cotton', slug: 'shirt-formal-cotton', description: 'Formal cotton shirt, full sleeve. For office and corporate wear.', brand: 'BD Formal', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 450, stockQuantity: 7000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 450 }, { minQty: 201, maxQty: 1000, pricePerUnit: 420 }, { minQty: 1001, maxQty: null, pricePerUnit: 390 }] },
    { name: 'T-Shirt Blank - V-Neck', slug: 'tshirt-blank-vneck', description: 'Blank V-neck t-shirt. 100% cotton, 180 GSM.', brand: 'BD Knit', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 185, stockQuantity: 20000, categorySlug: 'garments-apparel', supplierIndex: 6,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 185 }, { minQty: 501, maxQty: 2000, pricePerUnit: 170 }, { minQty: 2001, maxQty: null, pricePerUnit: 155 }] },

    // ===== Beauty & Personal Care (6 products) =====
    { name: 'Face Wash - Gentle', slug: 'face-wash-gentle', description: 'Gentle face wash with neem extract. For all skin types.', brand: 'BD Beauty', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 150, stockQuantity: 8000, categorySlug: 'beauty-personal-care', supplierIndex: 4,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 150 }, { minQty: 201, maxQty: 1000, pricePerUnit: 135 }, { minQty: 1001, maxQty: null, pricePerUnit: 120 }] },
    { name: 'Hair Oil - Coconut', slug: 'hair-oil-coconut', description: 'Pure coconut hair oil. Traditional hair care of Bangladesh.', brand: 'Parachute', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 95, stockQuantity: 15000, categorySlug: 'beauty-personal-care', supplierIndex: 4,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 95 }, { minQty: 501, maxQty: 2000, pricePerUnit: 85 }, { minQty: 2001, maxQty: null, pricePerUnit: 78 }] },
    { name: 'Shampoo - Herbal', slug: 'shampoo-herbal', description: 'Herbal shampoo with amla and shikakai. 200ml bottle.', brand: 'BD Beauty', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 180, stockQuantity: 6000, categorySlug: 'beauty-personal-care', supplierIndex: 4,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 180 }, { minQty: 201, maxQty: 1000, pricePerUnit: 165 }, { minQty: 1001, maxQty: null, pricePerUnit: 150 }] },
    { name: 'Hand Wash - Liquid', slug: 'hand-wash-liquid', description: 'Liquid hand wash with antibacterial formula. 500ml refill pack.', brand: 'Savlon BD', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 120, stockQuantity: 12000, categorySlug: 'beauty-personal-care', supplierIndex: 4,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 120 }, { minQty: 501, maxQty: 2000, pricePerUnit: 108 }, { minQty: 2001, maxQty: null, pricePerUnit: 98 }] },
    { name: 'Body Lotion - Moisturizing', slug: 'body-lotion-moisturizing', description: 'Moisturizing body lotion with vitamin E. 400ml bottle.', brand: 'BD Beauty', unit: 'pcs', moq: 50, maxOrderQty: 3000, basePrice: 220, stockQuantity: 4000, categorySlug: 'beauty-personal-care', supplierIndex: 4,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 220 }, { minQty: 201, maxQty: 1000, pricePerUnit: 200 }, { minQty: 1001, maxQty: null, pricePerUnit: 180 }] },
    { name: 'Soap - Neem Bath', slug: 'soap-neem-bath', description: 'Neem bath soap 125g. Antibacterial and skin-friendly.', brand: 'Neem BD', unit: 'pcs', moq: 200, maxOrderQty: 20000, basePrice: 45, stockQuantity: 25000, categorySlug: 'beauty-personal-care', supplierIndex: 4,
      priceTiers: [{ minQty: 200, maxQty: 1000, pricePerUnit: 45 }, { minQty: 1001, maxQty: 5000, pricePerUnit: 40 }, { minQty: 5001, maxQty: null, pricePerUnit: 36 }] },

    // ===== Mobile Accessories (6 products) =====
    { name: 'Tempered Glass - Universal', slug: 'tempered-glass-universal', description: '9H hardness tempered glass screen protector. Universal fit.', brand: 'BD Mobile', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 20, stockQuantity: 50000, categorySlug: 'mobile-accessories', supplierIndex: 3,
      priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 20 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 16 }, { minQty: 10001, maxQty: null, pricePerUnit: 12 }] },
    { name: 'Mobile Cover - Transparent', slug: 'mobile-cover-transparent', description: 'Transparent TPU mobile cover. Shock absorbing.', brand: 'BD Mobile', unit: 'pcs', moq: 200, maxOrderQty: 20000, basePrice: 30, stockQuantity: 30000, categorySlug: 'mobile-accessories', supplierIndex: 3,
      priceTiers: [{ minQty: 200, maxQty: 1000, pricePerUnit: 30 }, { minQty: 1001, maxQty: 5000, pricePerUnit: 25 }, { minQty: 5001, maxQty: null, pricePerUnit: 20 }] },
    { name: 'Earphone - Wired 3.5mm', slug: 'earphone-wired-35mm', description: 'Wired earphone with 3.5mm jack. In-ear design with mic.', brand: 'BD Sound', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 65, stockQuantity: 15000, categorySlug: 'mobile-accessories', supplierIndex: 3,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 65 }, { minQty: 501, maxQty: 2000, pricePerUnit: 55 }, { minQty: 2001, maxQty: null, pricePerUnit: 48 }] },
    { name: 'Bluetooth Earbuds - TWS', slug: 'bluetooth-earbuds-tws', description: 'True Wireless Stereo earbuds with charging case.', brand: 'BD Sound', unit: 'pcs', moq: 50, maxOrderQty: 3000, basePrice: 450, stockQuantity: 5000, categorySlug: 'mobile-accessories', supplierIndex: 3,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 450 }, { minQty: 201, maxQty: 1000, pricePerUnit: 410 }, { minQty: 1001, maxQty: null, pricePerUnit: 380 }] },
    { name: 'Mobile Stand - Adjustable', slug: 'mobile-stand-adjustable', description: 'Adjustable mobile/tablet stand. Aluminum alloy build.', brand: 'BD Mobile', unit: 'pcs', moq: 100, maxOrderQty: 5000, basePrice: 120, stockQuantity: 8000, categorySlug: 'mobile-accessories', supplierIndex: 3,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 120 }, { minQty: 501, maxQty: 2000, pricePerUnit: 108 }, { minQty: 2001, maxQty: null, pricePerUnit: 98 }] },
    { name: 'USB OTG Cable', slug: 'usb-otg-cable', description: 'USB OTG cable for connecting USB devices to mobile phones.', brand: 'Gulshan Tech', unit: 'pcs', moq: 200, maxOrderQty: 20000, basePrice: 18, stockQuantity: 30000, categorySlug: 'mobile-accessories', supplierIndex: 3,
      priceTiers: [{ minQty: 200, maxQty: 1000, pricePerUnit: 18 }, { minQty: 1001, maxQty: 5000, pricePerUnit: 15 }, { minQty: 5001, maxQty: null, pricePerUnit: 12 }] },

    // ===== LED & Lighting (6 products) =====
    { name: 'LED Panel Light - 18W', slug: 'led-panel-light-18w', description: 'Slim LED panel light 18W. For office and commercial false ceiling.', brand: 'BD LED', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 650, stockQuantity: 3000, categorySlug: 'led-lighting', supplierIndex: 3,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 650 }, { minQty: 201, maxQty: 1000, pricePerUnit: 600 }, { minQty: 1001, maxQty: null, pricePerUnit: 560 }] },
    { name: 'LED Tube Light - 4ft 20W', slug: 'led-tube-light-4ft', description: '4ft LED tube light 20W. Replaces traditional 40W fluorescent tube.', brand: 'BD LED', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 250, stockQuantity: 12000, categorySlug: 'led-lighting', supplierIndex: 3,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 250 }, { minQty: 501, maxQty: 2000, pricePerUnit: 230 }, { minQty: 2001, maxQty: null, pricePerUnit: 210 }] },
    { name: 'LED Strip Light - RGB 5m', slug: 'led-strip-light-rgb', description: 'RGB LED strip light 5 meters with remote controller.', brand: 'BD LED', unit: 'pcs', moq: 20, maxOrderQty: 2000, basePrice: 350, stockQuantity: 4000, categorySlug: 'led-lighting', supplierIndex: 3,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 350 }, { minQty: 101, maxQty: 500, pricePerUnit: 320 }, { minQty: 501, maxQty: null, pricePerUnit: 295 }] },
    { name: 'LED Flood Light - 50W', slug: 'led-flood-light-50w', description: '50W LED flood light for outdoor illumination. IP65 waterproof.', brand: 'BD LED', unit: 'pcs', moq: 10, maxOrderQty: 1000, basePrice: 1200, stockQuantity: 2000, categorySlug: 'led-lighting', supplierIndex: 3,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 1200 }, { minQty: 51, maxQty: 200, pricePerUnit: 1100 }, { minQty: 201, maxQty: null, pricePerUnit: 1000 }] },
    { name: 'Solar LED Street Light - 30W', slug: 'solar-led-street-light', description: '30W solar-powered LED street light with lithium battery.', brand: 'BD Solar', unit: 'pcs', moq: 5, maxOrderQty: 500, basePrice: 4500, stockQuantity: 1000, categorySlug: 'led-lighting', supplierIndex: 3,
      priceTiers: [{ minQty: 5, maxQty: 20, pricePerUnit: 4500 }, { minQty: 21, maxQty: 100, pricePerUnit: 4200 }, { minQty: 101, maxQty: null, pricePerUnit: 3900 }] },
    { name: 'LED Downlight - 12W', slug: 'led-downlight-12w', description: 'Recessed LED downlight 12W. Warm white for home interiors.', brand: 'BD LED', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 280, stockQuantity: 6000, categorySlug: 'led-lighting', supplierIndex: 3,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 280 }, { minQty: 201, maxQty: 1000, pricePerUnit: 255 }, { minQty: 1001, maxQty: null, pricePerUnit: 235 }] },

    // ===== Jute & Jute Products (5 products) =====
    { name: 'Raw Jute - Tossa', slug: 'raw-jute-tossa', description: 'Raw tossa jute fiber. Grade-A quality for jute product manufacturing.', brand: 'BJMC', unit: 'kg', moq: 500, maxOrderQty: 100000, basePrice: 45, stockQuantity: 80000, categorySlug: 'jute-products', supplierIndex: 10,
      priceTiers: [{ minQty: 500, maxQty: 5000, pricePerUnit: 45 }, { minQty: 5001, maxQty: 20000, pricePerUnit: 42 }, { minQty: 20001, maxQty: null, pricePerUnit: 39 }] },
    { name: 'Jute Bag - Shopping', slug: 'jute-bag-shopping', description: 'Eco-friendly jute shopping bag. Customizable printing.', brand: 'BJMC', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 25, stockQuantity: 40000, categorySlug: 'jute-products', supplierIndex: 10,
      priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 25 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 22 }, { minQty: 10001, maxQty: null, pricePerUnit: 19 }] },
    { name: 'Jute Rope - 10mm', slug: 'jute-rope-10mm', description: 'Natural jute rope 10mm diameter. For packaging and crafts.', brand: 'BJMC', unit: 'meter', moq: 100, maxOrderQty: 10000, basePrice: 12, stockQuantity: 15000, categorySlug: 'jute-products', supplierIndex: 10,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 12 }, { minQty: 501, maxQty: 2000, pricePerUnit: 11 }, { minQty: 2001, maxQty: null, pricePerUnit: 10 }] },
    { name: 'Jute Carpet - Handwoven', slug: 'jute-carpet-handwoven', description: 'Handwoven jute carpet/mat. Traditional Bangladeshi craft.', brand: 'Rangpur Jute Craft', unit: 'pcs', moq: 10, maxOrderQty: 500, basePrice: 1200, stockQuantity: 800, categorySlug: 'jute-products', supplierIndex: 10,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 1200 }, { minQty: 51, maxQty: 200, pricePerUnit: 1100 }, { minQty: 201, maxQty: null, pricePerUnit: 1000 }] },
    { name: 'Jute Sack - 50kg', slug: 'jute-sack-50kg', description: 'Standard 50kg jute sack for rice/potato/pulse storage.', brand: 'BJMC', unit: 'pcs', moq: 1000, maxOrderQty: 100000, basePrice: 15, stockQuantity: 60000, categorySlug: 'jute-products', supplierIndex: 10,
      priceTiers: [{ minQty: 1000, maxQty: 10000, pricePerUnit: 15 }, { minQty: 10001, maxQty: 50000, pricePerUnit: 13 }, { minQty: 50001, maxQty: null, pricePerUnit: 11 }] },

    // ===== Packaging & Printing (5 products) =====
    { name: 'Corrugated Box - Standard', slug: 'corrugated-box-standard', description: '3-ply corrugated box. Various sizes for packaging.', brand: 'BD Pack', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 15, stockQuantity: 50000, categorySlug: 'packaging-printing', supplierIndex: 1,
      priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 15 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 13 }, { minQty: 10001, maxQty: null, pricePerUnit: 11 }] },
    { name: 'Stretch Film Roll', slug: 'stretch-film-roll', description: 'Stretch film roll for wrapping pallets. 500mm x 300m.', brand: 'BD Pack', unit: 'pcs', moq: 20, maxOrderQty: 2000, basePrice: 650, stockQuantity: 3000, categorySlug: 'packaging-printing', supplierIndex: 1,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 650 }, { minQty: 101, maxQty: 500, pricePerUnit: 610 }, { minQty: 501, maxQty: null, pricePerUnit: 570 }] },
    { name: 'Printed Label - Custom', slug: 'printed-label-custom', description: 'Custom printed labels for garments. Woven and printed options.', brand: 'BD Label', unit: 'pcs', moq: 5000, maxOrderQty: 500000, basePrice: 0.5, stockQuantity: 200000, categorySlug: 'packaging-printing', supplierIndex: 1,
      priceTiers: [{ minQty: 5000, maxQty: 50000, pricePerUnit: 0.5 }, { minQty: 50001, maxQty: 200000, pricePerUnit: 0.4 }, { minQty: 200001, maxQty: null, pricePerUnit: 0.35 }] },
    { name: 'Paper Bag - Kraft', slug: 'paper-bag-kraft', description: 'Kraft paper bag for retail packaging. Eco-friendly alternative.', brand: 'BD Pack', unit: 'pcs', moq: 1000, maxOrderQty: 100000, basePrice: 5, stockQuantity: 80000, categorySlug: 'packaging-printing', supplierIndex: 1,
      priceTiers: [{ minQty: 1000, maxQty: 5000, pricePerUnit: 5 }, { minQty: 5001, maxQty: 20000, pricePerUnit: 4.5 }, { minQty: 20001, maxQty: null, pricePerUnit: 4 }] },
    { name: 'Shrink Wrap Sleeve', slug: 'shrink-wrap-sleeve', description: 'PVC shrink wrap sleeve for bottle packaging.', brand: 'BD Pack', unit: 'pcs', moq: 5000, maxOrderQty: 500000, basePrice: 1.2, stockQuantity: 300000, categorySlug: 'packaging-printing', supplierIndex: 1,
      priceTiers: [{ minQty: 5000, maxQty: 50000, pricePerUnit: 1.2 }, { minQty: 50001, maxQty: 200000, pricePerUnit: 1.0 }, { minQty: 200001, maxQty: null, pricePerUnit: 0.85 }] },

    // ===== Home & Garden (5 products) =====
    { name: 'Plastic Chair - Set of 4', slug: 'plastic-chair-set', description: 'Durable plastic chair set of 4. Multiple colors available.', brand: 'RFL Plastics', unit: 'set', moq: 20, maxOrderQty: 2000, basePrice: 1200, stockQuantity: 3000, categorySlug: 'home-garden', supplierIndex: 12,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 1200 }, { minQty: 101, maxQty: 500, pricePerUnit: 1100 }, { minQty: 501, maxQty: null, pricePerUnit: 1000 }] },
    { name: 'Plastic Table - 4ft Round', slug: 'plastic-table-round', description: 'RFL plastic table, 4ft round. Folding leg design.', brand: 'RFL Plastics', unit: 'pcs', moq: 10, maxOrderQty: 1000, basePrice: 1500, stockQuantity: 2000, categorySlug: 'home-garden', supplierIndex: 12,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 1500 }, { minQty: 51, maxQty: 200, pricePerUnit: 1400 }, { minQty: 201, maxQty: null, pricePerUnit: 1300 }] },
    { name: 'Aluminum Cookware Set', slug: 'aluminum-cookware-set', description: '5-piece aluminum cookware set. Durable and lightweight.', brand: 'BD Kitchen', unit: 'set', moq: 10, maxOrderQty: 1000, basePrice: 2800, stockQuantity: 1500, categorySlug: 'home-garden', supplierIndex: 12,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 2800 }, { minQty: 51, maxQty: 200, pricePerUnit: 2600 }, { minQty: 201, maxQty: null, pricePerUnit: 2400 }] },
    { name: 'Mats - Daris (Palm)', slug: 'mats-daris-palm', description: 'Traditional palm leaf mat (Daris). Handcrafted in Barisal.', brand: 'Barisal Craft', unit: 'pcs', moq: 20, maxOrderQty: 1000, basePrice: 350, stockQuantity: 2000, categorySlug: 'home-garden', supplierIndex: 9,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 350 }, { minQty: 101, maxQty: 500, pricePerUnit: 320 }, { minQty: 501, maxQty: null, pricePerUnit: 290 }] },
    { name: 'Flower Pot - Ceramic', slug: 'flower-pot-ceramic', description: 'Ceramic flower pot. Available in multiple sizes and colors.', brand: 'BD Ceramic', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 180, stockQuantity: 6000, categorySlug: 'home-garden', supplierIndex: 12,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 180 }, { minQty: 201, maxQty: 1000, pricePerUnit: 165 }, { minQty: 1001, maxQty: null, pricePerUnit: 150 }] },

    // ===== Health & Medical (5 products) =====
    { name: 'Surgical Mask - 3 Ply', slug: 'surgical-mask-3ply', description: '3-ply surgical mask. BFE > 95%. For medical and general use.', brand: 'BD Med', unit: 'pcs', moq: 1000, maxOrderQty: 100000, basePrice: 5, stockQuantity: 100000, categorySlug: 'health-medical', supplierIndex: 18,
      priceTiers: [{ minQty: 1000, maxQty: 10000, pricePerUnit: 5 }, { minQty: 10001, maxQty: 50000, pricePerUnit: 4.2 }, { minQty: 50001, maxQty: null, pricePerUnit: 3.5 }] },
    { name: 'N95 Mask', slug: 'n95-mask', description: 'N95 respirator mask. FDA approved for medical use.', brand: 'BD Med', unit: 'pcs', moq: 500, maxOrderQty: 20000, basePrice: 45, stockQuantity: 30000, categorySlug: 'health-medical', supplierIndex: 18,
      priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 45 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 40 }, { minQty: 10001, maxQty: null, pricePerUnit: 35 }] },
    { name: 'Hand Sanitizer - 500ml', slug: 'hand-sanitizer-500ml', description: 'Alcohol-based hand sanitizer 500ml. 70% ethyl alcohol.', brand: 'Savlon BD', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 120, stockQuantity: 15000, categorySlug: 'health-medical', supplierIndex: 18,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 120 }, { minQty: 501, maxQty: 2000, pricePerUnit: 108 }, { minQty: 2001, maxQty: null, pricePerUnit: 98 }] },
    { name: 'Disposable Gloves - Latex', slug: 'disposable-gloves-latex', description: 'Latex disposable gloves. Box of 100. For medical and food handling.', brand: 'BD Med', unit: 'box', moq: 50, maxOrderQty: 5000, basePrice: 350, stockQuantity: 5000, categorySlug: 'health-medical', supplierIndex: 18,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 350 }, { minQty: 201, maxQty: 1000, pricePerUnit: 320 }, { minQty: 1001, maxQty: null, pricePerUnit: 295 }] },
    { name: 'First Aid Kit - Standard', slug: 'first-aid-kit-standard', description: 'Standard first aid kit with essential medical supplies.', brand: 'BD Med', unit: 'pcs', moq: 20, maxOrderQty: 1000, basePrice: 850, stockQuantity: 2000, categorySlug: 'health-medical', supplierIndex: 18,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 850 }, { minQty: 101, maxQty: 500, pricePerUnit: 780 }, { minQty: 501, maxQty: null, pricePerUnit: 720 }] },

    // ===== Gifts & Crafts (4 products) =====
    { name: 'Nakshi Kantha - Embroidered', slug: 'nakshi-kantha-embroidered', description: 'Traditional Nakshi Kantha embroidered quilt. Handcrafted by rural women.', brand: 'Rajshahi Craft', unit: 'pcs', moq: 5, maxOrderQty: 200, basePrice: 1800, stockQuantity: 300, categorySlug: 'gifts-crafts', supplierIndex: 2,
      priceTiers: [{ minQty: 5, maxQty: 20, pricePerUnit: 1800 }, { minQty: 21, maxQty: 100, pricePerUnit: 1650 }, { minQty: 101, maxQty: null, pricePerUnit: 1500 }] },
    { name: 'Brass Showpiece - Boat', slug: 'brass-showpiece-boat', description: 'Handmade brass showpiece - traditional Bangladeshi boat design.', brand: 'Dhaka Craft', unit: 'pcs', moq: 10, maxOrderQty: 500, basePrice: 950, stockQuantity: 800, categorySlug: 'gifts-crafts', supplierIndex: 0,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 950 }, { minQty: 51, maxQty: 200, pricePerUnit: 880 }, { minQty: 201, maxQty: null, pricePerUnit: 820 }] },
    { name: 'Terracotta Pot - Decorative', slug: 'terracotta-pot-decorative', description: 'Decorative terracotta pot. Traditional Bengali design.', brand: 'Rajshahi Craft', unit: 'pcs', moq: 20, maxOrderQty: 1000, basePrice: 280, stockQuantity: 2000, categorySlug: 'gifts-crafts', supplierIndex: 2,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 280 }, { minQty: 101, maxQty: 500, pricePerUnit: 255 }, { minQty: 501, maxQty: null, pricePerUnit: 230 }] },
    { name: 'Bamboo Basket - Dokra', slug: 'bamboo-basket-dokra', description: 'Handwoven bamboo basket with Dokra art motif. Eco-friendly gift.', brand: 'Sylhet Craft', unit: 'pcs', moq: 10, maxOrderQty: 500, basePrice: 450, stockQuantity: 1000, categorySlug: 'gifts-crafts', supplierIndex: 4,
      priceTiers: [{ minQty: 10, maxQty: 50, pricePerUnit: 450 }, { minQty: 51, maxQty: 200, pricePerUnit: 420 }, { minQty: 201, maxQty: null, pricePerUnit: 390 }] },

    // ===== Promotional Items (3 products) =====
    { name: 'Custom Mug - Ceramic', slug: 'custom-mug-ceramic', description: 'Ceramic mug with custom logo printing. 11oz standard.', brand: 'BD Promo', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 65, stockQuantity: 15000, categorySlug: 'promotional-items', supplierIndex: 0,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 65 }, { minQty: 501, maxQty: 2000, pricePerUnit: 55 }, { minQty: 2001, maxQty: null, pricePerUnit: 48 }] },
    { name: 'Custom Pen - Ballpoint', slug: 'custom-pen-ballpoint', description: 'Ballpoint pen with custom branding. Blue ink, retractable.', brand: 'BD Promo', unit: 'pcs', moq: 500, maxOrderQty: 50000, basePrice: 8, stockQuantity: 50000, categorySlug: 'promotional-items', supplierIndex: 0,
      priceTiers: [{ minQty: 500, maxQty: 2000, pricePerUnit: 8 }, { minQty: 2001, maxQty: 10000, pricePerUnit: 6.5 }, { minQty: 10001, maxQty: null, pricePerUnit: 5 }] },
    { name: 'Custom Cap - Embroidered', slug: 'custom-cap-embroidered', description: 'Baseball cap with custom embroidered logo. Adjustable strap.', brand: 'BD Promo', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 95, stockQuantity: 10000, categorySlug: 'promotional-items', supplierIndex: 0,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 95 }, { minQty: 501, maxQty: 2000, pricePerUnit: 85 }, { minQty: 2001, maxQty: null, pricePerUnit: 75 }] },

    // ===== Automotive & Transport (3 products) =====
    { name: 'Engine Oil - 20W50 4L', slug: 'engine-oil-20w50', description: 'Multi-grade engine oil 20W50 4L can. For petrol and diesel engines.', brand: 'BD Lube', unit: 'pcs', moq: 20, maxOrderQty: 2000, basePrice: 650, stockQuantity: 3000, categorySlug: 'automotive-transport', supplierIndex: 5,
      priceTiers: [{ minQty: 20, maxQty: 100, pricePerUnit: 650 }, { minQty: 101, maxQty: 500, pricePerUnit: 600 }, { minQty: 501, maxQty: null, pricePerUnit: 560 }] },
    { name: 'Auto Battery - 12V 45Ah', slug: 'auto-battery-12v', description: '12V 45Ah maintenance-free automotive battery.', brand: 'Rahimafrooz', unit: 'pcs', moq: 5, maxOrderQty: 500, basePrice: 4500, stockQuantity: 1000, categorySlug: 'automotive-transport', supplierIndex: 5,
      priceTiers: [{ minQty: 5, maxQty: 20, pricePerUnit: 4500 }, { minQty: 21, maxQty: 100, pricePerUnit: 4200 }, { minQty: 101, maxQty: null, pricePerUnit: 3950 }] },
    { name: 'Bicycle Tire - 26 inch', slug: 'bicycle-tire-26inch', description: '26-inch bicycle tire with inner tube. For standard cycle rickshaw/bicycle.', brand: 'BD Cycle', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 280, stockQuantity: 8000, categorySlug: 'automotive-transport', supplierIndex: 5,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 280 }, { minQty: 201, maxQty: 1000, pricePerUnit: 255 }, { minQty: 1001, maxQty: null, pricePerUnit: 235 }] },

    // ===== Leather & Footwear (3 products) =====
    { name: 'Leather Wallet - Bi-fold', slug: 'leather-wallet-bifold', description: 'Genuine leather bi-fold wallet. Card slots and cash compartment.', brand: 'BD Leather', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 350, stockQuantity: 5000, categorySlug: 'leather-footwear', supplierIndex: 16,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 350 }, { minQty: 201, maxQty: 1000, pricePerUnit: 320 }, { minQty: 1001, maxQty: null, pricePerUnit: 290 }] },
    { name: 'Leather Belt - Genuine', slug: 'leather-belt-genuine', description: 'Genuine leather belt with brass buckle. 42-inch standard.', brand: 'BD Leather', unit: 'pcs', moq: 50, maxOrderQty: 5000, basePrice: 280, stockQuantity: 4000, categorySlug: 'leather-footwear', supplierIndex: 16,
      priceTiers: [{ minQty: 50, maxQty: 200, pricePerUnit: 280 }, { minQty: 201, maxQty: 1000, pricePerUnit: 255 }, { minQty: 1001, maxQty: null, pricePerUnit: 230 }] },
    { name: 'Sandals - PVC Sole', slug: 'sandals-pvc-sole', description: 'PVC sole sandals with synthetic leather upper. Comfortable daily wear.', brand: 'Apex', unit: 'pcs', moq: 100, maxOrderQty: 10000, basePrice: 220, stockQuantity: 10000, categorySlug: 'leather-footwear', supplierIndex: 16,
      priceTiers: [{ minQty: 100, maxQty: 500, pricePerUnit: 220 }, { minQty: 501, maxQty: 2000, pricePerUnit: 200 }, { minQty: 2001, maxQty: null, pricePerUnit: 180 }] },
  ]

  console.log(`  📦 Creating ${productsData.length} products...`)

  // Create products in batches
  const BATCH_SIZE = 20
  const allProducts: { id: string; supplierId: string; categoryId: string }[] = []

  for (let i = 0; i < productsData.length; i += BATCH_SIZE) {
    const batch = productsData.slice(i, i + BATCH_SIZE)
    const created = await db.$transaction(
      batch.map((p) =>
        db.products.create({
          data: {
            supplierId: allSupplierIds[p.supplierIndex],
            categoryId: categoryMap.get(p.categorySlug)!,
            name: p.name,
            slug: p.slug,
            description: p.description,
            brand: p.brand,
            unit: p.unit,
            moq: p.moq,
            maxOrderQty: p.maxOrderQty,
            basePrice: p.basePrice,
            currency: 'BDT',
            stockQuantity: p.stockQuantity,
            isActive: true,
            isApproved: true,
            thumbnailUrl: `/images/products/product-${i + batch.indexOf(p) + 1}.jpg`,
          },
        })
      )
    )
    allProducts.push(...created)
  }

  console.log(`  ✅ Created ${allProducts.length} products`)

  // Create product images and price tiers
  console.log('  🖼️ Creating product images & price tiers...')

  const allImagesData: { productId: string; imageUrl: string; sortOrder: number }[] = []
  const allPriceTiersData: { productId: string; minQty: number; maxQty: number | null; pricePerUnit: number }[] = []
  const allVariantsData: { productId: string; variantName: string; variantValue: string; sku: string; stockQuantity: number; priceOverride: number | null }[] = []

  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i]
    const productId = allProducts[i].id

    // 3 images per product
    for (let j = 0; j < 3; j++) {
      allImagesData.push({
        productId,
        imageUrl: `/images/products/product-${i + 1}-${j + 1}.jpg`,
        sortOrder: j,
      })
    }

    // Price tiers
    for (const tier of p.priceTiers) {
      allPriceTiersData.push({
        productId,
        minQty: tier.minQty,
        maxQty: tier.maxQty,
        pricePerUnit: tier.pricePerUnit,
      })
    }

    // Variants
    if (p.variants) {
      for (const v of p.variants) {
        allVariantsData.push({
          productId,
          variantName: v.name,
          variantValue: v.value,
          sku: v.sku,
          stockQuantity: v.stock,
          priceOverride: v.priceOverride ?? null,
        })
      }
    }
  }

  // Insert images in batches
  for (let i = 0; i < allImagesData.length; i += 100) {
    const batch = allImagesData.slice(i, i + 100)
    await db.$transaction(batch.map((img) => db.productImages.create({ data: img })))
  }

  // Insert price tiers in batches
  for (let i = 0; i < allPriceTiersData.length; i += 100) {
    const batch = allPriceTiersData.slice(i, i + 100)
    await db.$transaction(batch.map((tier) => db.productPriceTiers.create({ data: tier })))
  }

  // Insert variants in batches
  for (let i = 0; i < allVariantsData.length; i += 100) {
    const batch = allVariantsData.slice(i, i + 100)
    await db.$transaction(batch.map((v) => db.productVariants.create({ data: v })))
  }

  console.log(`  ✅ Created ${allImagesData.length} images, ${allPriceTiersData.length} price tiers, ${allVariantsData.length} variants`)

  // ============================================================
  // 4. Coupons
  // ============================================================
  console.log('🎫 Seeding coupons...')

  const now = new Date()
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  await db.coupons.createMany({
    data: [
      {
        code: 'BULK10',
        discountType: 'percentage',
        discountPercent: 10,
        maxDiscount: 5000,
        minOrderAmount: 5000,
        validFrom: now,
        validUntil: threeMonthsLater,
        usageLimit: 1000,
        usedCount: 0,
        isActive: true,
      },
      {
        code: 'WELCOME20',
        discountType: 'percentage',
        discountPercent: 20,
        maxDiscount: 2000,
        minOrderAmount: 1000,
        validFrom: now,
        validUntil: threeMonthsLater,
        usageLimit: 500,
        usedCount: 0,
        isActive: true,
      },
      {
        code: 'FIRST500',
        discountType: 'fixed',
        discountPercent: 500, // For fixed type, this represents the fixed amount
        maxDiscount: 500,
        minOrderAmount: 2000,
        validFrom: now,
        validUntil: oneMonthLater,
        usageLimit: 200,
        usedCount: 0,
        isActive: true,
      },
    ],
  })

  console.log('  ✅ Created 3 coupons: BULK10, WELCOME20, FIRST500')

  // ============================================================
  // 5. Buyer Addresses
  // ============================================================
  console.log('📍 Seeding buyer addresses...')

  const buyerAddressesData = [
    { userId: buyerUsers[0].id, label: 'Shop', addressLine1: '12 Nawabpur Road', addressLine2: 'Nawabpur', city: 'Dhaka', district: 'Dhaka', postalCode: '1000', isDefault: true },
    { userId: buyerUsers[0].id, label: 'Warehouse', addressLine1: '45 Old DH Road', addressLine2: 'Jatrabari', city: 'Dhaka', district: 'Dhaka', postalCode: '1204', isDefault: false },
    { userId: buyerUsers[1].id, label: 'Store', addressLine1: '78 Station Road', addressLine2: 'Chattogram Sadar', city: 'Chittagong', district: 'Chittagong', postalCode: '4000', isDefault: true },
    { userId: buyerUsers[2].id, label: 'Distribution Center', addressLine1: '23 Kushtia Road', addressLine2: 'Jhenaidah Sadar', city: 'Jhenaidah', district: 'Jhenaidah', postalCode: '7300', isDefault: true },
  ]

  await db.$transaction(
    buyerAddressesData.map((a) =>
      db.addresses.create({
        data: {
          userId: a.userId,
          label: a.label,
          addressLine1: a.addressLine1,
          addressLine2: a.addressLine2,
          city: a.city,
          district: a.district,
          postalCode: a.postalCode,
          country: 'Bangladesh',
          isDefault: a.isDefault,
        },
      })
    )
  )

  console.log('  ✅ Created buyer addresses')

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n' + '='.repeat(60))
  console.log('📊 SEED SUMMARY')
  console.log('='.repeat(60))

  const counts = {
    users: await db.users.count(),
    buyerProfiles: await db.buyerProfiles.count(),
    supplierProfiles: await db.supplierProfiles.count(),
    addresses: await db.addresses.count(),
    categories: await db.categories.count(),
    products: await db.products.count(),
    productImages: await db.productImages.count(),
    productPriceTiers: await db.productPriceTiers.count(),
    productVariants: await db.productVariants.count(),
    coupons: await db.coupons.count(),
  }

  console.log(`  Users:            ${counts.users}`)
  console.log(`  Buyer Profiles:   ${counts.buyerProfiles}`)
  console.log(`  Supplier Profiles:${counts.supplierProfiles}`)
  console.log(`  Addresses:        ${counts.addresses}`)
  console.log(`  Categories:       ${counts.categories}`)
  console.log(`  Products:         ${counts.products}`)
  console.log(`  Product Images:   ${counts.productImages}`)
  console.log(`  Price Tiers:      ${counts.productPriceTiers}`)
  console.log(`  Product Variants: ${counts.productVariants}`)
  console.log(`  Coupons:          ${counts.coupons}`)
  console.log('='.repeat(60))

  console.log('\n🔑 DEMO ACCOUNTS:')
  console.log('  Admin:     admin@zylod.com / admin123')
  console.log('  Buyer 1:   buyer1@zylod.com / buyer123')
  console.log('  Buyer 2:   buyer2@zylod.com / buyer123')
  console.log('  Buyer 3:   buyer3@zylod.com / buyer123')
  console.log('  Supplier1: supplier1@zylod.com / supplier123')
  console.log('  Supplier2: supplier2@zylod.com / supplier123')
  console.log('\n🎫 COUPONS:')
  console.log('  BULK10    - 10% off (max ৳5,000, min order ৳5,000)')
  console.log('  WELCOME20 - 20% off (max ৳2,000, min order ৳1,000)')
  console.log('  FIRST500  - ৳500 flat (min order ৳2,000)')

  console.log('\n✅ Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
