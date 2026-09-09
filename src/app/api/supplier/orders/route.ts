import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  // Dummy logic, replace with actual Prisma query
  const orders = [
    {
      id: 'ord_123',
      orderNumber: 'ZYL-9923-11',
      createdAt: new Date().toISOString(),
      status: status || 'Pending',
      paymentStatus: 'Paid',
      buyerCompanyName: 'Global Traders BD',
      buyerName: 'Rahim Ali',
      moqPackCount: 5,
      totalAmount: 45000,
      items: [
        {
          name: 'Industrial Safety Helmets - Yellow',
          imageUrl: 'https://via.placeholder.com/150',
          quantity: 50,
          price: 900
        }
      ]
    },
    {
      id: 'ord_124',
      orderNumber: 'ZYL-9923-12',
      createdAt: new Date().toISOString(),
      status: status || 'Processing',
      paymentStatus: 'Escrow',
      buyerCompanyName: 'BuildMart',
      buyerName: 'Karim',
      moqPackCount: 2,
      totalAmount: 12000,
      items: [
        {
          name: 'Safety Gloves',
          imageUrl: 'https://via.placeholder.com/150',
          quantity: 100,
          price: 120
        }
      ]
    }
  ];

  return NextResponse.json({ orders });
}
