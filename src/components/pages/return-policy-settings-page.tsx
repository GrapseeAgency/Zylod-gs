'use client';

import React, { useEffect, useState } from 'react';
import { useNavigationStore } from '@/store/navigation-store';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RefreshCcw, ShieldCheck, AlertCircle } from 'lucide-react';

/* REAL sellerReturnPolicies editor — one policy row per policyType (return |
 * exchange | refund | restock) with the model's actual fields. The previous
 * invented "warranty / shipping payer" selects had no backing columns. */

const POLICY_LABELS: Record<string, string> = {
  return: 'Return Policy',
  exchange: 'Exchange Policy',
  refund: 'Refund Policy',
  restock: 'Restocking Policy',
};

const REFUND_METHOD_LABELS: Record<string, string> = {
  original_payment: 'Original payment method',
  wallet: 'Zylod wallet',
  store_credit: 'Store credit',
};

interface PolicyRow {
  policyType: string;
  returnWindowDays: number;
  exchangeAllowed: boolean;
  refundMethod: string;
  restockingFeePct: number;
  conditions: string[];
  isActive: boolean;
}

export function ReturnPolicySettingsPage() {
  const { goBack } = useNavigationStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const res = await fetch('/api/supplier/return-policies');
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setPolicies(json.data.policies || []);
        } else {
          setError(json.error || 'Could not load return policies');
        }
      } catch (err) {
        console.error('Failed to fetch return policy', err);
        setError('Could not reach the policy service');
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  const updatePolicy = (policyType: string, patch: Partial<PolicyRow>) => {
    setSaved(false);
    setPolicies((prev) =>
      prev.map((p) => (p.policyType === policyType ? { ...p, ...patch } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await fetch('/api/supplier/return-policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policies: policies.map((p) => ({
            policyType: p.policyType,
            returnWindowDays: Number(p.returnWindowDays) || 0,
            exchangeAllowed: p.exchangeAllowed,
            refundMethod: p.refundMethod,
            restockingFeePct: Number(p.restockingFeePct) || 0,
            conditions: p.conditions,
            isActive: p.isActive,
          })),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSaved(true);
      } else {
        setSaveError(json.error || `Could not save policies (${res.status})`);
      }
    } catch (err) {
      console.error(err);
      setSaveError('Could not reach the policy service');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="md:hidden p-1 -ml-1 text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Return &amp; Warranty</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || policies.length === 0}
          className="flex items-center gap-1 bg-[#C8102E] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="p-4 space-y-6 md:p-6 md:max-w-3xl md:mx-auto">
        {error ? (
          <div className="bg-white p-6 rounded-xl border border-gray-200 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        ) : policies.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
            <RefreshCcw className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-700">No policies configured yet</h3>
            <p className="text-xs text-gray-500 mt-1">Save a policy row to publish your return terms to buyers.</p>
          </div>
        ) : (
          <>
            {saveError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5" /> {saveError}
              </p>
            )}
            {saved && !saveError && (
              <p className="text-xs text-green-700">Policies saved.</p>
            )}
            {policies.map((policy, idx) => (
              <motion.div
                key={policy.policyType}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.2) }}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="flex items-center justify-between mb-4 text-gray-900 font-semibold">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="w-5 h-5 text-[#C8102E]" />
                    <h2>{POLICY_LABELS[policy.policyType] || policy.policyType}</h2>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-normal text-gray-500">
                    <input
                      type="checkbox"
                      checked={policy.isActive}
                      onChange={(e) => updatePolicy(policy.policyType, { isActive: e.target.checked })}
                      className="accent-[#C8102E]"
                    />
                    Active
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Acceptance window (days)</label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={policy.returnWindowDays}
                      onChange={(e) => updatePolicy(policy.policyType, { returnWindowDays: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Refund method</label>
                    <select 
                      value={policy.refundMethod}
                      onChange={(e) => updatePolicy(policy.policyType, { refundMethod: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                    >
                      {Object.entries(REFUND_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Restocking fee (%)</label>
                    <select 
                      value={String(policy.restockingFeePct)}
                      onChange={(e) => updatePolicy(policy.policyType, { restockingFeePct: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="10">10%</option>
                      <option value="15">15%</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-medium text-gray-700">Exchange allowed</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={policy.exchangeAllowed}
                        onChange={(e) => updatePolicy(policy.policyType, { exchangeAllowed: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C8102E]"></div>
                    </label>
                  </div>
                </div>
              </motion.div>
            ))}

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2 text-gray-900 font-semibold">
                <ShieldCheck className="w-5 h-5 text-[#C8102E]" />
                <h2>How this works</h2>
              </div>
              <p className="text-xs text-gray-500">
                These policies describe your terms to buyers. Zylod&apos;s platform return window still applies to
                disputes, and every approved return is processed through the platform&apos;s returns workflow.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ReturnPolicySettingsPage;
