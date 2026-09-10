import { db } from '../src/lib/db'

async function main() {
  console.log('Seeding FAQs and Help Articles from Bangladesh Wholesale Policies...')

  // 1. FAQs
  const faqs = [
    {
      category: 'orders',
      questionEn: 'How do I place a wholesale order on Zylod?',
      answerEn: 'Search or browse products, choose your quantity meeting or exceeding the Minimum Order Quantity (MOQ), check tier pricing discounts, add to cart, select delivery address, and pay securely via bKash, Nagad, bank transfer, or card. View our [How It Works Guide](/how-it-works) or [Browse Catalog](/product-list).',
      questionBn: 'জাইলোড-এ কীভাবে পাইকারি অর্ডার করবেন?',
      answerBn: 'পণ্য সার্চ বা ব্রাউজ করুন, নূন্যতম অর্ডার পরিমাণ (MOQ) বা তার বেশি সিলেক্ট করুন, টায়ার প্রাইসিং ডিসকাউন্ট দেখুন, কার্টে যোগ করুন, ডেলিভারি ঠিকানা নির্বাচন করুন এবং বিকাশ, নগদ, ব্যাংক ট্রান্সফার বা কার্ড দিয়ে নিরাপদে পেমেন্ট করুন। বিস্তারিত জানতে [কীভাবে কাজ করে](/how-it-works) দেখুন।',
      sortOrder: 1,
    },
    {
      category: 'orders',
      questionEn: 'What is Minimum Order Quantity (MOQ)?',
      answerEn: 'MOQ is the lowest number of units a manufacturer or wholesale supplier agrees to sell in a single order. Different price tiers unlock higher discounts at higher quantities. Read our [Bulk Pricing & MOQ Guide](/bulk-pricing-guide).',
      questionBn: 'মিনিমাম অর্ডার কোয়ান্টিটি (MOQ) কী?',
      answerBn: 'MOQ হলো সর্বনিম্ন পণ্যের সংখ্যা যা একজন প্রস্তুতকারক বা পাইকারি বিক্রেতা একটি অর্ডারে বিক্রি করতে রাজি হন। বেশি পরিমাণের অর্ডারে বেশি ছাড় পাওয়া যায়। বিস্তারিত জানতে [বাল্ক প্রাইসিং গাইড](/bulk-pricing-guide) পড়ুন।',
      sortOrder: 2,
    },
    {
      category: 'payments',
      questionEn: 'How does Zylod Escrow Payment Protection work?',
      answerEn: 'When you pay for an order, Zylod holds your funds in escrow. The payment is only released to the seller after you confirm receipt and inspect the goods within the 48-hour inspection window. Read our [SafePay Escrow Guide](/escrow-protection-guide).',
      questionBn: 'জাইলোড এস্ক্রো পেমেন্ট সুরক্ষা কীভাবে কাজ করে?',
      answerBn: 'অর্ডারের পেমেন্ট করার পর জাইলোড তা এস্ক্রো একাউন্টে সুরক্ষিত রাখে। পণ্য হাতে পেয়ে ৪৮ ঘণ্টার মধ্যে যাচাই করে নিশ্চিত করলেই কেবল বিক্রেতাকে টাকা পরিশোধ করা হয়। বিস্তারিত দেখুন [এস্ক্রো পলিসি](/escrow-protection-guide)।',
      sortOrder: 3,
    },
    {
      category: 'payments',
      questionEn: 'What payment methods are supported in Bangladesh?',
      answerEn: 'We support bKash, Nagad, Rocket, Upay, Visa/Mastercard debit/credit cards, and direct B2B Bank Transfers with RTGS/BEFTN/NPSB. Manage payment options in your [Wallet Dashboard](/wallet).',
      questionBn: 'বাংলাদেশে কোন কোন পেমেন্ট মাধ্যম গ্রহণ করা হয়?',
      answerBn: 'আমরা বিকাশ, নগদ, রকেট, উপায়, ভিসা/মাস্টারকার্ড এবং সরাসরি বি২বি ব্যাংক ট্রান্সফার (RTGS/BEFTN/NPSB) সমর্থন করি। আপনার [ওয়ালেট ড্যাশবোর্ড](/wallet) থেকে পেমেন্ট পরিচালনা করুন।',
      sortOrder: 4,
    },
    {
      category: 'shipping',
      questionEn: 'How are wholesale products delivered across Bangladesh?',
      answerEn: 'Products are shipped via partner courier networks (Steadfast, Pathao, RedX, eCourier, SA Paribahan, Sundarban Courier) or supplier self-logistics. Read the full [Logistics & Courier Delivery Policy](/logistics-delivery-policy).',
      questionBn: 'সারা দেশে কীভাবে পণ্য ডেলিভারি দেওয়া হয়?',
      answerBn: 'আমাদের অনুমোদিত কুরিয়ার পার্টনার (স্টিডফাস্ট, পাঠাও, রেডএক্স, এসএ পরিবহন, সুন্দরবন কুরিয়ার) বা সেলারের নিজস্ব পরিবহনে পণ্য পাঠানো হয়। বিস্তারিত জানতে [লজিস্টিকস নীতিমালা](/logistics-delivery-policy) দেখুন।',
      sortOrder: 5,
    },
    {
      category: 'shipping',
      questionEn: 'Can I track my consignment in real time?',
      answerEn: 'Yes! Navigate to [Track Order](/orders) to view the live GPS status, driver notes, and courier consignment ID updates.',
      questionBn: 'আমি কি রিয়েল টাইমে ডেলিভারি ট্র্যাক করতে পারব?',
      answerBn: 'হ্যাঁ! আপনার ড্যাশবোর্ডের [অর্ডার ট্র্যাকিং](/orders) সেকশনে গিয়ে রিয়েল-টাইম কুরিয়ার কনসাইনমেন্ট স্ট্যাটাস দেখতে পাবেন।',
      sortOrder: 6,
    },
    {
      category: 'returns',
      questionEn: 'What is the return policy for wholesale damaged goods?',
      answerEn: 'If goods arrive damaged, defective, or do not match specifications, raise a dispute within 48 hours of delivery with unboxing photo/video evidence. Learn more in our [Buyer Protection Policy](/buyer-protection-policy) or [Open Dispute Ticket](/submit-ticket).',
      questionBn: 'নষ্ট বা ভুল পণ্য পাওয়ার পর রিটার্ন পলিসি কী?',
      answerBn: 'ডেলিভারির ৪৮ ঘণ্টার মধ্যে আনবক্সিং ছবি বা ভিডিও প্রমাণসহ ডিসপুট ওপেন করলে সেলার রিপ্লেসমেন্ট দিতে বাধ্য থাকবে অথবা এস্ক্রো থেকে সম্পূর্ণ রিফান্ড দেওয়া হবে। দেখুন [ক্রেতা সুরক্ষা পলিসি](/buyer-protection-policy) অথবা [টিকেট ওপেন করুন](/submit-ticket)।',
      sortOrder: 7,
    },
    {
      category: 'sellers',
      questionEn: 'What documents are required to become a verified supplier?',
      answerEn: 'You need an updated Trade License (ট্রেড লাইসেন্স), National ID (NID), TIN Certificate, and a commercial bank account under your company name. Review our [Supplier Verification Guide](/seller-verification-guide) or [Upload Documents Now](/seller-verification).',
      questionBn: 'ভেরিফায়েড সেলার হতে কী কী কাগজপত্র প্রয়োজন?',
      answerBn: 'হালনাগাদ ট্রেড লাইসেন্স, জাতীয় পরিচয়পত্র (NID), ই-টিন (TIN) সার্টিফিকেট এবং প্রতিষ্ঠানের নামে খোলা একটি ভ্যালিড ব্যাংক একাউন্ট প্রয়োজন। দেখুন [সেলার ভেরিফিকেশন গাইড](/seller-verification-guide) অথবা [ডকুমেন্টস আপলোড করুন](/seller-verification)।',
      sortOrder: 8,
    },
    {
      category: 'sellers',
      questionEn: 'How do suppliers receive payouts for fulfilled orders?',
      answerEn: 'Once the buyer confirms receipt or the 48-hour inspection window passes without dispute, funds are disbursed automatically via BEFTN/NPSB to the verified bank account within 1-3 business days. Read our [Seller Handbook](/seller-guide).',
      questionBn: 'সেলাররা কীভাবে বিক্রির টাকা পাবেন?',
      answerBn: 'ক্রেতা ডেলিভারি নিশ্চিত করার পর অথবা ৪৮ ঘণ্টা সময় পার হওয়ার পর কোনো অভিযোগ না থাকলে ১-৩ কার্যদিবসের মধ্যে BEFTN/NPSB এর মাধ্যমে সেলারের ব্যাংক একাউন্টে টাকা চলে যাবে। দেখুন [সেলার সহায়িকা](/seller-guide)।',
      sortOrder: 9,
    },
    {
      category: 'account',
      questionEn: 'How do I protect my account with Two-Factor Authentication (2FA)?',
      answerEn: 'Go to [Account Settings](/profile-settings) to enable OTP verification via SMS or Authenticator App on every login and high-value transaction. For help, contact our [Live Chat Team](/live-chat).',
      questionBn: 'টু-ফ্যাক্টর অথেনটিকেশন (2FA) কীভাবে চালু করবেন?',
      answerBn: 'আপনার [অ্যাকাউন্ট সেটিংস](/profile-settings)-এ গিয়ে এসএমএস বা অথেনটিকেটর অ্যাপের মাধ্যমে অতিরিক্ত নিরাপত্তা চালু করতে পারেন। প্রয়োজনে [লাইভ চ্যাটে যোগাযোগ করুন](/live-chat)।',
      sortOrder: 10,
    }
  ]

  for (const f of faqs) {
    const existing = await db.faqItems.findFirst({ where: { questionEn: f.questionEn } })
    if (existing) {
      await db.faqItems.update({
        where: { id: existing.id },
        data: f,
      })
    } else {
      await db.faqItems.create({ data: f })
    }
  }

  // 2. Help & Policy Articles
  const articles = [
    {
      slug: 'how-it-works',
      category: 'Getting Started',
      titleEn: 'How Zylod Wholesale Marketplace Works',
      titleBn: 'জাইলোড পাইকারি মার্কেটপ্লেস কীভাবে কাজ করে',
      contentEn: `# How Zylod Wholesale Marketplace Works

Zylod brings Bangladesh's vast wholesale market online. Instead of physically travelling to Karwan Bazar, Islampur, or Chawkbazar, retailers and small business owners can source factory-direct stock right from their smartphone or computer.

---

## 1. Step-by-Step for Wholesale Buyers

| Step | Action | Description | Direct Link |
|---|---|---|---|
| **1. Browse & Compare** | Search Catalog | Search by product name, SKU, category, or upload photo. Compare tiered wholesale prices and MOQs. | [Explore Catalog](/product-list) |
| **2. Review Supplier** | Verification Check | Inspect factory badges, trade license status, and customer reviews. | [Verification Guide](/seller-verification-guide) |
| **3. Secure Checkout** | SafePay Escrow | Pay via bKash, Nagad, cards, or B2B Bank Transfer. Funds are safely held in escrow. | [Escrow Rules](/escrow-protection-guide) |
| **4. Fast Dispatch** | Track Consignment | Supplier packages goods and hands over to Steadfast, Pathao, RedX, or Sundarban Courier. | [Courier SLAs](/logistics-delivery-policy) |
| **5. 48-Hour Inspection** | Confirm & Release | Receive stock, verify quantity/specifications, and release payment to the seller. | [48h Return Policy](/buyer-protection-policy) |

---

## 2. Step-by-Step for Suppliers & Manufacturers

1. **Register with Business Documents**: Submit Trade License, NID, TIN, and Bank details via [Supplier Verification](/seller-verification).
2. **List Products with Price Tiers**: Set volume discounts (e.g. 10–49 units @ ৳2,850, 50–199 @ ৳2,650, 200+ @ ৳2,400) using our [Bulk Pricing Guide](/bulk-pricing-guide).
3. **Receive Wholesale Orders**: Instant notification when a buyer completes escrow payment.
4. **Fulfill & Deliver**: Hand over parcels with generated shipping labels.
5. **Receive Automated Payouts**: Funds deposited directly to your bank account upon order completion.

> [!TIP]
> Need direct help with your first wholesale order? Open an inquiry with our [AI Wholesale Assistant](/chatbot) or connect with [Live Chat Support](/live-chat).`,
      contentBn: `# জাইলোড পাইকারি মার্কেটপ্লেস কীভাবে কাজ করে

জাইলোড বাংলাদেশের সমগ্র পাইকারি বাজারকে ডিজিটাল প্ল্যাটফর্মে নিয়ে এসেছে। চকবাজার, ইসলামপুর বা কারওয়ান বাজারে সশরীরে না গিয়েই যেকোনো ব্যবসায়ী সরাসরি প্রস্তুতকারকদের কাছ থেকে পণ্য কিনতে পারেন।

---

## পাইকারি ক্রেতাদের জন্য ধাপসমূহ
১. **পণ্য ব্রাউজ ও সার্চ**: [পণ্য ক্যাটালগ](/product-list) থেকে খুঁজুন।
২. **সেলার যাচাই**: [ভেরিফিকেশন গাইড](/seller-verification-guide) অনুযায়ী ট্রেড লাইসেন্স ও ব্যাজ চেক করুন।
৩. **এস্ক্রো পেমেন্ট**: [এস্ক্রো গাইড](/escrow-protection-guide) অনুযায়ী নিরাপদ মাধ্যমে টাকা জমা রাখুন।
৪. **ট্র্যাকিং ও ডেলিভারি**: [কুরিয়ার নীতিমালা](/logistics-delivery-policy) অনুযায়ী পণ্য ট্র্যাক করুন।
৫. **৪৮ ঘণ্টার মধ্যে যাচাই**: [ক্রেতা সুরক্ষা পলিসি](/buyer-protection-policy) মেনে পণ্য যাচাই করে পেমেন্ট ছাড় দিন।`,
    },
    {
      slug: 'terms-and-conditions',
      category: 'Legal & Policies',
      titleEn: 'Terms and Conditions of Use',
      titleBn: 'ব্যবহারের সাধারণ শর্তাবলী (Terms & Conditions)',
      contentEn: `# Zylod Terms and Conditions of Use

**Last Updated: August 2026**

Welcome to Zylod Wholesale Marketplace ("Zylod", "we", "our"). By registering as a Buyer or Supplier, you agree to these legally binding Terms.

---

## 1. Nature of the Marketplace
* Zylod is a B2B intermediary platform facilitating trade between commercial buyers and licensed suppliers.
* We provide escrow protection, digital order management, disputes arbitration, and courier integrations.
* All commercial contracts are formed between the Buyer and Seller directly.

---

## 2. User Obligations & Eligibility
1. **Commercial Intent**: Users must be purchasing for resale, manufacturing, or commercial enterprise.
2. **Truthful Registration**: NID, Trade License, and business documentation must be genuine and up-to-date. See [Seller Verification Guide](/seller-verification-guide).
3. **Prohibited Conduct**: Off-platform transactions, counterfeit goods, fraudulent chargebacks, and harassment result in immediate account termination. Review our [Prohibited Items List](/prohibited-items) and [Community Guidelines](/community-guidelines).

---

## 3. Pricing, Payments & Escrow
* All listed prices are in Bangladeshi Taka (BDT) and clearly distinguish Unit Price, MOQ, and applicable VAT.
* Payments made through Zylod SafePay remain in non-interest-bearing escrow until buyer confirmation or inspection expiration. Read [SafePay Escrow Rules](/escrow-protection-guide).

> [!WARNING]
> Attempting to transact off-platform (such as direct bKash transfers outside Zylod) forfeits all escrow protections and buyer insurance. You can [Report Off-Platform Violations](/report-user).`,
      contentBn: `# জাইলোড ব্যবহারের সাধারণ শর্তাবলী

জাইলোড প্ল্যাটফর্মে অ্যাকাউন্ট খোলার মাধ্যমে আপনি আমাদের নীতিমালার সাথে একমত পোষণ করছেন।

---

## প্রধান শর্তসমূহ
১. **ব্যবসায়িক উদ্দেশ্য**: কেবল পাইকারি ও ব্যবসায়িক উদ্দেশ্যে ক্রয়-বিক্রয় গ্রহণযোগ্য।
২. **সঠিক তথ্য প্রদান**: ট্রেড লাইসেন্স, এনআইডি এবং ব্যাংক তথ্য শতভাগ সঠিক হতে হবে। দেখুন [ভেরিফিকেশন গাইড](/seller-verification-guide)।
৩. **নিরাপদ লেনদেন**: সকল লেনদেন জাইলোড এস্ক্রোর মাধ্যমে সম্পন্ন করতে হবে। দেখুন [এস্ক্রো পলিসি](/escrow-protection-guide)।
৪. **নিষিদ্ধ পণ্য**: কোনো প্রকার অবৈধ বা নকল পণ্য বিক্রয় করা যাবে না। দেখুন [নিষিদ্ধ পণ্যের তালিকা](/prohibited-items)।`,
    },
    {
      slug: 'privacy-policy',
      category: 'Legal & Policies',
      titleEn: 'Privacy and Data Protection Policy',
      titleBn: 'গোপনীয়তা ও ডেটা সুরক্ষা নীতি',
      contentEn: `# Zylod Privacy & Data Protection Policy

We protect your commercial and personal data under the laws of Bangladesh and international data protection standards.

---

## 1. Information We Collect
* **Identity Data**: Full Name, NID/Passport number, National ID photo copies.
* **Business Data**: Trade License number, TIN Certificate, Business Name, Warehouse Address.
* **Transaction Data**: Order history, payment proofs, invoice generation, bank account details (encrypted).
* **Technical Data**: IP address, device identifier, session authentication tokens.

---

## 2. How Data Is Used
* To verify wholesale merchant credibility and combat fraud.
* To coordinate courier delivery with our authorized logistics partners via [Logistics Network](/logistics-delivery-policy).
* To issue lawful Mushak-6.3 VAT tax invoices via [Tax Compliance Guidelines](/tax-compliance-guide).

---

## 3. Data Security & Encryption
All database traffic is encrypted with AES-256 and TLS 1.3. Bank numbers and sensitive credentials are encrypted with hashed salts.

> [!NOTE]
> You can download your transaction data or update your privacy preferences anytime in [Profile Settings](/profile-settings).`,
      contentBn: `# জাইলোড গোপনীয়তা ও ডেটা সুরক্ষা নীতি

আমরা আপনার ব্যবসায়িক ও ব্যক্তিগত তথ্যের সর্বোচ্চ সুরক্ষা নিশ্চিত করি।

---

## আমরা কী কী তথ্য সংগ্রহ করি
* জাতীয় পরিচয়পত্র এবং ট্রেড লাইসেন্স কপি
* যোগাযোগের ঠিকানা ও ফোন নম্বর
* লেনদেনের তথ্য ও ইনভয়েস রেকর্ড
* সুরক্ষার জন্য আপনার [প্রোফাইল সেটিংস](/profile-settings) দেখুন।`,
    },
    {
      slug: 'bulk-pricing-guide',
      category: 'Guides & Best Practices',
      titleEn: 'Wholesale Bulk Pricing & MOQ Guide',
      titleBn: 'বাল্ক প্রাইসিং এবং MOQ গাইড',
      contentEn: `# Wholesale Bulk Pricing & MOQ Architecture

Master volume discounting to maximize profit margins on Zylod.

---

## 1. Understanding Tiered Pricing Structure

Sellers configure tiered pricing where unit costs decrease as order volume increases:

\`\`\`
Tier 1: 10 – 49 units   -> ৳2,850 / unit  (Standard Wholesale)
Tier 2: 50 – 199 units  -> ৳2,650 / unit  (Volume Discount: 7% Save)
Tier 3: 200+ units      -> ৳2,400 / unit  (Distributor Rate: 15.8% Save)
\`\`\`

---

## 2. Request for Quotation (RFQ) for Mega Orders
If you require container loads, custom branding (OEM/ODM), or orders above listed tiers, submit an RFQ directly from the Product Detail page to negotiate customized lead times and delivery terms.

> [!TIP]
> Ready to explore discounted volume tiers? [Browse Wholesale Categories](/category-browser) or [Search Products](/search-home).`,
      contentBn: `# বাল্ক প্রাইসিং এবং MOQ গাইড

অর্ডারের পরিমাণের ওপর ভিত্তি করে পাইকারি মূল্য নির্ধারণের নিয়মাবলী। পণ্য খুঁজতে [ক্যাটাগরি ব্রাউজ করুন](/category-browser)।`,
    },
    {
      slug: 'seller-verification-guide',
      category: 'Seller Handbook',
      titleEn: 'Supplier Verification & KYC Requirements',
      titleBn: 'সেলার ভেরিফিকেশন ও কেওয়াইসি গাইড',
      contentEn: `# Supplier Verification & Trust Badges

Get verified to unlock unlimited product listings, high-volume buyer orders, and the official Verified Supplier Badge.

---

## 1. Required Documents
1. **Trade License (হালনাগাদ ট্রেড লাইসেন্স)**: Clear photo or PDF of valid municipal or union parishad trade license.
2. **National ID / Passport (NID)**: Front and back clear color scans of company owner or managing director.
3. **e-TIN Certificate**: 12-digit Taxpayer Identification Number document.
4. **Bank Account Cheque Leaf**: Bank account title must match Trade License / Enterprise Name.

---

## 2. Verification Process & Timelines
* **Step 1: Submission**: Upload documents in your [Seller Verification Panel](/seller-verification).
* **Step 2: Document Audit**: Compliance officer verifies credentials with municipal databases within 24–48 hours.
* **Step 3: Badge Activated**: Store receives the blue Verified Supplier Shield.

> [!IMPORTANT]
> Uploading forged, expired, or third-party trade licenses will result in permanent blacklist under Bangladesh Digital Commerce Guidelines 2021. Review [Prohibited Items](/prohibited-items).`,
      contentBn: `# সেলার ভেরিফিকেশন ও কেওয়াইসি গাইড

জাইলোডে ভেরিফায়েড সেলার হতে আপনার ট্রেড লাইসেন্স, এনআইডি এবং ব্যাংক একাউন্ট ভেরিফাই করুন। এখনই [ডকুমেন্টস আপলোড করুন](/seller-verification)।`,
    },
    {
      slug: 'buyer-protection-policy',
      category: 'Buyer Protection',
      titleEn: '48-Hour Inspection & Buyer Return Policy',
      titleBn: '৪৮ ঘণ্টার পণ্য যাচাই ও ক্রেতা সুরক্ষা পলিসি',
      contentEn: `# 48-Hour Inspection & Buyer Return Policy

Every wholesale transaction on Zylod is guarded by our statutory 48-Hour Inspection Guarantee.

---

## 1. How the 48-Hour Window Works
* The countdown begins the minute your courier marks the consignment as **Delivered**.
* During these 48 hours, the seller **cannot withdraw funds** from escrow.
* You have 48 hours to open cartons, check quantities against invoice, and inspect for defects.

---

## 2. Eligible Dispute Grounds
1. **Quantity Shortage**: Missing cartons or missing pieces.
2. **Defective / Broken Goods**: Manufacturing faults, crushed parcels, water damage.
3. **Specification Mismatch**: Color, material, grade, or brand differing from listing description.

---

## 3. How to Open a Dispute
If there is any issue, open a dispute ticket immediately with photos of packaging and invoice:
* Click [Open Dispute Ticket](/submit-ticket).
* Attach consignment slip and photo/video evidence.
* SafePay escrow funds remain frozen until dispute arbitration is resolved.

> [!IMPORTANT]
> If 48 hours pass without a dispute or confirmation, funds are automatically released to the supplier pursuant to [SafePay Escrow Rules](/escrow-protection-guide).`,
      contentBn: `# ৪৮ ঘণ্টার পণ্য যাচাই ও ক্রেতা সুরক্ষা পলিসি

পণ্য হাতে পাওয়ার পর ৪৮ ঘণ্টার মধ্যে যাচাই করে কোনো সমস্যা থাকলে [ডিসপুট টিকেট ওপেন করুন](/submit-ticket)। এস্ক্রো নীতিমালার বিস্তারিত জানতে [এস্ক্রো গাইড](/escrow-protection-guide) দেখুন।`,
    },
    {
      slug: 'dispute-resolution-guide',
      category: 'Buyer Protection',
      titleEn: 'Step-by-Step Dispute & Arbitration Guide',
      titleBn: 'বিরোধ নিষ্পত্তি ও আরবিট্রেশন গাইড',
      contentEn: `# Step-by-Step Dispute & Arbitration Guide

When trade disagreements occur, Zylod provides a fair, evidence-based mediation process.

---

## 1. Arbitration Stages

\`\`\`
[1. Ticket Filed] -> [2. Seller Response (24h)] -> [3. Mediation Council] -> [4. Refund / Replacement]
\`\`\`

1. **Buyer Files Ticket**: Submit photos, invoice, and description within 48 hours via [Submit Ticket](/submit-ticket).
2. **Seller Review (24 Hours)**: Seller is given 24 hours to offer voluntary replacement or partial discount refund.
3. **Zylod Mediation Hearing**: If unresolved, Zylod compliance officers review evidence under Bangladesh Commercial Law.
4. **Final Resolution**: Funds are returned to buyer's [Wallet](/wallet) or released to supplier.

> [!WARNING]
> If a seller refuses legitimate replacement or sends counterfeit merchandise, file an official complaint via [Report Seller](/report-user).`,
      contentBn: `# বিরোধ নিষ্পত্তি ও আরবিট্রেশন গাইড

যেকোনো সমস্যার জন্য [সাপোর্ট টিকেট](/submit-ticket) ওপেন করুন অথবা গুরুতর জালিয়াতির ক্ষেত্রে [সেলার রিপোর্ট করুন](/report-user)।`,
    },
    {
      slug: 'escrow-protection-guide',
      category: 'Buyer Protection',
      titleEn: 'SafePay Escrow Architecture & Security',
      titleBn: 'সেফপে এস্ক্রো সুরক্ষা ও নিরাপত্তা ব্যবস্থা',
      contentEn: `# SafePay Escrow Architecture & Security

How Zylod eliminates wholesale fraud and guarantees payment safety for both buyers and manufacturers.

---

## 1. Flow of Funds

\`\`\`
Buyer Pays (bKash/Bank) -> Held in Trust Escrow Account -> Goods Delivered & Verified -> Released to Seller
\`\`\`

1. **Buyer Transfers Funds**: Payment is locked in a regulated Bangladesh Bank-compliant escrow account.
2. **Supplier Dispatches**: Supplier manufactures and ships knowing payment is guaranteed.
3. **Inspection Completed**: Buyer verifies stock under [Buyer Protection Policy](/buyer-protection-policy).
4. **Payout Executed**: Payout disbursed to seller via BEFTN/NPSB.

> [!TIP]
> You can review your transaction records anytime in your [Wallet Dashboard](/wallet).`,
      contentBn: `# সেফপে এস্ক্রো সুরক্ষা ও নিরাপত্তা ব্যবস্থা

কীভাবে এস্ক্রো সিস্টেম ক্রেতা ও বিক্রেতা উভয়ের টাকা সুরক্ষিত রাখে। আপনার ওয়ালেট ব্যালেন্স দেখতে [ওয়ালেট ড্যাশবোর্ড](/wallet) দেখুন।`,
    },
    {
      slug: 'prohibited-items',
      category: 'Legal & Policies',
      titleEn: 'Prohibited & Restricted Items Matrix',
      titleBn: 'নিষিদ্ধ ও নিয়ন্ত্রিত পণ্যের তালিকা',
      contentEn: `# Prohibited & Restricted Items Matrix

Strictly prohibited goods under Bangladesh law and Zylod B2B policies.

---

## Strictly Prohibited Categories
1. **Narcotics & Illegal Substances**: Controlled drugs, synthetic chemicals.
2. **Weapons & Explosives**: Firearms, ammunition, stun guns, fireworks, explosive precursors.
3. **Counterfeit & Replica Goods**: Unauthorized trademark copies.
4. **Unapproved Pharmaceuticals**: Drugs without DGDA registration.
5. **Smuggled / Duty-Evading Consignments**: Goods without customs clearance.

> [!WARNING]
> Listing prohibited items results in immediate store suspension, escrow forfeiture, and law enforcement referral. [Report Prohibited Listings](/report-user).`,
      contentBn: `# নিষিদ্ধ ও নিয়ন্ত্রিত পণ্যের তালিকা

বাংলাদেশের প্রচলিত আইন অনুযায়ী নিষিদ্ধ পণ্যের তালিকা। কোনো অবৈধ লিস্টিং দেখলে [রিপোর্ট করুন](/report-user)।`,
    },
    {
      slug: 'cookie-policy',
      category: 'Legal & Policies',
      titleEn: 'Cookie & Tracking Technologies Policy',
      titleBn: 'কুকি এবং ট্র্যাকিং প্রযুক্তি নীতি',
      contentEn: `# Zylod Cookie Policy

This policy explains how Zylod uses cookies and storage technologies to enhance your wholesale procurement experience.

---

## 1. Essential Storage
* **Session Authentication**: Keeps you securely logged in.
* **Shopping Cart State**: Preserves multi-item wholesale orders.
* **Escrow Checkouts**: Validates CSRF tokens and SafePay transactions via [Escrow Guide](/escrow-protection-guide).

> [!NOTE]
> You can manage language and theme preferences in your [Profile Settings](/profile-settings).`,
      contentBn: `# জাইলোড কুকি নীতিমালা

আমরা কীভাবে কুকি ও ট্র্যাকিং প্রযুক্তির মাধ্যমে আপনার ব্রাউজিং অভিজ্ঞতা উন্নত করি। সেটিংস পরিবর্তন করতে [প্রোফাইল সেটিংস](/profile-settings) দেখুন।`,
    },
    {
      slug: 'seller-guide',
      category: 'Seller Handbook',
      titleEn: 'Comprehensive Seller & Manufacturer Handbook',
      titleBn: 'প্রস্তুতকারক ও পাইকারি বিক্রেতা সহায়িকা',
      contentEn: `# Zylod Seller & Manufacturer Handbook

A comprehensive guide for factory owners, importers, and master wholesalers looking to scale bulk trade across Bangladesh.

---

## 1. Setting Up High-Converting Listings
* **Real Photos**: Upload high-resolution photos of factory stock.
* **Tier Pricing**: Set volume discounts using our [Bulk Pricing Guide](/bulk-pricing-guide).
* **Accurate MOQs**: Set realistic minimum order quantities.

---

## 2. Dispatch & Fulfillment
* Acknowledge orders within 12 hours.
* Comply with [Logistics & Courier Delivery SLAs](/logistics-delivery-policy).
* Issue itemized invoices under [NBR VAT Tax Guide](/tax-compliance-guide).

> [!TIP]
> Ready to start selling? Complete your [Supplier Verification](/seller-verification) today.`,
      contentBn: `# প্রস্তুতকারক ও পাইকারি বিক্রেতা সহায়িকা

জাইলোড প্ল্যাটফর্মে কীভাবে আপনার পাইকারি ব্যবসা বৃদ্ধি করবেন। এখনই [ভেরিফিকেশন সম্পন্ন করুন](/seller-verification)।`,
    },
    {
      slug: 'logistics-delivery-policy',
      category: 'Guides & Best Practices',
      titleEn: 'Logistics, Courier SLAs & Freight Delivery Policy',
      titleBn: 'লজিস্টিকস ও পরিবহন নীতিমালা',
      contentEn: `# Logistics & Courier SLAs Policy

Detailed freight and parcel delivery standards for Bangladesh wholesale trade.

---

## 1. Integrated Courier Networks
Zylod is integrated with Steadfast Courier, Pathao B2B, RedX, eCourier, SA Paribahan, and Sundarban Courier.

## 2. Transit Timelines
* **Inside Dhaka Metro**: 24–48 hours.
* **Divisional Hubs (Chittagong, Sylhet, Rajshahi, Khulna, Barisal, Rangpur, Mymensingh)**: 48–72 hours.
* **Upazila / Rural Outlets**: 72–96 hours.

---

## 3. Freight & Heavy Cargo (500kg+)
For container loads and heavy industrial machinery, suppliers coordinate through station-to-station cargo transport.

> [!NOTE]
> Track existing shipments live via [Track Order](/orders) or report shipping delays via [Report Delivery Issue](/report-problem).`,
      contentBn: `# লজিস্টিকস ও পরিবহন নীতিমালা

সারাদেশে কুরিয়ার পার্টনারদের মাধ্যমে দ্রুত ও নিরাপদ পাইকারি ডেলিভারির নিয়ম। ডেলিভারি ট্র্যাক করতে [অর্ডার ড্যাশবোর্ড](/orders) দেখুন।`,
    },
    {
      slug: 'tax-compliance-guide',
      category: 'Legal & Policies',
      titleEn: 'NBR VAT (Mushak-6.3) & TDS Compliance Guide',
      titleBn: 'ভ্যাট (মূসক-৬.৩) ও উৎসে কর নির্দেশিকা',
      contentEn: `# NBR VAT & Commercial Tax Invoicing Guide

Operating in full compliance with National Board of Revenue (NBR) regulations in Bangladesh.

---

## 1. Mushak-6.3 Invoicing
All registered wholesale sellers provide itemized Mushak-6.3 tax invoices for VAT-applicable goods. Invoices can be downloaded from your [Order Detail](/orders) page.

## 2. Tax Deducted at Source (TDS)
Corporate entities with withholding tax status can upload Mushak-6.6 certificates for statutory tax deductions.

> [!TIP]
> Need assistance with tax invoices? Contact our [Support Team](/contact-us) or open a [Support Ticket](/submit-ticket).`,
      contentBn: `# ভ্যাট (মূসক-৬.৩) ও উৎসে কর নির্দেশিকা

জাতীয় রাজস্ব বোর্ডের (NBR) নিয়মানুযায়ী বাণিজ্যিক ইনভয়েসিং ও ট্যাক্স সংক্রান্ত গাইড। সহায়তার জন্য [যোগাযোগ করুন](/contact-us)।`,
    }
  ]

  for (const a of articles) {
    const existing = await db.helpArticles.findFirst({ where: { slug: a.slug } })
    if (existing) {
      await db.helpArticles.update({
        where: { id: existing.id },
        data: a,
      })
    } else {
      await db.helpArticles.create({ data: a })
    }
  }

  console.log('All FAQs and Help Articles seeded and cross-linked successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
