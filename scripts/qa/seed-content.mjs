// Seed site content: legal documents, help articles, job listings,
// press releases, and trade events. Idempotent (upserts by unique key).
// Run: node scripts/qa/seed-content.mjs
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const LEGAL_DOCS = [
  {
    docType: 'terms_of_service',
    titleEn: 'Terms of Service',
    titleBn: 'সেবার শর্তাবলী',
    contentEn: `1. Acceptance of Terms
By accessing or using Zylod ("the Platform"), a business-to-business wholesale marketplace operated by Zylod Ltd. (Dhaka, Bangladesh), you agree to be bound by these Terms of Service.

2. Eligibility
Zylod accounts are for businesses and adults engaged in wholesale trade. You must be at least 18 years old and legally able to enter into contracts. Sellers must hold a valid trade license and, where applicable, VAT registration in Bangladesh.

3. Accounts
You are responsible for the accuracy of your registration information, for safeguarding your credentials, and for all activity under your account. One entity may operate one buyer and one supplier account.

4. Marketplace Role
Zylod is a venue that connects buyers and suppliers. Unless expressly stated (e.g. SafePay escrow), Zylod is not a party to the underlying sale contract between buyer and supplier. Quality assurances, warranties, and delivery commitments are the supplier's responsibility.

5. Orders & Payment
Buyers agree to pay the total order value through approved payment channels. Orders enter production or dispatch only after confirmed payment or agreed credit terms. Prices are quoted in Bangladeshi Taka (BDT) unless otherwise stated.

6. Shipping & Delivery
Delivery timelines are estimates based on supplier commitments. Risk passes according to the shipping terms agreed on the order. Zylod may facilitate logistics partners but does not operate carrier services.

7. Returns & Disputes
Return eligibility follows each supplier's published return policy and the platform return policy. Disputes should first be raised with the supplier through the order conversation; unresolved disputes may be escalated to Zylod support for mediation.

8. Prohibited Conduct
No fraudulent listings, counterfeit goods, payment fraud, scraping, or interference with platform operations. Violations may result in suspension or termination.

9. Liability
To the extent permitted by law, Zylod's aggregate liability arising from your use of the Platform is limited to the service fees you paid to Zylod in the six months preceding the claim.

10. Changes
We may update these terms; material changes will be announced on the Platform. Continued use constitutes acceptance.`,
  },
  {
    docType: 'privacy_policy',
    titleEn: 'Privacy Policy',
    titleBn: 'গোপনীয়তা নীতি',
    contentEn: `1. Information We Collect
- Account data: name, business name, email, phone, address.
- Transaction data: orders, quotes, messages, invoices.
- Device data: IP address, browser type, and basic analytics.

2. How We Use Information
We use your data to operate the marketplace (matching orders, logistics, escrow), to provide support, to prevent fraud, and to improve the service. We do not sell personal data.

3. Sharing
Data is shared only with: counterparty businesses necessary to complete your transactions (e.g. your shipping address with the supplier), payment and logistics providers processing your order, and authorities where required by Bangladeshi law.

4. Data Retention
Transaction records are retained as required under applicable tax and commercial law. Account data is retained until you request deletion, subject to legal holds.

5. Security
We apply transport encryption (TLS), hashed credentials, and role-based access. No method of transmission is 100% secure; please report suspected incidents to privacy@zylod.com.

6. Your Rights
You may request access, correction, or deletion of your personal data, and object to certain processing, by contacting privacy@zylod.com. We respond within 30 days.

7. Cookies
Essential cookies keep you signed in; analytics cookies require your consent. See the Cookie Policy for details.`,
  },
  {
    docType: 'return_policy',
    titleEn: 'Return Policy',
    titleBn: 'রিটার্ন নীতি',
    contentEn: `1. Eligibility Window
Buyers may raise a return request within 7 days of delivery for manufacturing defects, wrong items, or quantity shortfalls, and within 48 hours for transit damage (with photos).

2. How to Raise a Return
Open the order in your dashboard, choose "Request Return", select the affected items, add photos and a description. The supplier is notified immediately.

3. Supplier Response
Suppliers must accept, partially accept, or reject the request within 3 business days with a reasoned reply. Silence counts as acceptance.

4. Resolution Options
- Replacement: supplier ships a replacement at supplier cost.
- Repair: for machinery and equipment where repair is agreed.
- Refund: to the original payment method or SafePay escrow release adjustment.

5. Non-Returnable Cases
Custom-manufactured goods produced to buyer specification (unless defective), perishables past the return window, and goods altered after delivery.

6. Escalation
If you disagree with the supplier's decision, you can escalate to Zylod mediation from the return request. Decisions consider inspection reports when an inspection was ordered.`,
  },
  {
    docType: 'shipping_policy',
    titleEn: 'Shipping Policy',
    titleBn: 'শিপিং নীতি',
    contentEn: `1. Dispatch Times
Suppliers commit to a dispatch window shown on each product (typically 3–15 business days depending on production status). Made-to-order lots state the production lead time explicitly.

2. Carriers & Coverage
Zylod aggregates licensed freight forwarders and domestic carriers covering all 64 districts of Bangladesh. International freight quotes are available for export lots.

3. Rates
Domestic rates are calculated by weight, distance, and service level at checkout; supplier-fulfilled free-shipping thresholds apply where shown.

4. Tracking
Every dispatched order receives tracking updates on the order tracking page and via notifications. Delays over 48 hours against the committed window are flagged automatically.

5. Damage & Loss
Report transit damage within 48 hours with photos. Lost shipments are investigated with the carrier; escrow-protected orders are refunded or re-shipped per the investigation result.`,
  },
  {
    docType: 'payment_terms',
    titleEn: 'Payment Terms',
    titleBn: 'পেমেন্ট শর্তাবলী',
    contentEn: `1. Accepted Methods
bKash, Nagad, bank transfer, and cards for buyers; SafePay escrow is mandatory for orders above the platform threshold unless both parties opt out.

2. Escrow (SafePay)
Buyer funds are held by the escrow provider and released to the supplier after confirmed delivery (and expiry of the inspection window). This protects both sides of the transaction.

3. Invoicing
A digital invoice is generated for every order. Suppliers must issue compliant VAT invoices where applicable.

4. Currency & Taxes
All amounts are in BDT. Withholding taxes and VAT are the responsibility of the transacting parties; Zylod collects platform service fees as shown at checkout.

5. Refund Timing
Approved refunds return via the original method: wallet instantly; bKash/Nagad within 1–3 business days; bank transfers 3–7 business days depending on the bank.

6. Chargebacks & Fraud
Payment fraud, reversed transactions, and identity misuse lead to immediate account suspension and cooperation with law enforcement.`,
  },
  {
    docType: 'wholesale_terms',
    titleEn: 'Wholesale Trade Terms',
    titleBn: 'পাইকারি বাণিজ্য শর্ত',
    contentEn: `1. MOQ & Tiered Pricing
Each product states its Minimum Order Quantity and price tiers. Higher volumes unlock lower per-unit prices automatically at checkout.

2. Quotes & RFQ
Buyers may request quotations for custom requirements. Quotes are valid for the period stated in the quote (default 14 days).

3. Samples
Sample orders are supported on products marked "Sample available". Sample fees may be credited against the first bulk order per supplier policy.

4. Quality & Inspection
Buyers may order third-party inspection before dispatch. Where SafePay escrow applies, the inspection window is stated on the order and must elapse before release.

5. Packaging & Marking
Export lots follow the packaging specification agreed in the order; buyer branding requires prior written agreement with the supplier.

6. Compliance
Buyers are responsible for import compliance in their jurisdiction; suppliers are responsible for export documentation accuracy for Bangladesh origin goods.`,
  },
  {
    docType: 'cookie_policy',
    titleEn: 'Cookie Policy',
    titleBn: 'কুকি নীতি',
    contentEn: `1. What We Use
- Essential: session authentication, security tokens, cart state. These cannot be disabled.
- Preference: theme (light/dark), language, currency selection.
- Analytics: aggregated usage measurement, only with your consent.

2. Local Storage
We use browser local storage for non-sensitive UI state (active navigation page, wishlist view preferences). No personal or payment data is stored in local storage.

3. Third Parties
We do not load third-party advertising trackers. Analytics, when consented, is first-party.

4. Managing Cookies
You can clear or block cookies in your browser settings; blocking essential cookies will prevent sign-in. You can re-manage consent at any time from the cookie settings link in the footer.`,
  },
  {
    docType: 'dmca_policy',
    titleEn: 'DMCA & IP Policy',
    titleBn: 'ডিএমসিএ ও আইপি নীতি',
    contentEn: `1. Reporting Infringement
If you believe a listing infringes your copyright, trademark, or design rights, submit a notice through the DMCA report form with: identification of the work, the listing URL, your contact details, a good-faith statement, and your authority to act.

2. Our Response
We remove or disable access to materially infringing content, notify the supplier, and repeat-infringing suppliers are terminated.

3. Counter-Notice
A supplier may file a counter-notice if content was removed by mistake. We restore content 10 business days after a valid counter-notice unless the complainant files court action.

4. Bad-Faith Notices
Knowingly false notices make the sender liable for damages and costs.`,
  },
  {
    docType: 'refund_policy',
    titleEn: 'Refund Policy',
    titleBn: 'রিফান্ড নীতি',
    contentEn: `1. When You Are Eligible
- Order cancelled before dispatch: 100% refund.
- Goods not delivered against the committed window and not resolvable: 100% refund (escrow orders).
- Return accepted: refund of item value per the supplier's accepted resolution.

2. Non-Refundable
Platform service fees on completed buyer-remorse cancellations, sample orders already shipped, and custom-manufactured goods already in production (unless defective).

3. Process
Refunds are issued after the return/inspection resolution is confirmed. Escrow releases are adjusted automatically; other refunds are initiated within 2 business days.

4. Timelines
Wallet: instant. Mobile financial services (bKash/Nagad): 1–3 business days. Bank transfer: 3–7 business days. Your statement descriptor will show "Zylod".`,
  },
]

