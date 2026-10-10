import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding App-Level System Configuration, Versions, and Deep Links...')

  // 1. App System Settings
  const settingsData = [
    { key: 'app_name', value: 'Zylod Wholesale', category: 'general', description: 'Official App Display Name' },
    { key: 'min_order_bdt', value: '5000', category: 'general', description: 'Default Platform MOQ Amount in BDT' },
    { key: 'network_timeout_ms', value: '15000', category: 'network', description: 'HTTP Request Timeout' },
    { key: 'offline_cache_max_mb', value: '250', category: 'storage', description: 'Max Local Storage Allocation' },
    { key: 'enable_biometric_login', value: 'true', category: 'security', description: 'Biometric Face/Fingerprint Auth' },
    { key: 'auto_sync_interval_mins', value: '15', category: 'sync', description: 'Background Offline Queue Sync Rate' },
    { key: 'image_cache_quality', value: 'high', category: 'cache', description: 'WebP / AVIF High-Res Factory Swatches' },
  ]

  for (const s of settingsData) {
    await prisma.appSystemSettings.upsert({
      where: { key: s.key },
      update: s,
      create: s,
    })
  }

  // 2. App Versions (Android, iOS, Web)
  const versionsData = [
    {
      platform: 'android',
      versionNumber: '2.4.0',
      versionCode: 240,
      minSupportedVersion: '2.0.0',
      isMandatory: false,
      changelogEn: `- Added Native Android Live Factory Shopping hardware-accelerated video player\n- Instant SafePay Escrow multi-sign biometric authentication\n- Offline product catalogue sync for remote warehouse operations\n- 40% faster bulk image caching and background consignment tracking`,
      changelogBn: `- লাইভ ফ্যাক্টরি স্ট্রিমিং ও উন্নত ভিডিও প্লেয়ার\n- সেফপে এসক্রো বায়োমেট্রিক অথেন্টিকেশন\n- অফলাইন ক্যাটালগ সিঙ্ক`,
      apkDownloadUrl: '/downloads/zylod-b2b-v2.4.0.apk',
      apkSizeBytes: BigInt(28500000), // ~28.5MB
      releaseNotes: 'Production Release 2.4.0 for Android 10+ devices',
      isPublished: true,
    },
    {
      platform: 'android',
      versionNumber: '2.3.1',
      versionCode: 231,
      minSupportedVersion: '2.0.0',
      isMandatory: false,
      changelogEn: `- Fixed Bluetooth barcode scanner compatibility\n- Improved bKash Merchant webhook latency`,
      changelogBn: `- বারকোড স্ক্যানার বাগ ফিক্স`,
      apkDownloadUrl: '/downloads/zylod-b2b-v2.3.1.apk',
      apkSizeBytes: BigInt(27800000),
      releaseNotes: 'Maintenance patch',
      isPublished: true,
    },
  ]

  for (const v of versionsData) {
    await prisma.appVersions.upsert({
      where: { id: `android-v${v.versionCode}` },
      update: v,
      create: { id: `android-v${v.versionCode}`, ...v },
    })
  }

  // 3. Maintenance Schedules
  await prisma.maintenanceSchedules.upsert({
    where: { id: 'maint-2026-q3' },
    update: {
      title: 'Scheduled Core Database Optimization',
      messageEn: 'Zylod will undergo routine database indexing on Sunday, 02:00 AM - 04:00 AM BST. Checkout will remain available.',
      messageBn: 'নিয়মিত ডাটাবেজ অপ্টিমাইজেশনের জন্য রবিবার রাত ২টা থেকে ৪টা পর্যন্ত রক্ষণাবেক্ষণ চলবে।',
      scheduledStart: new Date(Date.now() + 86400000 * 3),
      scheduledEnd: new Date(Date.now() + 86400000 * 3 + 7200000),
      isActive: false,
      affectedServices: 'escrow_settlements',
    },
    create: {
      id: 'maint-2026-q3',
      title: 'Scheduled Core Database Optimization',
      messageEn: 'Zylod will undergo routine database indexing on Sunday, 02:00 AM - 04:00 AM BST. Checkout will remain available.',
      messageBn: 'নিয়মিত ডাটাবেজ অপ্টিমাইজেশনের জন্য রবিবার রাত ২টা থেকে ৪টা পর্যন্ত রক্ষণাবেক্ষণ চলবে।',
      scheduledStart: new Date(Date.now() + 86400000 * 3),
      scheduledEnd: new Date(Date.now() + 86400000 * 3 + 7200000),
      isActive: false,
      affectedServices: 'escrow_settlements',
    },
  })

  // 4. Deep Link Routes
  const deepLinks = [
    { slug: 'product', pathPattern: '/product/:id', targetPage: 'product-detail', description: 'Direct wholesale product details' },
    { slug: 'supplier', pathPattern: '/supplier/:id', targetPage: 'supplier-storefront', description: 'Direct factory mill storefront' },
    { slug: 'deal', pathPattern: '/deals/exclusive/:id', targetPage: 'exclusive-deal-detail', description: 'Exclusive bulk discount link' },
    { slug: 'rfq', pathPattern: '/rfq/create', targetPage: 'rfq-list', description: 'Instant bulk quotation request' },
    { slug: 'order', pathPattern: '/order/:id/track', targetPage: 'shipping-tracker', description: 'Real-time courier telemetry tracker' },
    { slug: 'live', pathPattern: '/live/:id', targetPage: 'live-shopping-detail', description: 'Live factory broadcast stream' },
  ]

  for (const d of deepLinks) {
    await prisma.deepLinkRoutes.upsert({
      where: { slug: d.slug },
      update: d,
      create: d,
    })
  }

  // 5. App Diagnostics
  const diagnosticsData = [
    { serviceName: 'postgres_primary_db', status: 'healthy', responseTimeMs: 8, detailsJson: '{"poolSize": 20, "activeConnections": 4}' },
    { serviceName: 'safepay_escrow_ledger', status: 'healthy', responseTimeMs: 12, detailsJson: '{"vaultStatus": "operational", "bankSLA": "99.98%"}' },
    { serviceName: 'logistics_telemetry_carrier_api', status: 'healthy', responseTimeMs: 24, detailsJson: '{"steadfast": "online", "pathao": "online", "redx": "online"}' },
    { serviceName: 'redis_cache_cluster', status: 'healthy', responseTimeMs: 2, detailsJson: '{"hitRatio": "94.2%", "memoryUsedMB": 118}' },
  ]

  await prisma.appDiagnostics.deleteMany({})
  for (const diag of diagnosticsData) {
    await prisma.appDiagnostics.create({ data: diag })
  }

  console.log('Seeded all App-Level settings, versions, deep links, and diagnostics successfully!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
