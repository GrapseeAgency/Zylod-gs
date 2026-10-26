import { loadPage, getChunkForPage } from '@/lib/page-loader'
import * as chunkLoader from '@/lib/chunk-loader'

const targets = ['category-navigation','search-home','barcode-scanner','voice-search','popular-searches','flash-sale','daily-deals','coupons','suppliers','register-buyer','buyer-dashboard','my-orders','wishlist','collections','escrow-protection-guide','buyer-protection-policy','rfq-list','seller-registration','seller-dashboard','seller-storefront','add-product','seller-verification','bulk-upload-products','seller-analytics','seller-payouts','help-center','faq','contact-us','live-chat','chatbot','submit-ticket','safety-center','community-guidelines','report-problem','report-user','feedback-suggestions','docs-browser','terms-of-service','privacy-policy','return-policy','shipping-policy','payment-terms','wholesale-terms','cookie-policy','dmca-policy','about-us','careers-page','press-media','investor-relations','sitemap','seller-verification-guide','dispute-resolution-guide','about','careers','press','blog','events','partner-program','welcome']

for (const t of targets) {
  const r = await loadPage(t)
  let status = ''
  if (r.component) status = 'REAL(component)'
  else if (r.genericType) status = `GENERIC(${r.genericType})`
  else {
    const chunk = getChunkForPage(t)
    if (!chunk) { status = 'NOT-FOUND(null)' }
    else {
      try {
        const pr = await (chunkLoader as any).loadPageFromChunk(chunk, t)
        status = pr && pr.component ? `REAL(chunk:${chunk})` : `NOT-IN-CHUNK(${chunk})`
      } catch (e: any) { status = `ERR(${chunk}: ${String(e).slice(0,60)})` }
    }
  }
  console.log(`${t.padEnd(30)} ${status}`)
}