const HELP_ARTICLES = [
  {
    slug: 'how-it-works',
    titleEn: 'How Zylod Works',
    category: 'General',
    contentEn: `From account creation to bulk delivery — the full buying flow on Zylod.

Zylod connects verified Bangladeshi suppliers with wholesale buyers.

1. Create your account — buyers sign up free with email or phone verification.
2. Find products — browse categories, search, compare, or post an RFQ for custom requirements.
3. Negotiate & order — chat with suppliers, confirm quantity and tier pricing, then place the order.
4. Pay safely — pay via bKash, Nagad, bank transfer, or card. Orders above the escrow threshold use SafePay: your money is held until delivery is confirmed.
5. Receive & inspect — track your shipment; raise a return within the window if anything is wrong.
6. Grow — rate suppliers, save favorites, and unlock wholesale rewards.

For suppliers: register your business, complete verification (trade license), list products with MOQ and tier pricing, and receive orders with escrow protection.`,
  },
  {
    slug: 'buyer-guide',
    titleEn: 'Buyer Guide: Ordering in Bulk',
    category: 'Products',
    contentEn: `MOQ, price tiers, samples, and inspection — everything buyers should know.

Minimum Order Quantity (MOQ) is the smallest lot a supplier will sell. Tiered pricing lowers your per-unit price as quantity increases — the cart applies tiers automatically.

Samples: products marked "Sample available" can be ordered in single units to test quality first. Sample fees may be credited against your first bulk order.

Inspection: for large orders, request third-party inspection before dispatch from the order page. With SafePay escrow, funds are only released after the inspection window passes.

Communication: always keep negotiation in the order conversation — it is your evidence in any dispute.`,
  },
  {
    slug: 'seller-guide',
    titleEn: 'Seller Guide: Listing & Fulfillment',
    category: 'Sellers',
    contentEn: `Product listing standards, verification, payouts, and fulfillment SLAs.

Verification: submit your trade license and bank details; approved suppliers get the Verified badge and higher search ranking.

Listings: real product photos (no stock misuse), accurate MOQ, tiered prices, and honest stock counts. Listings that mislead buyers are removed.

Fulfillment: dispatch within your stated window. Late dispatch lowers your seller score and can suspend listing visibility.

Payouts: escrow releases to your payout account after the buyer's inspection window. Withdrawals process within 2 business days.`,
  },
  {
    slug: 'safepay-escrow',
    titleEn: 'SafePay Escrow Explained',
    category: 'Payments',
    contentEn: `How escrow protects both buyers and suppliers on every large order.

SafePay holds the buyer's payment with our escrow provider when the order is placed. The supplier ships with confidence knowing funds are secured.

Release: funds release to the supplier after delivery confirmation and the inspection window (shown on the order) elapses. The buyer can raise a return within the window — disputed funds stay held until resolution.

Fees: escrow protection is included in the platform service fee; there is no extra charge for orders that qualify.`,
  },
  {
    slug: 'returns-refunds',
    titleEn: 'Returns & Refunds',
    category: 'Returns',
    contentEn: `Return windows, how to raise a request, and refund timelines.

Windows: 7 days for defects/wrong items, 48 hours for transit damage (photos required).

Raising a return: open the order → "Request Return" → select items → attach photos. Suppliers must respond within 3 business days; silence counts as acceptance.

Refunds: wallet instantly, bKash/Nagad 1–3 days, bank transfer 3–7 days after resolution is confirmed. See the full Return Policy for non-returnable cases.`,
  },
  {
    slug: 'terms-and-conditions',
    titleEn: 'Terms & Conditions (Summary)',
    category: 'General',
    contentEn: `The plain-language summary of Zylod's Terms of Service. The full document lives at the Terms of Service page.

Accounts: one entity, one account; you are responsible for your credentials and for accurate business information. Sellers need a valid trade license.

Marketplace role: Zylod connects buyers and suppliers. Suppliers own their quality and delivery commitments; SafePay escrow protects payment until delivery is confirmed.

Orders: prices in BDT; orders are fulfilled after confirmed payment or agreed credit terms. Delivery timelines are supplier commitments tracked on each order.

Returns: 7 days for defects or wrong items, 48 hours for transit damage with photos. See the Return Policy for resolution options and escalation.

Prohibited: counterfeit goods, payment fraud, scraping, or interference with platform operations — violations lead to suspension.

For the complete, binding text, read the Terms of Service document (version 1.0).`,
  },
  {
    slug: 'account-security',
    titleEn: 'Account Security & Two-Factor Auth',
    category: 'Account',
    contentEn: `Protect your business account with 2FA, recovery codes, and device hygiene.

Two-factor authentication: enable from Account Settings → Security. We support TOTP apps and SMS.

Recovery codes: store your backup codes offline — each code works once if you lose your second factor.

Phishing: Zylod never asks for your password over chat or email. Verify sender addresses and only sign in on zylod.com.`,
  },
]

