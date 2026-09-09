import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/sitemap
 * Returns the full navigational structure of the platform for display in the sitemap page.
 * Includes dynamic counts from the DB for products, categories, suppliers.
 */
export async function GET(request: NextRequest) {
  try {
    const [categoryCount, productCount, supplierCount] = await Promise.all([
      db.categories.count({ where: { isActive: true } }),
      db.products.count({ where: { isActive: true } }),
      db.supplierProfiles.count(),
    ])

    const sitemap = {
      shopping: {
        label: 'Shop & Browse',
        pages: [
          { id: 'home', label: 'Home', description: 'Platform homepage' },
          { id: 'category-browser', label: 'All Categories', description: `${categoryCount} active categories` },
          { id: 'product-list', label: 'All Products', description: `${productCount}+ wholesale products` },
          { id: 'supplier-directory', label: 'Supplier Directory', description: `${supplierCount} verified manufacturers` },
          { id: 'deals', label: 'Flash Deals', description: 'Limited-time wholesale offers' },
          { id: 'new-arrivals', label: 'New Arrivals', description: 'Latest factory additions' },
          { id: 'best-sellers', label: 'Best Sellers', description: 'Top performing products' },
          { id: 'search-home', label: 'Search', description: 'Find products, suppliers, categories' },
        ],
      },
      orders: {
        label: 'Orders & Logistics',
        pages: [
          { id: 'my-orders', label: 'My Orders', description: 'Track and manage bulk orders' },
          { id: 'cart', label: 'Cart', description: 'Review items before checkout' },
          { id: 'checkout', label: 'Checkout', description: 'Complete wholesale purchase' },
          { id: 'shipping-tracker', label: 'Track Shipment', description: 'Real-time delivery tracking' },
          { id: 'return-request', label: 'Return & Exchange', description: 'Initiate returns' },
          { id: 'invoice-list', label: 'Invoices', description: 'Download wholesale invoices' },
          { id: 'rfq-list', label: 'RFQ / Quote Request', description: 'Get custom pricing for bulk' },
        ],
      },
      account: {
        label: 'Account & Profile',
        pages: [
          { id: 'buyer-dashboard', label: 'Dashboard', description: 'Your wholesale overview' },
          { id: 'profile-settings', label: 'Profile Settings', description: 'Manage account details' },
          { id: 'security-settings', label: 'Security', description: '2FA, password, sessions' },
          { id: 'address-book', label: 'Address Book', description: 'Delivery addresses' },
          { id: 'business-profile', label: 'Business Profile', description: 'Company & tax information' },
          { id: 'payment-method', label: 'Payment Methods', description: 'Cards, bKash, bank accounts' },
          { id: 'wallet', label: 'Wallet', description: 'Balance, topup, transactions' },
          { id: 'notification-settings', label: 'Notifications', description: 'Manage alerts' },
        ],
      },
      marketing: {
        label: 'Rewards & Promotions',
        pages: [
          { id: 'coupons', label: 'Coupons', description: 'Browse wholesale discount codes' },
          { id: 'loyalty-points', label: 'Loyalty Points', description: 'Earn and redeem points' },
          { id: 'vip-membership', label: 'VIP Membership', description: 'Gold, Platinum, Enterprise tiers' },
          { id: 'referral-program', label: 'Refer & Earn', description: 'Invite buyers for rewards' },
          { id: 'affiliate-program', label: 'Affiliate Program', description: 'Commission-based partner program' },
          { id: 'spin-win', label: 'Spin & Win', description: 'Daily prize wheel' },
          { id: 'daily-checkin', label: 'Daily Check-in', description: 'Earn streak bonuses' },
          { id: 'group-buy', label: 'Group Buy', description: 'Pool orders for better pricing' },
          { id: 'live-shopping', label: 'Live Shopping', description: 'Factory live broadcasts' },
        ],
      },
      legal: {
        label: 'Legal & Policies',
        pages: [
          { id: 'terms-of-service', label: 'Terms of Service', description: 'Platform usage terms' },
          { id: 'privacy-policy', label: 'Privacy Policy', description: 'How we handle your data' },
          { id: 'return-policy', label: 'Return Policy', description: 'Return and refund terms' },
          { id: 'shipping-policy', label: 'Shipping Policy', description: 'Delivery terms and zones' },
          { id: 'payment-terms', label: 'Payment Terms', description: 'Accepted payment methods and terms' },
          { id: 'wholesale-terms', label: 'Wholesale Terms', description: 'B2B agreement terms' },
          { id: 'cookie-policy', label: 'Cookie Policy', description: 'Cookie usage and preferences' },
          { id: 'dmca-policy', label: 'DMCA Policy', description: 'Copyright protection process' },
        ],
      },
      company: {
        label: 'Company',
        pages: [
          { id: 'about-us', label: 'About Us', description: 'Our story, mission, and values' },
          { id: 'careers-page', label: 'Careers', description: 'Open positions at Zylod' },
          { id: 'press-media', label: 'Press & Media', description: 'News, press releases, media kit' },
          { id: 'investor-relations', label: 'Investor Relations', description: 'Financial reports and filings' },
          { id: 'sitemap', label: 'Sitemap', description: 'Complete site structure' },
        ],
      },
      support: {
        label: 'Help & Support',
        pages: [
          { id: 'help-center', label: 'Help Center', description: 'Articles and guides' },
          { id: 'faq', label: 'FAQs', description: 'Frequently asked questions' },
          { id: 'contact-us', label: 'Contact Us', description: 'Get in touch with our team' },
          { id: 'live-chat', label: 'Live Chat', description: 'Real-time support' },
          { id: 'submit-ticket', label: 'Submit Ticket', description: 'Create a support request' },
          { id: 'safety-center', label: 'Safety Center', description: 'Fraud prevention and security' },
          { id: 'report-problem', label: 'Report Problem', description: 'Report platform issues' },
        ],
      },
      appLevel: {
        label: 'App & System Engine',
        pages: [
          { id: 'app-settings', label: 'App Settings', description: 'General preferences, biometrics & network' },
          { id: 'storage-management', label: 'Storage Manager', description: 'Device space & SQLite caches' },
          { id: 'cache-settings', label: 'Cache Settings', description: 'LRU image cache & ServiceWorker' },
          { id: 'app-update', label: 'App Update & APK', description: 'Version checker & Android APK build' },
          { id: 'maintenance-mode', label: 'Maintenance Status', description: 'Scheduled maintenance windows' },
          { id: 'error-404', label: 'Page Not Found (404)', description: 'Broken link recovery & search' },
          { id: 'error-500', label: 'Server Error (500)', description: 'Crash telemetry & live health' },
          { id: 'offline-mode', label: 'Offline Engine', description: 'Offline wholesale database & sync queue' },
          { id: 'deep-link-handler', label: 'Deep Link Handler', description: 'App Link routing & QR generator' },
        ],
      },
    }

    return NextResponse.json({
      success: true,
      data: sitemap,
      stats: { categoryCount, productCount, supplierCount },
    })
  } catch (error) {
    console.error('Sitemap GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
