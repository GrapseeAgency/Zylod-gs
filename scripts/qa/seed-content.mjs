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

  const counts = {
    legalDocuments: await db.legalDocuments.count(),
    helpArticles: await db.helpArticles.count(),
    jobListings: await db.jobListings.count(),
    pressReleases: await db.pressReleases.count(),
    tradeEvents: await db.tradeEvents.count(),
  }
  console.log('[seed-content] totals:', counts)
}

main()
  .catch((e) => { console.error('[seed-content] FAILED:', e); process.exit(1) })
  .finally(() => db.$disconnect())