const JOBS = [
  {
    title: 'Senior Backend Engineer (Distributed Systems)',
    slug: 'senior-backend-engineer-distributed-systems',
    department: 'Engineering',
    location: 'Dhaka, Bangladesh (Hybrid)',
    locationType: 'hybrid',
    employmentType: 'full_time',
    descriptionEn: `Own the core marketplace services: order orchestration, escrow state machine, and the notification pipeline serving hundreds of thousands of monthly trade events across Bangladesh.`,
    requirementsEn: `• 5+ years backend experience with TypeScript or Go\n• Distributed systems fundamentals: queues, idempotency, exactly-once effects\n• SQL mastery (PostgreSQL/MySQL) and schema design\n• Experience with event-driven architecture\n• B2B, marketplace, or fintech background a plus`,
    salaryMin: 180000,
    salaryMax: 320000,
  },
  {
    title: 'Category Manager — Textiles & Apparel',
    slug: 'category-manager-textiles-apparel',
    department: 'Operations',
    location: 'Dhaka, Bangladesh (On-site)',
    locationType: 'onsite',
    employmentType: 'full_time',
    descriptionEn: `Grow the textiles category: recruit mills and garment houses, curate the catalog, and own GMV and supply quality for the category that anchors Zylod's wholesale volume.`,
    requirementsEn: `• 3+ years in textiles sourcing, merchandising, or B2B sales\n• Deep knowledge of Bangladesh RMG and fabric supply chains\n• Negotiation and supplier account management skills\n• Data fluency: funnel metrics, pricing analysis`,
    salaryMin: 90000,
    salaryMax: 160000,
  },
  {
    title: 'Mobile Engineer (Android, Kotlin)',
    slug: 'mobile-engineer-android-kotlin',
    department: 'Engineering',
    location: 'Remote (Bangladesh)',
    locationType: 'remote',
    employmentType: 'full_time',
    descriptionEn: `Build the Zylod Android app in Kotlin + Jetpack Compose (Material 3): buyer ordering flows, offline-first catalogs, and barcode-driven warehouse tooling for suppliers.`,
    requirementsEn: `• 3+ years Android with Kotlin, strong Compose experience\n• Offline-first architecture and sync patterns\n• REST/WebSocket integration at scale\n• Play Store release experience`,
    salaryMin: 120000,
    salaryMax: 220000,
  },
]

