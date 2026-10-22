// Task 152: wire rate limits into EVERY uncovered mutating handler.
// Manifest: "route METHOD": [bucket, limit, windowMs] — triaged by abuse value.
// Insertion: after the auth guard block (401-first doctrine) for auth'd handlers;
// first statement of body for public handlers. Per-handler verified by sweep.
import { readFileSync, writeFileSync } from 'node:fs';

const MIN = 60_000;
const FIFTEEN = 15 * MIN;

const MANIFEST = {
  // ---- AUTH: credential stuffing / SMS bombing / email hammering (15m windows)
  '/auth/register POST': ['auth-register', 8, FIFTEEN],
  '/auth/recover POST': ['auth-recover', 5, FIFTEEN],
  '/auth/reset-password POST': ['auth-reset-password', 5, FIFTEEN],
  '/auth/verify-email POST': ['auth-verify-email', 10, FIFTEEN],
  '/auth/verify-email PUT': ['auth-verify-email', 10, FIFTEEN],
  '/auth/2fa/setup POST': ['auth-2fa-setup', 10, MIN],
  '/auth/2fa/verify POST': ['auth-2fa-verify', 10, FIFTEEN],
  '/auth/backup-codes POST': ['auth-backup-codes', 10, MIN],
  '/auth/phone-verify POST': ['auth-phone-verify', 5, FIFTEEN],
  '/auth/google POST': ['auth-oauth', 20, MIN],
  '/auth/facebook POST': ['auth-oauth', 20, MIN],
  '/auth/logout POST': ['auth-logout', 30, MIN],
  '/auth/refresh POST': ['auth-refresh', 30, MIN],
  // ---- PAYMENTS: flood protection, generous (providers retry)
  '/payments/webhook POST': ['payments-webhook', 120, MIN],
  '/wallet/callback/sslcommerz POST': ['wallet-callback', 120, MIN],
  '/wallet/ipn/sslcommerz POST': ['wallet-ipn', 120, MIN],
  '/orders/[id]/payments/initiate POST': ['order-payment-initiate', 10, MIN],
  // ---- ORDERS
  '/orders/[id]/exchange POST': ['order-exchange', 10, MIN],
  '/orders/[id]/feedback POST': ['order-feedback', 5, MIN],
  '/orders/[id]/track POST': ['order-track', 30, MIN],
  // ---- REVIEWS: the second write path (t151 wired /api/reviews only)
  '/products/[id]/reviews POST': ['reviews-product-create', 5, MIN],
  // ---- SEARCH: AI cost + spam
  '/search/image POST': ['search-image', 20, MIN],
  '/search/voice POST': ['search-voice', 20, MIN],
  '/search/barcode POST': ['search-barcode', 30, MIN],
  '/search/popular POST': ['search-popular', 60, MIN],
  '/search/price-alerts POST': ['search-price-alerts-create', 10, MIN],
  '/search/price-alerts/[id] PATCH': ['search-price-alerts-write', 20, MIN],
  '/search/price-alerts/[id] DELETE': ['search-price-alerts-write', 20, MIN],
  '/search/saved POST': ['search-saved-create', 30, MIN],
  '/search/saved/[id] DELETE': ['search-saved-write', 30, MIN],
  '/search/history DELETE': ['search-history-clear', 20, MIN],
  // ---- SUPPORT: ticket/message/report spam
  '/support/tickets POST': ['support-tickets-create', 5, MIN],
  '/support/tickets/[id] PATCH': ['support-tickets-write', 30, MIN],
  '/support/tickets/[id]/messages POST': ['support-tickets-msg', 20, MIN],
  '/support/tickets/[id]/rate POST': ['support-tickets-rate', 10, MIN],
  '/support/contact POST': ['support-contact', 5, MIN],
  '/support/feedback POST': ['support-feedback', 10, MIN],
  '/support/report-problem POST': ['support-report-problem', 5, MIN],
  '/support/report-user POST': ['support-report-user', 5, MIN],
  '/support/faqs POST': ['support-faqs-write', 30, MIN],
  '/support/faqs/[id]/vote POST': ['support-faqs-vote', 30, MIN],
  '/support/articles/[slug]/feedback POST': ['support-articles-feedback', 20, MIN],
  '/support/chat/sessions POST': ['support-chat-create', 10, MIN],
  '/support/chat/sessions/[id] PATCH': ['support-chat-write', 30, MIN],
  '/support/chat/sessions/[id]/messages POST': ['support-chat-msg', 30, MIN],
  // ---- MONEY-ADJACENT PROFILE OBJECTS: enumeration/spam
  '/cards POST': ['cards-create', 10, MIN],
  '/cards/[id] PATCH': ['cards-write', 20, MIN],
  '/cards/[id] DELETE': ['cards-write', 20, MIN],
  '/bank-accounts POST': ['banks-create', 10, MIN],
  '/bank-accounts/[id] PATCH': ['banks-write', 20, MIN],
  '/bank-accounts/[id] DELETE': ['banks-write', 20, MIN],
  '/payment-methods POST': ['payment-methods-create', 10, MIN],
  '/payment-methods/mobile-banking POST': ['payment-methods-create', 10, MIN],
  '/payment-methods/[id] DELETE': ['payment-methods-write', 20, MIN],
  '/wallet POST': ['wallet-write', 30, MIN],
  '/wallet/topup/initiate POST': ['wallet-topup-initiate', 10, MIN],
  // ---- REWARDS/REFERRALS/CREDITS
  '/rewards/checkin POST': ['rewards-checkin', 10, MIN],
  '/rewards/spin POST': ['rewards-spin', 10, MIN],
  '/referrals/claim POST': ['referrals-claim', 10, MIN],
  '/credits/limit POST': ['credits-limit', 10, MIN],
  '/coupons/validate POST': ['coupons-validate', 30, MIN],
  // ---- CART/WISHLIST/SAVE: high-traffic benign, moderate
  '/cart POST': ['cart-add', 60, MIN],
  '/cart/[itemId] PUT': ['cart-item-write', 60, MIN],
  '/cart/[itemId] DELETE': ['cart-item-write', 60, MIN],
  '/wishlist POST': ['wishlist-write', 30, MIN],
  '/wishlist DELETE': ['wishlist-write', 30, MIN],
  '/wishlist/[itemId] PATCH': ['wishlist-item-write', 30, MIN],
  '/wishlist/[itemId] DELETE': ['wishlist-item-write', 30, MIN],
  '/wishlist/share POST': ['wishlist-share', 10, MIN],
  '/wishlist/share DELETE': ['wishlist-share', 10, MIN],
  '/save-for-later POST': ['save-for-later-write', 30, MIN],
  '/save-for-later DELETE': ['save-for-later-write', 30, MIN],
  '/save-for-later/[itemId] DELETE': ['save-for-later-write', 30, MIN],
  // ---- ADDRESSES/PROFILE
  '/addresses/[id] PUT': ['addresses-item-write', 30, MIN],
  '/addresses/[id] DELETE': ['addresses-item-write', 30, MIN],
  '/profile/addresses POST': ['profile-addresses-post', 20, MIN],
  '/profile PUT': ['profile-write', 30, MIN],
  '/profile PATCH': ['profile-write', 30, MIN],
  '/profile/me PUT': ['profile-me-write', 30, MIN],
  '/profile/me PATCH': ['profile-me-write', 30, MIN],
  '/profile/business PUT': ['profile-business-write', 30, MIN],
  '/profile/business PATCH': ['profile-business-write', 30, MIN],
  '/profile/tax PUT': ['profile-tax-write', 30, MIN],
  '/profile/tax PATCH': ['profile-tax-write', 30, MIN],
  '/profile/notifications PUT': ['profile-notifications-write', 30, MIN],
  '/profile/notifications PATCH': ['profile-notifications-write', 30, MIN],
  '/profile/photo POST': ['profile-photo', 10, MIN],
  '/profile/account DELETE': ['profile-account-delete', 5, MIN],
  // ---- NOTIFICATIONS
  '/notifications PATCH': ['notifications-write', 30, MIN],
  '/notifications/[id] DELETE': ['notifications-item-write', 30, MIN],
  '/notifications/archive DELETE': ['notifications-archive', 30, MIN],
  '/notifications/mark-read POST': ['notifications-read', 60, MIN],
  '/notifications/preferences PATCH': ['notifications-prefs', 20, MIN],
  '/notifications/push-token POST': ['push-token', 10, MIN],
  '/notifications/push-token DELETE': ['push-token', 10, MIN],
  '/notifications/evaluate-alerts POST': ['evaluate-alerts', 10, MIN],
  // ---- ADMIN
  '/admin/orders/[id]/verify-payment POST': ['admin-verify-payment', 30, MIN],
  '/admin/reports/[id] PATCH': ['admin-reports-write', 30, MIN],
  '/admin/shipping/methods/[id] PATCH': ['admin-shipping-item-write', 30, MIN],
  '/admin/shipping/methods/[id] DELETE': ['admin-shipping-item-write', 30, MIN],
  '/admin/shipping/rates/[id] PATCH': ['admin-shipping-item-write', 30, MIN],
  '/admin/shipping/rates/[id] DELETE': ['admin-shipping-item-write', 30, MIN],
  '/admin/shipping/zones/[id] PATCH': ['admin-shipping-item-write', 30, MIN],
  '/admin/shipping/zones/[id] DELETE': ['admin-shipping-item-write', 30, MIN],
  '/admin/users PATCH': ['admin-users-write', 30, MIN],
  '/suppliers/[id]/verify POST': ['admin-supplier-verify', 20, MIN],
  // ---- SUPPLIER
  '/supplier/storefront PATCH': ['supplier-storefront-patch', 20, MIN],
  '/suppliers/storefront PUT': ['suppliers-storefront-put', 20, MIN],
  '/supplier/queries/[id] PATCH': ['supplier-queries-patch', 30, MIN],
  '/supplier/support/[id] PATCH': ['supplier-support-patch', 30, MIN],
  '/supplier/verification/[docId] DELETE': ['supplier-verification-delete', 20, MIN],
  // ---- RFQ/AFFILIATE/INVESTOR/LEGAL/CAREERS/UPLOADS
  '/rfq POST': ['rfq-create', 10, MIN],
  '/affiliate POST': ['affiliate-apply', 5, MIN],
  '/investor/contact POST': ['investor-contact', 5, MIN],
  '/legal/cookie-consent POST': ['cookie-consent', 30, MIN],
  '/legal/data-rights POST': ['legal-data-rights', 5, MIN],
  '/legal/dmca POST': ['legal-dmca', 5, MIN],
  '/careers/apply POST': ['careers-apply', 5, MIN],
  '/uploads/kyc POST': ['uploads-kyc', 10, MIN],
  // ---- COMPARE
  '/products/compare POST': ['products-compare', 60, MIN],
  '/products/compare DELETE': ['products-compare', 60, MIN],
  // ---- APP/NATIVE sync: bursts OK
  '/app/offline-sync POST': ['app-offline-sync', 60, MIN],
  '/native/offline-sync POST': ['native-offline-sync', 60, MIN],
  '/app/settings POST': ['app-settings-post', 30, MIN],
  '/app/storage-stats POST': ['app-storage-stats', 30, MIN],
  '/app/telemetry POST': ['app-telemetry', 120, MIN],
};

