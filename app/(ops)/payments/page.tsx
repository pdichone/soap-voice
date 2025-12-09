'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PatientNonPhi, PaymentNonPhi } from '@/lib/types-ops';
import { LoadingSpinner, PageLoading } from '@/components/ui/loading-spinner';
import { ALL_PAYMENT_METHODS } from '@/lib/practice-config';
import { useToast } from '@/lib/toast-context';
import { DateFilterPills, isTimestampInRange } from '@/components/ops/DateFilterPills';

interface PaymentWithPatient extends PaymentNonPhi {
  patient?: PatientNonPhi;
}

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('action') === 'new';
  const { showToast } = useToast();

  const [payments, setPayments] = useState<PaymentWithPatient[]>([]);
  const [patients, setPatients] = useState<PatientNonPhi[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(showNewForm);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [isCopay, setIsCopay] = useState(false);

  // Date filter state
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    loadData();
    // Refresh data when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Run queries in parallel for faster loading
    const [paymentsResult, patientsResult] = await Promise.all([
      supabase
        .from('payments_non_phi')
        .select('*, patient:patients_non_phi(id, display_name)')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('patients_non_phi')
        .select('*')
        .eq('owner_user_id', user.id)
        .eq('is_active', true)
        .order('display_name'),
    ]);

    const paymentsData = paymentsResult.data || [];
    setPayments(paymentsData);
    setPatients(patientsResult.data || []);
    setLoading(false);
  };

  const handleAddPayment = async () => {
    if (!selectedPatientId || !amount) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('payments_non_phi').insert({
      owner_user_id: user.id,
      patient_id: selectedPatientId,
      amount: parseFloat(amount),
      method,
      is_copay: isCopay,
    });

    if (!error) {
      setShowDialog(false);
      setSelectedPatientId('');
      setAmount('');
      setMethod('CASH');
      setIsCopay(false);
      showToast(`Payment of $${parseFloat(amount).toFixed(2)} recorded`);
      loadData();
      router.refresh();
      router.replace('/payments');
    } else {
      showToast('Failed to save payment', 'error');
    }
    setSaving(false);
  };

  // Filter and group payments by date
  const filteredPayments = payments.filter(payment => isTimestampInRange(payment.created_at, dateFilter));
  const groupedPayments = filteredPayments.reduce((acc, payment) => {
    const date = new Date(payment.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(payment);
    return acc;
  }, {} as Record<string, PaymentWithPatient[]>);

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm">
            {dateFilter === 'all'
              ? `${payments.length} total payments`
              : `${filteredPayments.length} of ${payments.length} payments`}
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>Log Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Patient *</label>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Amount *</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Method</label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="copay"
                  checked={isCopay}
                  onChange={(e) => setIsCopay(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="copay" className="text-sm text-gray-700">
                  Patient collection
                </label>
              </div>
              <Button
                onClick={handleAddPayment}
                disabled={saving || !selectedPatientId || !amount}
                className="w-full"
              >
                {saving ? 'Saving...' : 'Log Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Date Filter Pills */}
      {payments.length > 0 && (
        <DateFilterPills value={dateFilter} onChange={setDateFilter} />
      )}

      {/* Summary - changes based on filter */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            {dateFilter === 'all' ? 'All Time' : dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : 'This Month'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            ${filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-sm text-gray-500">
            {filteredPayments.length} {filteredPayments.length === 1 ? 'payment' : 'payments'}
          </p>
        </CardContent>
      </Card>

      {/* Payment List */}
      {loading ? (
        <LoadingSpinner text="Loading payments..." />
      ) : Object.keys(groupedPayments).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedPayments).map(([date, datePayments]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500">{date}</h3>
                <span className="text-sm font-medium text-gray-700">
                  ${datePayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                </span>
              </div>
              <div className="space-y-2">
                {datePayments.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {payment.patient?.display_name || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {ALL_PAYMENT_METHODS.find(m => m.value === payment.method)?.label || payment.method}
                            </Badge>
                            {payment.is_copay && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                Collect
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-green-600">
                          ${payment.amount.toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Track Your Earnings</h3>
            {patients.length === 0 ? (
              <>
                <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                  Add a patient first, then come back here to log payments after each session.
                </p>
                <Button variant="outline" onClick={() => router.push('/patients?action=new')}>
                  Add Your First Patient
                </Button>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                  Payments are automatically logged when you add a visit. You can also log standalone payments here.
                </p>
                <Button onClick={() => setShowDialog(true)}>
                  Log Payment
                </Button>
              </>
            )}
            <p className="text-xs text-gray-500 mt-6">
              Tip: Add a visit from the Visits tab - you&apos;ll be prompted to collect payment automatically
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageLoading text="Loading payments..." />}>
      <PaymentsContent />
    </Suspense>
  );
}
