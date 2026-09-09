import { NextResponse } from 'next/server';

export async function GET() {
  const rankingsData = {
    score: {
      total: 98.4,
      onTimeDelivery: 99.1,
      responseRate: 97.5,
      orderDefectRate: 0.5,
      buyerRating: 4.8
    },
    ranking: {
      category: 'Industrial Electronics',
      rank: 3,
      totalSellers: 450
    },
    tier: {
      current: 'Gold Supplier',
      perks: [
        'Higher search placement',
        'Lower commission rate (4.5%)',
        'VIP Merchant Account Manager'
      ],
      nextTier: 'Platinum Supplier',
      nextTierProgress: 85
    }
  };

  return NextResponse.json(rankingsData);
}
