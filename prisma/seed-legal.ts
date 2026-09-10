import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Legal & Policy records...')

  // 1. Legal Documents
  const legalDocs = [
    {
      docType: 'terms_of_service',
      titleEn: 'Terms of Service & Merchant Agreement',
      titleBn: 'সেবার শর্তাবলী ও মার্চেন্ট চুক্তি',
      version: '2.4',
      contentEn: `## 1. General Agreement & Scope
Welcome to Zylod Wholesale Marketplace ("Zylod", "we", "our", or "us"). By accessing, browsing, registering for, or using our B2B wholesale platform, software applications, APIs, escrow settlement channels, and logistics fulfillment coordination services (collectively, the "Services"), you ("User", "Buyer", "Supplier", or "Merchant") unconditionally agree to be bound by these Terms of Service.

## 2. Eligibility & Account Verification
2.1. Zylod operates strictly as an accredited business-to-business (B2B) trade platform. All registering enterprises must provide legitimate documentation, including but not limited to: valid e-TIN (Tax Identification Number), Trade License issued by municipal authorities in Bangladesh, National Identity Card (NID) or passport of the authorized representative, and valid business premises utility documentation.
2.2. Individual non-business consumers are strictly prohibited from placing wholesale purchase orders or establishing supplier storefronts on the platform.

## 3. Wholesale Orders & Minimum Order Quantities (MOQ)
3.1. All product listings on Zylod specify a binding Minimum Order Quantity ("MOQ") established by verified factories and direct mills. Buyers cannot place orders below stated MOQ thresholds unless negotiated via formalized Request for Quotation ("RFQ") contracts.
3.2. Once a purchase order is submitted and acknowledged by the supplier, the pricing and quantities become a legally binding commercial contract under the Sale of Goods Act, 1930 (Bangladesh).

## 4. SafePay Escrow & Financial Settlements
4.1. To mitigate credit default and commercial fraud risk, all monetary transactions are routed through Zylod SafePay Escrow accounts approved by Bangladesh Bank guidelines.
4.2. Buyer funds remain securely in escrow until either: (a) Buyer inspects and confirms delivery within the 48-hour inspection window, or (b) Logistics tracking API confirms physical delivery without dispute notice within 72 hours.
4.3. Suppliers shall receive automated disbursements to their registered commercial bank account or BEFTN/NPSB gateway minus applicable platform commission within 48 banking hours of escrow release.

## 5. Dispute Resolution & Arbitration
5.1. In the event of non-conforming goods, severe transit damage, or unauthorized order cancellations, parties agree to submit to Zylod Mediation Center within 7 business days.
5.2. Unresolved disputes shall be referred to arbitration in Dhaka, Bangladesh in accordance with the Arbitration Act, 2001.`,
      contentBn: `## ১. সাধারণ চুক্তি ও পরিধি
জাইলড হোলসেল মার্কেটপ্লেসে আপনাকে স্বাগতম। আমাদের বি২বি প্ল্যাটফর্ম ব্যবহার করার মাধ্যমে আপনি আমাদের শর্তাবলীর সাথে সম্মত হচ্ছেন।`,
    },
    {
      docType: 'privacy_policy',
      titleEn: 'Privacy Policy & Commercial Data Protection',
      titleBn: 'গোপনীয়তা নীতি ও বাণিজ্যিক তথ্য সুরক্ষা',
      version: '3.1',
      contentEn: `## 1. Introduction & Regulatory Commitment
Zylod Wholesale takes corporate confidentiality and personal data security with utmost seriousness. We operate in strict compliance with the Digital Security Act, 2018 (Bangladesh), Information Technology guidelines, and internationally benchmarked GDPR and PDPA data governance frameworks.

## 2. Categories of Information Collected
2.1. Enterprise Identity Data: Trade licenses, VAT registration, incorporation certificates, owner NID numbers, bank routing details.
2.2. Transactional & Order Telemetry: Item SKUs, transaction amounts in BDT, delivery warehouse coordinates, invoice metadata.
2.3. Communications Data: Direct supplier-buyer live messaging logs, RFQ negotiation history, and customer service transcripts.

## 3. Data Processing Justification & Usage
Data is processed strictly for:
(a) Executing escrow disbursements and tax compliance reporting (NBR).
(b) Verifying merchant authentications and fraud mitigation.
(c) Providing logistics routing telemetry with verified carriers (Steadfast, Pathao, RedX).
(d) Delivering personalized bulk pricing discounts and tier-specific rebates.

## 4. User Rights & Data Portability
Under our data governance framework, you reserve the perpetual right to request a full machine-readable archive of your commercial transaction ledger or request permanent anonymization upon corporate account closure.`,
      contentBn: `## ১. ভূমিকা
জাইলড আপনার বাণিজ্যিক ও ব্যক্তিগত তথ্যের সর্বোচ্চ নিরাপত্তা প্রদানে প্রতিশ্রুতিবদ্ধ।`,
    },
    {
      docType: 'return_policy',
      titleEn: 'Wholesale Return, Replacement & Inspection Policy',
      titleBn: 'পাইকারি পণ্য ফেরত, প্রতিস্থাপন ও পরিদর্শন নীতিমালা',
      version: '2.0',
      contentEn: `## 1. 7-Day Inspection Window
Wholesale buyers have a mandatory 7-calendar-day inspection window from the timestamp of delivery handover to review bulk consignments for manufacturing defects, material discrepancies, or transit damages.

## 2. Eligible Grounds for Return
Returns, partial replacements, or credit refunds are authorized under the following conditions:
(a) Verified defect rate exceeding stated commercial tolerance (AQL 2.5 standard).
(b) Supply of wrong specifications, incorrect GSM/fabric blend, or color variation beyond sample approval.
(c) Short-shipped unit count compared to the sealed commercial packing invoice.
(d) Transit breakage directly attributable to substandard factory packing.

## 3. Return Procedure
1. Navigate to Order Detail > Initiate Return/Claim within 7 days.
2. Upload high-definition photographic proof, unboxing video logs, and laboratory test reports if relevant.
3. Supplier must respond within 48 hours to authorize return or counter-offer credit memo.
4. Goods are returned via Zylod Reverse Logistics network with verified tracking.`,
      contentBn: `## ১. ৭ দিনের পরিদর্শন সময়সীমা
পণ্য গ্রহণের পর থেকে ৭ দিনের মধ্যে ক্রেতা পণ্যের মান ও ত্রুটি যাচাই করতে পারবেন।`,
    },
    {
      docType: 'shipping_policy',
      titleEn: 'Wholesale Logistics, Freight & Shipping Policy',
      titleBn: 'পাইকারি পরিবহন, মালবাহী জাহাজ ও শিপিং নীতিমালা',
      version: '2.2',
      contentEn: `## 1. Nationwide Coverage & Hubs
Zylod coordinates freight distribution across all 64 districts in Bangladesh utilizing tier-1 integrated logistics networks including Steadfast Courier, Pathao Logistics, RedX, eCourier, and dedicated Full Truck Load (FTL) / Less Than Truckload (LTL) mill fleets.

## 2. Dispatch SLAs
(a) Ready-Stock Orders: Dispatched within 24 to 48 hours of order confirmation.
(b) Custom Production Runs: Dispatched according to agreed milestone schedule specified in RFQ contract.

## 3. Shipping Rates & Bulk Weight Tiers
- Standard Courier Parcels (0–10kg): Base ৳60–120 depending on district zone.
- Bulk LTL Consignments (50–500kg): Discounted freight slabs calculated per quintal.
- Dedicated Mill FTL (3 Ton / 5 Ton / 10 Ton covered trucks): Flat freight quoted dynamically during checkout.`,
      contentBn: `## ১. দেশব্যাপী শিপিং কভারেজ
জাইলড বাংলাদেশের ৬৪টি জেলায় দ্রুত ও নিরাপদ পাইকারি পণ্য সরবরাহের ব্যবস্থা করে।`,
    },
    {
      docType: 'payment_terms',
      titleEn: 'Payment Terms, Gateway SLAs & Escrow Protocols',
      titleBn: 'মূল্য পরিশোধের শর্তাবলী ও এসক্রো প্রটোকল',
      version: '2.5',
      contentEn: `## 1. Authorized Settlement Instruments
Zylod supports multiple real-time and scheduled payment channels:
- MFS Channels: bKash Merchant, Nagad Business, Rocket, Upay (Instant settlement).
- Commercial Banking: BEFTN, RTGS, NPSB real-time transfers with automated reconciliation.
- Cards: Visa, MasterCard, UnionPay, American Express.
- Zylod SafePay Escrow: Multi-signature escrow protocol protecting both buyer and supplier.

## 2. Trade Credit & Invoice Factoring
Accredited VIP Gold, Platinum, and Enterprise buyers may apply for Net-30 and Net-60 trade credit facilities subject to institutional underwriting and CIB credit bureau vetting.`,
      contentBn: `## ১. অনুমোদিত পেমেন্ট মাধ্যম
বিকাশ, নগদ, ব্যাংক ট্রান্সফার এবং নিরাপদ সেফপে এসক্রো সমর্থিত।`,
    },
    {
      docType: 'wholesale_terms',
      titleEn: 'Wholesale Commercial Trade Agreement',
      titleBn: 'পাইকারি বাণিজ্যিক বাণিজ্য চুক্তি',
      version: '1.9',
      contentEn: `## 1. Commercial Purpose Representation
By operating on Zylod, buyers warrant that all transactions are executed strictly for resale, institutional consumption, manufacturing raw material input, or commercial enterprise utilization.

## 2. Supplier Quality Guarantees
Verified suppliers warrant that all products comply with BSTI standards, industrial safety requirements, and stated textile/material specifications.`,
      contentBn: `## ১. বাণিজ্যিক উদ্দেশ্য
প্ল্যাটফর্মের সকল লেনদেন বাণিজ্যিক বা পুনর্বিক্রয়ের উদ্দেশ্যে সম্পাদিত হবে।`,
    },
    {
      docType: 'cookie_policy',
      titleEn: 'Cookie & Tracking Technologies Policy',
      titleBn: 'কুকি ও ট্র্যাকিং পলিসি',
      version: '1.5',
      contentEn: `## 1. Use of Cookies
Zylod uses strictly necessary cookies to maintain session persistence, secure authentication tokens, protect CSRF attack vectors, and persist shopping cart caches. Optional analytical and marketing cookies require affirmative opt-in consent.`,
      contentBn: `## ১. কুকির ব্যবহার
নিরাপদ লগইন ও সেশন রক্ষার জন্য প্রয়োজনীয় কুকি ব্যবহৃত হয়।`,
    },
    {
      docType: 'dmca_policy',
      titleEn: 'DMCA & Intellectual Property Rights Policy',
      titleBn: 'ডিএমসিএ ও মেধা সম্পত্তি সুরক্ষা নীতিমালা',
      version: '1.8',
      contentEn: `## 1. Commitment to IP Protection
Zylod strictly prohibits the listing, promotion, or distribution of counterfeit items, trademark-infringing apparel, unauthorized patent designs, or copyrighted media assets.

## 2. Takedown Notice Protocol
Copyright holders may submit formalized DMCA Takedown notices via /api/legal/dmca or through our online reporting portal. Notices must contain:
1. Proof of intellectual property ownership.
2. Direct URL links to the infringing product listing on Zylod.
3. Sworn declaration under penalty of perjury.
4. Contact details of the authorized representative.

Valid reports are processed and infringing listings removed within 72 business hours.`,
      contentBn: `## ১. মেধা সম্পত্তি সুরক্ষা
কপিরাইট লঙ্ঘনকারী কোনো পণ্য প্ল্যাটফর্মে অনুমোদন করা হয় না।`,
    },
  ]

  for (const doc of legalDocs) {
    await prisma.legalDocuments.upsert({
      where: { docType: doc.docType },
      update: doc,
      create: doc,
    })
  }

  // 2. Legal FAQs
  const legalFaqsData = [
    {
      docType: 'terms_of_service',
      questionEn: 'Who is eligible to purchase on Zylod Wholesale?',
      answerEn: 'Only registered businesses, retail shops, manufacturing units, and verified commercial entities with valid Trade License or NID are eligible to transact.',
      sortOrder: 1,
    },
    {
      docType: 'terms_of_service',
      questionEn: 'How does the SafePay Escrow system protect my money?',
      answerEn: 'Your payment is deposited in an independent Bangladesh Bank approved escrow account. Funds are only transferred to the supplier after you confirm product receipt or after the 48-hour delivery inspection window expires without disputes.',
      sortOrder: 2,
    },
    {
      docType: 'privacy_policy',
      questionEn: 'Do you sell my business or transaction data to third parties?',
      answerEn: 'No. Zylod never sells, rents, or monetizes merchant transaction records or customer databases to any external third-party advertisers.',
      sortOrder: 1,
    },
    {
      docType: 'privacy_policy',
      questionEn: 'How can I request complete deletion of my account data?',
      answerEn: 'You can submit a data deletion request via the Data Rights page or by contacting privacy@zylod.com. Deletion is completed within 30 days in compliance with statutory audit retention periods.',
      sortOrder: 2,
    },
    {
      docType: 'return_policy',
      questionEn: 'What is the return window for defective bulk orders?',
      answerEn: 'You have 7 calendar days from the date of physical delivery to inspect the batch and initiate a return/replacement request.',
      sortOrder: 1,
    },
    {
      docType: 'shipping_policy',
      questionEn: 'What are the delivery timelines across Bangladesh?',
      answerEn: 'Dhaka metro deliveries take 24–48 hours; other district headquarters take 2–4 business days; remote upazilas take 4–7 business days.',
      sortOrder: 1,
    },
    {
      docType: 'payment_terms',
      questionEn: 'Can I pay using corporate bank wire (BEFTN/RTGS)?',
      answerEn: 'Yes. BEFTN and RTGS bank transfers are supported with zero transaction fee and automated reconciliation upon funds receipt.',
      sortOrder: 1,
    },
    {
      docType: 'wholesale_terms',
      questionEn: 'Can I negotiate custom MOQ or bulk tiered pricing with factories?',
      answerEn: 'Yes! Use the RFQ (Request for Quotation) feature to directly negotiate volume price tiers, custom labeling, and payment schedules.',
      sortOrder: 1,
    },
    {
      docType: 'cookie_policy',
      questionEn: 'Can I disable non-essential cookies?',
      answerEn: 'Yes. You can manage your analytical and marketing cookie preferences at any time through our interactive Cookie Preference Center.',
      sortOrder: 1,
    },
    {
      docType: 'dmca_policy',
      questionEn: 'How quickly does Zylod respond to trademark or copyright takedown claims?',
      answerEn: 'Our Legal & Compliance team reviews and acts upon verified DMCA takedown requests within 72 business hours.',
      sortOrder: 1,
    },
  ]

  await prisma.faqItems.deleteMany({})
  for (const faq of legalFaqsData) {
    await prisma.faqItems.create({ data: { ...faq, category: faq.docType } as any })
  }

  // 3. Job Listings
  const jobListingsData = [
    {
      title: 'Senior Backend Engineer (Distributed Systems)',
      slug: 'senior-backend-engineer-distributed-systems',
      department: 'Engineering',
      locationType: 'hybrid',
      location: 'Banani, Dhaka (Hybrid 3d/2d)',
      employmentType: 'full_time',
      salaryMin: 180000,
      salaryMax: 280000,
      currency: 'BDT',
      isFeatured: true,
      descriptionEn: `We are seeking an experienced Senior Backend Engineer to architect our high-throughput B2B wholesale order execution engine, automated escrow settlement pipelines, and real-time inventory ledger.`,
      requirementsEn: `- 5+ years building distributed backend architectures in Node.js/TypeScript or Go.
- Deep expertise with PostgreSQL, high-concurrency database locking, and Prisma ORM.
- Experience with Redis caching clusters and asynchronous message brokers (RabbitMQ/Kafka).
- Proven track record handling high-value financial transactions or e-commerce scaling.`,
      benefitsEn: `- Competitive compensation (BDT 180k - 280k) + Equity options
- Comprehensive family health & hospitalization insurance
- Yearly performance bonus & festival bonuses (2x yearly)
- Daily catered gourmet lunch and premium coffee`,
    },
    {
      title: 'Lead Product Designer (B2B SaaS / Supply Chain)',
      slug: 'lead-product-designer-b2b-supply-chain',
      department: 'Design',
      locationType: 'onsite',
      location: 'Banani, Dhaka',
      employmentType: 'full_time',
      salaryMin: 150000,
      salaryMax: 240000,
      currency: 'BDT',
      isFeatured: true,
      descriptionEn: `Join Zylod as Lead Product Designer to revolutionize how hundreds of thousands of wholesale buyers and factory suppliers interact, negotiate bulk RFQs, and monitor live factory production.`,
      requirementsEn: `- 4+ years of UX/UI product design experience in complex SaaS or fintech products.
- Mastery of Figma, design systems, and rapid prototyping.
- Strong user research background with ability to conduct field interviews with factory owners.`,
      benefitsEn: `- Top-of-market salary + stock options
- Annual equipment stipend (latest MacBook Pro + 4K display)
- Wellness & gym allowance`,
    },
    {
      title: 'Enterprise Supply Chain Operations Manager',
      slug: 'enterprise-supply-chain-operations-manager',
      department: 'Operations',
      locationType: 'onsite',
      location: 'Tejgaon / Gazipur Hubs, Dhaka',
      employmentType: 'full_time',
      salaryMin: 120000,
      salaryMax: 190000,
      currency: 'BDT',
      isFeatured: false,
      descriptionEn: `Oversee end-to-end factory pickup logistics, cross-docking hub management, and courier SLA enforcement across 64 districts in Bangladesh.`,
      requirementsEn: `- 4+ years in commercial supply chain management, freight forwarding, or 3PL operations.
- Strong network with garment/textile mills and courier companies in Bangladesh.`,
      benefitsEn: `- Attractive salary & performance incentives
- Company transport / fuel allowance
- Two festival bonuses + medical coverage`,
    },
    {
      title: 'Supplier Acquisition & RMG Onboarding Specialist',
      slug: 'supplier-acquisition-rmg-onboarding-specialist',
      department: 'Sales',
      locationType: 'hybrid',
      location: 'Dhaka / Narayanganj / Gazipur',
      employmentType: 'full_time',
      salaryMin: 80000,
      salaryMax: 140000,
      currency: 'BDT',
      isFeatured: false,
      descriptionEn: `Drive onboarding of verified RMG factories, knitwear mills, leather manufacturers, and plastic suppliers onto Zylod Marketplace.`,
      requirementsEn: `- 2+ years direct experience in RMG buying house sales, factory merchandising, or B2B sales.
- Exceptional negotiation and relationship-building skills in Bengali and English.`,
      benefitsEn: `- Base salary + uncapped performance commissions on supplier volume
- Mobile bill and travel allowances`,
    },
    {
      title: 'Legal Counsel & Corporate Compliance Associate',
      slug: 'legal-counsel-corporate-compliance-associate',
      department: 'Legal',
      locationType: 'hybrid',
      location: 'Banani, Dhaka',
      employmentType: 'full_time',
      salaryMin: 100000,
      salaryMax: 160000,
      currency: 'BDT',
      isFeatured: false,
      descriptionEn: `Draft, review, and negotiate enterprise supply contracts, oversee merchant compliance, manage IP/DMCA takedowns, and ensure regulatory alignment with Bangladesh Bank & BTRC.`,
      requirementsEn: `- LL.B (Honours) / LL.M with Advocate enrollment in Bangladesh Bar Council.
- 2–4 years corporate legal experience in fintech, e-commerce, or corporate law firms.`,
      benefitsEn: `- Professional legal development allowance
- Full medical benefits and executive insurance`,
    },
  ]

  for (const job of jobListingsData) {
    await prisma.jobListings.upsert({
      where: { slug: job.slug },
      update: job,
      create: job,
    })
  }

  // 4. Press Releases
  const pressReleasesData = [
    {
      slug: 'zylod-secures-series-a-to-digitize-bangladesh-wholesale',
      title: 'Zylod Secures $8.5M Series A Funding to Digitize Bangladesh’s $40B Wholesale Trade',
      summary: 'Funding led by regional venture capital partners to expand direct mill sourcing, launch SafePay escrow, and scale nationwide fulfillment logistics.',
      category: 'funding',
      imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
      authorName: 'Zylod Corporate Communications',
      contentEn: `DHAKA, BANGLADESH — Zylod Wholesale, Bangladesh's premier B2B digital marketplace connecting verified manufacturers directly with wholesale retail buyers, today announced the successful closing of an $8.5 million Series A financing round.

The round was led by prominent South Asian venture capital firms with participation from global supply chain technology funds. The capital infusion will accelerate Zylod’s proprietary SafePay Escrow expansion, automate factory warehouse logistics, and onboarding over 10,000 new direct textile and manufacturing mills over the next 18 months.

"Bangladesh’s wholesale ecosystem has long suffered from opaque multi-tier middlemen margins and high credit default risks," stated the CEO of Zylod. "With our technology-driven escrow, instant bulk logistics, and verified factory direct pricing, we are enabling micro and medium retail shopkeepers to achieve the highest profit margins in their operating history."`,
    },
    {
      slug: 'zylod-partners-with-steadfast-for-nationwide-express-bulk-freight',
      title: 'Zylod Partners with Steadfast Courier to Guarantee 48-Hour Nationwide Bulk Freight',
      summary: 'Strategic logistics alliance provides deep API integration, discounted freight slabs, and automated parcel tracking across all 64 districts.',
      category: 'partnership',
      imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
      authorName: 'Logistics Operations Desk',
      contentEn: `DHAKA — Zylod has officially formalized a comprehensive strategic logistics partnership with Steadfast Courier, Bangladesh's leading express delivery network.

Under the partnership, all wholesale orders placed on Zylod benefit from automated consignment generation, real-time doorstep tracking telemetry, and discounted per-quintal freight slabs. This integration reduces transit times from factory floor to rural retailers by over 40%.`,
    },
    {
      slug: 'zylod-launches-direct-factory-live-shopping-broadcasting',
      title: 'Zylod Unveils South Asia’s First B2B Live Factory Stream Shopping Technology',
      summary: 'Wholesale buyers can now virtually tour RMG factories, inspect fabric quality via high-definition live video, and claim real-time bulk flash discount vouchers.',
      category: 'product_launch',
      imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
      authorName: 'Product Innovation Team',
      contentEn: `DHAKA — In a groundbreaking industry first, Zylod has introduced interactive Live Factory Shopping for wholesale commercial buyers. Factory owners in Gazipur, Narayanganj, and Chattogram can now host live broadcasting sessions directly from their production floors, allowing thousands of retail shopkeepers to inspect raw materials, negotiate live MOQs, and place high-volume bulk orders in real time.`,
    },
    {
      slug: 'zylod-crosses-100k-registered-retail-buyers-milestone',
      title: 'Zylod Crosses 100,000 Verified Retail Buyers Milestone Across Bangladesh',
      summary: 'Marketplace achieves 320% year-on-year GMV growth while processing over ৳150 Crore in monthly wholesale trade volume.',
      category: 'milestone',
      imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
      authorName: 'Zylod Analytics Team',
      contentEn: `DHAKA — Zylod has officially surpassed 100,000 verified active retail buyers operating across every division of Bangladesh. The milestone reflects surging adoption of digital B2B sourcing among traditional retail merchants and apparel boutique owners seeking direct manufacturer relationships.`,
    },
  ]

  for (const pr of pressReleasesData) {
    await prisma.pressReleases.upsert({
      where: { slug: pr.slug },
      update: pr,
      create: pr,
    })
  }

  // 5. Media Kit Assets
  const mediaAssets = [
    {
      assetType: 'logo',
      title: 'Zylod Primary Brand Logo (Vector SVG & PNG)',
      description: 'Official high-resolution vector logos for digital and print media on light and dark backgrounds.',
      fileUrl: '/assets/brand/zylod-logo-primary.svg',
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
      fileSizeMB: 2.4,
      fileFormat: 'SVG / PNG',
    },
    {
      assetType: 'brand_guideline',
      title: 'Zylod Brand Identity & Typography Guidelines (PDF)',
      description: 'Comprehensive brand standards manual including color palettes, typography rules, and logo usage guidelines.',
      fileUrl: '/assets/brand/zylod-brand-guidelines-2026.pdf',
      thumbnailUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=400&q=80',
      fileSizeMB: 8.7,
      fileFormat: 'PDF',
    },
    {
      assetType: 'executive_photo',
      title: 'Leadership & Executive Team Portraits',
      description: 'High-resolution professional portraits of Zylod founders and executive leadership for press usage.',
      fileUrl: '/assets/brand/zylod-executive-portraits.zip',
      thumbnailUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      fileSizeMB: 24.5,
      fileFormat: 'ZIP / JPG',
    },
    {
      assetType: 'product_screenshot',
      title: 'Zylod Platform UI Screenshots & Media Pack',
      description: 'High-definition screenshots of Zylod mobile app, web dashboard, and SafePay checkout.',
      fileUrl: '/assets/brand/zylod-ui-screenshots.zip',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80',
      fileSizeMB: 18.2,
      fileFormat: 'ZIP / PNG',
    },
  ]

  await prisma.mediaKitAssets.deleteMany({})
  for (const asset of mediaAssets) {
    await prisma.mediaKitAssets.create({ data: asset })
  }

  // 6. Investor Documents
  const investorDocs = [
    {
      docType: 'annual_report',
      title: 'Zylod Annual Report & Audited Financials FY 2025-26',
      fiscalYear: '2025-26',
      fiscalQ: 'Annual',
      fileUrl: '/investor/reports/zylod-annual-report-fy2025-26.pdf',
      summary: 'Comprehensive annual financial review, audited balance sheet, cash flow statements, and GMV growth performance metrics.',
    },
    {
      docType: 'quarterly_report',
      title: 'Q3 FY26 Quarterly Financial & Trade Volume Report',
      fiscalYear: '2025-26',
      fiscalQ: 'Q3',
      fileUrl: '/investor/reports/zylod-q3-fy26-report.pdf',
      summary: 'Quarterly operational overview showing 42% QoQ growth in wholesale merchant volume and ৳480M escrow throughput.',
    },
    {
      docType: 'investor_presentation',
      title: 'Investor Pitch & Market Opportunity Presentation (Series A)',
      fiscalYear: '2026',
      fiscalQ: 'H1',
      fileUrl: '/investor/presentations/zylod-investor-deck-2026.pdf',
      summary: 'Strategic presentation outlining South Asia B2B marketplace TAM, unit economics, cohort retention, and 2028 roadmap.',
    },
    {
      docType: 'financial_filing',
      title: 'Statutory RJSC Regulatory Filings & Corporate Disclosures',
      fiscalYear: '2025',
      fiscalQ: 'Annual',
      fileUrl: '/investor/filings/zylod-rjsc-statutory-filings-2025.pdf',
      summary: 'Official Registrar of Joint Stock Companies and Firms (RJSC) statutory filings and certified board resolutions.',
    },
  ]

  await prisma.investorDocuments.deleteMany({})
  for (const inv of investorDocs) {
    await prisma.investorDocuments.create({ data: inv })
  }

  // 7. Company Milestones
  const milestonesData = [
    {
      year: 2020,
      month: 3,
      title: 'Zylod Founded in Dhaka',
      description: 'Launched with a team of 4 engineers to solve garment wholesale inefficiencies in Narayanganj and Dhaka.',
      iconType: 'rocket',
      sortOrder: 1,
    },
    {
      year: 2022,
      month: 6,
      title: '1,000 Verified Direct Mills Onboarded',
      description: 'Surpassed 1,000 accredited textile, knitwear, and accessories manufacturing mills across Gazipur and Chattogram.',
      iconType: 'award',
      sortOrder: 2,
    },
    {
      year: 2024,
      month: 9,
      title: 'SafePay Escrow System Launched',
      description: 'Introduced automated escrow payment protection, processing over ৳50 Crore in monthly protected GMV.',
      iconType: 'shield',
      sortOrder: 3,
    },
    {
      year: 2025,
      month: 11,
      title: '100,000 Active Retail Buyers Milestone',
      description: 'Reached coverage in all 64 districts of Bangladesh with automated express bulk courier dispatch.',
      iconType: 'users',
      sortOrder: 4,
    },
    {
      year: 2026,
      month: 5,
      title: '$8.5M Series A Funding & Live Shopping Launch',
      description: 'Closed Series A financing to roll out real-time factory video broadcasting and AI-driven supplier matchmaking.',
      iconType: 'star',
      sortOrder: 5,
    },
  ]

  await prisma.companyMilestones.deleteMany({})
  for (const m of milestonesData) {
    await prisma.companyMilestones.create({ data: m })
  }

  console.log('Seeded all Legal, Careers, Press, Investor, and About records successfully!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
