import { db } from '../src/lib/db'

async function main() {
  console.log('Seeding real B2B Wholesale notifications & alerts into PostgreSQL...')

  const users = await db.users.findMany({ select: { id: true, email: true } })
  if (users.length === 0) {
    console.log('No users found in database to seed notifications for.')
    return
  }

  const products = await db.products.findMany({ select: { id: true, name: true, basePrice: true, thumbnailUrl: true }, take: 5 })
  const defaultProd = products[0] || {
    id: 'prod-sample-yarn-101',
    name: '100% Combed Ring-Spun Cotton Yarn 30s/1',
    basePrice: 480,
    thumbnailUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=400&q=80',
  }

  for (const user of users) {
    console.log(`Seeding notifications for user ${user.email} (${user.id})...`)

    // 1. Notification Preferences
    await db.notificationPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        pushOrderUpdates: true,
        pushPromotions: true,
        pushPriceDrops: true,
        pushBackInStock: true,
        pushDelivery: true,
        pushChat: true,
        pushSystem: true,
        emailOrderUpdates: true,
        emailPromotions: false,
        emailPriceDrops: true,
        emailBackInStock: true,
        emailDelivery: true,
        notificationSound: 'default',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        digestEnabled: true,
        mentionNotify: true,
      },
      update: {
        pushOrderUpdates: true,
        pushPromotions: true,
        pushPriceDrops: true,
        pushBackInStock: true,
        pushDelivery: true,
      },
    })

    // 2. Clear old demo notifications for this user
    await db.notifications.deleteMany({ where: { userId: user.id } })

    // 3. Insert rich realistic Bangladesh B2B Wholesale Notifications
    const seedNotifs = [
      {
        userId: user.id,
        type: 'delivery',
        title: 'Courier In Transit: Consignment #STF-849201',
        body: 'Your wholesale carton package (200 units) has been picked up by Steadfast Courier Dhaka Central Hub and is out for nationwide transit. Expected arrival tomorrow by 4:00 PM.',
        isRead: false,
        relatedEntityId: defaultProd.id,
      },
      {
        userId: user.id,
        type: 'order',
        title: 'Order ORD-2026-9812 Confirmed by Factory',
        body: 'Apex Garments & Textiles has acknowledged your purchase order for 500 pcs Cotton Knit Fabric. SafePay Escrow deposit of ৳185,000 has been secured in your vault.',
        isRead: false,
        relatedEntityId: defaultProd.id,
      },
      {
        userId: user.id,
        type: 'price_drop',
        title: 'Price Drop Alert: 100% Combed Yarn',
        body: 'Good news! Direct mill rate for 100% Combed Ring-Spun Cotton Yarn dropped to ৳450/kg (saving ৳30/kg) matching your wholesale target alert.',
        isRead: false,
        relatedEntityId: defaultProd.id,
      },
      {
        userId: user.id,
        type: 'promotion',
        title: '⚡ Narayanganj Textile Mega Flash Sale (Up to 25% Off)',
        body: 'Over 40 verified export-quality garment and yarn mills in Narayanganj are offering limited-time tier discounts on 1,000+ unit MOQ orders until midnight Friday.',
        isRead: true,
        relatedEntityId: defaultProd.id,
      },
      {
        userId: user.id,
        type: 'back_in_stock',
        title: 'Restocked: Industrial Heavy-Duty Packaging Tape (100m Roll)',
        body: 'Bengal Polymer Industries has replenished 1,200 cartons in their Gazipur warehouse. MOQ 50 cartons ready for dispatch.',
        isRead: true,
        relatedEntityId: defaultProd.id,
      },
      {
        userId: user.id,
        type: 'system',
        title: 'NBR Mushak-6.3 VAT Invoice Generated',
        body: 'Official VAT challan Mushak-6.3 for your order ORD-2026-9740 is now available for download in compliance with Bangladesh Revenue regulations.',
        isRead: true,
        relatedEntityId: null,
      },
    ]

    for (const n of seedNotifs) {
      await db.notifications.create({ data: n })
    }

    // 4. Seed sample active Price Alerts
    await db.priceAlerts.deleteMany({ where: { userId: user.id } })
    await db.priceAlerts.create({
      data: {
        userId: user.id,
        productId: defaultProd.id,
        productName: defaultProd.name,
        productImage: defaultProd.thumbnailUrl,
        currentPrice: defaultProd.basePrice,
        targetPrice: Math.round(defaultProd.basePrice * 0.85),
        status: 'active',
      },
    })

    // 5. Seed sample Stock Alerts
    await db.stockAlerts.deleteMany({ where: { userId: user.id } })
    await db.stockAlerts.create({
      data: {
        userId: user.id,
        productId: defaultProd.id,
        productName: defaultProd.name,
        productImage: defaultProd.thumbnailUrl,
        status: 'active',
      },
    })
  }

  console.log('✅ Real wholesale notifications, price alerts, and stock alerts seeded successfully!')
}

main()
  .catch((e) => {
    console.error('Seed notifications error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
