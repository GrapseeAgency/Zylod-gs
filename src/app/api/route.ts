import { NextResponse } from "next/server";

/**
 * GET /api/ — platform root descriptor. Formerly returned a literal
 * "Hello, world!" placeholder; now states honestly what this surface is.
 */
export async function GET() {
  return NextResponse.json({
    name: "Zylod",
    tagline: "B2B Wholesale Marketplace for Bangladesh",
    api: "v1",
    surfaces: {
      products: "/api/products",
      orders: "/api/orders",
      supplier: "/api/supplier",
      admin: "/api/admin",
    },
  });
}
