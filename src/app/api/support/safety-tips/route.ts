import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/support/safety-tips
 * Returns buyer and seller verification safety tips, escrow guidelines, and fraud prevention measures.
 */
export async function GET(request: NextRequest) {
  const tips = [
    {
      id: 'tip-1',
      category: 'payments',
      titleEn: 'Always Transact Through Zylod SafePay',
      titleBn: 'সবসময় জাইলোড সেফপে এস্ক্রোর মাধ্যমে লেনদেন করুন',
      descriptionEn: 'Never send direct bank deposits or personal bKash/Nagad transfers outside the platform. Off-platform payments forfeit buyer protection and escrow dispute recovery.',
      descriptionBn: 'প্ল্যাটফর্মের বাইরে কোনো ব্যক্তিগত বিকাশ বা নগদ একাউন্টে টাকা পাঠাবেন না। প্ল্যাটফর্মের বাইরে লেনদেনে কোনো নিরাপত্তা পাওয়া যায় না।',
      icon: 'ShieldCheck',
      importance: 'critical',
    },
    {
      id: 'tip-2',
      category: 'inspection',
      titleEn: 'Inspect Consignments Within 48 Hours',
      titleBn: '৪৮ ঘণ্টার মধ্যে পার্সেল আনবক্স ও কাউন্ট করুন',
      descriptionEn: 'Take clear unboxing photos and video upon delivery. If any units are damaged or missing, click Raise Dispute immediately before escrow payout releases.',
      descriptionBn: 'ডেলিভারি পাওয়ার সাথে সাথে আনবক্সিং ভিডিও করুন। কোনো পণ্যে ত্রুটি থাকলে সাথে সাথে ডিসপুট ওপেন করুন।',
      icon: 'BoxCheck',
      importance: 'high',
    },
    {
      id: 'tip-3',
      category: 'suppliers',
      titleEn: 'Verify Trade License & Factory Badges',
      titleBn: 'ট্রেড লাইসেন্স ও ভেরিফিকেশন ব্যাজ যাচাই করুন',
      descriptionEn: 'Look for the green Verified Supplier Badge, ratings above 4.5, and minimum 6 months on-platform history before placing high-value container orders.',
      descriptionBn: 'বড় অর্ডারের ক্ষেত্রে ভেরিফায়েড ব্যাজ ও রিভিউ রেটিং চেক করে নিন।',
      icon: 'Award',
      importance: 'high',
    },
    {
      id: 'tip-4',
      category: 'communications',
      titleEn: 'Keep All B2B Negotiations in Zylod Chat',
      titleBn: 'সকল ব্যবসায়িক চুক্তি ও যোগাযোগ জাইলোড চ্যাটে রাখুন',
      descriptionEn: 'Official chat logs serve as legally valid evidence in arbitration cases and escrow dispute resolutions under Bangladesh contract law.',
      descriptionBn: 'সকল কথা জাইলোড চ্যাটে রেকর্ড রাখুন, যা ডিসপুট নিষ্পত্তিতে প্রমাণ হিসেবে ব্যবহৃত হবে।',
      icon: 'MessageSquare',
      importance: 'medium',
    },
  ]

  return NextResponse.json({
    success: true,
    data: tips,
  })
}
