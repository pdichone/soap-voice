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
import type { PatientNonPhi, VisitNonPhi } from '@/lib/types-ops';

interface VisitWithPatient extends VisitNonPhi {
  patient?: PatientNonPhi;
}

interface PatientWithReferral extends PatientNonPhi {
  activeReferralId?: string | null;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CARD', label: 'Card' },
  { value: 'HSA', label: 'HSA/FSA' },
  { value: 'OTHER', label: 'Other' },
];

function VisitsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('action') === 'new';
  const preselectedPatientId = searchParams.get('patientId');

  const [visits, setVisits] = useState<VisitWithPatient[]>([]);
  const [patients, setPatients] = useState<PatientWithReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(showNewForm);
  const [saving, setSaving] = useState(false);

  // Form state for visit
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId || '');
  const [visitDate, setVisitDate] = useState(getLocalDateString());
  const [isBillable, setIsBillable] = useState(true);

  // Copay prompt state
  const [showCopayDialog, setShowCopayDialog] = useState(false);
  const [newVisitId, setNewVisitId] = useState<string | null>(null);
  const [copayPatient, setCopayPatient] = useState<PatientNonPhi | null>(null);
  const [copayAmount, setCopayAmount] = useState('');
  const [copayMethod, setCopayMethod] = useState('CASH');
  const [savingCopay, setSavingCopay] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load visits with patient info
    const { data: visitsData } = await supabase
      .from('visits_non_phi')
      .select('*, patient:patients_non_phi(id, display_name)')
      .eq('owner_user_id', user.id)
      .order('visit_date', { ascending: false })
      .limit(50);

    setVisits(visitsData || []);

    // Load patients for dropdown
    const { data: patientsData } = await supabase
      .from('patients_non_phi')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('is_active', true)
      .order('display_name');

    // Load all active referrals
    const today = getLocalDateString();
    const { data: referralsData } = await supabase
      .from('referrals_non_phi')
      .select('*')
      .eq('owner_user_id', user.id)
      .or(`referral_expiration_date.is.null,referral_expiration_date.gte.${today}`)
      .order('referral_start_date', { ascending: false });

    // Associate each patient with their active referral
    const patientsWithReferrals = (patientsData || []).map(patient => {
      const activeReferral = (referralsData || []).find(r => r.patient_id === patient.id);
      return {
        ...patient,
        activeReferralId: activeReferral?.id || null,
      };
    });

    setPatients(patientsWithReferrals);
    setLoading(false);
  };

  const handleAddVisit = async () => {
    if (!selectedPatientId || !visitDate) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Find the selected patient to get their active referral
    const patient = patients.find(p => p.id === selectedPatientId);

    const { data: visitData, error } = await supabase.from('visits_non_phi').insert({
      owner_user_id: user.id,
      patient_id: selectedPatientId,
      referral_id: patient?.activeReferralId || null,
      visit_date: visitDate,
      is_billable_to_insurance: isBillable,
    }).select().single();

    if (!error && visitData) {
      // Close visit dialog
      setShowDialog(false);

      // Set up copay prompt
      setNewVisitId(visitData.id);
      setCopayPatient(patient || null);
      setCopayAmount(patient?.default_copay_amount?.toString() || '');
      setCopayMethod('CASH');

      // Reset visit form
      setSelectedPatientId('');
      setVisitDate(getLocalDateString());
      setIsBillable(true);

      // Reload data and show copay prompt
      loadData();
      router.replace('/visits');
      setShowCopayDialog(true);
    }
    setSaving(false);
  };

  const handleLogCopay = async () => {
    if (!copayAmount || !newVisitId || !copayPatient) return;

    setSavingCopay(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('payments_non_phi').insert({
      owner_user_id: user.id,
      patient_id: copayPatient.id,
      visit_id: newVisitId,
      amount: parseFloat(copayAmount),
      method: copayMethod,
      is_copay: true,
    });

    if (!error) {
      setShowCopayDialog(false);
      setNewVisitId(null);
      setCopayPatient(null);
      setCopayAmount('');
      setCopayMethod('CASH');
    }
    setSavingCopay(false);
  };

  const handleSkipCopay = () => {
    setShowCopayDialog(false);
    setNewVisitId(null);
    setCopayPatient(null);
    setCopayAmount('');
    setCopayMethod('CASH');
  };

  // Group visits by date
  const groupedVisits = visits.reduce((acc, visit) => {
    const date = visit.visit_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(visit);
    return acc;
  }, {} as Record<string, VisitWithPatient[]>);

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visits</h1>
          <p className="text-gray-500 text-sm">{visits.length} total visits</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>Add Visit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log New Visit</DialogTitle>
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
                <label className="text-sm font-medium text-gray-700">Visit Date *</label>
                <Input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="mt-1"
                />
              </div>
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
              <Button
                onClick={handleAddVisit}
                disabled={saving || !selectedPatientId || !visitDate}
                className="w-full"
              >
                {saving ? 'Adding...' : 'Add Visit'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Copay Prompt Dialog */}
        <Dialog open={showCopayDialog} onOpenChange={setShowCopayDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Visit Logged!</DialogTitle>
              <DialogDescription>
                Collect copay for {copayPatient?.display_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Copay Amount</label>
                <Input
                  type="number"
                  value={copayAmount}
                  onChange={(e) => setCopayAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Payment Method</label>
                <Select value={copayMethod} onValueChange={setCopayMethod}>
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSkipCopay}
                  className="flex-1"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleLogCopay}
                  disabled={savingCopay || !copayAmount}
                  className="flex-1"
                >
                  {savingCopay ? 'Saving...' : 'Log Copay'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Visit List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
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
                            {visit.patient?.display_name || 'Unknown Patient'}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {visit.is_billable_to_insurance ? 'Insurance' : 'Self-pay'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No visits recorded yet</p>
            <Button onClick={() => setShowDialog(true)}>Log Your First Visit</Button>
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
    <Suspense fallback={<div className="p-4 text-center text-gray-500">Loading...</div>}>
      <VisitsContent />
    </Suspense>
  );
}
