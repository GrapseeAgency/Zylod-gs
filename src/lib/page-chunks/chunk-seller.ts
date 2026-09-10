// Chunk: Seller — Complete Seller & Supplier Suite (Pages 129-150 + Sub-pages)

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_SELLER = new Set([
  // Main 22 Pages (129-150)
  'seller-dashboard', 'supplier-dashboard',
  'seller-registration',
  'seller-verification',
  'seller-storefront',
  'add-product', 'seller-add-product', 'supplier-add-product',
  'edit-product', 'seller-edit-product',
  'product-listings-manager', 'seller-products-manager', 'supplier-products',
  'inventory-management', 'seller-inventory',
  'seller-order-management', 'seller-orders', 'supplier-orders',
  'seller-analytics',
  'revenue-reports', 'seller-revenue',
  'seller-reviews',
  'seller-promotions',
  'seller-shipping-settings', 'shipping-settings',
  'return-policy-settings', 'seller-return-policy',
  'seller-payouts', 'payouts',
  'seller-support',
  'bulk-upload-products', 'seller-bulk-upload',
  'product-performance',
  'customer-queries', 'seller-customer-queries',
  'seller-rankings',
  'store-customization', 'seller-store-customization',

  // Verification & Storefront Sub-pages
  'seller-verification-upload',
  'seller-verification-status',
  'seller-badge-levels',
  'store-banner-editor',
  'store-featured-products',
  'store-story-about',

  // Product & Inventory Sub-pages
  'product-variant-matrix',
  'product-pricing-tiers',
  'product-spec-editor',
  'product-media-gallery',
  'inventory-alerts',
  'inventory-restock',
  'inventory-warehouse-locations',
  'inventory-audit-log',

  // Order & Fulfillment Sub-pages
  'seller-order-detail',
  'seller-order-fulfillment',
  'seller-order-cancellation',
  'seller-order-disputes',
  'seller-bulk-order-inquiry',
  'shipping-zone-editor',
  'shipping-courier-integration',
  'self-pickup-settings',
  'return-claim-detail',

  // Analytics & Financial Sub-pages
  'seller-sales-funnel',
  'seller-traffic-sources',
  'seller-customer-insights',
  'revenue-breakdown',
  'seller-tax-invoices',
  'seller-financial-statements',
  'seller-payout-request',
  'seller-payout-methods',
  'product-conversion-rate',
  'seller-tier-benefits',

  // Marketing, Support & Operations Sub-pages
  'seller-review-reply',
  'create-promotion',
  'promotion-analytics',
  'seller-flash-sale-nomination',
  'seller-create-ticket',
  'seller-ticket-detail',
  'bulk-upload-template',
  'bulk-upload-history',
  'bulk-price-update',
  'customer-query-detail',
  'customer-rfq-inbox',
  'store-theme-customizer',
  'seller-quick-actions',
  'seller-notifications-center',
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {
    // 129. Seller Dashboard
    'seller-dashboard': () => import('@/components/pages/seller-dashboard-page'),
    'supplier-dashboard': () => import('@/components/pages/seller-dashboard-page'),

    // 130. Seller Registration
    'seller-registration': () => import('@/components/pages/seller-registration-page'),

    // 131. Seller Verification
    'seller-verification': () => import('@/components/pages/seller-verification-page'),

    // 132. Seller Storefront
    'seller-storefront': () => import('@/components/pages/seller-storefront-page'),

    // 133. Add Product
    'add-product': () => import('@/components/pages/seller-add-product-page'),
    'seller-add-product': () => import('@/components/pages/seller-add-product-page'),
    'supplier-add-product': () => import('@/components/pages/seller-add-product-page'),

    // 134. Edit Product
    'edit-product': () => import('@/components/pages/seller-edit-product-page'),
    'seller-edit-product': () => import('@/components/pages/seller-edit-product-page'),

    // 135. Product Listings Manager
    'product-listings-manager': () => import('@/components/pages/product-listings-manager-page'),
    'seller-products-manager': () => import('@/components/pages/product-listings-manager-page'),
    'supplier-products': () => import('@/components/pages/product-listings-manager-page'),

    // 136. Inventory Management
    'inventory-management': () => import('@/components/pages/inventory-management-page'),
    'seller-inventory': () => import('@/components/pages/inventory-management-page'),

    // 137. Order Management (Seller)
    'seller-order-management': () => import('@/components/pages/seller-order-management-page'),
    'seller-orders': () => import('@/components/pages/seller-order-management-page'),
    'supplier-orders': () => import('@/components/pages/seller-order-management-page'),

    // 138. Seller Analytics
    'seller-analytics': () => import('@/components/pages/seller-analytics-page'),

    // 139. Revenue Reports
    'revenue-reports': () => import('@/components/pages/revenue-reports-page'),
    'seller-revenue': () => import('@/components/pages/revenue-reports-page'),

    // 140. Seller Reviews
    'seller-reviews': () => import('@/components/pages/seller-reviews-page'),

    // 141. Seller Promotions
    'seller-promotions': () => import('@/components/pages/seller-promotions-page'),

    // 142. Shipping Settings (Seller)
    'seller-shipping-settings': () => import('@/components/pages/seller-shipping-settings-page'),
    'shipping-settings': () => import('@/components/pages/seller-shipping-settings-page'),

    // 143. Return Policy Settings
    'return-policy-settings': () => import('@/components/pages/return-policy-settings-page'),
    'seller-return-policy': () => import('@/components/pages/return-policy-settings-page'),

    // 144. Seller Payouts
    'seller-payouts': () => import('@/components/pages/seller-payouts-page'),
    'payouts': () => import('@/components/pages/seller-payouts-page'),

    // 145. Seller Support
    'seller-support': () => import('@/components/pages/seller-support-page'),

    // 146. Bulk Upload Products
    'bulk-upload-products': () => import('@/components/pages/bulk-upload-products-page'),
    'seller-bulk-upload': () => import('@/components/pages/bulk-upload-products-page'),

    // 147. Product Performance
    'product-performance': () => import('@/components/pages/product-performance-page'),

    // 148. Customer Queries (Seller)
    'customer-queries': () => import('@/components/pages/customer-queries-page'),
    'seller-customer-queries': () => import('@/components/pages/customer-queries-page'),

    // 149. Seller Rankings
    'seller-rankings': () => import('@/components/pages/seller-rankings-page'),

    // 150. Store Customization
    'store-customization': () => import('@/components/pages/store-customization-page'),
    'seller-store-customization': () => import('@/components/pages/store-customization-page'),

    // Sub-pages: Verification & Storefront
    'seller-verification-upload': () => import('@/components/pages/seller-verification-upload-page'),
    'seller-verification-status': () => import('@/components/pages/seller-verification-status-page'),
    'seller-badge-levels': () => import('@/components/pages/seller-badge-levels-page'),
    'store-banner-editor': () => import('@/components/pages/store-banner-editor-page'),
    'store-featured-products': () => import('@/components/pages/store-featured-products-page'),
    'store-story-about': () => import('@/components/pages/store-story-about-page'),

    // Sub-pages: Product & Inventory
    'product-variant-matrix': () => import('@/components/pages/product-variant-matrix-page'),
    'product-pricing-tiers': () => import('@/components/pages/product-pricing-tiers-page'),
    'product-spec-editor': () => import('@/components/pages/product-spec-editor-page'),
    'product-media-gallery': () => import('@/components/pages/product-media-gallery-page'),
    'inventory-alerts': () => import('@/components/pages/inventory-alerts-page'),
    'inventory-restock': () => import('@/components/pages/inventory-restock-page'),
    'inventory-warehouse-locations': () => import('@/components/pages/inventory-warehouse-locations-page'),
    'inventory-audit-log': () => import('@/components/pages/inventory-audit-log-page'),

    // Sub-pages: Order & Fulfillment
    'seller-order-detail': () => import('@/components/pages/seller-order-detail-page'),
    'seller-order-fulfillment': () => import('@/components/pages/seller-order-fulfillment-page'),
    'seller-order-cancellation': () => import('@/components/pages/seller-order-cancellation-page'),
    'seller-order-disputes': () => import('@/components/pages/seller-order-disputes-page'),
    'seller-bulk-order-inquiry': () => import('@/components/pages/seller-bulk-order-inquiry-page'),
    'shipping-zone-editor': () => import('@/components/pages/shipping-zone-editor-page'),
    'shipping-courier-integration': () => import('@/components/pages/shipping-courier-integration-page'),
    'self-pickup-settings': () => import('@/components/pages/self-pickup-settings-page'),
    'return-claim-detail': () => import('@/components/pages/return-claim-detail-page'),

    // Sub-pages: Analytics & Financial
    'seller-sales-funnel': () => import('@/components/pages/seller-sales-funnel-page'),
    'seller-traffic-sources': () => import('@/components/pages/seller-traffic-sources-page'),
    'seller-customer-insights': () => import('@/components/pages/seller-customer-insights-page'),
    'revenue-breakdown': () => import('@/components/pages/revenue-breakdown-page'),
    'seller-tax-invoices': () => import('@/components/pages/seller-tax-invoices-page'),
    'seller-financial-statements': () => import('@/components/pages/seller-financial-statements-page'),
    'seller-payout-request': () => import('@/components/pages/seller-payout-request-page'),
    'seller-payout-methods': () => import('@/components/pages/seller-payout-methods-page'),
    'product-conversion-rate': () => import('@/components/pages/product-conversion-rate-page'),
    'seller-tier-benefits': () => import('@/components/pages/seller-tier-benefits-page'),

    // Sub-pages: Marketing, Support & Operations
    'seller-review-reply': () => import('@/components/pages/seller-review-reply-page'),
    'create-promotion': () => import('@/components/pages/create-promotion-page'),
    'promotion-analytics': () => import('@/components/pages/promotion-analytics-page'),
    'seller-flash-sale-nomination': () => import('@/components/pages/seller-flash-sale-nomination-page'),
    'seller-create-ticket': () => import('@/components/pages/seller-create-ticket-page'),
    'seller-ticket-detail': () => import('@/components/pages/seller-ticket-detail-page'),
    'bulk-upload-template': () => import('@/components/pages/bulk-upload-template-page'),
    'bulk-upload-history': () => import('@/components/pages/bulk-upload-history-page'),
    'bulk-price-update': () => import('@/components/pages/bulk-price-update-page'),
    'customer-query-detail': () => import('@/components/pages/customer-query-detail-page'),
    'customer-rfq-inbox': () => import('@/components/pages/customer-rfq-inbox-page'),
    'store-theme-customizer': () => import('@/components/pages/store-theme-customizer-page'),
    'seller-quick-actions': () => import('@/components/pages/seller-quick-actions-page'),
    'seller-notifications-center': () => import('@/components/pages/seller-notifications-center-page'),
  }
  return loadFromMap(loaders, pageId)
}