const PRESS = [
  {
    slug: 'zylod-secures-series-a-to-digitize-bangladesh-wholesale',
    title: 'Zylod Raises Series A to Digitize Bangladesh\u2019s Wholesale Trade',
    summary: 'The round will expand SafePay escrow coverage, logistics integrations, and the supplier verification program across all 64 districts.',
    category: 'funding',
    contentEn: `DHAKA, BANGLADESH — Zylod, the business-to-business wholesale marketplace for Bangladeshi suppliers and buyers, announced a Series A financing to accelerate its mission of digitizing the country's wholesale trade.

The investment will fund three areas: nationwide expansion of SafePay escrow so every large order is protected end-to-end, deeper logistics integrations with licensed freight partners in all 64 districts, and growth of the supplier verification program that gives buyers verified trade-license and factory documentation for every approved supplier.

"Wholesale buying in Bangladesh still runs on phone calls, cash advances, and trust that is hard to verify," said a Zylod spokesperson. "Zylod replaces that friction with tiered pricing, escrow protection, and tracked delivery — while keeping the relationships that make B2B trade work."

The platform currently serves buyers across textiles, agriculture, electronics, packaging, and home goods categories, with made-in-Bangladesh supply ranging from jute and muslin to LED lighting and ceramic tableware.`,
  },
  {
    slug: 'zylod-launches-safepay-escrow-for-every-order',
    title: 'Zylod Launches SafePay Escrow for Every Wholesale Order',
    summary: 'Buyer funds are now held in escrow by default and released only after delivery and inspection — eliminating advance-payment risk.',
    category: 'product_launch',
    contentEn: `Zylod today announced that SafePay escrow is now the default protection for wholesale orders above the platform threshold.

With SafePay, the buyer's payment is held by a regulated escrow provider from order placement until delivery is confirmed and the inspection window closes. Suppliers ship knowing funds are secured; buyers inspect before money moves.

The rollout includes automatic dispute holds: any return request raised within the inspection window freezes the release until the dispute resolves. Escrow protection is included in the platform service fee with no extra charge.`,
  },
  {
    slug: 'zylod-expands-verified-supplier-program-nationwide',
    title: 'Zylod Expands Verified Supplier Program Nationwide',
    summary: 'Trade-license verification, factory documentation, and on-site inspections now available to suppliers in all 64 districts.',
    category: 'milestone',
    contentEn: `Zylod's Verified Supplier program is now open to suppliers in all 64 districts of Bangladesh.

Verification includes trade-license checks, bank account matching, and — for exporters — factory documentation review. Buyers see the verification status directly on every storefront and product page, and can order third-party inspections before dispatch on qualifying orders.

The program targets the core trust problem in wholesale: buyers committing large sums to suppliers they have never met. Verified suppliers receive a badge, higher search ranking, and access to escrow-protected enterprise buyers.`,
  },
]

const EVENTS = [
  {
    title: 'Dhaka International Trade Fair — Zylod Buyer Meetup',
    description: 'Meet Zylod category managers and verified suppliers at the Bangladesh-China Friendship Exhibition Center. Live product showcases for textiles, jute goods, and ceramics; on-site buyer registration and sample counters.',
    location: 'ICCB, Purbachal, Dhaka',
    startsAt: new Date(Date.now() + 21 * 86400e3),
    endsAt: new Date(Date.now() + 28 * 86400e3),
  },
  {
    title: 'Chattogram Port & Export Logistics Workshop',
    description: 'A working session for exporters: customs documentation, freight forwarder selection, and container consolidation via Zylod\u2019s logistics partners. Limited seats for verified suppliers.',
    location: 'World Trade Center, Chattogram',
    startsAt: new Date(Date.now() + 35 * 86400e3),
    endsAt: new Date(Date.now() + 35 * 86400e3 + 8 * 3600e3),
  },
  {
    title: 'Textiles Sourcing Week — Muslin & Denim Lots',
    description: 'Five days of factory-direct sourcing: muslin weaving clusters from Rangpur, denim mills from Narayanganj, and tiered-pricing negotiation sessions hosted with Zylod category managers.',
    location: 'Bangabandhu International Conference Center, Dhaka',
    startsAt: new Date(Date.now() + 49 * 86400e3),
    endsAt: new Date(Date.now() + 54 * 86400e3),
  },
]