// ---------- matcher ----------
function handlerSpans(src) {
  const spans = [];
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const next = src.indexOf('\nexport ', m.index + 10);
    spans.push({ method: m[1], start: m.index, end: next === -1 ? src.length : next });
  }
  return spans;
}

// String/comment-aware scanner
function scan(src, from, onChar) {
  let i = from, str = null, line = false, block = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (line) { if (c === '\n') { line = false; onChar(c, true); i++; continue; } onChar(c, true); i++; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; onChar(' ', true); onChar('/', true); i += 2; continue; } onChar(c, true); i++; continue; }
    if (str) {
      if (c === '\\') { onChar(c, true); onChar(n, true); i += 2; continue; }
      if (str === '`' && c === '$' && n === '{') { onChar('$', true); onChar('{', true); i += 2; continue; }
      if (c === str) { str = null; onChar(c, true); i++; continue; }
      onChar(c, true); i++; continue;
    }
    if (c === '/' && n === '/') { line = true; onChar('/', true); onChar('/', true); i += 2; continue; }
    if (c === '/' && n === '*') { block = true; onChar('/', true); onChar('*', true); i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; onChar(c, true); i++; continue; }
    onChar(c, false); i++;
  }
}

function matchFrom(src, from, open, close) {
  let depth = 0, end = -1;
  scan(src, from, (c, inert) => {
    if (end !== -1) return;
    if (inert) return;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) end = arguments; }
  });
  return end;
}

