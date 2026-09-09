// Page loader — ultra-minimal, uses generic page types for most routes

import type { PageLoadResult, GenericPageType } from './page-chunks/types'
export type { GenericPageType, PageLoadResult }

import { CHUNK_CORE, loadChunkPage as loadCore } from './page-chunks/chunk-core'
import { CHUNK_MISC } from './page-chunks/chunk-misc'

const REAL_PAGES = new Set([
  'home', 'welcome', 'register', 'login', 'register-buyer', 'register-supplier',
  'otp-verification', 'forgot-password', 'reset-password', 'phone-verification',
  'email-verification', 'account-suspended', 'two-factor-auth', 'backup-codes', 'account-recovery',
  'product-detail', 'category-products', 'product-list', 'search-results', 'compare', 'product-comparison', 'filter-sort',
  'product-reviews', 'product-qa', 'write-review', 'upload-review-photos', 'product-specifications',
  'size-guide', 'bulk-pricing', 'wholesale-catalog', 'supplier-products', 'similar-products',
  'suppliers', 'rfq-list', 'blog', 'blog-post', 'events',
  'notifications-page',
  'data-sync', 'display-settings', 'shipping-policy-detail', 'misc', 'profile-settings',
  'browsing-history', 'coupons-offers', 'create-account', 'crop-image', 'crystal-clear', 'free-samples', 'market-trends', 'pdf-viewer', 'product-quick-view', 'promotion-banners', 'quick-view', 'reorder', 'team-management', 'wishlist-analytics', 'auction-page', 'b2b-services', 'bid-history', 'compliance-center', 'contract-management', 'digital-products', 'eco-friendly-products', 'enterprise', 'issue-tracker', 'price-list', 'quality-check', 'quick-links', 'seller-education',
  'explore-page', 'faq-page', 'favorites-page', 'live-shopping-page', 'new-arrivals-page', 'notification-preferences-page', 'referral-program-page', 'rfq-list-page', 'seller-analytics-page', 'seller-badge-levels-page', 'seller-payouts-page', 'vip-benefits-page', 'wishlist-share-page', 'checkout-page', 'seller-dashboard-page', 'sitemap-page', 'trending-products-page', 'wishlist-page', 'category-directory', 'categories-page', 'checkout-success', 'compare-products', 'currency-settings', 'dashboard', 'department-store', 'disputes-page', 'download-app', 'exclusive-deal', 'feedback-page', 'flash-sales', 'gdpr', 'global-search', 'history-page', 'image-search-results', 'membership-trends', 'mobile-app', 'notification-center', 'onboarding-guide', 'order-tracking', 'orders-history', 'pickup-points', 'pricing', 'product-catalog', 'product-reviews-list', 'promotions-page', 'purchase-history', 'raise-dispute', 'rate-products', 'recently-viewed-products', 'register-seller', 'return-management', 'returns-exchange', 'seller-fulfillment', 'seller-onboarding', 'seller-sales-report', 'supplier-onboarding', 'supplier-verification-page', 'support-center', 'support-tickets', 'system-status', 'trade-assurance', 'track-consignment', 'trending-now', 'trust-center', 'upgrade-plan', 'verification-center', 'vip-club', 'voice-search-results', 'warehouse-management', 'warranty-claims', 'wholesale-account', 'wholesale-pricing', 'wishlist-shared', 'about-store', 'account-dashboard', 'account-overview', 'add-listing', 'all-orders', 'all-products', 'all-reviews', 'analytics-dashboard', 'approved-suppliers', 'auth-callback', 'become-a-seller', 'bulk-enquiry', 'business-directory', 'buyer-insights', 'career-page', 'catalog-management', 'contact-page', 'custom-orders', 'customer-support', 'dashboard-overview', 'delivery-options', 'discount-center', 'docs-page', 'draft-orders', 'email-preferences', 'emergency-support', 'featured-suppliers', 'fulfillment-center', 'flash-sale-page', 'global-search-page', 'helpdesk', 'import-products', 'inquiry-page', 'instant-chat', 'job-listings', 'join-seller', 'loyalty-program', 'manufacturing-partners', 'marketplace-news', 'member-area', 'merchant-dashboard', 'messaging-center', 'newsletter', 'offers-page', 'order-bulk-actions', 'order-management-page', 'pending-orders', 'product-upload', 'rating-page', 'report-issue-page', 'return-page', 'reviews-page', 'reward-points', 'rfp', 'sell-with-us', 'seller-center', 'seller-guidelines', 'seller-help', 'seller-home', 'seller-policy', 'seller-signup', 'seller-store-settings', 'seller-tools', 'shipping-info', 'shipping-zones', 'shop-page', 'size-chart', 'spin-wheel', 'store-analytics', 'store-management', 'store-page', 'store-settings', 'subscription-plans', 'supplier-center', 'supplier-listing', 'supplier-resources', 'support-ticket', 'system-health', 'top-suppliers', 'track-package', 'upcoming-products', 'vendor-registration', 'verified-suppliers', 'vip-program', 'wallet-page', 'wholesale-buying',
  'frequently-bought', 'frequently-bought-together', 'product-variants',
  'cart', 'checkout', 'orders', 'my-orders', 'order-detail',
  'add-to-cart-confirm', 'add-to-cart-confirmation', 'bulk-order', 'bulk-order-form', 'quick-order', 'buy-now',
  'shipping-address', 'add-address', 'edit-address', 'delivery-method',
  'payment-method', 'add-payment-method', 'order-confirmation', 'order-summary', 'coupon-promo',
  'apply-credits', 'gift-card', 'order-invoice', 'split-payment', 'installment-payment',
  'track-order', 'order-timeline', 'cancel-order',
  'return-request', 'return-detail', 'exchange-request', 'refund-status', 'refund-detail',
  'order-receipt', 'order-invoice-download', 'dispute-center', 'dispute-detail', 'raise-complaint', 'order-feedback',
  'shipping-tracker', 'delivery-chat', 'delivery-confirmation', 'delivery-proof', 'missed-delivery',
  'reschedule-delivery', 'pickup-point', 'warehouse-locator', 'shipping-calculator', 'shipping-policies',
  'import-export-tracker', 'customs-clearance', 'freight-tracking',
  'profile', 'my-profile', 'seller-profile', 'admin-profile', 'staff-profile', 'buyer-profile',
  'edit-profile', 'profile-photo', 'account-settings', 'notification-preferences',
  'privacy-settings', 'language-settings', 'theme-settings', 'linked-accounts',
  'delete-account', 'account-verification-badge', 'business-profile', 'tax-information',
  'my-wallet', 'wallet', 'balance-overview', 'add-money', 'withdraw-money',
  'transaction-history', 'transaction-detail', 'bank-accounts', 'add-bank-account',
  'upi-payment-setup', 'credit-debit-cards', 'add-card', 'payment-history',
  'payment-pending', 'payment-failed', 'refund-to-wallet', 'earnings-dashboard',
  'commission-history', 'invoice-management', 'credit-score', 'credit-limit',
  'admin-dashboard', 'admin-reports', 'admin-moderation', 'supplier-dashboard', 'buyer-dashboard',
  'explore', 'discover', 'trending-products', 'trending', 'flash-sale', 'flash-deals', 'daily-deals', 'new-arrivals',
  'clearance', 'clearance-sale', 'seasonal-offers', 'seasonal-sale', 'brand-showcase', 'category-browser',
  // Wishlist & Favorites (121-128 + sub-pages)
  'wishlist', 'wishlist-detail', 'favorites', 'favorite-suppliers', 'favorite-products', 'favorite-categories',
  'save-for-later', 'save-for-later-detail',
  'recently-viewed', 'recently-searched',
  'collections', 'collection-detail', 'create-collection', 'edit-collection',
  'shared-wishlist', 'shared-wishlist-detail', 'wishlist-share',
  'price-drop-alerts', 'wishlist-sort-filter', 'bulk-add-to-cart',
  // Seller / Supplier Suite (129-150 + sub-pages)
  'seller-dashboard', 'supplier-dashboard',
  'seller-registration', 'seller-verification', 'seller-storefront',
  'add-product', 'seller-add-product', 'supplier-add-product',
  'edit-product', 'seller-edit-product',
  'product-listings-manager', 'seller-products-manager', 'supplier-products',
  'inventory-management', 'seller-inventory',
  'seller-order-management', 'seller-orders', 'supplier-orders',
  'seller-analytics', 'revenue-reports', 'seller-revenue',
  'seller-reviews', 'seller-promotions',
  'seller-shipping-settings', 'shipping-settings',
  'return-policy-settings', 'seller-return-policy',
  'seller-payouts', 'payouts',
  'seller-support',
  'bulk-upload-products', 'seller-bulk-upload',
  'product-performance',
  'customer-queries', 'seller-customer-queries',
  'seller-rankings',
  'store-customization', 'seller-store-customization',
  // Seller Sub-pages
  'seller-verification-upload', 'seller-verification-status', 'seller-badge-levels',
  'store-banner-editor', 'store-featured-products', 'store-story-about',
  'product-variant-matrix', 'product-pricing-tiers', 'product-spec-editor', 'product-media-gallery',
  'inventory-alerts', 'inventory-restock', 'inventory-warehouse-locations', 'inventory-audit-log',
  'seller-order-detail', 'seller-order-fulfillment', 'seller-order-cancellation', 'seller-order-disputes', 'seller-bulk-order-inquiry',
  'shipping-zone-editor', 'shipping-courier-integration', 'self-pickup-settings', 'return-claim-detail',
  'seller-sales-funnel', 'seller-traffic-sources', 'seller-customer-insights',
  'revenue-breakdown', 'seller-tax-invoices', 'seller-financial-statements', 'seller-payout-request', 'seller-payout-methods',
  'product-conversion-rate', 'seller-tier-benefits',
  'seller-review-reply', 'create-promotion', 'promotion-analytics', 'seller-flash-sale-nomination',
  'seller-create-ticket', 'seller-ticket-detail',
  'bulk-upload-template', 'bulk-upload-history', 'bulk-price-update',
  'customer-query-detail', 'customer-rfq-inbox', 'store-theme-customizer',
  'seller-quick-actions', 'seller-notifications-center',
  // Search & Navigation (151-158 + sub-pages)
  'search-home', 'search',
  'voice-search',
  'image-search', 'visual-search',
  'barcode-scanner', 'qr-scanner', 'scan-barcode',
  'search-suggestions', 'search-autocomplete',
  'search-history',
  'popular-searches', 'trending-searches',
  'category-navigation', 'all-categories',
  'search-filters',
  'trending-searches-sub',
  'saved-searches',
  'category-products-detail',
  'search-results-supplier',
  'visual-search-results',
  'barcode-result',
  'category-tree',
  'search-price-alert', 'price-alerts',
  'search-results-category',
  'advanced-search',
  'search-voice-history',
  // Support & Help (159-170 + Docs & Policy Sub-pages)
  'help-center', 'help', 'support',
  'faq', 'faqs',
  'contact-us', 'contact',
  'live-chat', 'chat-support',
  'chatbot', 'ai-assistant', 'support-bot',
  'submit-ticket', 'create-ticket', 'open-ticket',
  'ticket-detail', 'ticket',
  'report-problem', 'report-bug', 'report-issue',
  'report-user', 'report-seller', 'report-violation',
  'safety-center', 'trust-safety', 'safety',
  'community-guidelines', 'guidelines', 'rules',
  'feedback-suggestions', 'feedback', 'suggestions',
  'docs-browser', 'docs', 'documentation',
  'policy-detail', 'policy', 'terms', 'terms-of-service', 'terms-and-conditions', 'privacy', 'privacy-policy', 'cookies', 'cookie-policy', 'refund-policy', 'return-policy',
  'quality-guarantee', 'dispute-resolution', 'supplier-agreement', 'compliance', 'how-it-works', 'bulk-pricing-guide',
  'docs-search-results', 'docs-search',
  'prohibited-items', 'restricted-items',
  'dispute-resolution-guide', 'dispute-guide', 'arbitration-guide',
  'escrow-protection-guide', 'safepay-guide', 'escrow-guide',
  'seller-verification-guide', 'kyc-guide', 'supplier-guide', 'seller-guide',
  'buyer-protection-policy', 'buyer-protection',
  'logistics-delivery-policy', 'shipping-policy', 'delivery-policy',
  'tax-compliance-guide', 'vat-guide', 'tax-guide',
  // Notifications & Alerts (171-178 + Sub-pages)
  'notifications', 'notification-detail', 'push-notification-settings', 'notification-settings',
  'order-updates', 'promo-notifications', 'price-drop-alerts', 'back-in-stock-alerts', 'delivery-updates',
  'price-alert-create', 'stock-alert-create', 'notification-archive',
  'notification-sound-settings', 'notification-quiet-hours', 'notification-categories',
  'promo-preferences', 'delivery-tracking-alerts', 'order-status-subscriptions',
  'push-notification-per-channel', 'notification-filter', 'notification-search', 'notification-muted',
  'order-update-detail', 'delivery-update-detail', 'promo-detail', 'price-drop-detail', 'back-in-stock-detail',
  // Marketing & Promotions (179-194 + Sub-pages)
  'coupons', 'my-coupons', 'earn-coupons', 'spin-win', 'daily-checkin',
  'referral-program', 'affiliate-program', 'loyalty-points', 'points-history', 'redeem-points',
  'vip-membership', 'membership-tiers', 'exclusive-deals', 'group-buy', 'live-shopping', 'mini-games',
  'coupon-detail', 'spin-history', 'checkin-streak', 'referral-earnings', 'affiliate-dashboard',
  'points-detail', 'vip-benefits', 'exclusive-deal-detail', 'group-buy-detail', 'live-shopping-detail', 'game-history',
  // Legal & Policy (195-207 + Sub-pages)
  'terms-of-service', 'terms', 'terms-and-conditions', 'buyer-terms', 'seller-terms', 'terms-faq', 'terms-history',
  'privacy-policy', 'privacy', 'data-collection', 'data-rights', 'data-deletion', 'privacy-faq',
  'return-policy', 'refund-policy', 'return-process', 'non-returnable', 'return-faq',
  'shipping-policy', 'delivery-policy', 'logistics-delivery-policy', 'shipping-policy-detail', 'domestic-shipping', 'international-shipping', 'shipping-faq',
  'payment-terms', 'payment-methods-detail', 'credit-terms', 'payment-faq',
  'wholesale-terms', 'wholesale-agreement', 'wholesale-faq',
  'cookie-policy', 'cookies', 'cookie-preferences', 'cookie-faq',
  'dmca-policy', 'dmca-submit', 'dmca-faq',
  'about-us', 'company-milestones', 'leadership-team', 'company-values',
  'careers-page', 'careers', 'job-detail', 'job-apply', 'career-benefits', 'career-culture', 'career-internships', 'career-life',
  'press-media', 'press-release-detail', 'media-kit',
  'investor-relations', 'annual-report', 'financial-filings', 'investor-presentation', 'investor-contact',
  'sitemap',
  // App-Level & Native Android (208 - 216)
  'app-settings', 'general-settings', 'app-general-settings', 'display-settings', 'network-settings', 'app-network-settings',
  'security-settings', 'app-security-settings', 'app-language-settings', 'data-sync',
  'storage-management', 'storage-breakdown', 'clear-storage', 'clear-data', 'offline-data-manager',
  'cache-settings', 'cache-stats', 'image-cache', 'purge-cache', 'clear-cache',
  'app-update', 'update-changelog', 'version-history', 'update-history', 'apk-download',
  'maintenance-mode', 'maintenance-schedule', 'service-status',
  'error-404', 'broken-link-report', 'page-suggestions',
  'error-500', 'error-boundary', 'server-diagnostics', 'crash-report',
  'offline-mode', 'offline-content', 'offline-catalogue', 'offline-sync-queue', 'sync-queue', 'offline-orders',
  'deep-link-handler', 'link-configuration', 'link-generator', 'link-analytics', 'qr-deeplink',
])