// t281 5-d seeded the CURRENT app version row (the download page and the
// in-app updater read the LATEST published appVersions row; the repo's APKs
// sat at the v2.4.7 era while the code shipped v2.4.42 — the t229h stale-APK
// class). t283 bumps the row to 2.4.44/284 alongside the round-7 sweep;
// t284 published the APK from the green run-489 (0863d4e) release artifact —
// 26,690,415 bytes, sha256 a5178cae…, byte-identical to the CI artifact.
// t285 publishes the round-8 build: the green run-491 (3665bfe) release
// artifact — 26,690,415 bytes, sha256 60f9cadd…, byte-identical to the CI
// artifact (manifest string pool carries 2.4.45 + the 3665bfe suffix).
const APP_VERSION = {
  id: 'android-v285',
  platform: 'android',
  versionNumber: '2.4.45',
  versionCode: 285,
  minSupportedVersion: '2.4.0',
  isMandatory: false,
  changelogEn: `- Every policy screen (Privacy Policy, Terms, Returns, Shipping, Wholesale Terms, Cookies, DMCA, Refunds) now shows the REAL policy document with sections and version — no more placeholder bullets
- Checkout success page: the Estimated-Delivery note now sits in its own column, cleanly separated from the order number
- Rewards page no longer slides under the top bar; the balance hero is fully visible
- Supplier pages show star ratings only when a real rating exists — no more "★ 0.0" rows
- Admin audit logs read as clean "key: value" lines instead of raw JSON
- Assorted polish: order "1 shipment" line stays on one line, careers quick-nav labels wrap fully, two-factor SMS icon clearly visible, credit-limit meter no longer shows a false full marker`,
  changelogBn: `- প্রতিটি পলিসি স্ক্রিন (প্রাইভেসি পলিসি, শর্তাবলী, রিটার্ন, শিপিং, হোলসেল শর্ত, কুকি, DMCA, রিফান্ড) এখন আসল পলিসি ডকুমেন্ট সেকশন ও ভার্সন সহ দেখায় — আর কোনো প্লেসহোল্ডার বুলেট নেই
- চেকআউট সাকসেস পেজে আনুমানিক ডেলিভারি নোটটি এখন নিজের কলামে, অর্ডার নম্বর থেকে পরিষ্কভাবে আলাদা
- রিওয়ার্ডস পেজ আর টপ বারের নিচে চাপা পড়ে না; ব্যালেন্স হিরো পুরোপুরি দেখা যায়
- সাপ্লায়ার পেজে রিয়েল রেটিং থাকলেই তারা চিহ্ন দেখায় — আর "★ 0.0" সারি নেই
- অ্যাডমিন অডিট লগ এখন পরিষ্কার "কী: ভ্যালু" লাইনে পড়া যায়, কাঁচা JSON নয়
- আরও পলিশ: অর্ডারের "1 shipment" লাইন এক লাইনে থাকে, ক্যারিয়ার্স কুইক-নেভ লেবেল পুরো দেখা যায়, টু-ফ্যাক্টর SMS আইকন স্পষ্ট, ক্রেডিট-লিমিট মিটারে আর ভুয়া ফুল মার্কার নেই`,
  apkDownloadUrl: '/downloads/zylod-b2b-v2.4.45.apk',
  apkSizeBytes: BigInt(26690415),  // real byte count of the green run-491 release artifact (t285 publish)
  releaseNotes: 'Round-8 sweep (real policy documents in-app, checkout/rewards/orders/supplier layout fixes, audit-log readability).',
  isPublished: true,
}

// t283: public deep-link routes — the deep-link-handler page lists these
// rows via /api/app/deep-links and NOTHING seeded the table on any CI path
// (prisma/seed-app-level.ts owns the data but no workflow runs it — the
// same class as the t281 faqItems/blogPosts find). Canonical slugs from
// the QR/link-generator surfaces; targets normalized to the live pageIds
// (supplier→seller-storefront per the t277 D9 retirement, store kept as
// the link-generator alias).
const DEEP_LINK_ROUTES = [
  { slug: 'product', pathPattern: '/dl/product/:id', targetPage: 'product-detail', description: 'Direct wholesale product details' },
  { slug: 'supplier', pathPattern: '/dl/supplier/:id', targetPage: 'seller-storefront', description: 'Direct factory mill storefront' },
  { slug: 'store', pathPattern: '/dl/store/:id', targetPage: 'seller-storefront', description: 'Storefront alias used by the link generator' },
  { slug: 'deal', pathPattern: '/dl/deal/:id', targetPage: 'exclusive-deal-detail', description: 'Exclusive bulk discount link' },
  { slug: 'live', pathPattern: '/dl/live/:id', targetPage: 'live-shopping-detail', description: 'Live factory broadcast stream' },
  { slug: 'rfq', pathPattern: '/dl/rfq', targetPage: 'rfq-list', description: 'Instant bulk quotation request' },
  { slug: 'order', pathPattern: '/dl/order/:id', targetPage: 'shipping-tracker', description: 'Real-time courier telemetry tracker' },
]

