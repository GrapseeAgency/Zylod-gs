const fs = require('fs');
const path = require('path');

const basePath = '/mnt/new_volume/Grapsee Products/Zylod (WholeSale)';

const pages = [
  {
    name: 'src/components/pages/seller-reviews-page.tsx',
    content: `'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';
import { motion } from 'framer-motion';
import { Star, AlertCircle, MessageSquare } from 'lucide-react';

export function SellerReviewsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/reviews')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="text-xl font-bold">Seller Reviews</h1>
      </header>
      <main className="flex-1 p-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-bold">Rating Overview</h2>
              <div className="flex items-center space-x-2 mt-2">
                <Star className="text-yellow-500" />
                <span className="text-2xl font-bold">{data?.averageRating || '4.5'}</span>
                <span className="text-gray-500">({data?.totalReviews || 0} reviews)</span>
              </div>
            </div>
            <div className="space-y-4">
              {data?.reviews?.map((review: any) => (
                <div key={review.id} className="bg-white p-4 rounded shadow">
                  <div className="flex justify-between">
                    <span className="font-bold">{review.buyerName}</span>
                    <span className="text-sm text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-2">{review.comment}</p>
                  <div className="mt-4 flex space-x-2">
                    <button onClick={() => navigate('seller-review-reply-page', { id: review.id })} className="flex items-center text-primary text-sm font-semibold">
                      <MessageSquare className="w-4 h-4 mr-1" /> Reply
                    </button>
                    <button className="flex items-center text-gray-500 text-sm font-semibold">
                      <AlertCircle className="w-4 h-4 mr-1" /> Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerReviewsPage;`
  },
  {
    name: 'src/components/pages/seller-promotions-page.tsx',
    content: `'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';
import { motion } from 'framer-motion';
import { Plus, Tag } from 'lucide-react';

export function SellerPromotionsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/promotions')
      .then(res => res.json())
      .then(d => {
        setPromotions(d?.promotions || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Promotions</h1>
        </div>
        <button onClick={() => navigate('create-promotion-page')} className="bg-white text-primary p-2 rounded-full">
          <Plus className="w-5 h-5" />
        </button>
      </header>
      <main className="flex-1 p-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {promotions.map(promo => (
              <div key={promo.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{promo.title}</h3>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded mt-1">{promo.status}</span>
                  </div>
                  <Tag className="text-primary" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Redemptions</p>
                    <p className="font-bold">{promo.redemptions || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Revenue</p>
                    <p className="font-bold">৳{promo.revenue || 0}</p>
                  </div>
                </div>
                <button onClick={() => navigate('promotion-analytics-page', { id: promo.id })} className="mt-4 w-full py-2 bg-gray-100 text-center rounded font-semibold text-gray-700">
                  View Analytics
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerPromotionsPage;`
  },
  {
    name: 'src/components/pages/seller-support-page.tsx',
    content: `'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';
import { motion } from 'framer-motion';
import { LifeBuoy, PlusCircle } from 'lucide-react';

export function SellerSupportPage() {
  const { navigate, goBack } = useNavigationStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/support')
      .then(res => res.json())
      .then(d => {
        setTickets(d?.tickets || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Seller Support</h1>
        </div>
      </header>
      <main className="flex-1 p-4">
        <div className="mb-6 flex space-x-4">
          <button onClick={() => navigate('seller-create-ticket-page')} className="flex-1 bg-white border border-primary text-primary py-3 rounded-lg flex items-center justify-center font-bold">
            <PlusCircle className="w-5 h-5 mr-2" />
            New Ticket
          </button>
          <button className="flex-1 bg-primary text-white py-3 rounded-lg flex items-center justify-center font-bold">
            <LifeBuoy className="w-5 h-5 mr-2" />
            Live Chat
          </button>
        </div>
        <h2 className="text-lg font-bold mb-4">Recent Tickets</h2>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} onClick={() => navigate('seller-ticket-detail-page', { id: ticket.id })} className="bg-white p-4 rounded shadow cursor-pointer">
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{ticket.subject}</span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">{ticket.status}</span>
                </div>
                <p className="text-sm text-gray-500">Ticket #{ticket.id} • {new Date(ticket.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default SellerSupportPage;`
  },
  {
    name: 'src/components/pages/bulk-upload-products-page.tsx',
    content: `'use client';
import React, { useState } from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';
import { motion } from 'framer-motion';
import { UploadCloud, FileSpreadsheet, History } from 'lucide-react';

export function BulkUploadProductsPage() {
  const { navigate, goBack } = useNavigationStore();
  const [uploading, setUploading] = useState(false);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => setUploading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Bulk Upload</h1>
        </div>
        <button onClick={() => navigate('bulk-upload-history-page')}>
          <History className="w-6 h-6" />
        </button>
      </header>
      <main className="flex-1 p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <button onClick={() => navigate('bulk-upload-template-page')} className="w-full bg-white border border-gray-200 p-4 rounded-lg flex items-center text-left shadow-sm">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <FileSpreadsheet className="text-blue-600 w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Download Template</h3>
              <p className="text-sm text-gray-500">Get category specific Excel/CSV templates</p>
            </div>
          </button>

          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-bold text-gray-800 mb-2">Drag and drop your file here</h3>
            <p className="text-sm text-gray-500 mb-4">Support CSV, XLSX files</p>
            <button onClick={handleUpload} className="bg-primary text-white px-6 py-2 rounded font-semibold">
              {uploading ? 'Uploading...' : 'Browse File'}
            </button>
          </div>
          
          <button onClick={() => navigate('bulk-price-update-page')} className="w-full bg-gray-800 text-white p-4 rounded-lg font-bold">
            Quick Bulk Price & MOQ Update
          </button>
        </motion.div>
      </main>
    </div>
  );
}

export default BulkUploadProductsPage;`
  },
  {
    name: 'src/components/pages/customer-queries-page.tsx',
    content: `'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

export function CustomerQueriesPage() {
  const { navigate, goBack } = useNavigationStore();
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/queries')
      .then(res => res.json())
      .then(d => {
        setQueries(d?.queries || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="text-xl font-bold">Customer Queries</h1>
      </header>
      <main className="flex-1 p-4">
        <div className="flex space-x-4 mb-6">
          <button onClick={() => navigate('customer-rfq-inbox-page')} className="flex-1 bg-white border border-primary text-primary py-2 rounded font-bold">
            View RFQ Inbox
          </button>
        </div>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {queries.map(q => (
              <div key={q.id} onClick={() => navigate('customer-query-detail-page', { id: q.id })} className="bg-white p-4 rounded shadow cursor-pointer flex items-start">
                <div className="bg-gray-100 p-3 rounded-full mr-4">
                  <MessageCircle className="w-6 h-6 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h3 className="font-bold">{q.buyerName}</h3>
                    <span className="text-xs text-gray-500">{new Date(q.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 truncate">{q.lastMessage}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default CustomerQueriesPage;`
  },
  {
    name: 'src/components/pages/store-customization-page.tsx',
    content: `'use client';
import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';
import { motion } from 'framer-motion';
import { Layout, Palette, Settings } from 'lucide-react';

export function StoreCustomizationPage() {
  const { navigate, goBack } = useNavigationStore();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/supplier/customization')
      .then(res => res.json())
      .then(d => {
        setSettings(d);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={goBack} className="mr-4">←</button>
          <h1 className="text-xl font-bold">Store Customization</h1>
        </div>
      </header>
      <main className="flex-1 p-4">
        {loading ? (
          <div className="h-40 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-bold mb-4 flex items-center"><Layout className="mr-2 w-5 h-5 text-gray-500"/> Header Layout</h2>
              <select className="w-full border p-2 rounded">
                <option>Hero Banner</option>
                <option>Split Showcase</option>
                <option>Minimalist Grid</option>
              </select>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-bold mb-4 flex items-center"><Settings className="mr-2 w-5 h-5 text-gray-500"/> Widgets</h2>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span>Show Verified Badges</span>
                  <input type="checkbox" defaultChecked={settings?.showBadges} className="w-5 h-5 accent-primary" />
                </label>
                <label className="flex items-center justify-between">
                  <span>Show Factory Video</span>
                  <input type="checkbox" defaultChecked={settings?.showVideo} className="w-5 h-5 accent-primary" />
                </label>
              </div>
            </div>

            <button onClick={() => navigate('store-theme-customizer-page')} className="w-full bg-white border border-gray-200 p-4 rounded shadow flex items-center justify-between">
              <div className="flex items-center font-bold">
                <Palette className="mr-2 w-5 h-5 text-gray-500" />
                Advanced Theme Settings
              </div>
              <span>→</span>
            </button>

            <button className="w-full bg-primary text-white py-3 rounded-lg font-bold">
              Save Changes
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default StoreCustomizationPage;`
  },
  {
    name: 'src/components/pages/seller-review-reply-page.tsx',
    content: `'use client';
import React, { useState } from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function SellerReviewReplyPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  const [reply, setReply] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/supplier/reviews', { method: 'POST', body: JSON.stringify({ reviewId: id, reply }) });
    goBack();
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <header className="flex items-center mb-6">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="text-xl font-bold">Reply to Review</h1>
      </header>
      <textarea className="w-full h-40 border rounded p-3 mb-4" placeholder="Write a polite response to the customer..." value={reply} onChange={(e) => setReply(e.target.value)}></textarea>
      <button onClick={handleSubmit} className="w-full bg-primary text-white py-3 rounded font-bold">Post Reply</button>
    </div>
  );
}
export default SellerReviewReplyPage;`
  },
  {
    name: 'src/components/pages/create-promotion-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function CreatePromotionPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-2xl font-bold mb-6">Create Campaign</h1>
      <div className="bg-white p-4 shadow rounded space-y-4">
        <input type="text" placeholder="Campaign Name" className="w-full border p-2 rounded" />
        <select className="w-full border p-2 rounded">
          <option>Percentage Discount</option>
          <option>Fixed BDT Off</option>
        </select>
        <button className="w-full bg-primary text-white py-3 rounded font-bold">Create</button>
      </div>
    </div>
  );
}
export default CreatePromotionPage;`
  },
  {
    name: 'src/components/pages/promotion-analytics-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function PromotionAnalyticsPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Campaign Analytics</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded">
          <p className="text-sm text-gray-500">ROI</p>
          <p className="text-xl font-bold text-green-600">+340%</p>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <p className="text-sm text-gray-500">Cost/Acquisition</p>
          <p className="text-xl font-bold">৳45</p>
        </div>
      </div>
    </div>
  );
}
export default PromotionAnalyticsPage;`
  },
  {
    name: 'src/components/pages/seller-flash-sale-nomination-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function SellerFlashSaleNominationPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Flash Sale Nomination</h1>
      <p className="mb-4">Select products to nominate for Zylod Flash Sales.</p>
      <button className="w-full bg-primary text-white py-3 rounded font-bold">Submit Items</button>
    </div>
  );
}
export default SellerFlashSaleNominationPage;`
  },
  {
    name: 'src/components/pages/seller-create-ticket-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function SellerCreateTicketPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">New Ticket</h1>
      <div className="space-y-4">
        <select className="w-full border p-2 rounded">
          <option>Billing</option>
          <option>Logistics</option>
        </select>
        <textarea className="w-full h-32 border p-2 rounded" placeholder="Describe your issue..."></textarea>
        <button className="w-full bg-primary text-white py-3 rounded font-bold">Submit</button>
      </div>
    </div>
  );
}
export default SellerCreateTicketPage;`
  },
  {
    name: 'src/components/pages/seller-ticket-detail-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function SellerTicketDetailPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white p-4 flex items-center border-b">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="font-bold">Ticket #{id || '001'}</h1>
      </header>
      <main className="flex-1 p-4 space-y-4">
        <div className="bg-white p-3 rounded shadow-sm inline-block">Hello, how can I help?</div>
      </main>
      <footer className="p-4 bg-white border-t flex">
        <input type="text" className="flex-1 border rounded-l p-2" placeholder="Reply..." />
        <button className="bg-primary text-white px-4 rounded-r">Send</button>
      </footer>
    </div>
  );
}
export default SellerTicketDetailPage;`
  },
  {
    name: 'src/components/pages/bulk-upload-template-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function BulkUploadTemplatePage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Templates</h1>
      <ul className="space-y-2">
        <li className="p-4 border rounded font-semibold text-primary">Garments.xlsx</li>
        <li className="p-4 border rounded font-semibold text-primary">Electronics.xlsx</li>
      </ul>
    </div>
  );
}
export default BulkUploadTemplatePage;`
  },
  {
    name: 'src/components/pages/bulk-upload-history-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function BulkUploadHistoryPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Upload History</h1>
      <div className="bg-white p-4 shadow rounded mb-2">
        <p className="font-bold">batch_0812.csv</p>
        <p className="text-sm text-green-600">Success: 120 rows</p>
      </div>
    </div>
  );
}
export default BulkUploadHistoryPage;`
  },
  {
    name: 'src/components/pages/bulk-price-update-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function BulkPriceUpdatePage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Quick Price Update</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr><th className="border-b p-2">SKU</th><th className="border-b p-2">Price</th><th className="border-b p-2">MOQ</th></tr></thead>
          <tbody>
            <tr><td className="p-2">SHIRT-01</td><td className="p-2"><input type="number" className="w-20 border rounded p-1" defaultValue={450}/></td><td className="p-2"><input type="number" className="w-16 border rounded p-1" defaultValue={50}/></td></tr>
          </tbody>
        </table>
      </div>
      <button className="w-full bg-primary text-white py-3 mt-4 rounded font-bold">Save All</button>
    </div>
  );
}
export default BulkPriceUpdatePage;`
  },
  {
    name: 'src/components/pages/customer-query-detail-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function CustomerQueryDetailPage({ id }: { id?: string }) {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white p-4 flex items-center border-b">
        <button onClick={goBack} className="mr-4">←</button>
        <h1 className="font-bold">Query thread</h1>
      </header>
      <main className="flex-1 p-4 space-y-4">
        <div className="bg-white p-3 rounded shadow-sm inline-block">Can you do 500 units by next week?</div>
      </main>
      <footer className="p-4 bg-white border-t flex">
        <input type="text" className="flex-1 border rounded-l p-2" placeholder="Reply..." />
        <button className="bg-primary text-white px-4 rounded-r">Send</button>
      </footer>
    </div>
  );
}
export default CustomerQueryDetailPage;`
  },
  {
    name: 'src/components/pages/customer-rfq-inbox-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function CustomerRfqInboxPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">RFQ Inbox</h1>
      <div className="bg-white p-4 rounded shadow mb-2">
        <h3 className="font-bold">Need 5000x Cotton T-Shirts</h3>
        <p className="text-sm text-gray-500">Budget: ৳500,000</p>
        <button className="mt-2 bg-primary text-white px-4 py-1 rounded text-sm">Bid Now</button>
      </div>
    </div>
  );
}
export default CustomerRfqInboxPage;`
  },
  {
    name: 'src/components/pages/store-theme-customizer-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function StoreThemeCustomizerPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Theme Options</h1>
      <div className="space-y-4">
        <div>
          <label className="font-bold block mb-1">Brand Color</label>
          <input type="color" defaultValue="#C8102E" className="w-full h-10 p-0 border-0" />
        </div>
        <button className="w-full bg-primary text-white py-3 rounded font-bold">Apply Theme</button>
      </div>
    </div>
  );
}
export default StoreThemeCustomizerPage;`
  },
  {
    name: 'src/components/pages/seller-quick-actions-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function SellerQuickActionsPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-6">Quick Actions</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-6 rounded-lg text-center font-bold">Scan Barcode</div>
        <div className="bg-gray-800 p-6 rounded-lg text-center font-bold">Rapid Restock</div>
      </div>
    </div>
  );
}
export default SellerQuickActionsPage;`
  },
  {
    name: 'src/components/pages/seller-notifications-center-page.tsx',
    content: `'use client';
import React from 'react';
import { useNavigationStore } from '@/lib/store/navigation-store';

export function SellerNotificationsCenterPage() {
  const { goBack } = useNavigationStore();
  return (
    <div className="min-h-screen bg-white p-4">
      <button onClick={goBack} className="mb-4">← Back</button>
      <h1 className="text-xl font-bold mb-4">Notifications</h1>
      <div className="space-y-2">
        <div className="p-3 bg-blue-50 text-blue-900 rounded">
          <p className="font-bold">New Order #1029</p>
          <p className="text-sm">You have 2 days to fulfill this wholesale order.</p>
        </div>
      </div>
    </div>
  );
}
export default SellerNotificationsCenterPage;`
  }
];

