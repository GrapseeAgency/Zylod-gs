#!/usr/bin/env bash
# t229g: responsive sweep — mobile 390px horizontal-overflow audit across
# high-traffic Tier-3 pageIds. Reports pages where document.scrollWidth
# exceeds the viewport (real responsive breakage, the owner's #1 complaint).
cd /home/z/my-project || exit 1

PAGES=(
  "home" "category-browser" "category-products?category=textiles-fabrics"
  "search-results?q=textile" "search" "flash-sale" "flash-deals" "daily-deals"
  "suppliers" "supplier-detail?id=supplier-001" "product-detail?productId=prod-001"
  "cart" "checkout" "help-center" "faq" "contact-us" "about-us" "about-store"
  "terms-of-service" "privacy-policy" "return-policy" "shipping-policy"
  "career-page" "job-listings" "press" "blog" "blog-post?slug=market-trends-bangladesh"
  "events" "pricing" "mobile-app" "download-app" "become-a-seller" "sell-with-us"
  "join-seller" "seller-onboarding" "supplier-verification-page" "trade-assurance"
  "trust-center" "system-status" "wallet" "my-wallet" "wallet-page" "addresses"
  "shipping-address" "add-address" "payment-method" "order-tracking" "track-package"
  "wishlist" "favorites" "compare" "notifications" "notification-center"
  "voucher-page" "gift-card" "loyalty-program" "reward-points" "vip-club"
  "barcode-scanner" "qr-scanner" "image-search" "visual-search" "voice-search"
  "login" "register-buyer" "forgot-password" "guest-support" "emergency-support"
  "bulk-enquiry" "rfq-list" "quote-request" "store-page" "top-suppliers"
  "approved-suppliers" "featured-suppliers" "trending-now" "new-arrivals"
  "clearance" "seasonal-offers" "wholesale-pricing" "wholesale-account"
  "packaging" "led-lighting" "garments" "spices" "electronics" "agriculture-food"
)

PASS=0; FAIL=0; FAILED_LIST=""
for p in "${PAGES[@]}"; do
  agent-browser open "http://localhost:3000/?page=${p}" --wait 2500 >/dev/null 2>&1
  RESULT=$(agent-browser eval "Math.round(document.documentElement.scrollWidth) + 'x' + Math.round(window.innerWidth)" 2>/dev/null | tr -d '"')
  SW=${RESULT%x*}; IW=${RESULT#*x}
  if [[ "$SW" -gt "$IW" ]] 2>/dev/null; then
    FAIL=$((FAIL+1))
    FAILED_LIST="${FAILED_LIST}\n  OVERFLOW ${p}: scrollWidth=${SW} > viewport=${IW} (+$((SW-IW))px)"
    echo "FAIL  ${p}  ${SW} > ${IW}"
  else
    PASS=$((PASS+1))
    echo "ok    ${p}  ${SW}x${IW}"
  fi
done

echo ""
echo "=== SWEEP RESULT: ${PASS} pass / ${FAIL} overflow ==="
[[ -n "$FAILED_LIST" ]] && echo -e "$FAILED_LIST"
