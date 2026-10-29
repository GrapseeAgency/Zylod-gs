'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '@/store/navigation-store';
import {
  ArrowLeft, Loader2, Truck, UserPlus, Link2, ShieldAlert,
  RefreshCw, PackageSearch, CircleCheck, Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/page-loader'

interface DriverRow {
  id: string;
  email: string | null;
  phone: string | null;
  accountStatus: string;
  createdAt: string;
}

interface AssignmentRow {
  id: string;
  subOrderId: string;
  status: string;
  assignedAt: string;
  completedAt?: string | null;
  subOrderStatus?: string;
  driver: { id: string; name: string };
}

interface AdminOrderRow {
  id: string;
  orderNumber: string;
  subOrders: { id: string; status: string }[];
}

const bdtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function assignmentChip(status: string) {
  if (status === 'active') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>;
  if (status === 'cancelled') return <Badge className="bg-slate-200 text-slate-700 dark:text-neutral-300 hover:bg-slate-200">Superseded</Badge>;
  if (status === 'completed') return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const ASSIGNABLE = ['pending', 'confirmed', 'packed', 'shipped'];

export function AdminDeliveriesPage() {
  const navigate = useNavigationStore((state) => state.navigate);
  const goBack = useNavigationStore((state) => state.goBack);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignableSubOrders, setAssignableSubOrders] = useState<{ id: string; orderNumber: string; status: string }[]>([]);

  /* create-driver form */
  const [dEmail, setDEmail] = useState('');
  const [dPassword, setDPassword] = useState('');
  const [dPhone, setDPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* assign form */
  const [aSubOrder, setASubOrder] = useState('');
  const [aDriver, setADriver] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [dr, as, or] = await Promise.all([
        fetch('/api/admin/deliveries/drivers'),
        fetch('/api/admin/deliveries/assignments'),
        fetch('/api/admin/orders?limit=50'),
      ]);
      if (dr.status === 401 || dr.status === 403 || as.status === 401 || as.status === 403 || or.status === 401 || or.status === 403) {
        setAuthRequired(true);
        return;
      }
      const drj = await dr.json().catch(() => null);
      const asj = await as.json().catch(() => null);
      const orj = await or.json().catch(() => null);
      setDrivers(drj?.drivers ?? []);
      setAssignments(asj?.assignments ?? []);
      const pool: { id: string; orderNumber: string; status: string }[] = [];
      for (const o of orj?.orders ?? orj?.data?.orders ?? []) {
        for (const so of o.subOrders ?? []) {
          if (ASSIGNABLE.includes(so.status)) pool.push({ id: so.id, orderNumber: o.orderNumber, status: so.status });
        }
      }
      setAssignableSubOrders(pool);
      setError('');
      setAuthRequired(false);
    } catch {
      setError('Could not reach the delivery console services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const createDriver = async () => {
    setCreateMsg(null);
    setCreating(true);
    try {
      const body: Record<string, unknown> = { email: dEmail.trim(), password: dPassword };
      if (dPhone.trim()) body.phone = dPhone.trim();
      const res = await fetch('/api/admin/deliveries/drivers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) { setAuthRequired(true); return; }
      if (res.status === 201 || json?.driver) {
        setCreateMsg({ ok: true, text: `Driver account created for ${json?.driver?.email ?? dEmail}` });
        setDEmail(''); setDPassword(''); setDPhone('');
        await loadAll();
      } else {
        const issue = json?.issues ? Object.values(json.issues).flat().join('; ') : '';
        setCreateMsg({ ok: false, text: json?.error ? `${json.error}${issue ? ` — ${issue}` : ''}` : 'Could not create the driver account' });
      }
    } catch {
      setCreateMsg({ ok: false, text: 'Network error while creating the driver' });
    } finally {
      setCreating(false);
    }
  };

  const assign = async () => {
    setAssignMsg(null);
    setAssigning(true);
    try {
      const res = await fetch('/api/admin/deliveries/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subOrderId: aSubOrder.trim(), driverId: aDriver }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) { setAuthRequired(true); return; }
      if (res.status === 201 || json?.ok) {
        setAssignMsg({ ok: true, text: `Driver assigned — live tracking is now armed for this sub-order.` });
        setASubOrder(''); setADriver('');
        await loadAll();
      } else {
        setAssignMsg({ ok: false, text: json?.error || 'Could not create the assignment' });
      }
    } catch {
      setAssignMsg({ ok: false, text: 'Network error while assigning' });
    } finally {
      setAssigning(false);
    }
  };

  const activeCount = assignments.filter((a) => a.status === 'active').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8 dark:bg-gray-900"
    >
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-50 bg-white dark:bg-gray-900 dark:bg-gray-800 border-b px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:bg-gray-700" aria-label="Go back">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Delivery ops</h1>
        <button onClick={loadAll} className="ml-auto p-2 rounded-full hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 dark:hover:bg-gray-700" aria-label="Refresh">
          <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300" />
        </button>
      </header>

      <main className="p-4 space-y-6 md:p-6 md:max-w-5xl md:mx-auto md:pt-6">
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 dark:text-white">Delivery ops</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
              Drivers + assignments — the gate that makes live GPS tracking possible.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} className="h-9">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {loading ? (
          <PageLoader />
        ) : authRequired ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-8 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-gray-300 mx-auto" />
              <h2 className="text-base font-bold dark:text-white">Admin sign-in required</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Delivery ops are admin-only.</p>
              <Button onClick={() => navigate('login')} className="h-11">Sign In</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-none shadow-sm dark:bg-gray-800">
            <CardContent className="p-6 text-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-300">{error}</CardContent>
          </Card>
        ) : (
          <>
            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Drivers</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="drivers-count">{drivers.length}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Active assignments</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="assignments-active">{activeCount}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Assignable sub-orders</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white" data-testid="assignable-count">{assignableSubOrders.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Create driver */}
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Create driver account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="drv-email" className="text-xs">Email</Label>
                    <Input id="drv-email" type="email" placeholder="driver@zylod.com" value={dEmail} onChange={(e) => setDEmail(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="drv-pass" className="text-xs">Password <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">(min 10 chars — hand to the driver securely)</span></Label>
                    <Input id="drv-pass" type="password" placeholder="••••••••••" value={dPassword} onChange={(e) => setDPassword(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="drv-phone" className="text-xs">Phone <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">(optional, 01XXXXXXXXX)</span></Label>
                    <Input id="drv-phone" inputMode="numeric" placeholder="01712345678" value={dPhone} onChange={(e) => setDPhone(e.target.value)} className="h-10" />
                  </div>
                  <Button onClick={createDriver} disabled={creating || !dEmail.trim() || dPassword.length < 10} className="w-full h-10">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                    Create driver
                  </Button>
                  {createMsg && (
                    <p className={`text-xs ${createMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} role="status">
                      {createMsg.text}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Drivers cannot self-register. They authenticate in the driver app and push GPS pings only for
                    sub-orders with an active assignment.
                  </p>
                </CardContent>
              </Card>

              {/* Assign driver */}
              <Card className="border-none shadow-sm dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                    <Link2 className="w-4 h-4 text-primary" />
                    Assign driver to sub-order
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="asg-sub" className="text-xs">Sub-order</Label>
                    {assignableSubOrders.length > 0 ? (
                      <select
                        id="asg-sub"
                        value={aSubOrder}
                        onChange={(e) => setASubOrder(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Pick an in-transit sub-order…</option>
                        {assignableSubOrders.map((so) => (
                          <option key={so.id} value={so.id}>
                            {so.orderNumber} · {so.status} · {so.id.slice(-8)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input placeholder="Sub-order ID" value={aSubOrder} onChange={(e) => setASubOrder(e.target.value)} className="h-10" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asg-drv" className="text-xs">Driver</Label>
                    <select
                      id="asg-drv"
                      value={aDriver}
                      onChange={(e) => setADriver(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Pick a driver…</option>
                      {drivers.filter((d) => d.accountStatus === 'active').map((d) => (
                        <option key={d.id} value={d.id}>{d.email ?? d.phone ?? d.id}</option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={assign} disabled={assigning || !aSubOrder.trim() || !aDriver} className="w-full h-10">
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                    Assign driver
                  </Button>
                  {assignMsg && (
                    <p className={`text-xs ${assignMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} role="status">
                      {assignMsg.text}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    One active driver per sub-order — assigning supersedes the previous assignment. Delivered,
                    cancelled or returned sub-orders refuse assignment.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Driver roster */}
            <Card className="border-none shadow-sm dark:bg-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                  <Truck className="w-4 h-4 text-primary" />
                  Driver roster
                </CardTitle>
              </CardHeader>
              <CardContent>
                {drivers.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-6 text-center">
                    No drivers yet — create the first account above.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-gray-900 dark:bg-gray-800">
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 border-b">
                          <th className="py-2 pr-3 font-medium">Email</th>
                          <th className="py-2 pr-3 font-medium">Phone</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map((d) => (
                          <tr key={d.id} className="border-b last:border-0 text-gray-800 dark:text-gray-200">
                            <td className="py-2.5 pr-3 font-mono text-xs">{d.email ?? '—'}</td>
                            <td className="py-2.5 pr-3 font-mono text-xs">{d.phone ?? '—'}</td>
                            <td className="py-2.5 pr-3">
                              {d.accountStatus === 'active'
                                ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                                : <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{d.accountStatus}</Badge>}
                            </td>
                            <td className="py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{bdtTime(d.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assignments feed */}
            <Card className="border-none shadow-sm dark:bg-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                  <PackageSearch className="w-4 h-4 text-primary" />
                  Assignment feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-6 text-center">
                    No assignments yet — assign a driver to arm live tracking.
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-950 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 dark:border-gray-700">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {a.status === 'active'
                            ? <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            : <Ban className="w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-white truncate">
                              {a.driver?.name ?? a.driver?.id}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 font-mono truncate">
                              sub-order {a.subOrderId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3 shrink-0">
                          {a.subOrderStatus && <Badge variant="outline" className="text-[10px] capitalize">{a.subOrderStatus}</Badge>}
                          {assignmentChip(a.status)}
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 whitespace-nowrap">{bdtTime(a.assignedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </motion.div>
  );
}

export default AdminDeliveriesPage;
