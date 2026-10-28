/* ════════════════════════════════════════════════════════════════════════
   FAQ fallback dataset (t228).

   Why this exists: the FAQ page (src/components/pages/faq-page.tsx) fetches
   GET /api/support/faqs, which reads the `faqItems` table. On databases
   where `prisma/seed-support-docs.ts` has not been applied the table is
   empty, so every tab rendered "No matching questions found". The page now
   falls back to this curated dataset when the API fails or returns no rows;
   seeded API rows always take precedence.

   SOURCE REQUIREMENT — every Q&A pair below is genuine in-repo material,
   not invented copy:
   • items f1–f10 are the FAQ entries from prisma/seed-support-docs.ts,
     which were themselves curated from the site's policy pages
     (escrow-protection-guide, bulk-pricing-guide,
     logistics-delivery-policy, buyer-protection-policy,
     seller-verification-guide, seller-guide, profile-settings, wallet).
   • item f11 is derived from the Return Policy page's own steps and
     non-returnable list (src/components/pages/return-policy-page.tsx).
   • item f12 is derived from the COD verification gate copy
     (src/components/pages/account-verification-card.tsx and the checkout
     COD gate: "Cash on Delivery requires a verified account").

   No company claims, no metrics, no lorem. Static rows carry
   isStatic: true and helpful counters of 0 — they are never POSTed to
   /api/support/faqs/[id]/vote and the vote UI is hidden for them, so no
   fabricated engagement numbers are shown.
   ════════════════════════════════════════════════════════════════════════ */

export interface FaqContentItem {
  id: string
  category: string
  questionEn: string
  answerEn: string
  questionBn?: string
  answerBn?: string
  helpfulYes: number
  helpfulNo: number
  sortOrder: number
  /** true = rendered from this in-repo dataset, not a DB-backed API row */
  isStatic?: boolean
}

