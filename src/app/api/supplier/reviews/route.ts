import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ averageRating: 4.8, totalReviews: 120, reviews: [{ id: 1, buyerName: 'Rahim Traders', comment: 'Excellent quality', createdAt: new Date().toISOString() }] });
}
export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ success: true });
}