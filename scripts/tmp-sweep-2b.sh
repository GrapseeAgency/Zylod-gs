#!/bin/bash
# Task 2-b responsive overflow sweep
IP="21.0.21.97"
VP="$1"   # viewport "WxH"
PAGES=(
"home"
"search-results&query=cotton"
"category-products&category=textiles-fabrics"
"category-products&category=agriculture-food"
"flash-sale"
"best-sellers"
"recommended"
"supplier-listing"
"supplier-profile&supplierId=cmvqg8lmq0016mcuwy9v7ue0a"
"buyer-dashboard"
"buyer-orders"
"buyer-wishlist"
"buyer-favorites"
"buyer-settings"
"buyer-returns"
"login"
"register-buyer"
"register-supplier"
"forgot-password"
"rfq-list"
"quote-request"
"careers-page"
"privacy-policy"
"terms-of-service"
"about-us"
"contact-us"
"faq"
"chat-list"
"notifications"
"wallet"
"shipping-address"
"spin-win"
"explore"
)
W="${VP%x*}"; H="${VP#*x}"
agent-browser set viewport "$W" "$H" >/dev/null 2>&1
for p in "${PAGES[@]}"; do
  agent-browser open "http://$IP:3000/?page=$p" >/dev/null 2>&1
  agent-browser wait 2500 >/dev/null 2>&1
  OW=$(agent-browser eval "document.documentElement.scrollWidth - document.documentElement.clientWidth" 2>/dev/null | tr -d '"')
  SW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null | tr -d '"')
  echo "$VP|$p|overflow=$OW|scrollWidth=$SW"
done
