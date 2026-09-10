#!/bin/bash

# Define paths
COMPONENTS_DIR="src/components/pages"
mkdir -p "$COMPONENTS_DIR"

# Common template
create_component() {
    local file_name=$1
    local component_name=$2
    local page_title=$3
    
    cat << 'INNER_EOF' > "$COMPONENTS_DIR/$file_name.tsx"
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/lib/store/navigation-store';
import { ArrowLeft, Loader2, TrendingUp, DollarSign, Activity, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function $component_name() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from the appropriate API
    setTimeout(() => {
      setData({ placeholder: true });
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 pb-20"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">$page_title</h1>
      </header>

      <main className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  $page_title Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Content for $page_title will be populated from the API.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </motion.div>
  );
}

export default $component_name;
INNER_EOF
}

# Create components
create_component "seller-analytics-page" "SellerAnalyticsPage" "Seller Analytics"
create_component "revenue-reports-page" "RevenueReportsPage" "Revenue Reports"
create_component "seller-payouts-page" "SellerPayoutsPage" "Seller Payouts"
create_component "product-performance-page" "ProductPerformancePage" "Product Performance"
create_component "seller-rankings-page" "SellerRankingsPage" "Seller Rankings"
create_component "seller-sales-funnel-page" "SellerSalesFunnelPage" "Sales Funnel"
create_component "seller-traffic-sources-page" "SellerTrafficSourcesPage" "Traffic Sources"
create_component "seller-customer-insights-page" "SellerCustomerInsightsPage" "Customer Insights"
create_component "revenue-breakdown-page" "RevenueBreakdownPage" "Revenue Breakdown"
create_component "seller-tax-invoices-page" "SellerTaxInvoicesPage" "Tax Invoices"
create_component "seller-financial-statements-page" "SellerFinancialStatementsPage" "Financial Statements"
create_component "seller-payout-request-page" "SellerPayoutRequestPage" "Request Payout"
create_component "seller-payout-methods-page" "SellerPayoutMethodsPage" "Payout Methods"
create_component "product-conversion-rate-page" "ProductConversionRatePage" "Conversion Rates"
create_component "seller-tier-benefits-page" "SellerTierBenefitsPage" "Tier Benefits"

