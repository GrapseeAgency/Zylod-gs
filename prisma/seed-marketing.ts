import { db } from '../src/lib/db'

async function main() {
  console.log('Seeding real B2B Wholesale Marketing & Promotions data into PostgreSQL...')

  const users = await db.users.findMany({ select: { id: true, email: true } })
  const adminUser = users[0] || { id: 'admin-default', email: 'admin@zylod.com' }

  const products = await db.products.findMany({
    select: { id: true, name: true, basePrice: true, thumbnailUrl: true },
    take: 5,
  })
  const defaultProd = products[0] || {
    id: 'prod-sample-yarn-101',
    name: '100% Combed Ring-Spun Cotton Yarn 30s/1',
    basePrice: 480,
    thumbnailUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=400&q=80',
  }

  // 1. Seed Active Platform Coupons
  console.log('Seeding coupons...')
  const sampleCoupons = [
    {
      code: 'MEGAWHOLESALE500',
      discountType: 'fixed',
      discountPercent: 500, // value in BDT
      minOrderAmount: 5000,
      maxDiscount: 500,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 86400000),
      usageLimit: 10000,
      isActive: true,
    },
    {
      code: 'TEXTILE10',
      discountType: 'percentage',
      discountPercent: 10,
      minOrderAmount: 10000,
      maxDiscount: 2000,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 20 * 86400000),
      usageLimit: 5000,
      isActive: true,
    },
    {
      code: 'FREECARGO2026',
      discountType: 'fixed',
      discountPercent: 350,
      minOrderAmount: 15000,
      maxDiscount: 350,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 45 * 86400000),
      usageLimit: 2000,
      isActive: true,
    },
    {
      code: 'VIPFACTORY15',
      discountType: 'percentage',
      discountPercent: 15,
      minOrderAmount: 25000,
      maxDiscount: 5000,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 60 * 86400000),
      usageLimit: 1000,
      isActive: true,
    },
  ]

  for (const c of sampleCoupons) {
    await db.coupons.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    })
  }

  // 2. Seed Coupon Earning Tasks
  console.log('Seeding earning tasks...')
  const sampleTasks = [
    {
      type: 'first_order',
      title: 'Complete First Wholesale Purchase',
      description: 'Place your first bulk order with SafePay Escrow protection.',
      rewardLabel: '৳500 Voucher',
      rewardBDT: 500,
      iconColor: '#3B82F6',
      sortOrder: 1,
      isActive: true,
    },
    {
      type: 'review_photo',
      title: 'Submit Photo QC Review',
      description: 'Write a verified product review with carton packaging photos.',
      rewardLabel: '৳150 Voucher',
      rewardBDT: 150,
      iconColor: '#10B981',
      sortOrder: 2,
      isActive: true,
    },
    {
      type: 'referral',
      title: 'Invite 3 Wholesale Retailers',
      description: 'Share your unique referral link with fellow business owners.',
      rewardLabel: '৳1,000 Voucher',
      rewardBDT: 1000,
      iconColor: '#F59E0B',
      sortOrder: 3,
      isActive: true,
    },
    {
      type: 'checkin',
      title: '7-Day Check-in Streak',
      description: 'Open the Zylod app for 7 consecutive days to claim streak bonus.',
      rewardLabel: '৳300 Voucher',
      rewardBDT: 300,
      iconColor: '#6366F1',
      sortOrder: 4,
      isActive: true,
    },
  ]

  for (const t of sampleTasks) {
    const existing = await db.couponEarningTasks.findFirst({ where: { type: t.type } })
    if (existing) {
      await db.couponEarningTasks.update({ where: { id: existing.id }, data: t })
    } else {
      await db.couponEarningTasks.create({ data: t })
    }
  }

  // 3. Seed Group Buy Campaigns
  console.log('Seeding group buy campaigns...')
  const sampleGroupBuys = [
    {
      productId: defaultProd.id,
      title: '500-Carton Cotton Fabric Pool (Save 25%)',
      targetQty: 500,
      currentQty: 340,
      discountedPrice: Math.round(defaultProd.basePrice * 0.75),
      originalPrice: defaultProd.basePrice,
      expiresAt: new Date(Date.now() + 3 * 86400000),
      status: 'active',
    },
    {
      productId: defaultProd.id,
      title: '1,000-Unit Industrial Safety Helmets Tier',
      targetQty: 1000,
      currentQty: 820,
      discountedPrice: Math.round(defaultProd.basePrice * 0.7),
      originalPrice: defaultProd.basePrice,
      expiresAt: new Date(Date.now() + 5 * 86400000),
      status: 'active',
    },
  ]

  for (const gb of sampleGroupBuys) {
    const existing = await db.groupBuyCampaigns.findFirst({ where: { title: gb.title } })
    if (!existing) {
      await db.groupBuyCampaigns.create({ data: gb })
    }
  }

  // 4. Seed Live Shopping Broadcasts
  console.log('Seeding live streams...')
  const sampleStreams = [
    {
      supplierId: adminUser.id,
      title: 'Live From Narayanganj Mill: Summer Knitwear Showcase',
      description: 'Factory floor walk-through inspecting GSM fabric weights, stitching tension, and export lot MOQ negotiations.',
      isLive: true,
      viewerCount: 142,
      scheduledAt: new Date(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=600&q=80',
    },
    {
      supplierId: adminUser.id,
      title: 'Gazipur Packaging & Corrugated Box Direct Pricing',
      description: 'Exclusive bulk discounts on export cartons, adhesive tapes, and bubble wrap lots with instant live vouchers.',
      isLive: false,
      viewerCount: 0,
      scheduledAt: new Date(Date.now() + 24 * 3600000),
      thumbnailUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
    },
  ]

  for (const ls of sampleStreams) {
    const existing = await db.liveStreams.findFirst({ where: { title: ls.title } })
    if (!existing) {
      await db.liveStreams.create({ data: ls })
    }
  }

  // 5. Seed user coupons & loyalty points for existing users
  for (const user of users) {
    await db.buyerRewards.upsert({
      where: { buyerId: user.id },
      create: {
        buyerId: user.id,
        pointsBalance: 750,
        totalEarned: 1250,
        totalRedeemed: 500,
        tier: 'silver',
      },
      update: {},
    })

    // Seed sample claimed user coupons
    const existingUserCoupon = await db.userCoupons.findFirst({ where: { userId: user.id } })
    if (!existingUserCoupon) {
      await db.userCoupons.create({
        data: {
          userId: user.id,
          couponId: 'seed-voucher',
          code: 'WELCOMEWHOLESALE',
          title: 'Welcome Wholesale Voucher',
          discountStyle: 'fixed',
          discountLabel: '৳500 FLAT OFF',
          status: 'active',
          validUntil: new Date(Date.now() + 30 * 86400000),
          savingsBDT: 500,
          minOrderBDT: 3000,
          categoryLabel: 'Welcome Bonus',
          categoryColor: '#E53935',
        },
      })
    }

    // Seed affiliate profile
    await db.affiliateProfiles.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        affiliateCode: 'ZY-AFF-' + user.id.slice(-4).toUpperCase(),
        commissionRate: 0.05,
        totalClicks: 24,
        totalOrders: 3,
        totalEarnings: 8450,
        pendingPayout: 2450,
        paidPayout: 6000,
        status: 'active',
      },
      update: {},
    })
  }

  console.log('✅ Real Marketing & Promotions data seeded successfully!')
}

main()
  .catch((e) => {
    console.error('Seed marketing error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
