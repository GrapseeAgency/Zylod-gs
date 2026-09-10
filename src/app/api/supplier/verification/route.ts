import { NextResponse } from 'next/server';

export async function GET() {
  const data = {
    progress: 75,
    documents: [
      { name: 'Trade License', status: 'Verified' },
      { name: 'NID / Passport', status: 'Verified' },
      { name: 'Tax TIN', status: 'Pending' },
      { name: 'Factory License', status: 'Missing' },
    ]
  };
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  // Handle form data upload
  const formData = await req.formData();
  return NextResponse.json({ success: true, message: 'Uploaded successfully' });
}