// Simpler direct implementations (the scan() callback cannot return early)
function findMatching(src, openPos, open, close) {
  let depth = 0;
  let i = openPos;
  let inStr = null, inLine = false, inBlock = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') inLine = false; i++; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i += 2; continue; } i++; continue; }
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { inLine = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBlock = true; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

function skipWs(src, i) {
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    return i;
  }
  return i;
}

// Find insertion point inside a handler span: after the auth-guard statement.
function findInsertAfterAuth(src, spanStart, spanEnd) {
  const span = src.slice(spanStart, spanEnd);
  const authRe = /const\s+\w+\s*=\s*await\s+(?:authenticateRequest|requireUserType|guard)\(/g;
  let m, lastEnd = null, lastPos = null;
  while ((m = authRe.exec(span)) !== null) {
    const constLineEnd = span.indexOf('\n', m.index);
    // find the first `if (` after the auth const line (the guard)
    let ifPos = span.indexOf('if (', constLineEnd);
    const tryPos = span.indexOf('try {', constLineEnd);
    if (ifPos !== -1 && (tryPos === -1 || ifPos < tryPos)) {
      const condOpen = span.indexOf('(', ifPos);
      const condClose = findMatching(span, condOpen, '(', ')');
      if (condClose === -1) continue;
      let afterCond = skipWs(span, condClose + 1);
      if (span[afterCond] === '{') {
        const blockEnd = findMatching(span, afterCond, '{', '}');
        if (blockEnd === -1 || blockEnd > spanEnd - spanStart) continue;
        const block = span.slice(afterCond, blockEnd);
        if (!/return/.test(block)) continue; // guard must return early
        lastEnd = blockEnd + 1; lastPos = spanStart + m.index;
      } else {
        // single-line if: `if (g) return g`
        const lineEnd = span.indexOf('\n', afterCond);
        const stmt = span.slice(afterCond, lineEnd === -1 ? span.length : lineEnd);
        if (!/return/.test(stmt)) continue;
        lastEnd = lineEnd === -1 ? span.length : lineEnd; lastPos = spanStart + m.index;
      }
    } else {
      // no guard if — gate right after the auth const line
      lastEnd = constLineEnd; lastPos = spanStart + m.index;
    }
  }
  return lastEnd === null ? null : { insertAt: spanStart + lastEnd, authPos: lastPos };
}

function publicBodyStart(src, spanStart) {
  // signature always closes with `) {` — first occurrence after span start
  const idx = src.indexOf(') {', spanStart);
  return idx === -1 ? null : idx + 3;
}

function addImport(src) {
  if (/import\s*\{[^}]*checkRateLimit[^}]*\}\s*from\s*'@\/lib\/rate-limit'/.test(src)) return src;
  const importRe = /^import[^;]+;[\s]*$/gm;
  let last = null, m;
  while ((m = importRe.exec(src)) !== null) last = m.index + m[0].length;
  const imp = `import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'\n`;
  if (last !== null) return src.slice(0, last) + imp + src.slice(last);
  return imp + src;
}

