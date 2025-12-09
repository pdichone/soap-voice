'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLocalDateString, formatDate } from '@/lib/date-utils';
import type { PatientNonPhi, VisitNonPhi, PatientBenefits, CollectionResult, ReferralNonPhi } from '@/lib/types-ops';
import { formatDate as formatDateShort } from '@/lib/date-utils';
import { LoadingSpinner, PageLoading } from '@/components/ui/loading-spinner';
import { ALL_PAYMENT_METHODS, usePracticeConfig } from '@/lib/practice-config';
import { getCollectAmount } from '@/lib/benefits-calculator';
import { useToast } from '@/lib/toast-context';
import { DateFilterPills, isDateInRange } from '@/components/ops/DateFilterPills';

interface VisitWithPatient extends VisitNonPhi {
  patient?: PatientNonPhi;
}

interface PatientWithReferral extends PatientNonPhi {
  activeReferralId?: string | null;
  benefits?: PatientBenefits | null;
}

// Referral with computed visit usage info
interface ReferralWithUsage extends ReferralNonPhi {
  visitsUsed: number;
  visitsRemaining: number | null; // null = unlimited
  isExpired: boolean;
  isExhausted: boolean;
}

function VisitsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('action') === 'new';
  const preselectedPatientId = searchParams.get('patientId');
  const { showToast } = useToast();

  // Get practice config for terminology
  const { practiceType } = usePracticeConfig();
  const isCashOnly = practiceType === 'cash_only';

  // Dynamic terminology
  const visitLabel = isCashOnly ? 'Session' : 'Visit';
  const visitLabelPlural = isCashOnly ? 'Sessions' : 'Visits';
  const clientLabel = isCashOnly ? 'Client' : 'Patient';

  const [visits, setVisits] = useState<VisitWithPatient[]>([]);
  const [patients, setPatients] = useState<PatientWithReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(showNewForm);
  const [saving, setSaving] = useState(false);

  // Referral state
  const [allReferrals, setAllReferrals] = useState<ReferralWithUsage[]>([]);

  // Form state for visit
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId || '');
  const [selectedReferralId, setSelectedReferralId] = useState<string>('');
  const [visitDate, setVisitDate] = useState(getLocalDateString());
  const [isBillable, setIsBillable] = useState(true);

  // Payment prompt state (copay for insurance, full payment for cash-only)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [newVisitId, setNewVisitId] = useState<string | null>(null);
  const [paymentPatient, setPaymentPatient] = useState<PatientWithReferral | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [savingPayment, setSavingPayment] = useState(false);
  const [collectionResult, setCollectionResult] = useState<CollectionResult | null>(null);

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

  // React to URL parameter changes (e.g., from FAB navigation)
  useEffect(() => {
    const action = searchParams.get('action');
    const patientIdParam = searchParams.get('patientId');

    if (action === 'new') {
      // If navigating with a patientId, preselect that patient
      if (patientIdParam && patientIdParam !== selectedPatientId) {
        setSelectedPatientId(patientIdParam);
        // Auto-select best referral for this patient
        const bestReferral = allReferrals
          .filter(r => r.patient_id === patientIdParam && !r.isExpired && !r.isExhausted)
          .sort((a, b) => {
            const dateA = a.referral_start_date ? new Date(a.referral_start_date).getTime() : 0;
            const dateB = b.referral_start_date ? new Date(b.referral_start_date).getTime() : 0;
            return dateA - dateB;
          })[0];
        if (bestReferral) {
          setSelectedReferralId(bestReferral.id);
        }
      }
      setShowDialog(true);
    }
  }, [searchParams, allReferrals]);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = getLocalDateString();

    // Run all queries in parallel for faster loading
    const [visitsResult, patientsResult, referralsResult, benefitsResult] = await Promise.all([
      supabase
        .from('visits_non_phi')
        .select('*, patient:patients_non_phi(id, display_name)')
        .eq('owner_user_id', user.id)
        .order('visit_date', { ascending: false })
        .limit(50),
      supabase
        .from('patients_non_phi')
        .select('*')
        .eq('owner_user_id', user.id)
        .eq('is_active', true)
        .order('display_name'),
      supabase
        .from('referrals_non_phi')
        .select('*')
        .eq('owner_user_id', user.id)
        .or(`referral_expiration_date.is.null,referral_expiration_date.gte.${today}`)
        .order('referral_start_date', { ascending: false }),
      supabase
        .from('patient_benefits')
        .select('*')
        .eq('owner_user_id', user.id),
    ]);

    const allVisits = visitsResult.data || [];
    setVisits(allVisits);

    // Compute visit counts per referral
    const visitCountByReferral: Record<string, number> = {};
    allVisits.forEach(v => {
      if (v.referral_id) {
        visitCountByReferral[v.referral_id] = (visitCountByReferral[v.referral_id] || 0) + 1;
      }
    });

    // Process referrals with usage info
    const referralsWithUsage: ReferralWithUsage[] = (referralsResult.data || []).map(ref => {
      const visitsUsed = visitCountByReferral[ref.id] || 0;
      const isUnlimited = ref.visit_limit_type === 'UNLIMITED';
      const visitsRemaining = isUnlimited ? null : (ref.visit_limit_count || 0) - visitsUsed;
      const isExpired = ref.referral_expiration_date
        ? new Date(ref.referral_expiration_date) < new Date(today)
        : false;
      const isExhausted = !isUnlimited && visitsRemaining !== null && visitsRemaining <= 0;

      return {
        ...ref,
        visitsUsed,
        visitsRemaining,
        isExpired,
        isExhausted,
      };
    });

    setAllReferrals(referralsWithUsage);

    // Associate each patient with their "best" active referral (oldest usable) and benefits
    const patientsWithReferrals = (patientsResult.data || []).map(patient => {
      // Find best referral: oldest non-expired, non-exhausted referral for this patient
      const patientReferrals = referralsWithUsage
        .filter(r => r.patient_id === patient.id && !r.isExpired && !r.isExhausted)
        .sort((a, b) => {
          // Sort by start date ascending (oldest first = FIFO)
          const dateA = a.referral_start_date ? new Date(a.referral_start_date).getTime() : 0;
          const dateB = b.referral_start_date ? new Date(b.referral_start_date).getTime() : 0;
          return dateA - dateB;
        });

      const bestReferral = patientReferrals[0] || null;
      const patientBenefits = (benefitsResult.data || []).find(b => b.patient_id === patient.id);

      return {
        ...patient,
        activeReferralId: bestReferral?.id || null,
        benefits: patientBenefits || null,
      };
    });

    setPatients(patientsWithReferrals);
    setLoading(false);

    // Auto-select best referral for preselected patient (from URL param)
    if (preselectedPatientId && !selectedReferralId) {
      const bestReferral = referralsWithUsage
        .filter(r => r.patient_id === preselectedPatientId && !r.isExpired && !r.isExhausted)
        .sort((a, b) => {
          const dateA = a.referral_start_date ? new Date(a.referral_start_date).getTime() : 0;
          const dateB = b.referral_start_date ? new Date(b.referral_start_date).getTime() : 0;
          return dateA - dateB;
        })[0];
      if (bestReferral) {
        setSelectedReferralId(bestReferral.id);
      }
    }
  };

  // Get referrals for the selected patient (for the dropdown)
  const getPatientReferrals = (patientId: string): ReferralWithUsage[] => {
    return allReferrals
      .filter(r => r.patient_id === patientId)
      .sort((a, b) => {
        // Put usable referrals first, then sort by start date (oldest first)
        const aUsable = !a.isExpired && !a.isExhausted ? 0 : 1;
        const bUsable = !b.isExpired && !b.isExhausted ? 0 : 1;
        if (aUsable !== bUsable) return aUsable - bUsable;

        const dateA = a.referral_start_date ? new Date(a.referral_start_date).getTime() : 0;
        const dateB = b.referral_start_date ? new Date(b.referral_start_date).getTime() : 0;
        return dateA - dateB;
      });
  };

  // Get the "best" referral for a patient (oldest usable)
  const getBestReferralForPatient = (patientId: string): ReferralWithUsage | null => {
    const patientReferrals = getPatientReferrals(patientId);
    return patientReferrals.find(r => !r.isExpired && !r.isExhausted) || null;
  };

  // Format referral display label
  const formatReferralLabel = (ref: ReferralWithUsage): string => {
    const label = ref.physician_name || ref.referral_label || 'Referral';
    const visits = ref.visit_limit_type === 'UNLIMITED'
      ? '∞ visits'
      : `${ref.visitsUsed}/${ref.visit_limit_count} used`;
    const expiry = ref.referral_expiration_date
      ? ` · exp ${formatDateShort(ref.referral_expiration_date)}`
      : '';
    const status = ref.isExpired ? ' [EXPIRED]' : ref.isExhausted ? ' [EXHAUSTED]' : '';
    return `${label} (${visits}${expiry})${status}`;
  };

  // Handle patient selection - auto-select best referral
  const handlePatientChange = (patientId: string) => {
    setSelectedPatientId(patientId);
    // Auto-select the best referral for this patient
    const bestReferral = getBestReferralForPatient(patientId);
    setSelectedReferralId(bestReferral?.id || '');
  };

  const handleAddVisit = async () => {
    if (!selectedPatientId || !visitDate) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Find the selected patient
    const patient = patients.find(p => p.id === selectedPatientId);

    // Use the explicitly selected referral (or null if none/"no-referral" selected)
    const referralIdToUse = selectedReferralId && selectedReferralId !== 'no-referral'
      ? selectedReferralId
      : null;

    const { data: visitData, error } = await supabase.from('visits_non_phi').insert({
      owner_user_id: user.id,
      patient_id: selectedPatientId,
      referral_id: referralIdToUse,
      visit_date: visitDate,
      is_billable_to_insurance: isBillable,
    }).select().single();

    if (!error && visitData) {
      // Close visit dialog
      setShowDialog(false);

      // Set up payment prompt
      setNewVisitId(visitData.id);
      setPaymentPatient(patient || null);

      // Calculate collection amount using benefits calculator (for insurance practices)
      // For cash-only or patients without benefits, fall back to default amount
      if (!isCashOnly && patient?.benefits) {
        const collection = getCollectAmount(patient, patient.benefits);
        setCollectionResult(collection);
        setPaymentAmount(collection.collect_amount.toFixed(2));
      } else {
        setCollectionResult(null);
        // Use default copay amount if available (can be repurposed as session rate for cash-only)
        setPaymentAmount(patient?.default_copay_amount?.toString() || '');
      }
      setPaymentMethod('CASH');

      // Check if the visit was added for today
      const today = getLocalDateString();
      const wasAddedForToday = visitDate === today;

      // Reset visit form
      setSelectedPatientId('');
      setSelectedReferralId('');
      setVisitDate(getLocalDateString());
      setIsBillable(true);

      // If added for today, switch to "Today" filter so user sees it immediately
      if (wasAddedForToday) {
        setDateFilter('today');
      }

      // Reload data and show payment prompt
      await loadData();
      router.refresh();
      router.replace('/visits');
      setShowPaymentDialog(true);
    }
    setSaving(false);
  };

  const handleLogPayment = async () => {
    if (!paymentAmount || !newVisitId || !paymentPatient) return;

    setSavingPayment(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('payments_non_phi').insert({
      owner_user_id: user.id,
      patient_id: paymentPatient.id,
      visit_id: newVisitId,
      amount: parseFloat(paymentAmount),
      method: paymentMethod,
      // Only mark as copay for insurance practices
      is_copay: !isCashOnly,
    });

    if (!error) {
      setShowPaymentDialog(false);
      setNewVisitId(null);
      setPaymentPatient(null);
      setPaymentAmount('');
      setPaymentMethod('CASH');
      setCollectionResult(null);
      showToast(`$${parseFloat(paymentAmount).toFixed(2)} payment collected`);
      loadData();
      router.refresh();
    } else {
      showToast('Failed to log payment', 'error');
    }
    setSavingPayment(false);
  };

  const handleSkipPayment = () => {
    setShowPaymentDialog(false);
    setNewVisitId(null);
    setPaymentPatient(null);
    setPaymentAmount('');
    setPaymentMethod('CASH');
    setCollectionResult(null);
  };

  // Filter and group visits by date
  const filteredVisits = visits.filter(visit => isDateInRange(visit.visit_date, dateFilter));
  const groupedVisits = filteredVisits.reduce((acc, visit) => {
    const date = visit.visit_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(visit);
    return acc;
  }, {} as Record<string, VisitWithPatient[]>);

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{visitLabelPlural}</h1>
          <p className="text-gray-500 text-sm">
            {dateFilter === 'all'
              ? `${visits.length} total ${visitLabelPlural.toLowerCase()}`
              : `${filteredVisits.length} of ${visits.length} ${visitLabelPlural.toLowerCase()}`}
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>Add {visitLabel}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log New {visitLabel}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">{clientLabel} *</label>
                <Select value={selectedPatientId} onValueChange={handlePatientChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={`Select ${clientLabel.toLowerCase()}`} />
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

              {/* Referral dropdown - only for insurance practices when patient has referrals */}
              {!isCashOnly && selectedPatientId && getPatientReferrals(selectedPatientId).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Referral</label>
                  <Select value={selectedReferralId} onValueChange={setSelectedReferralId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select referral (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-referral">
                        <span className="text-gray-500">No referral (self-pay)</span>
                      </SelectItem>
                      {getPatientReferrals(selectedPatientId).map((ref) => (
                        <SelectItem
                          key={ref.id}
                          value={ref.id}
                          disabled={ref.isExpired || ref.isExhausted}
                        >
                          <span className={ref.isExpired || ref.isExhausted ? 'text-gray-400' : ''}>
                            {formatReferralLabel(ref)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedReferralId && selectedReferralId !== 'no-referral' && (() => {
                    const selectedRef = allReferrals.find(r => r.id === selectedReferralId);
                    if (selectedRef && !selectedRef.isExpired && !selectedRef.isExhausted) {
                      return (
                        <p className="text-xs text-green-600 mt-1">
                          {selectedRef.visit_limit_type === 'UNLIMITED'
                            ? 'Unlimited visits available'
                            : `${selectedRef.visitsRemaining} visits remaining`}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">{visitLabel} Date *</label>
                <Input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              {/* Only show billable checkbox for insurance practices */}
              {!isCashOnly && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="billable"
                    checked={isBillable}
                    onChange={(e) => setIsBillable(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="billable" className="text-sm text-gray-700">
                    Billable to insurance
                  </label>
                </div>
              )}
              <Button
                onClick={handleAddVisit}
                disabled={saving || !selectedPatientId || !visitDate}
                className="w-full"
              >
                {saving ? 'Adding...' : `Add ${visitLabel}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Prompt Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{visitLabel} Logged!</DialogTitle>
              <DialogDescription>
                {isCashOnly
                  ? `Collect payment from ${paymentPatient?.display_name}?`
                  : `Collect from ${paymentPatient?.display_name}?`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Show collection explanation for insurance patients with benefits */}
              {!isCashOnly && collectionResult && (
                <div className={`rounded-lg p-3 text-sm ${
                  collectionResult.collect_amount === 0
                    ? 'bg-green-50 text-green-800'
                    : collectionResult.deductible_met
                      ? 'bg-blue-50 text-blue-800'
                      : 'bg-amber-50 text-amber-800'
                }`}>
                  <p className="font-medium">{collectionResult.explanation}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {isCashOnly ? 'Payment Amount' : 'Collect Amount'}
                </label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSkipPayment}
                  className="flex-1"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleLogPayment}
                  disabled={savingPayment || !paymentAmount}
                  className="flex-1"
                >
                  {savingPayment ? 'Saving...' : 'Log Payment'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Date Filter Pills */}
      {visits.length > 0 && (
        <DateFilterPills value={dateFilter} onChange={setDateFilter} />
      )}

      {/* Visit/Session List */}
      {loading ? (
        <LoadingSpinner text={`Loading ${visitLabelPlural.toLowerCase()}...`} />
      ) : Object.keys(groupedVisits).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedVisits).map(([date, dateVisits]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                {formatDate(date, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
              <div className="space-y-2">
                {dateVisits.map((visit) => (
                  <Card key={visit.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {visit.patient?.display_name || `Unknown ${clientLabel}`}
                          </p>
                        </div>
                        {/* Only show insurance badge for insurance practices */}
                        {!isCashOnly && (
                          <Badge variant="outline">
                            {visit.is_billable_to_insurance ? 'Insurance' : 'Self-pay'}
                          </Badge>
                        )}
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
              <CalendarIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to log your first {visitLabel.toLowerCase()}?</h3>
            {patients.length === 0 ? (
              <>
                <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                  First, add a {clientLabel.toLowerCase()} to get started. Then come back here to log their {visitLabelPlural.toLowerCase()}.
                </p>
                <Button variant="outline" onClick={() => router.push('/patients?action=new')}>
                  Add Your First {clientLabel}
                </Button>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                  Select a {clientLabel.toLowerCase()} and log a {visitLabel.toLowerCase()}. You&apos;ll be prompted to collect payment right after.
                </p>
                <Button onClick={() => setShowDialog(true)}>
                  Log {visitLabel}
                </Button>
              </>
            )}
            <p className="text-xs text-gray-500 mt-6">
              Tip: Use the green &quot;Add {visitLabel}&quot; button in the bottom right for quick access
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={<PageLoading text="Loading visits..." />}>
      <VisitsContent />
    </Suspense>
  );
}