// t281 5-c: public FAQs — the FAQ/help-center surfaces rendered
// 'No matching questions found' on every CI run (faqItems was seeded by
// NOTHING — prisma/seed-support-docs.ts exists but no CI path runs it;
// the VLM audit of artifact 13386389669 flagged capture 35). Ten entries
// lifted verbatim from prisma/seed-support-docs.ts (EN+BN).
const FAQS = [
  {
    "category": "orders",
    "questionEn": "How do I place a wholesale order on Zylod?",
    "answerEn": "Search or browse products, choose your quantity meeting or exceeding the Minimum Order Quantity (MOQ), check tier pricing discounts, add to cart, select delivery address, and pay securely via bKash, Nagad, bank transfer, or card. View our [How It Works Guide](/how-it-works) or [Browse Catalog](/product-list).",
    "questionBn": "জাইলোড-এ কীভাবে পাইকারি অর্ডার করবেন?",
    "answerBn": "পণ্য সার্চ বা ব্রাউজ করুন, নূন্যতম অর্ডার পরিমাণ (MOQ) বা তার বেশি সিলেক্ট করুন, টায়ার প্রাইসিং ডিসকাউন্ট দেখুন, কার্টে যোগ করুন, ডেলিভারি ঠিকানা নির্বাচন করুন এবং বিকাশ, নগদ, ব্যাংক ট্রান্সফার বা কার্ড দিয়ে নিরাপদে পেমেন্ট করুন। বিস্তারিত জানতে [কীভাবে কাজ করে](/how-it-works) দেখুন।",
    "sortOrder": 1
  },
  {
    "category": "orders",
    "questionEn": "What is Minimum Order Quantity (MOQ)?",
    "answerEn": "MOQ is the lowest number of units a manufacturer or wholesale supplier agrees to sell in a single order. Different price tiers unlock higher discounts at higher quantities. Read our [Bulk Pricing & MOQ Guide](/bulk-pricing-guide).",
    "questionBn": "মিনিমাম অর্ডার কোয়ান্টিটি (MOQ) কী?",
    "answerBn": "MOQ হলো সর্বনিম্ন পণ্যের সংখ্যা যা একজন প্রস্তুতকারক বা পাইকারি বিক্রেতা একটি অর্ডারে বিক্রি করতে রাজি হন। বেশি পরিমাণের অর্ডারে বেশি ছাড় পাওয়া যায়। বিস্তারিত জানতে [বাল্ক প্রাইসিং গাইড](/bulk-pricing-guide) পড়ুন।",
    "sortOrder": 2
  },
  {
    "category": "payments",
    "questionEn": "How does Zylod Escrow Payment Protection work?",
    "answerEn": "When you pay for an order, Zylod holds your funds in escrow. The payment is only released to the seller after you confirm receipt and inspect the goods within the 48-hour inspection window. Read our [SafePay Escrow Guide](/escrow-protection-guide).",
    "questionBn": "জাইলোড এস্ক্রো পেমেন্ট সুরক্ষা কীভাবে কাজ করে?",
    "answerBn": "অর্ডারের পেমেন্ট করার পর জাইলোড তা এস্ক্রো একাউন্টে সুরক্ষিত রাখে। পণ্য হাতে পেয়ে ৪৮ ঘণ্টার মধ্যে যাচাই করে নিশ্চিত করলেই কেবল বিক্রেতাকে টাকা পরিশোধ করা হয়। বিস্তারিত দেখুন [এস্ক্রো পলিসি](/escrow-protection-guide)।",
    "sortOrder": 3
  },
  {
    "category": "payments",
    "questionEn": "What payment methods are supported in Bangladesh?",
    "answerEn": "We support bKash, Nagad, Rocket, Upay, Visa/Mastercard debit/credit cards, and direct B2B Bank Transfers with RTGS/BEFTN/NPSB. Manage payment options in your [Wallet Dashboard](/wallet).",
    "questionBn": "বাংলাদেশে কোন কোন পেমেন্ট মাধ্যম গ্রহণ করা হয়?",
    "answerBn": "আমরা বিকাশ, নগদ, রকেট, উপায়, ভিসা/মাস্টারকার্ড এবং সরাসরি বি২বি ব্যাংক ট্রান্সফার (RTGS/BEFTN/NPSB) সমর্থন করি। আপনার [ওয়ালেট ড্যাশবোর্ড](/wallet) থেকে পেমেন্ট পরিচালনা করুন।",
    "sortOrder": 4
  },
  {
    "category": "shipping",
    "questionEn": "How are wholesale products delivered across Bangladesh?",
    "answerEn": "Products are shipped via partner courier networks (Steadfast, Pathao, RedX, eCourier, SA Paribahan, Sundarban Courier) or supplier self-logistics. Read the full [Logistics & Courier Delivery Policy](/logistics-delivery-policy).",
    "questionBn": "সারা দেশে কীভাবে পণ্য ডেলিভারি দেওয়া হয়?",
    "answerBn": "আমাদের অনুমোদিত কুরিয়ার পার্টনার (স্টিডফাস্ট, পাঠাও, রেডএক্স, এসএ পরিবহন, সুন্দরবন কুরিয়ার) বা সেলারের নিজস্ব পরিবহনে পণ্য পাঠানো হয়। বিস্তারিত জানতে [লজিস্টিকস নীতিমালা](/logistics-delivery-policy) দেখুন।",
    "sortOrder": 5
  },
  {
    "category": "shipping",
    "questionEn": "Can I track my consignment in real time?",
    "answerEn": "Yes! Navigate to [Track Order](/orders) to view the live GPS status, driver notes, and courier consignment ID updates.",
    "questionBn": "আমি কি রিয়েল টাইমে ডেলিভারি ট্র্যাক করতে পারব?",
    "answerBn": "হ্যাঁ! আপনার ড্যাশবোর্ডের [অর্ডার ট্র্যাকিং](/orders) সেকশনে গিয়ে রিয়েল-টাইম কুরিয়ার কনসাইনমেন্ট স্ট্যাটাস দেখতে পাবেন।",
    "sortOrder": 6
  },
  {
    "category": "returns",
    "questionEn": "What is the return policy for wholesale damaged goods?",
    "answerEn": "If goods arrive damaged, defective, or do not match specifications, raise a dispute within 48 hours of delivery with unboxing photo/video evidence. Learn more in our [Buyer Protection Policy](/buyer-protection-policy) or [Open Dispute Ticket](/submit-ticket).",
    "questionBn": "নষ্ট বা ভুল পণ্য পাওয়ার পর রিটার্ন পলিসি কী?",
    "answerBn": "ডেলিভারির ৪৮ ঘণ্টার মধ্যে আনবক্সিং ছবি বা ভিডিও প্রমাণসহ ডিসপুট ওপেন করলে সেলার রিপ্লেসমেন্ট দিতে বাধ্য থাকবে অথবা এস্ক্রো থেকে সম্পূর্ণ রিফান্ড দেওয়া হবে। দেখুন [ক্রেতা সুরক্ষা পলিসি](/buyer-protection-policy) অথবা [টিকেট ওপেন করুন](/submit-ticket)।",
    "sortOrder": 7
  },
  {
    "category": "sellers",
    "questionEn": "What documents are required to become a verified supplier?",
    "answerEn": "You need an updated Trade License (ট্রেড লাইসেন্স), National ID (NID), TIN Certificate, and a commercial bank account under your company name. Review our [Supplier Verification Guide](/seller-verification-guide) or [Upload Documents Now](/seller-verification).",
    "questionBn": "ভেরিফায়েড সেলার হতে কী কী কাগজপত্র প্রয়োজন?",
    "answerBn": "হালনাগাদ ট্রেড লাইসেন্স, জাতীয় পরিচয়পত্র (NID), ই-টিন (TIN) সার্টিফিকেট এবং প্রতিষ্ঠানের নামে খোলা একটি ভ্যালিড ব্যাংক একাউন্ট প্রয়োজন। দেখুন [সেলার ভেরিফিকেশন গাইড](/seller-verification-guide) অথবা [ডকুমেন্টস আপলোড করুন](/seller-verification)।",
    "sortOrder": 8
  },
  {
    "category": "sellers",
    "questionEn": "How do suppliers receive payouts for fulfilled orders?",
    "answerEn": "Once the buyer confirms receipt or the 48-hour inspection window passes without dispute, funds are disbursed automatically via BEFTN/NPSB to the verified bank account within 1-3 business days. Read our [Seller Handbook](/seller-guide).",
    "questionBn": "সেলাররা কীভাবে বিক্রির টাকা পাবেন?",
    "answerBn": "ক্রেতা ডেলিভারি নিশ্চিত করার পর অথবা ৪৮ ঘণ্টা সময় পার হওয়ার পর কোনো অভিযোগ না থাকলে ১-৩ কার্যদিবসের মধ্যে BEFTN/NPSB এর মাধ্যমে সেলারের ব্যাংক একাউন্টে টাকা চলে যাবে। দেখুন [সেলার সহায়িকা](/seller-guide)।",
    "sortOrder": 9
  },
  {
    "category": "account",
    "questionEn": "How do I protect my account with Two-Factor Authentication (2FA)?",
    "answerEn": "Go to [Account Settings](/profile-settings) to enable OTP verification via SMS or Authenticator App on every login and high-value transaction. For help, contact our [Live Chat Team](/live-chat).",
    "questionBn": "টু-ফ্যাক্টর অথেনটিকেশন (2FA) কীভাবে চালু করবেন?",
    "answerBn": "আপনার [অ্যাকাউন্ট সেটিংস](/profile-settings)-এ গিয়ে এসএমএস বা অথেনটিকেটর অ্যাপের মাধ্যমে অতিরিক্ত নিরাপত্তা চালু করতে পারেন। প্রয়োজনে [লাইভ চ্যাটে যোগাযোগ করুন](/live-chat)।",
    "sortOrder": 10
  },
]