export const FALLBACK_FAQ_ITEMS: FaqContentItem[] = [
  {
    id: 'faq-static-orders-1',
    category: 'orders',
    questionEn: 'How do I place a wholesale order on Zylod?',
    answerEn: 'Search or browse products, choose your quantity meeting or exceeding the Minimum Order Quantity (MOQ), check tier pricing discounts, add to cart, select delivery address, and pay securely via bKash, Nagad, bank transfer, or card. View our [How It Works Guide](/how-it-works) or [Browse Catalog](/product-list).',
    questionBn: 'জাইলোড-এ কীভাবে পাইকারি অর্ডার করবেন?',
    answerBn: 'পণ্য সার্চ বা ব্রাউজ করুন, নূন্যতম অর্ডার পরিমাণ (MOQ) বা তার বেশি সিলেক্ট করুন, টায়ার প্রাইসিং ডিসকাউন্ট দেখুন, কার্টে যোগ করুন, ডেলিভারি ঠিকানা নির্বাচন করুন এবং বিকাশ, নগদ, ব্যাংক ট্রান্সফার বা কার্ড দিয়ে নিরাপদে পেমেন্ট করুন। বিস্তারিত জানতে [কীভাবে কাজ করে](/how-it-works) দেখুন।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 1,
    isStatic: true,
  },
  {
    id: 'faq-static-orders-2',
    category: 'orders',
    questionEn: 'What is Minimum Order Quantity (MOQ)?',
    answerEn: 'MOQ is the lowest number of units a manufacturer or wholesale supplier agrees to sell in a single order. Different price tiers unlock higher discounts at higher quantities. Read our [Bulk Pricing & MOQ Guide](/bulk-pricing-guide).',
    questionBn: 'মিনিমাম অর্ডার কোয়ান্টিটি (MOQ) কী?',
    answerBn: 'MOQ হলো সর্বনিম্ন পণ্যের সংখ্যা যা একজন প্রস্তুতকারক বা পাইকারি বিক্রেতা একটি অর্ডারে বিক্রি করতে রাজি হন। বেশি পরিমাণের অর্ডারে বেশি ছাড় পাওয়া যায়। বিস্তারিত জানতে [বাল্ক প্রাইসিং গাইড](/bulk-pricing-guide) পড়ুন।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 2,
    isStatic: true,
  },
  {
    id: 'faq-static-payments-1',
    category: 'payments',
    questionEn: 'How does Zylod Escrow Payment Protection work?',
    answerEn: 'When you pay for an order, Zylod holds your funds in escrow. The payment is only released to the seller after you confirm receipt and inspect the goods within the 48-hour inspection window. Read our [SafePay Escrow Guide](/escrow-protection-guide).',
    questionBn: 'জাইলোড এস্ক্রো পেমেন্ট সুরক্ষা কীভাবে কাজ করে?',
    answerBn: 'অর্ডারের পেমেন্ট করার পর জাইলোড তা এস্ক্রো একাউন্টে সুরক্ষিত রাখে। পণ্য হাতে পেয়ে ৪৮ ঘণ্টার মধ্যে যাচাই করে নিশ্চিত করলেই কেবল বিক্রেতাকে টাকা পরিশোধ করা হয়। বিস্তারিত দেখুন [এস্ক্রো পলিসি](/escrow-protection-guide)।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 3,
    isStatic: true,
  },
  {
    id: 'faq-static-payments-2',
    category: 'payments',
    questionEn: 'What payment methods are supported in Bangladesh?',
    answerEn: 'We support bKash, Nagad, Rocket, Upay, Visa/Mastercard debit/credit cards, and direct B2B Bank Transfers with RTGS/BEFTN/NPSB. Manage payment options in your [Wallet Dashboard](/wallet).',
    questionBn: 'বাংলাদেশে কোন কোন পেমেন্ট মাধ্যম গ্রহণ করা হয়?',
    answerBn: 'আমরা বিকাশ, নগদ, রকেট, উপায়, ভিসা/মাস্টারকার্ড এবং সরাসরি বি২বি ব্যাংক ট্রান্সফার (RTGS/BEFTN/NPSB) সমর্থন করি। আপনার [ওয়ালেট ড্যাশবোর্ড](/wallet) থেকে পেমেন্ট পরিচালনা করুন।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 4,
    isStatic: true,
  },
  {
    id: 'faq-static-shipping-1',
    category: 'shipping',
    questionEn: 'How are wholesale products delivered across Bangladesh?',
    answerEn: 'Products are shipped via partner courier networks (Steadfast, Pathao, RedX, eCourier, SA Paribahan, Sundarban Courier) or supplier self-logistics. Read the full [Logistics & Courier Delivery Policy](/logistics-delivery-policy).',
    questionBn: 'সারা দেশে কীভাবে পণ্য ডেলিভারি দেওয়া হয়?',
    answerBn: 'আমাদের অনুমোদিত কুরিয়ার পার্টনার (স্টিডফাস্ট, পাঠাও, রেডএক্স, এসএ পরিবহন, সুন্দরবন কুরিয়ার) বা সেলারের নিজস্ব পরিবহনে পণ্য পাঠানো হয়। বিস্তারিত জানতে [লজিস্টিকস নীতিমালা](/logistics-delivery-policy) দেখুন।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 5,
    isStatic: true,
  },
  {
    id: 'faq-static-shipping-2',
    category: 'shipping',
    questionEn: 'Can I track my consignment in real time?',
    answerEn: 'Yes! Navigate to [Track Order](/orders) to view the live GPS status, driver notes, and courier consignment ID updates.',
    questionBn: 'আমি কি রিয়েল টাইমে ডেলিভারি ট্র্যাক করতে পারব?',
    answerBn: 'হ্যাঁ! আপনার ড্যাশবোর্ডের [অর্ডার ট্র্যাকিং](/orders) সেকশনে গিয়ে রিয়েল-টাইম কুরিয়ার কনসাইনমেন্ট স্ট্যাটাস দেখতে পাবেন।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 6,
    isStatic: true,
  },
  {
    id: 'faq-static-returns-1',
    category: 'returns',
    questionEn: 'What is the return policy for wholesale damaged goods?',
    answerEn: 'If goods arrive damaged, defective, or do not match specifications, raise a dispute within 48 hours of delivery with unboxing photo/video evidence. Learn more in our [Buyer Protection Policy](/buyer-protection-policy) or [Open Dispute Ticket](/submit-ticket).',
    questionBn: 'নষ্ট বা ভুল পণ্য পাওয়ার পর রিটার্ন পলিসি কী?',
    answerBn: 'ডেলিভারির ৪৮ ঘণ্টার মধ্যে আনবক্সিং ছবি বা ভিডিও প্রমাণসহ ডিসপুট ওপেন করলে সেলার রিপ্লেসমেন্ট দিতে বাধ্য থাকবে অথবা এস্ক্রো থেকে সম্পূর্ণ রিফান্ড দেওয়া হবে। দেখুন [ক্রেতা সুরক্ষা পলিসি](/buyer-protection-policy) অথবা [টিকেট ওপেন করুন](/submit-ticket)।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 7,
    isStatic: true,
  },
  {
    id: 'faq-static-returns-2',
    category: 'returns',
    // Derived from the Return Policy page's own steps + non-returnable list
    // (src/components/pages/return-policy-page.tsx).
    questionEn: 'What items cannot be returned or exchanged?',
    answerEn: 'Custom-manufactured or bespoke orders, perishable goods (food, chemicals), intimate or hygiene products, items damaged by the buyer after delivery, items without original packaging after 7 days, and digital or software products are not returnable. Eligible returns go through supplier review and the refund is credited to your wallet or bank within 5–7 business days — see the [Return Policy](/return-policy).',
    questionBn: 'কোন কোন পণ্য রিটার্ন বা এক্সচেঞ্জ করা যায় না?',
    answerBn: 'কাস্টম-নির্মিত বা বেসপোক অর্ডার, নষ্টশীল পণ্য (খাদ্য, রাসায়নিক), ব্যবহার-সংবেদনশীল পণ্য, ডেলিভারির পর ক্রেতার কারণে ক্ষতিগ্রস্ত পণ্য, ৭ দিন পরে মূল প্যাকেজিং ছাড়া পণ্য এবং ডিজিটাল বা সফটওয়্যার পণ্য রিটার্নযোগ্য নয়। যোগ্য রিটার্ন সাপ্লায়ার রিভিউয়ের পর ৫–৭ কার্যদিবসে ওয়ালেট বা ব্যাংকে রিফান্ড পৌঁছে যায় — দেখুন [রিটার্ন পলিসি](/return-policy)।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 8,
    isStatic: true,
  },
  {
    id: 'faq-static-sellers-1',
    category: 'sellers',
    questionEn: 'What documents are required to become a verified supplier?',
    answerEn: 'You need an updated Trade License (ট্রেড লাইসেন্স), National ID (NID), TIN Certificate, and a commercial bank account under your company name. Review our [Supplier Verification Guide](/seller-verification-guide) or [Upload Documents Now](/seller-verification).',
    questionBn: 'ভেরিফায়েড সেলার হতে কী কী কাগজপত্র প্রয়োজন?',
    answerBn: 'হালনাগাদ ট্রেড লাইসেন্স, জাতীয় পরিচয়পত্র (NID), ই-টিন (TIN) সার্টিফিকেট এবং প্রতিষ্ঠানের নামে খোলা একটি ভ্যালিড ব্যাংক একাউন্ট প্রয়োজন। দেখুন [সেলার ভেরিফিকেশন গাইড](/seller-verification-guide) অথবা [ডকুমেন্টস আপলোড করুন](/seller-verification)।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 9,
    isStatic: true,
  },
  {
    id: 'faq-static-sellers-2',
    category: 'sellers',
    questionEn: 'How do suppliers receive payouts for fulfilled orders?',
    answerEn: 'Once the buyer confirms receipt or the 48-hour inspection window passes without dispute, funds are disbursed automatically via BEFTN/NPSB to the verified bank account within 1-3 business days. Read our [Seller Handbook](/seller-guide).',
    questionBn: 'সেলাররা কীভাবে বিক্রির টাকা পাবেন?',
    answerBn: 'ক্রেতা ডেলিভারি নিশ্চিত করার পর অথবা ৪৮ ঘণ্টা সময় পার হওয়ার পর কোনো অভিযোগ না থাকলে ১-৩ কার্যদিবসের মধ্যে BEFTN/NPSB এর মাধ্যমে সেলারের ব্যাংক একাউন্টে টাকা চলে যাবে। দেখুন [সেলার সহায়িকা](/seller-guide)।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 10,
    isStatic: true,
  },
  {
    id: 'faq-static-account-1',
    category: 'account',
    questionEn: 'How do I protect my account with Two-Factor Authentication (2FA)?',
    answerEn: 'Go to [Account Settings](/profile-settings) to enable OTP verification via SMS or Authenticator App on every login and high-value transaction. For help, contact our [Live Chat Team](/live-chat).',
    questionBn: 'টু-ফ্যাক্টর অথেনটিকেশন (2FA) কীভাবে চালু করবেন?',
    answerBn: 'আপনার [অ্যাকাউন্ট সেটিংস](/profile-settings)-এ গিয়ে এসএমএস বা অথেনটিকেটর অ্যাপের মাধ্যমে অতিরিক্ত নিরাপত্তা চালু করতে পারেন। প্রয়োজনে [লাইভ চ্যাটে যোগাযোগ করুন](/live-chat)।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 11,
    isStatic: true,
  },
  {
    id: 'faq-static-account-2',
    category: 'account',
    // Derived from the COD verification gate copy
    // (src/components/pages/account-verification-card.tsx).
    questionEn: 'Why is Cash on Delivery locked until I verify my email or phone?',
    answerEn: 'Cash on Delivery requires a verified account — the account gate stays locked until your email or phone is verified from your profile. Wallet, bank transfer and mobile banking are unaffected. Once verified, Cash on Delivery unlocks automatically.',
    questionBn: 'ইমেইল বা ফোন ভেরিফাই না করা পর্যন্ত ক্যাশ অন ডেলিভারি কেন লক থাকে?',
    answerBn: 'ক্যাশ অন ডেলিভারির জন্য ভেরিফায়েড অ্যাকাউন্ট প্রয়োজন — প্রোফাইল থেকে ইমেইল বা ফোন ভেরিফাই করা হলে এটি আনলক হয়। ওয়ালেট, ব্যাংক ট্রান্সফার ও মোবাইল ব্যাংকিংয়ে কোনো প্রভাব পড়ে না।',
    helpfulYes: 0,
    helpfulNo: 0,
    sortOrder: 12,
    isStatic: true,
  },
]

/** Static rows for the active FAQ tab (the API filters server-side; we mirror it). */
export function filterFaqContent(category: string): FaqContentItem[] {
  if (!category || category === 'all') return FALLBACK_FAQ_ITEMS
  return FALLBACK_FAQ_ITEMS.filter((f) => f.category === category)
}