const CATEGORY_IDS = new Set([
  'textiles-fabrics', 'agriculture-food', 'electronics', 'construction', 'packaging',
  'home-garden', 'gifts-crafts', 'beauty-personal-care', 'promotional-items', 'garments',
  'spices', 'mobile-accessories', 'led-lighting', 'automotive', 'sports-fitness',
  'books-stationery', 'toys', 'jewelry', 'medical-supplies', 'furniture',
])

const DEAL_IDS = new Set([
  'mega-sale', 'bulk-discounts', 'top-deals', 'week-special', 'group-buy',
  'pre-order', 'sample-orders', 'factory-direct', 'cross-border',
  'daily-deals', 'flash-sale', 'clearance', 'seasonal-offers', 'new-arrivals',
  'best-sellers', 'recommended', 'trending-products',
])

function getGenericType(pageId: string): GenericPageType | null {
  if (CATEGORY_IDS.has(pageId)) return 'category'
  if (DEAL_IDS.has(pageId)) return 'deals'
  if (pageId.startsWith('admin-') || pageId.startsWith('supplier-') ||
      pageId.startsWith('seller-') || pageId.startsWith('buyer-')) return 'info'
  if (pageId.includes('payment') || pageId.includes('wallet') || pageId.includes('invoice') ||
      pageId.includes('transaction') || pageId.includes('billing') || pageId.includes('escrow') ||
      pageId.includes('credit') || pageId.includes('earnings') || pageId.includes('finance') ||
      pageId.includes('bank') || pageId.includes('withdraw') || pageId.includes('refund') ||
      pageId.includes('balance') || pageId.includes('card') || pageId.includes('commission') ||
      pageId.includes('revenue') || pageId.includes('payout')) {
    return 'finance'
  }
  return 'info'
}

