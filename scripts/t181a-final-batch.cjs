#!/usr/bin/env node
/** t181a final batch: exact-string theme fixes for remaining findings. */
const fs = require('fs')
const path = require('path')
const PAGES = '/home/z/my-project/src/components/pages'

const R = (find, replace, all) => ({ find, replace, all })

const batch = {
  'safety-center-page.tsx': [
    R('bg-slate-900 text-white px-4 pt-4 pb-8 rounded-b-3xl shadow-lg md:px-6 md:pt-6 md:pb-10',
      'bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-4 pt-4 pb-8 rounded-b-3xl shadow-lg md:px-6 md:pt-6 md:pb-10 border-b border-gray-200 dark:border-slate-800'),
    R('md:hidden p-2 rounded-full bg-white dark:bg-gray-900/10 hover:bg-white dark:bg-gray-900/20 transition',
      'md:hidden p-2 rounded-full bg-gray-100 dark:bg-gray-900/10 hover:bg-gray-200 dark:bg-gray-900/20 transition'),
    R('<ArrowLeft className="w-5 h-5 text-white" />',
      '<ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />'),
    R('px-2.5 py-1 bg-white dark:bg-gray-900/10 text-xs font-semibold rounded-full hover:bg-white dark:bg-gray-900/20 transition',
      'px-2.5 py-1 bg-gray-100 dark:bg-gray-900/10 text-xs font-semibold rounded-full hover:bg-gray-200 dark:bg-gray-900/20 transition'),
    R('<p className="text-xs text-slate-300">',
      '<p className="text-xs text-slate-600 dark:text-slate-300">'),
  ],
  'investor-relations-page.tsx': [
    R('bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white space-y-3',
      'bg-gradient-to-r from-emerald-100 via-teal-100 to-slate-100 dark:from-emerald-900 dark:via-teal-900 dark:to-slate-900 rounded-3xl p-6 md:p-8 text-gray-900 dark:text-white space-y-3'),
    R('bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
      'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/30'),
    R('<p className="text-xs text-slate-300 leading-relaxed">',
      '<p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">'),
    R('border-t border-white/10', 'border-t border-black/10 dark:border-white/10'),
    R('font-black text-emerald-400', 'font-black text-emerald-600 dark:text-emerald-400'),
    R('font-black text-teal-300', 'font-black text-teal-700 dark:text-teal-300'),
    R('font-black text-amber-300', 'font-black text-amber-700 dark:text-amber-300'),
    R('text-slate-400 dark:text-slate-500 dark:text-slate-400', 'text-slate-500 dark:text-slate-400'),
  ],
  'bulk-pricing-guide-page.tsx': [
    R("color: 'from-slate-900 to-slate-800',", "color: 'from-slate-600 to-slate-700 dark:from-slate-900 dark:to-slate-800',"),
  ],
  'career-culture-page.tsx': [
    R('bg-slate-900 rounded-3xl p-5 text-white space-y-2',
      'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-gray-900 dark:text-white space-y-2 shadow-sm'),
    R('<Users className="w-5 h-5 text-teal-400" />', '<Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />'),
    R('<p className="text-xs text-slate-300 leading-relaxed">', '<p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">'),
  ],
  'tax-compliance-guide-page.tsx': [
    R('bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-2',
      'bg-white dark:bg-slate-900 text-gray-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-2'),
    R('text-xs font-bold text-red-400 uppercase tracking-wide', 'text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide'),
    R('<p className="text-xs text-slate-300 leading-relaxed">', '<p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">'),
  ],
  'international-shipping-page.tsx': [
    R('bg-slate-900 rounded-3xl p-5 md:p-6 text-white space-y-2',
      'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 text-gray-900 dark:text-white space-y-2 shadow-sm'),
    R('<p className="text-xs md:text-sm text-slate-300 leading-relaxed">', '<p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">'),
    R('md:px-10 bg-slate-900 text-white rounded-xl text-xs md:text-sm font-bold py-3',
      'md:px-10 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs md:text-sm font-bold py-3'),
  ],
  'media-kit-page.tsx': [
    R('bg-slate-900 rounded-3xl p-5 md:p-6 text-white space-y-2',
      'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 text-gray-900 dark:text-white space-y-2 shadow-sm'),
    R('<p className="text-xs md:text-sm text-slate-300 leading-relaxed">', '<p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">'),
    R('className="w-full bg-slate-900 text-white rounded-xl text-xs font-bold py-3"',
      'className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold py-3"'),
  ],
  'press-media-page.tsx': [
    R("'bg-slate-900 text-white shadow-sm'", "'bg-primary text-white shadow-sm'"),
  ],
  'account-settings-page.tsx': [
    R('bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 rounded-xl text-xs',
      'bg-primary hover:bg-primary/90 text-white font-bold h-11 rounded-xl text-xs'),
  ],
  'affiliate-program-page.tsx': [
    R('bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-xs sm:text-sm gap-2',
      'bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl text-xs sm:text-sm gap-2'),
  ],
  'financial-filings-page.tsx': [
    R('className="w-full bg-slate-900 text-white rounded-xl text-xs font-bold py-3"',
      'className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold py-3"'),
  ],
  'non-returnable-page.tsx': [
    R('className="w-full bg-slate-900 text-white rounded-xl text-xs font-bold py-3"',
      'className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold py-3"'),
  ],
  'press-release-detail-page.tsx': [
    R('md:px-10 bg-slate-900 text-white rounded-xl text-xs font-bold py-3',
      'md:px-10 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold py-3'),
  ],
  'data-deletion-page.tsx': [
    R('className="bg-slate-900 text-white rounded-xl text-xs font-bold"',
      'className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold"'),
  ],
  'dmca-submit-page.tsx': [
    R('className="bg-slate-900 text-white rounded-xl text-xs font-bold"',
      'className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold"'),
  ],
  'inventory-management-page.tsx': [
    R('bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50',
      'bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium disabled:opacity-50'),
  ],
  'seller-profile-page.tsx': [
    R('bg-slate-900 hover:bg-primary text-white font-bold h-8 rounded-xl text-[11px]',
      'bg-primary hover:bg-primary/90 text-white font-bold h-8 rounded-xl text-[11px]'),
  ],
  'shared-wishlist-detail-page.tsx': [
    R('w-full bg-gray-900 text-white hover:bg-gray-800 rounded-xl h-12 text-base font-semibold',
      'w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-12 text-base font-semibold'),
    R('bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full',
      'bg-gray-800 dark:bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full'),
  ],
  'shared-wishlist-page.tsx': [
    R('w-full py-3 bg-gray-900 text-white font-medium rounded-lg active:bg-gray-800',
      'w-full py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg active:bg-primary/80'),
  ],
  'admin-support-tickets-page.tsx': [
    R("'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'", "'bg-primary text-white shadow-md'"),
  ],
  'track-order-page.tsx': [
    R('bg-slate-900 dark:bg-slate-800',
      'bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800'),
    R('w-10 h-10 rounded-xl bg-white dark:bg-gray-900/10 flex items-center justify-center shrink-0',
      'w-10 h-10 rounded-xl bg-primary/10 dark:bg-gray-900/10 flex items-center justify-center shrink-0'),
    R('<Truck className="h-5 w-5 text-white" />', '<Truck className="h-5 w-5 text-primary" />'),
    R('<h2 className="text-sm font-black text-white">Shipment Tracking</h2>',
      '<h2 className="text-sm font-black text-gray-900 dark:text-white">Shipment Tracking</h2>'),
    R('<p className="text-[11px] text-slate-300">Status updates from your suppliers</p>',
      '<p className="text-[11px] text-slate-600 dark:text-slate-300">Status updates from your suppliers</p>'),
    R('bg-white dark:bg-gray-900 dark:bg-slate-900 rounded-3xl', 'bg-white dark:bg-slate-900 rounded-3xl'),
  ],
  'daily-deals-page.tsx': [
    R('bg-[#1E1E1E] dark:bg-gray-900 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:border-[#FF4D6D]/40 border border-transparent',
      'bg-white dark:bg-gray-900 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:border-[#FF4D6D]/40 border border-gray-200 dark:border-gray-800'),
  ],
  'bulk-upload-template-page.tsx': [
    R('bg-slate-900 text-slate-100 text-[11px] font-mono rounded-xl p-3 overflow-x-auto leading-relaxed',
      'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] font-mono rounded-xl p-3 overflow-x-auto leading-relaxed border border-slate-200 dark:border-slate-800'),
  ],
  'staff-profile-page.tsx': [
    R('h-20 bg-gradient-to-r from-slate-800 to-slate-900 relative overflow-hidden',
      'h-20 bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-800 dark:to-slate-900 relative overflow-hidden'),
    R("clockedIn ? 'bg-gradient-to-br from-emerald-800 to-emerald-900' : 'bg-gradient-to-br from-slate-800 to-slate-900'",
      "clockedIn ? 'bg-gradient-to-br from-emerald-700 to-emerald-800 dark:from-emerald-800 dark:to-emerald-900' : 'bg-gradient-to-br from-slate-500 to-slate-600 dark:from-slate-800 dark:to-slate-900'"),
  ],
  'admin-content-page.tsx': [
    R('bg-neutral-100 text-neutral-600 border-neutral-200',
      'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700', true),
  ],
  'buyer-dashboard-page.tsx': [
    R('bg-gray-100 text-gray-700 border-gray-200',
      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700', true),
  ],
  'supplier-dashboard-page.tsx': [
    R('bg-gray-100 text-gray-700 border-gray-200',
      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700', true),
  ],
  'favorite-categories-page.tsx': [
    R('text-gray-400 bg-gray-100', 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'),
  ],
  'favorite-products-page.tsx': [
    R("'w-full aspect-square'} bg-gray-100", "'w-full aspect-square'} bg-gray-100 dark:bg-gray-800"),
  ],
  'collection-detail-page.tsx': [
    R("viewMode === 'list' ? 'w-32 shrink-0' : 'w-full aspect-square'} bg-gray-100",
      "viewMode === 'list' ? 'w-32 shrink-0' : 'w-full aspect-square'} bg-gray-100 dark:bg-gray-800"),
  ],
  'missed-delivery-page.tsx': [
    R("'bg-slate-100 text-slate-600'", "'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'"),
  ],
  'my-samples-page.tsx': [
    R('bg-neutral-100 text-neutral-600 border-neutral-200',
      'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700', true),
  ],
  'supplier-samples-page.tsx': [
    R('bg-neutral-100 text-neutral-600 border-neutral-200',
      'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700', true),
  ],
  'popular-searches-page.tsx': [
    R('bg-gray-100 text-gray-600', 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300', true),
  ],
  'search-history-page.tsx': [
    R('bg-gray-100 text-gray-600', 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300', true),
  ],
  'trending-searches-page.tsx': [
    R('bg-gray-100 text-gray-600', 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300', true),
  ],
  'search-results-supplier-page.tsx': [
    R('bg-gray-100 text-gray-600', 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300', true),
  ],
  'search-results-category-page.tsx': [
    R('bg-gray-100 text-gray-700 hover:bg-gray-200', 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'),
  ],
}

let failures = 0
for (const [file, rules] of Object.entries(batch)) {
  const full = path.join(PAGES, file)
  let code = fs.readFileSync(full, 'utf8')
  for (const r of rules) {
    const count = code.split(r.find).length - 1
    if (count === 0) { console.log(`MISS  ${file}: ${r.find.slice(0, 60)}`); failures++; continue }
    if (count > 1 && !r[2] && !r.all) { console.log(`AMBIG  ${file} (${count}x): ${r.find.slice(0, 60)}`); failures++; continue }
    code = code.split(r.find).join(r.replace)
  }
  fs.writeFileSync(full, code)
}
console.log(failures === 0 ? 'ALL OK' : `${failures} issue(s)`)