// t281 5-c: public blog posts — the blog surface rendered "No articles
// published yet" on every CI run (blogPosts was seeded by NOTHING; the VLM
// audit of artifact 13386389669 flagged capture 43). Covers reuse the home
// banner art (thematically consistent, no new assets).
const BLOG_POSTS = [
  {
    slug: 'sourcing-textiles-from-narayanganj-mills',
    title: 'Sourcing Textiles from Narayanganj Mills: A Buyer Field Guide',
    excerpt: 'Denim, muslin, and finished-goods clusters within 25km of Dhaka — what MOQs, lead times, and tier pricing to expect when you buy direct.',
    category: 'Sourcing guide',
    coverImageUrl: '/images/banners/textile-warehouse.png',
    contentEn: `Narayanganj holds the densest concentration of textile mills in Bangladesh. This guide walks through the practical numbers buyers should expect.

## Typical MOQs
Woven denim lots start at 500-1,000 meters; knit jersey from 300kg. Mills reward commitment: a 3-tier price ladder usually unlocks 5-12% at the second tier and 10-15% at the third.

## Lead times
Stock programs ship in 3-5 days. Made-to-order dyeing adds 10-18 days depending on shade cards. Always confirm the mill's current loom allocation before committing a delivery date to your own buyers.

## Inspection windows
Book third-party inspection before dispatch on qualifying Zylod orders. The 48-hour post-delivery inspection window applies to escrow-protected orders.

## Working the relationship
Mills prioritize repeat buyers during capacity crunches. Consolidating your seasonal buys with two or three mills — rather than spreading across ten — gets you better tiers and faster restocks.`,
    daysAgo: 6,
  },
  {
    slug: 'bkash-nagad-b2b-payment-flows',
    title: 'bKash & Nagad for B2B: Payment Flows That Scale Past 5 Lakh Taka',
    excerpt: 'Mobile financial services now clear large wholesale invoices — how escrow, RTGS rails, and verified merchant wallets fit together.',
    category: 'Market news',
    coverImageUrl: '/images/banners/electronics-factory.png',
    contentEn: `Mobile financial services have quietly become settlement rails for mid-size wholesale in Bangladesh.

## Where MFS fits
For invoices under 5 lakh BDT, bKash and Nagad merchant settlements typically clear same-day — faster than BEFTN batches. Above that, splitting across rails or moving to RTGS keeps compliance clean.

## Escrow changes the risk math
Zylod SafePay holds funds until you confirm receipt within the inspection window. Suppliers ship faster against escrowed money; buyers stop pre-paying strangers.

## Verification still matters
Counterparty checks — trade license, bank-account matching — remain the cheapest fraud control. Verified suppliers on Zylod carry the badge on every storefront.`,
    daysAgo: 13,
  },
  {
    slug: 'container-consolidation-chattogram',
    title: 'Container Consolidation from Chattogram: Cutting Landed Cost 8-12%',
    excerpt: 'Sharing a 20ft container with complementary loads — the paperwork, the freight-forwarder negotiation, and the customs line items.',
    category: 'Logistics',
    coverImageUrl: '/images/banners/bulk-goods.png',
    contentEn: `Landed cost on small export lots is dominated by fixed container overhead. Consolidation attacks exactly that.

## Finding co-load partners
Category-compatible, schedule-compatible, and clean-documentation loads are the three filters. Zylod RFQ threads let you post a consolidation ask alongside your regular sourcing.

## The paperwork
One bill of lading per container, one harmonized line per co-load, and a written split of terminal handling. Agree the split BEFORE the box is stuffed.

## Realistic savings
8-12% on landed cost for loads between 4-9 CBM. Below 3 CBM, LCL rates usually win; above 12 CBM you are near a full container anyway.`,
    daysAgo: 27,
  },
]