export async function loadPage(pageId: string): Promise<PageLoadResult> {
  if (CHUNK_CORE.has(pageId)) return loadCore(pageId)
  if (REAL_PAGES.has(pageId)) return { component: null, needsPageId: true, genericType: undefined as any }
  const genericType = getGenericType(pageId)
  if (genericType) return { component: null, needsPageId: true, genericType }
  return { component: null, needsPageId: true, genericType: undefined as any }
}

export function isKnownPage(pageId: string): boolean {
  if (CHUNK_CORE.has(pageId)) return true
  if (REAL_PAGES.has(pageId)) return true
  if (CATEGORY_IDS.has(pageId)) return true
  if (DEAL_IDS.has(pageId)) return true
  if (pageId.startsWith('supplier-') || pageId.startsWith('admin-') || pageId.startsWith('buyer-')) return true
  return true
}

export function getChunkForPage(pageId: string): string | null {
  if (CHUNK_CORE.has(pageId)) return null
  if (CHUNK_MISC.has(pageId)) return 'misc'
  if ([
    'help-center', 'help', 'support',
    'faq', 'faqs',
    'contact-us', 'contact',
    'live-chat', 'chat-support',
    'chatbot', 'ai-assistant', 'support-bot',
    'submit-ticket', 'create-ticket', 'open-ticket',
    'ticket-detail', 'ticket',
    'report-problem', 'report-bug', 'report-issue',
    'report-user', 'report-seller', 'report-violation',
    'safety-center', 'trust-safety', 'safety',
    'community-guidelines', 'guidelines', 'rules',
    'feedback-suggestions', 'feedback', 'suggestions',
    'docs-browser', 'docs', 'documentation',
    'policy-detail', 'policy', 'terms', 'terms-of-service', 'terms-and-conditions', 'privacy', 'privacy-policy', 'cookies', 'cookie-policy', 'refund-policy', 'return-policy',
    'quality-guarantee', 'dispute-resolution', 'supplier-agreement', 'compliance', 'how-it-works', 'bulk-pricing-guide',
    'docs-search-results', 'docs-search',
    'prohibited-items', 'restricted-items',
    'dispute-resolution-guide', 'dispute-guide', 'arbitration-guide',
    'escrow-protection-guide', 'safepay-guide', 'escrow-guide',
    'seller-verification-guide', 'kyc-guide', 'supplier-guide', 'seller-guide',
    'buyer-protection-policy', 'buyer-protection',
    'logistics-delivery-policy', 'shipping-policy', 'delivery-policy',
    'tax-compliance-guide', 'vat-guide', 'tax-guide',
  ].includes(pageId)) return 'support'
  if (CATEGORY_IDS.has(pageId)) return 'browse'
  if (DEAL_IDS.has(pageId)) return 'browse'
  if (pageId.startsWith('admin-') && pageId !== 'admin-profile') return 'misc'
  if (pageId.startsWith('supplier-') && pageId !== 'supplier-products') return 'seller'
  if (pageId.startsWith('buyer-') && pageId !== 'buyer-profile') return 'misc'
  if ([
    'product-detail', 'category-products', 'product-list', 'search-results', 'compare', 'product-comparison', 'filter-sort',
    'product-reviews', 'product-qa', 'write-review', 'upload-review-photos', 'product-specifications',
    'size-guide', 'bulk-pricing', 'wholesale-catalog', 'supplier-products', 'similar-products',
  'suppliers', 'rfq-list',
    'frequently-bought', 'frequently-bought-together', 'product-variants',
    'explore', 'discover', 'trending-products', 'trending', 'flash-sale', 'flash-deals', 'daily-deals', 'new-arrivals',
    'clearance', 'clearance-sale', 'seasonal-offers', 'seasonal-sale', 'brand-showcase', 'category-browser',
    'suppliers', 'rfq-list',
  ].includes(pageId)) return 'browse'
  if ([
    'cart', 'checkout', 'orders', 'my-orders', 'order-detail',
    'add-to-cart-confirm', 'add-to-cart-confirmation', 'bulk-order', 'bulk-order-form', 'quick-order', 'buy-now',
    'shipping-address', 'add-address', 'edit-address', 'delivery-method',
    'payment-method', 'add-payment-method', 'order-confirmation', 'order-summary', 'coupon-promo',
    'apply-credits', 'gift-card', 'order-invoice', 'split-payment', 'installment-payment',
    'track-order', 'order-timeline', 'cancel-order',
    'return-request', 'return-detail', 'exchange-request', 'refund-status', 'refund-detail',
    'order-receipt', 'order-invoice-download', 'dispute-center', 'dispute-detail', 'raise-complaint', 'order-feedback',
    'shipping-tracker', 'delivery-chat', 'delivery-confirmation', 'delivery-proof', 'missed-delivery',
    'reschedule-delivery', 'pickup-point', 'warehouse-locator', 'shipping-calculator', 'shipping-policies',
    'import-export-tracker', 'customs-clearance', 'freight-tracking',
  ].includes(pageId)) return 'cart'
  if ([
    'profile', 'my-profile', 'seller-profile', 'admin-profile', 'staff-profile', 'buyer-profile',
    'edit-profile', 'profile-photo', 'account-settings', 'profile-settings', 'notification-preferences',
    'privacy-settings', 'language-settings', 'theme-settings', 'linked-accounts',
    'delete-account', 'account-verification-badge', 'business-profile', 'tax-information',
    'my-wallet', 'wallet', 'balance-overview', 'add-money', 'withdraw-money',
    'transaction-history', 'transaction-detail', 'bank-accounts', 'add-bank-account',
    'upi-payment-setup', 'credit-debit-cards', 'add-card', 'payment-history',
    'payment-pending', 'payment-failed', 'refund-to-wallet', 'earnings-dashboard',
    'commission-history', 'invoice-management', 'credit-score', 'credit-limit',
  ].includes(pageId)) return 'profile'
  if ([
    'wishlist', 'wishlist-detail', 'favorites', 'favorite-suppliers', 'favorite-products', 'favorite-categories',
    'save-for-later', 'save-for-later-detail',
    'recently-viewed', 'recently-searched',
    'collections', 'collection-detail', 'create-collection', 'edit-collection',
    'shared-wishlist', 'shared-wishlist-detail', 'wishlist-share',
    'price-drop-alerts', 'wishlist-sort-filter', 'bulk-add-to-cart',
  ].includes(pageId)) return 'wishlist'
  if ([
    'seller-dashboard', 'supplier-dashboard',
    'seller-registration', 'seller-verification', 'seller-storefront',
    'add-product', 'seller-add-product', 'supplier-add-product',
    'edit-product', 'seller-edit-product',
    'product-listings-manager', 'seller-products-manager', 'supplier-products',
    'inventory-management', 'seller-inventory',
    'seller-order-management', 'seller-orders', 'supplier-orders',
    'seller-analytics', 'revenue-reports', 'seller-revenue',
    'seller-reviews', 'seller-promotions',
    'seller-shipping-settings', 'shipping-settings',
    'return-policy-settings', 'seller-return-policy',
    'seller-payouts', 'payouts',
    'seller-support',
    'bulk-upload-products', 'seller-bulk-upload',
    'product-performance',
    'customer-queries', 'seller-customer-queries',
    'seller-rankings',
    'store-customization', 'seller-store-customization',
    'seller-verification-upload', 'seller-verification-status', 'seller-badge-levels',
    'store-banner-editor', 'store-featured-products', 'store-story-about',
    'product-variant-matrix', 'product-pricing-tiers', 'product-spec-editor', 'product-media-gallery',
    'inventory-alerts', 'inventory-restock', 'inventory-warehouse-locations', 'inventory-audit-log',
    'seller-order-detail', 'seller-order-fulfillment', 'seller-order-cancellation', 'seller-order-disputes', 'seller-bulk-order-inquiry',
    'shipping-zone-editor', 'shipping-courier-integration', 'self-pickup-settings', 'return-claim-detail',
    'seller-sales-funnel', 'seller-traffic-sources', 'seller-customer-insights',
    'revenue-breakdown', 'seller-tax-invoices', 'seller-financial-statements', 'seller-payout-request', 'seller-payout-methods',
    'product-conversion-rate', 'seller-tier-benefits',
    'seller-review-reply', 'create-promotion', 'promotion-analytics', 'seller-flash-sale-nomination',
    'seller-create-ticket', 'seller-ticket-detail',
    'bulk-upload-template', 'bulk-upload-history', 'bulk-price-update',
    'customer-query-detail', 'customer-rfq-inbox', 'store-theme-customizer',
    'seller-quick-actions', 'seller-notifications-center',
  ].includes(pageId)) return 'seller'
  if ([
    'search-home', 'search',
    'voice-search',
    'image-search', 'visual-search',
    'barcode-scanner', 'qr-scanner', 'scan-barcode',
    'search-suggestions', 'search-autocomplete',
    'search-history',
    'popular-searches', 'trending-searches',
    'category-navigation', 'all-categories',
    'search-filters',
    'trending-searches-sub',
    'saved-searches',
    'category-products-detail',
    'search-results-supplier',
    'visual-search-results',
    'barcode-result',
    'category-tree',
    'search-price-alert', 'price-alerts',
    'search-results-category',
    'advanced-search',
    'search-voice-history',
  ].includes(pageId)) return 'search'
  if ([
    'help-center', 'help', 'support',
    'faq', 'faqs',
    'contact-us', 'contact',
    'live-chat', 'chat-support',
    'chatbot', 'ai-assistant', 'support-bot',
    'submit-ticket', 'create-ticket', 'open-ticket',
    'ticket-detail', 'ticket',
    'report-problem', 'report-bug', 'report-issue',
    'report-user', 'report-seller', 'report-violation',
    'safety-center', 'trust-safety', 'safety',
    'community-guidelines', 'guidelines', 'rules',
    'feedback-suggestions', 'feedback', 'suggestions',
    'docs-browser', 'docs', 'documentation',
    'policy-detail', 'policy', 'terms', 'terms-of-service', 'terms-and-conditions', 'privacy', 'privacy-policy', 'cookies', 'cookie-policy', 'refund-policy', 'return-policy',
    'quality-guarantee', 'dispute-resolution', 'supplier-agreement', 'compliance', 'how-it-works', 'bulk-pricing-guide',
    'docs-search-results', 'docs-search',
    'prohibited-items', 'restricted-items',
    'dispute-resolution-guide', 'dispute-guide', 'arbitration-guide',
    'escrow-protection-guide', 'safepay-guide', 'escrow-guide',
    'seller-verification-guide', 'kyc-guide', 'supplier-guide', 'seller-guide',
    'buyer-protection-policy', 'buyer-protection',
    'logistics-delivery-policy', 'shipping-policy', 'delivery-policy',
    'tax-compliance-guide', 'vat-guide', 'tax-guide',
  ].includes(pageId)) return 'support'
  return 'misc'
}