// ---------- apply ----------
const files = [...new Set(Object.keys(MANIFEST).map((k) => k.slice(0, k.lastIndexOf(' '))))];
let wired = 0, failed = [];
for (const key of Object.keys(MANIFEST)) {
  const sp = key.lastIndexOf(' ');
  const route = key.slice(0, sp), method = key.slice(sp + 1);
  const file = 'src/app/api' + route + '/route.ts';
  const [bucket, limit, window] = MANIFEST[key];
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { failed.push(key + ' (no file)'); continue; }
  const spans = handlerSpans(src).filter((s) => s.method === method);
  if (spans.length === 0) { failed.push(key + ' (no handler)'); continue; }
  const span = spans[0];
  if (src.slice(span.start, span.end).includes('checkRateLimit')) { wired++; continue; } // already
  const auth = findInsertAfterAuth(src, span.start, span.end);
  let insertAt, modeNote;
  if (auth !== null) { insertAt = auth.insertAt; modeNote = 'after-auth'; }
  else {
    const pb = publicBodyStart(src, span.start);
    if (pb === null) { failed.push(key + ' (no body)'); continue; }
    insertAt = pb; modeNote = 'public';
  }
  // indent = indent of next line after insertAt
  const nl = src.indexOf('\n', insertAt);
  const nextLine = nl === -1 ? '' : src.slice(nl + 1);
  const indMatch = nextLine.match(/^(\s*)\S/);
  const ind = indMatch ? indMatch[1] : '  ';
  const gate = `\n${ind}const rl = checkRateLimit(request, '${bucket}', ${limit}, ${window})\n${ind}if (!rl.ok) return rateLimitResponse(rl)\n`;
  let out = src.slice(0, insertAt) + gate + src.slice(insertAt);
  out = addImport(out);
  writeFileSync(file, out);
  wired++;
  console.log(`wired ${key} [${modeNote}] -> ${bucket} ${limit}/${window / 1000}s`);
}
console.log(`\nDONE wired=${wired} failed=${failed.length}`);
for (const f of failed) console.log('FAILED: ' + f);