async function main() {
  // Legal documents (upsert by docType)
  for (const d of LEGAL_DOCS) {
    await db.legalDocuments.upsert({
      where: { docType: d.docType },
      create: { ...d, version: '1.0' },
      update: { titleEn: d.titleEn, titleBn: d.titleBn, contentEn: d.contentEn },
    })
  }
  console.log(`[seed-content] legalDocuments: ${LEGAL_DOCS.length}`)

  // Help articles (upsert by slug)
  for (const a of HELP_ARTICLES) {
    await db.helpArticles.upsert({
      where: { slug: a.slug },
      create: { ...a, isPublished: true },
      update: { titleEn: a.titleEn, category: a.category, contentEn: a.contentEn },
    })
  }
  console.log(`[seed-content] helpArticles: ${HELP_ARTICLES.length}`)

  // Job listings (upsert by slug)
  for (const j of JOBS) {
    await db.jobListings.upsert({
      where: { slug: j.slug },
      create: { ...j, isActive: true },
      update: { title: j.title, department: j.department, location: j.location, descriptionEn: j.descriptionEn, requirementsEn: j.requirementsEn, salaryMin: j.salaryMin, salaryMax: j.salaryMax },
    })
  }
  console.log(`[seed-content] jobListings: ${JOBS.length}`)

  // Press releases (upsert by slug)
  for (const p of PRESS) {
    await db.pressReleases.upsert({
      where: { slug: p.slug },
      create: { ...p, isPublished: true, publishedAt: new Date() },
      update: { title: p.title, summary: p.summary, contentEn: p.contentEn, category: p.category },
    })
  }
  console.log(`[seed-content] pressReleases: ${PRESS.length}`)

  // Trade events (upsert by title — rebuild if schema just added)
  for (const e of EVENTS) {
    const existing = await db.tradeEvents.findFirst({ where: { title: e.title } })
    if (!existing) await db.tradeEvents.create({ data: e })
  }
  console.log(`[seed-content] tradeEvents: ${EVENTS.length}`)

  // t281 5-c: FAQs (findFirst by category+question — the model has no unique
  // key besides id, so upsert-by-slug does not apply; tradeEvents precedent)
  for (const f of FAQS) {
    const existing = await db.faqItems.findFirst({ where: { category: f.category, questionEn: f.questionEn } })
    if (!existing) await db.faqItems.create({ data: { ...f, isActive: true } })
  }
  console.log(`[seed-content] faqItems: ${FAQS.length}`)

  // t281 5-c: blog posts (upsert by unique slug)
  for (const b of BLOG_POSTS) {
    const { daysAgo, contentEn, ...post } = b
    await db.blogPosts.upsert({
      where: { slug: post.slug },
      create: { ...post, content: contentEn, isPublished: true, publishedAt: new Date(Date.now() - daysAgo * 86400e3) },
      update: { title: post.title, excerpt: post.excerpt, category: post.category, content: contentEn, coverImageUrl: post.coverImageUrl },
    })
  }
  console.log(`[seed-content] blogPosts: ${BLOG_POSTS.length}`)

  // t281 5-d: the current app version row (upsert by stable id)
  await db.appVersions.upsert({
    where: { id: APP_VERSION.id },
    create: APP_VERSION,
    update: { ...APP_VERSION, id: undefined },
  })
  console.log(`[seed-content] appVersions: ${APP_VERSION.versionNumber}/${APP_VERSION.versionCode}`)

  // t283: public deep-link routes (upsert by unique slug — the
  // deep-link-handler page and /api/app/deep-links read this table)
  for (const route of DEEP_LINK_ROUTES) {
    await db.deepLinkRoutes.upsert({
      where: { slug: route.slug },
      create: { ...route, isDynamic: true, isActive: true },
      update: { pathPattern: route.pathPattern, targetPage: route.targetPage, description: route.description, isActive: true },
    })
  }
  console.log(`[seed-content] deepLinkRoutes: ${DEEP_LINK_ROUTES.length}`)




  const counts = {
    legalDocuments: await db.legalDocuments.count(),
    helpArticles: await db.helpArticles.count(),
    jobListings: await db.jobListings.count(),
    pressReleases: await db.pressReleases.count(),
    tradeEvents: await db.tradeEvents.count(),
    faqItems: await db.faqItems.count(),
    blogPosts: await db.blogPosts.count(),
    appVersions: await db.appVersions.count(),
    deepLinkRoutes: await db.deepLinkRoutes.count(),
  }
  console.log('[seed-content] totals:', counts)
}

main()
  .catch((e) => { console.error('[seed-content] FAILED:', e); process.exit(1) })
  .finally(() => db.$disconnect())
