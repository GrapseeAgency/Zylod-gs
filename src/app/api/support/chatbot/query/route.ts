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
      // Only suggest articles that actually exist in the DB — never hardcoded slugs.
      const realArticles = await db.helpArticles.findMany({
        where: { isPublished: true },
        select: { slug: true, titleEn: true },
        take: 2,
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({
        success: true,
        source: 'faq',
        answer: language === 'bn' && faq.answerBn ? faq.answerBn : faq.answerEn,
        suggestedArticles: realArticles.map(a => ({ title: a.titleEn, slug: a.slug })),
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

    // 3. Fallback honest answers — no escrow, no invented SLAs
    let fallbackAnswer = language === 'bn'
      ? '\u0986\u09ae\u09be\u09a6\u09c7\u09b0 \u09a8\u09b2\u09c7\u099c \u09ac\u09c7\u09b8\u09c7 \u09b8\u09b0\u09be\u09b8\u09b0\u09bf \u0989\u09a4\u09cd\u09a4\u09b0 \u09aa\u09be\u0993\u09df\u09be \u09af\u09be\u09df\u09a8\u09bf\u0964 \u0986\u09aa\u09a8\u09bf \u098f\u0995\u099f\u09bf \u09b8\u09be\u09aa\u09cb\u09b0\u09cd\u099f \u099f\u09bf\u0995\u09c7\u099f \u0993\u09aa\u09c7\u09a8 \u0995\u09b0\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u09a8 \u0985\u09a5\u09ac\u09be support@zylod.com \u098f \u0987\u09ae\u09c7\u0987\u09b2 \u0995\u09b0\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u09a8\u0964'
      : 'I could not find an exact match in our knowledge base. You can open a support ticket or email support@zylod.com.'

    if (q.includes('order') || q.includes('\u0985\u09b0\u09cd\u09a1\u09be\u09b0')) {
      fallbackAnswer = language === 'bn'
        ? '\u09aa\u09c7\u0987\u0995\u09be\u09b0\u09bf \u0985\u09b0\u09cd\u09a1\u09be\u09b0\u09c7\u09b0 \u099c\u09a8\u09cd\u09af \u09aa\u09a3\u09cd\u09af \u09aa\u09c7\u099c\u09c7 \u0997\u09bf\u09df\u09c7 MOQ \u0985\u09a8\u09c1\u09af\u09be\u09df\u09c0 \u09aa\u09b0\u09bf\u09ae\u09be\u09a3 \u09b8\u09bf\u09b2\u09c7\u0995\u09cd\u099f \u0995\u09b0\u09c7 \u0985\u09b0\u09cd\u09a1\u09be\u09b0 \u0995\u09b0\u09c1\u09a8\u0964 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f \u09ad\u09c7\u09b0\u09bf\u09ab\u09be\u0987 \u09a8\u09be \u09b9\u0993\u09df\u09be \u09aa\u09b0\u09cd\u09df\u09a8\u09cd\u09a4 \u0985\u09b0\u09cd\u09a1\u09be\u09b0 UNPAID \u09a5\u09be\u0995\u09c7\u0964'
        : 'To place a wholesale order, open a product page, select a quantity that meets the seller\'s MOQ, and place the order. It stays UNPAID until your payment is verified.'
    } else if (q.includes('payment') || q.includes('\u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f') || q.includes('bkash') || q.includes('\u09ac\u09bf\u0995\u09be\u09b6') || q.includes('escrow')) {
      fallbackAnswer = language === 'bn'
        ? '\u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f \u09ac\u09cd\u09af\u09be\u0982\u0995 \u099f\u09cd\u09b0\u09be\u09a8\u09cd\u09b8\u09ab\u09be\u09b0 \u09ac\u09be \u09ae\u09cb\u09ac\u09be\u0987\u09b2 \u09ac\u09cd\u09af\u09be\u0982\u0995\u09bf\u0982 (\u09ac\u09bf\u0995\u09be\u09b6/\u09a8\u0997\u09a6) \u098f\u09b0 \u09ae\u09be\u09a7\u09cd\u09af\u09ae\u09c7 \u0995\u09b0\u09be \u09b9\u09df, \u0985\u09b0\u09cd\u09a1\u09be\u09b0\u09c7 \u09a6\u09c7\u0996\u09be\u09a8\u09cb \u09a8\u09ae\u09cd\u09ac\u09b0\u09c7\u0964 \u09aa\u09c7\u09ae\u09c7\u09a8\u09cd\u099f \u09ad\u09c7\u09b0\u09bf\u09ab\u09be\u0987 \u09b9\u0993\u09df\u09be\u09b0 \u0986\u0997\u09c7 \u0985\u09b0\u09cd\u09a1\u09be\u09b0 UNPAID \u09a5\u09be\u0995\u09c7\u0964'
        : 'Payments are made by bank transfer or mobile banking (bKash/Nagad) to the details shown on your order. The order stays UNPAID until payment is verified by Zylod.'
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
