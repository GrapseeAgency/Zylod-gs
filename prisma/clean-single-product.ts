import { db } from '../src/lib/db'
import { hash } from 'bcryptjs'

async function cleanAndKeepOne() {
  console.log('🧹 Cleaning database to keep only ONE authentic product...')

  // Truncate public tables
  await db.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations') LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename);
      END LOOP;
    END $$;
  `)

  console.log('✅ All tables cleaned.')

  // 1. Create 1 Main Category
  const category = await db.categories.create({
    data: {
      name: 'Electronics & Gadgets',
      slug: 'electronics-gadgets',
      iconUrl: '/icons/electronics.svg',
      isActive: true,
      sortOrder: 1,
    }
  })

  // 2. Create 1 Admin & 1 Supplier User
  const passwordHash = await hash('admin123', 10)
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
    }
  })

  const supplierUser = await db.users.create({
    data: {
      userType: 'supplier',
      email: 'supplier@zylod.com',
      phone: '+8801700000002',
      passwordHash,
      authProvider: 'email',
      accountStatus: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
    }
  })

  // 3. Create 1 Supplier Profile
  const supplierProfile = await db.supplierProfiles.create({
    data: {
      userId: supplierUser.id,
      companyName: 'Zylod Official Wholesale Depot',
      nidNumber: '19871234567890',
      nidFrontImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      nidBackImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      tradeLicenseNumber: 'TRAD/DNCC/092812',
      tradeLicenseImageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      tinNumber: '782910293847',
      bankAccountName: 'Zylod Official Wholesale Depot',
      bankAccountNumber: '1501203948571001',
      bankName: 'BRAC Bank PLC',
      branch: 'Gulshan 1, Dhaka',
      verificationStatus: 'approved',
      ratingAvg: 5.0,
      ratingCount: 1,
    }
  })

  // 4. Create Storefront Customization
  await db.sellerStoreCustomizations.create({
    data: {
      supplierId: supplierProfile.id,
      bannerUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200',
      logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200',
      theme: 'default',
      layout: 'grid',
      font: 'inter',
      showRatings: true,
      showContactInfo: true,
      showCategories: true,
      customSections: JSON.stringify({
        foundedYear: '2024',
        factorySizeSqFt: '25,000 Sq. Ft.',
        workforceCount: '50+ Engineers & Staff',
        productionCapacityMonthly: '10,000 Units',
        aboutBio: 'Official flagship supplier offering guaranteed authentic wholesale products with full warranty and bulk tier discounts.',
        mainExportMarkets: ['Bangladesh', 'South Asia'],
        certifications: ['ISO 9001:2015', 'CE Certified']
      })
    }
  })

  // 5. Create Exactly ONE Authentic Product
  const singleProduct = await db.products.create({
    data: {
      supplierId: supplierProfile.id,
      categoryId: category.id,
      name: 'Industrial Precision Heavy-Duty Angle Grinder 850W (Wholesale Batch)',
      slug: 'industrial-heavy-duty-angle-grinder-850w',
      sku: 'ZYL-ELEC-GR850',
      description: 'High-performance commercial grade angle grinder engineered for continuous cutting, grinding, and surface preparation. Features all-copper motor, heat dissipation airflow vents, safety trigger lock, and ergonomic shock-absorbing handle.',
      brand: 'Zylod Heavy Industries',
      unit: 'pcs',
      moq: 10,
      maxOrderQty: 1000,
      basePrice: 2850.00,
      currency: 'BDT',
      stockQuantity: 450,
      isActive: true,
      isApproved: true,
      isCustomizable: true,
      thumbnailUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600',
      soldCount: 0,
      ratingAvg: 5.0,
      reviewCount: 0,
      priceTiers: {
        create: [
          { minQty: 10, maxQty: 49, pricePerUnit: 2850.00 },
          { minQty: 50, maxQty: 199, pricePerUnit: 2650.00 },
          { minQty: 200, maxQty: 1000, pricePerUnit: 2400.00 },
        ]
      },
      images: {
        create: [
          { imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600', sortOrder: 0 },
          { imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600', sortOrder: 1 },
          { imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600', sortOrder: 2 },
        ]
      },
      variants: {
        create: [
          { variantName: 'Power & Disc Size', variantValue: '850W - 100mm Disc', sku: 'ZYL-GR850-100', priceOverride: 2850.00, stockQuantity: 250 },
          { variantName: 'Power & Disc Size', variantValue: '1050W - 125mm Disc', sku: 'ZYL-GR1050-125', priceOverride: 3450.00, stockQuantity: 200 },
        ]
      }
    }
  })

  // 6. Create Default Seller Shipping Config
  await db.sellerShippingConfigs.createMany({
    data: [
      { supplierId: supplierProfile.id, zone: 'dhaka', baseRate: 120, ratePerKg: 30, freeAboveAmount: 25000, estimatedDays: '1-2 Days' },
      { supplierId: supplierProfile.id, zone: 'all', baseRate: 200, ratePerKg: 50, freeAboveAmount: 50000, estimatedDays: '3-4 Days' }
    ]
  })

  // 7. Create Default Return Policy
  await db.sellerReturnPolicies.create({
    data: {
      supplierId: supplierProfile.id,
      policyType: 'return',
      returnWindowDays: 7,
      exchangeAllowed: true,
      refundMethod: 'original_payment',
      restockingFeePct: 0,
      conditions: JSON.stringify(['Defective on arrival', 'Wrong item received', 'Unopened batch package']),
      isActive: true
    }
  })

  console.log(`\n🎉 Database Cleaned! Exactly 1 product retained: "${singleProduct.name}" (ID: ${singleProduct.id})`)
}

cleanAndKeepOne()
  .catch(err => {
    console.error('Error cleaning database:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
