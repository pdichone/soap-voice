'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLocalDateString, formatDate } from '@/lib/date-utils';
import type { PatientNonPhi, VisitNonPhi, ClaimNonPhi, ReferralNonPhi, PaymentNonPhi } from '@/lib/types-ops';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CARD', label: 'Card' },
  { value: 'HSA', label: 'HSA/FSA' },
  { value: 'OTHER', label: 'Other' },
];

const VISIT_LIMIT_TYPES = [
  { value: 'PER_REFERRAL', label: 'Per Referral' },
  { value: 'PER_CALENDAR_YEAR', label: 'Per Calendar Year' },
  { value: 'UNLIMITED', label: 'Unlimited' },
];

export default function PatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [patient, setPatient] = useState<PatientNonPhi | null>(null);
  const [visits, setVisits] = useState<VisitNonPhi[]>([]);
  const [claims, setClaims] = useState<ClaimNonPhi[]>([]);
  const [referrals, setReferrals] = useState<ReferralNonPhi[]>([]);
  const [payments, setPayments] = useState<PaymentNonPhi[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment form state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentIsCopay, setPaymentIsCopay] = useState(true);

  // Referral form state
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [savingReferral, setSavingReferral] = useState(false);
  const [editingReferral, setEditingReferral] = useState<ReferralNonPhi | null>(null);
  const [referralLabel, setReferralLabel] = useState('');
  const [visitLimitType, setVisitLimitType] = useState('PER_REFERRAL');
  const [visitLimitCount, setVisitLimitCount] = useState('');
  const [referralStartDate, setReferralStartDate] = useState(getLocalDateString());
  const [referralExpirationDate, setReferralExpirationDate] = useState('');
  const [referralNotes, setReferralNotes] = useState('');

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load patient
    const { data: patientData } = await supabase
      .from('patients_non_phi')
      .select('*')
      .eq('id', id)
      .eq('owner_user_id', user.id)
      .single();

    if (patientData) {
      setPatient(patientData);
    }

    // Load visits
    const { data: visitsData } = await supabase
      .from('visits_non_phi')
      .select('*')
      .eq('patient_id', id)
      .order('visit_date', { ascending: false });

    setVisits(visitsData || []);

    // Load claims
    const { data: claimsData } = await supabase
      .from('claims_non_phi')
      .select('*')
      .eq('patient_id', id)
      .order('date_of_service', { ascending: false });

    setClaims(claimsData || []);

    // Load referrals
    const { data: referralsData } = await supabase
      .from('referrals_non_phi')
      .select('*')
      .eq('patient_id', id)
      .order('referral_start_date', { ascending: false });

    setReferrals(referralsData || []);

    // Load payments
    const { data: paymentsData } = await supabase
      .from('payments_non_phi')
      .select('*')
      .eq('patient_id', id)
      .order('created_at', { ascending: false });

    setPayments(paymentsData || []);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetReferralForm = () => {
    setReferralLabel('');
    setVisitLimitType('PER_REFERRAL');
    setVisitLimitCount('');
    setReferralStartDate(getLocalDateString());
    setReferralExpirationDate('');
    setReferralNotes('');
    setEditingReferral(null);
  };

  const resetPaymentForm = () => {
    setPaymentAmount(patient?.default_copay_amount?.toString() || '');
    setPaymentMethod('CASH');
    setPaymentIsCopay(true);
  };

  const handleSavePayment = async () => {
    if (!paymentAmount) return;

    setSavingPayment(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingPayment(false);
      return;
    }

    const { error } = await supabase.from('payments_non_phi').insert({
      owner_user_id: user.id,
      patient_id: id,
      amount: parseFloat(paymentAmount),
      method: paymentMethod,
      is_copay: paymentIsCopay,
    });

    if (!error) {
      setShowPaymentDialog(false);
      resetPaymentForm();
      loadData();
    }
    setSavingPayment(false);
  };

  const openEditReferral = (referral: ReferralNonPhi) => {
    setEditingReferral(referral);
    setReferralLabel(referral.referral_label || '');
    setVisitLimitType(referral.visit_limit_type || 'PER_REFERRAL');
    setVisitLimitCount(referral.visit_limit_count?.toString() || '');
    setReferralStartDate(referral.referral_start_date || '');
    setReferralExpirationDate(referral.referral_expiration_date || '');
    setReferralNotes(referral.notes || '');
    setShowReferralDialog(true);
  };

  const handleSaveReferral = async () => {
    setSavingReferral(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to save a referral');
      setSavingReferral(false);
      return;
    }

    // Ensure profile exists (needed for foreign key)
    await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });

    const referralData = {
      patient_id: id,
      owner_user_id: user.id,
      referral_label: referralLabel.trim() || null,
      visit_limit_type: visitLimitType,
      visit_limit_count: visitLimitType === 'UNLIMITED' ? null : (visitLimitCount ? parseInt(visitLimitCount) : null),
      referral_start_date: referralStartDate || null,
      referral_expiration_date: referralExpirationDate || null,
      notes: referralNotes.trim() || null,
    };

    let error;

    if (editingReferral) {
      // Update existing referral - don't include owner_user_id in update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { owner_user_id, patient_id, ...updateData } = referralData;
      const result = await supabase
        .from('referrals_non_phi')
        .update(updateData)
        .eq('id', editingReferral.id)
        .eq('owner_user_id', user.id);
      error = result.error;
    } else {
      // Insert new referral
      const result = await supabase
        .from('referrals_non_phi')
        .insert(referralData);
      error = result.error;
    }

    if (error) {
      console.error('Error saving referral:', error);
      alert(`Error saving referral: ${error.message}`);
    } else {
      setShowReferralDialog(false);
      resetReferralForm();
      loadData();
    }

    setSavingReferral(false);
  };

  const getVisitsUsedForReferral = (referralId: string) => {
    return visits.filter(v => v.referral_id === referralId).length;
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading...</div>;
  }

  if (!patient) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Patient not found</p>
        <Link href="/patients" className="text-blue-600 font-medium mt-2 inline-block">
          Back to Patients
        </Link>
      </div>
    );
  }

  const activeReferral = referrals.find(r =>
    !r.referral_expiration_date || new Date(r.referral_expiration_date) >= new Date()
  );

  return (
    <div className="p-4 space-y-4">
      <header>
        <Link href="/patients" className="text-blue-600 text-sm font-medium flex items-center gap-1 mb-2">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Patients
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.display_name}</h1>
            {patient.insurer_name && (
              <p className="text-gray-500">{patient.insurer_name}</p>
            )}
          </div>
          {patient.default_copay_amount && (
            <Badge variant="outline" className="text-sm">
              Copay: ${patient.default_copay_amount}
            </Badge>
          )}
        </div>
      </header>

      {/* Active Referral Alert */}
      {activeReferral && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">
                  {activeReferral.referral_label || 'Active Referral'}
                </p>
                <p className="text-sm text-blue-700">
                  {activeReferral.visit_limit_count
                    ? `${getVisitsUsedForReferral(activeReferral.id)} / ${activeReferral.visit_limit_count} visits used`
                    : 'Unlimited visits'}
                </p>
                {/* Progress bar for visit usage */}
                {activeReferral.visit_limit_count && (
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (getVisitsUsedForReferral(activeReferral.id) / activeReferral.visit_limit_count) * 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
              {activeReferral.referral_expiration_date && (
                <Badge
                  variant="outline"
                  className={
                    new Date(activeReferral.referral_expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300'
                  }
                >
                  Expires {formatDate(activeReferral.referral_expiration_date)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{visits.length}</div>
            <p className="text-xs text-gray-500">Visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">
              {claims.filter(c => ['TO_SUBMIT', 'SUBMITTED', 'PENDING'].includes(c.status)).length}
            </div>
            <p className="text-xs text-gray-500">Pending Claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{referrals.length}</div>
            <p className="text-xs text-gray-500">Referrals</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visits" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => router.push(`/visits?patientId=${id}&action=new`)}>
              Add Visit
            </Button>
          </div>
          {visits.length > 0 ? (
            visits.map((visit) => (
              <Card key={visit.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDate(visit.visit_date, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-500">
                        {visit.is_billable_to_insurance ? 'Insurance' : 'Self-pay'}
                      </p>
                    </div>
                    {visit.referral_id && (
                      <Badge variant="outline" className="text-xs">
                        Referral
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No visits recorded yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="claims" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => router.push(`/claims?patientId=${id}&action=new`)}>
              Add Claim
            </Button>
          </div>
          {claims.length > 0 ? (
            claims.map((claim) => (
              <Card key={claim.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {claim.date_of_service
                          ? formatDate(claim.date_of_service)
                          : 'No date'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {claim.insurer_name || 'No insurer'} - ${claim.billed_amount || 0}
                      </p>
                    </div>
                    <ClaimStatusBadge status={claim.status} />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No claims yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="referrals" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Dialog open={showReferralDialog} onOpenChange={(open) => {
              setShowReferralDialog(open);
              if (!open) resetReferralForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">Add Referral</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingReferral ? 'Edit Referral' : 'Add New Referral'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Referral Label</label>
                    <Input
                      value={referralLabel}
                      onChange={(e) => setReferralLabel(e.target.value)}
                      placeholder="e.g., Dr. Smith referral"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Visit Limit Type</label>
                    <Select value={visitLimitType} onValueChange={setVisitLimitType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIT_LIMIT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {visitLimitType !== 'UNLIMITED' && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Visit Limit Count</label>
                      <Input
                        type="number"
                        value={visitLimitCount}
                        onChange={(e) => setVisitLimitCount(e.target.value)}
                        placeholder="e.g., 12"
                        className="mt-1"
                        min="1"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Start Date</label>
                      <Input
                        type="date"
                        value={referralStartDate}
                        onChange={(e) => setReferralStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Expiration Date</label>
                      <Input
                        type="date"
                        value={referralExpirationDate}
                        onChange={(e) => setReferralExpirationDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notes (non-medical)</label>
                    <textarea
                      value={referralNotes}
                      onChange={(e) => setReferralNotes(e.target.value)}
                      placeholder="Any administrative notes..."
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleSaveReferral}
                    disabled={savingReferral}
                    className="w-full"
                  >
                    {savingReferral ? 'Saving...' : (editingReferral ? 'Update Referral' : 'Add Referral')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {referrals.length > 0 ? (
            referrals.map((referral) => {
              const visitsUsed = getVisitsUsedForReferral(referral.id);
              const isExpired = referral.referral_expiration_date && new Date(referral.referral_expiration_date) < new Date();
              const isNearLimit = referral.visit_limit_count && visitsUsed >= referral.visit_limit_count * 0.8;

              return (
                <Card key={referral.id} className={isExpired ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {referral.referral_label || 'Referral'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {referral.visit_limit_type === 'UNLIMITED'
                            ? 'Unlimited visits'
                            : `${visitsUsed} / ${referral.visit_limit_count || '?'} visits used`}
                        </p>
                        {referral.referral_start_date && (
                          <p className="text-xs text-gray-400 mt-1">
                            Started {formatDate(referral.referral_start_date)}
                            {referral.referral_expiration_date && (
                              <> - Expires {formatDate(referral.referral_expiration_date)}</>
                            )}
                          </p>
                        )}
                        {/* Progress bar */}
                        {referral.visit_limit_count && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (visitsUsed / referral.visit_limit_count) * 100)}%`
                              }}
                            />
                          </div>
                        )}
                        {referral.notes && (
                          <p className="text-xs text-gray-500 mt-2 italic">{referral.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isExpired
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }
                        >
                          {isExpired ? 'Expired' : 'Active'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => openEditReferral(referral)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <p className="mb-4">No referrals on file</p>
                <Button onClick={() => setShowReferralDialog(true)}>Add First Referral</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total: ${payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
              </p>
            </div>
            <Dialog open={showPaymentDialog} onOpenChange={(open) => {
              setShowPaymentDialog(open);
              if (open) resetPaymentForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">Log Payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Payment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Amount *</label>
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
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
                      id="is-copay"
                      checked={paymentIsCopay}
                      onChange={(e) => setPaymentIsCopay(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="is-copay" className="text-sm text-gray-700">
                      This is a copay
                    </label>
                  </div>
                  <Button
                    onClick={handleSavePayment}
                    disabled={savingPayment || !paymentAmount}
                    className="w-full"
                  >
                    {savingPayment ? 'Saving...' : 'Log Payment'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {payments.length > 0 ? (
            payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        ${payment.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(payment.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {PAYMENT_METHODS.find(m => m.value === payment.method)?.label || payment.method}
                      </Badge>
                      {payment.is_copay && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          Copay
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <p className="mb-4">No payments recorded yet</p>
                <Button onClick={() => setShowPaymentDialog(true)}>Log First Payment</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    TO_SUBMIT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
    DENIED: 'bg-red-100 text-red-800',
    APPEAL: 'bg-purple-100 text-purple-800',
  };

  const labels: Record<string, string> = {
    TO_SUBMIT: 'To Submit',
    SUBMITTED: 'Submitted',
    PENDING: 'Pending',
    PAID: 'Paid',
    DENIED: 'Denied',
    APPEAL: 'Appeal',
  };

  return (
    <Badge variant="outline" className={styles[status] || 'bg-gray-100'}>
      {labels[status] || status}
    </Badge>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