const apis = [
  {
    name: 'src/app/api/supplier/reviews/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ averageRating: 4.8, totalReviews: 120, reviews: [{ id: 1, buyerName: 'Rahim Traders', comment: 'Excellent quality', createdAt: new Date().toISOString() }] });
}
export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/promotions/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ promotions: [{ id: 1, title: 'Summer Wholesale Sale', status: 'Active', redemptions: 45, revenue: 150000 }] });
}
export async function POST(req: Request) {
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/promotions/[id]/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ id: 1, title: 'Promo Details' });
}
export async function PATCH() {
  return NextResponse.json({ success: true });
}
export async function DELETE() {
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/support/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ tickets: [{ id: 101, subject: 'Payment Delay', status: 'Open', createdAt: new Date().toISOString() }] });
}
export async function POST(req: Request) {
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/support/[id]/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ id: 101, messages: [] });
}
export async function POST() {
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/bulk-upload/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ jobs: [] });
}
export async function POST() {
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/queries/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ queries: [{ id: 1, buyerName: 'Karim Fabrics', lastMessage: 'Can you do 500 units?', createdAt: new Date().toISOString() }] });
}
export async function POST() {
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/queries/[id]/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ id: 1, thread: [] });
}
export async function PATCH() {
  return NextResponse.json({ success: true });
}`
  },
  {
    name: 'src/app/api/supplier/customization/route.ts',
    content: `import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ theme: 'Red', showBadges: true, showVideo: false });
}
export async function PATCH() {
  return NextResponse.json({ success: true });
}`
  }
];

const allFiles = [...pages, ...apis];

allFiles.forEach(file => {
  const fullPath = path.join(basePath, file.name);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, file.content);
});

console.log('Files generated successfully.');
