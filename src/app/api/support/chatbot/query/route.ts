import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/support/chatbot/query
 * Quick AI response querying real database FAQs and policy articles.
 * Body: { query: string, language?: 'en' | 'bn' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const query = String(body.query || '').trim()
    const language = body.language === 'bn' ? 'bn' : 'en'

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const q = query.toLowerCase()

    // 1. Search FAQ items
    const faq = await db.faqItems.findFirst({
      where: {
        isActive: true,
        OR: [
          { questionEn: { contains: q } },
          { answerEn: { contains: q } },
          { questionBn: { contains: q } },
          { answerBn: { contains: q } },
        ],
      },
    })

    if (faq) {
      return NextResponse.json({
        success: true,
        source: 'faq',
        answer: language === 'bn' && faq.answerBn ? faq.answerBn : faq.answerEn,
        suggestedArticles: [
          { title: 'How Zylod Wholesale Works', slug: 'how-it-works' },
          { title: 'SafePay Escrow Protection', slug: 'escrow-buyer-protection' },
        ],
      })
    }

    // 2. Search Articles
    const article = await db.helpArticles.findFirst({
      where: {
        isPublished: true,
        OR: [
          { titleEn: { contains: q } },
          { contentEn: { contains: q } },
          { titleBn: { contains: q } },
          { contentBn: { contains: q } },
        ],
      },
    })

    if (article) {
      const snippet = language === 'bn' && article.contentBn
        ? article.contentBn.slice(0, 300) + '...'
        : article.contentEn.slice(0, 300) + '...'

      return NextResponse.json({
        success: true,
        source: 'article',
        answer: snippet,
        articleSlug: article.slug,
        articleTitle: language === 'bn' && article.titleBn ? article.titleBn : article.titleEn,
      })
    }

    // 3. Fallback smart contextual wholesale answers
    let fallbackAnswer = language === 'bn'
      ? 'আপনার প্রশ্নের সরাসরি উত্তর পাওয়া যায়নি। আপনি একটি সাপোর্ট টিকেট ওপেন করতে পারেন অথবা আমাদের লাইভ সাপোর্ট এজেন্টের সাথে কথা বলতে পারেন।'
      : 'I could not find an exact match in our knowledge base. Would you like to submit a support ticket or speak with a live wholesale support agent?'

    if (q.includes('order') || q.includes('অর্ডার')) {
      fallbackAnswer = language === 'bn'
        ? 'পাইকারি অর্ডারের জন্য পণ্য পেজে গিয়ে MOQ সিলেক্ট করে সরাসরি বাই নাও বা অ্যাড টু কার্ট করুন।'
        : 'To place a wholesale order, navigate to the product page, select your quantity meeting MOQ, and proceed to checkout with SafePay Escrow.'
    } else if (q.includes('payment') || q.includes('পেমেন্ট') || q.includes('bkash') || q.includes('বিকাশ')) {
      fallbackAnswer = language === 'bn'
        ? 'আমরা বিকাশ, নগদ, রকেট, ব্যাংক ট্রান্সফার এবং কার্ড পেমেন্ট সমর্থন করি। সকল টাকা এস্ক্রোতে সুরক্ষিত থাকে।'
        : 'We support bKash, Nagad, Rocket, credit/debit cards, and B2B bank transfers protected by Zylod SafePay Escrow.'
    }

    return NextResponse.json({
      success: true,
      source: 'fallback',
      answer: fallbackAnswer,
    })
  } catch (error) {
    console.error('Chatbot query error:', error)
    return NextResponse.json({ error: 'Failed to process assistant query' }, { status: 500 })
  }
}
