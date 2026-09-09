import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ queries: [{ id: 1, buyerName: 'Karim Fabrics', lastMessage: 'Can you do 500 units?', createdAt: new Date().toISOString() }] });
}
export async function POST() {
  return NextResponse.json({ success: true });
}