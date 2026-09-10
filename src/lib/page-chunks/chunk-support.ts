// Chunk: Support & Help — Pages 159-170 + Docs & Policy Sub-pages

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_SUPPORT = new Set([
  // Main 12 Pages (159-170)
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

  // Documentation & Policy Sub-pages (Amazon/Stripe Docs System)
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
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {
    // Main 12 Pages (159-170)
    'help-center': () => import('@/components/pages/help-center-page'),
    'help': () => import('@/components/pages/help-center-page'),
    'support': () => import('@/components/pages/help-center-page'),

    'faq': () => import('@/components/pages/faq-page'),
    'faqs': () => import('@/components/pages/faq-page'),

    'contact-us': () => import('@/components/pages/contact-us-page'),
    'contact': () => import('@/components/pages/contact-us-page'),

    'live-chat': () => import('@/components/pages/live-chat-page'),
    'chat-support': () => import('@/components/pages/live-chat-page'),

    'chatbot': () => import('@/components/pages/chatbot-page'),
    'ai-assistant': () => import('@/components/pages/chatbot-page'),
    'support-bot': () => import('@/components/pages/chatbot-page'),

    'submit-ticket': () => import('@/components/pages/submit-ticket-page'),
    'create-ticket': () => import('@/components/pages/submit-ticket-page'),
    'open-ticket': () => import('@/components/pages/submit-ticket-page'),

    'ticket-detail': () => import('@/components/pages/ticket-detail-page'),
    'ticket': () => import('@/components/pages/ticket-detail-page'),

    'report-problem': () => import('@/components/pages/report-problem-page'),
    'report-bug': () => import('@/components/pages/report-problem-page'),
    'report-issue': () => import('@/components/pages/report-problem-page'),

    'report-user': () => import('@/components/pages/report-user-page'),
    'report-seller': () => import('@/components/pages/report-user-page'),
    'report-violation': () => import('@/components/pages/report-user-page'),

    'safety-center': () => import('@/components/pages/safety-center-page'),
    'trust-safety': () => import('@/components/pages/safety-center-page'),
    'safety': () => import('@/components/pages/safety-center-page'),

    'community-guidelines': () => import('@/components/pages/community-guidelines-page'),
    'guidelines': () => import('@/components/pages/community-guidelines-page'),
    'rules': () => import('@/components/pages/community-guidelines-page'),

    'feedback-suggestions': () => import('@/components/pages/feedback-suggestions-page'),
    'feedback': () => import('@/components/pages/feedback-suggestions-page'),
    'suggestions': () => import('@/components/pages/feedback-suggestions-page'),

    // Documentation & Policy Sub-pages
    'docs-browser': () => import('@/components/pages/docs-browser-page'),
    'docs': () => import('@/components/pages/docs-browser-page'),
    'documentation': () => import('@/components/pages/docs-browser-page'),

    'policy-detail': () => import('@/components/pages/policy-detail-page'),
    'policy': () => import('@/components/pages/policy-detail-page'),
    'terms': () => import('@/components/pages/policy-detail-page'),
    'terms-of-service': () => import('@/components/pages/policy-detail-page'),
    'terms-and-conditions': () => import('@/components/pages/policy-detail-page'),
    'privacy': () => import('@/components/pages/policy-detail-page'),
    'privacy-policy': () => import('@/components/pages/policy-detail-page'),
    'cookies': () => import('@/components/pages/policy-detail-page'),
    'cookie-policy': () => import('@/components/pages/policy-detail-page'),
    'refund-policy': () => import('@/components/pages/buyer-protection-policy-page'),
    'return-policy': () => import('@/components/pages/buyer-protection-policy-page'),
    'quality-guarantee': () => import('@/components/pages/buyer-protection-policy-page'),
    'dispute-resolution': () => import('@/components/pages/dispute-resolution-guide-page'),
    'supplier-agreement': () => import('@/components/pages/community-guidelines-page'),
    'compliance': () => import('@/components/pages/community-guidelines-page'),
    'how-it-works': () => import('@/components/pages/docs-browser-page'),
    'bulk-pricing-guide': () => import('@/components/pages/bulk-pricing-guide-page'),

    'docs-search-results': () => import('@/components/pages/docs-search-results-page'),
    'docs-search': () => import('@/components/pages/docs-search-results-page'),

    'prohibited-items': () => import('@/components/pages/prohibited-items-page'),
    'restricted-items': () => import('@/components/pages/prohibited-items-page'),

    'dispute-resolution-guide': () => import('@/components/pages/dispute-resolution-guide-page'),
    'dispute-guide': () => import('@/components/pages/dispute-resolution-guide-page'),
    'arbitration-guide': () => import('@/components/pages/dispute-resolution-guide-page'),

    'escrow-protection-guide': () => import('@/components/pages/escrow-protection-guide-page'),
    'safepay-guide': () => import('@/components/pages/escrow-protection-guide-page'),
    'escrow-guide': () => import('@/components/pages/escrow-protection-guide-page'),

    'seller-verification-guide': () => import('@/components/pages/seller-verification-guide-page'),
    'kyc-guide': () => import('@/components/pages/seller-verification-guide-page'),
    'supplier-guide': () => import('@/components/pages/seller-verification-guide-page'),
    'seller-guide': () => import('@/components/pages/seller-verification-guide-page'),

    'buyer-protection-policy': () => import('@/components/pages/buyer-protection-policy-page'),
    'buyer-protection': () => import('@/components/pages/buyer-protection-policy-page'),

    'logistics-delivery-policy': () => import('@/components/pages/logistics-delivery-policy-page'),
    'shipping-policy': () => import('@/components/pages/logistics-delivery-policy-page'),
    'delivery-policy': () => import('@/components/pages/logistics-delivery-policy-page'),

    'tax-compliance-guide': () => import('@/components/pages/tax-compliance-guide-page'),
    'vat-guide': () => import('@/components/pages/tax-compliance-guide-page'),
    'tax-guide': () => import('@/components/pages/tax-compliance-guide-page'),
  }

  return loadFromMap(loaders, pageId)
}
