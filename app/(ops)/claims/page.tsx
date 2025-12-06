'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/date-utils';
import type { PatientNonPhi, ClaimNonPhi, ClaimStatus, Portal } from '@/lib/types-ops';
import { LoadingSpinner, PageLoading } from '@/components/ui/loading-spinner';
import { usePracticeConfig } from '@/lib/practice-config';
import { useFeatureFlags } from '@/lib/feature-flags';

interface ClaimWithPatient extends ClaimNonPhi {
  patient?: PatientNonPhi;
}

const CLAIM_STATUSES: { value: ClaimStatus; label: string; color: string }[] = [
  { value: 'TO_SUBMIT', label: 'To Submit', color: 'bg-gray-100 text-gray-800' },
  { value: 'SUBMITTED', label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PAID', label: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'DENIED', label: 'Denied', color: 'bg-red-100 text-red-800' },
  { value: 'APPEAL', label: 'Appeal', color: 'bg-purple-100 text-purple-800' },
];

// Portal badge colors - assigned dynamically based on index
const PORTAL_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-green-50 text-green-700 border-green-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-orange-50 text-orange-700 border-orange-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-lime-50 text-lime-700 border-lime-200',
];

// Default portals to seed if none exist
const DEFAULT_PORTALS = [
  { name: 'Office Ally', url: 'https://www.officeally.com', sort_order: 1 },
  { name: 'Availity', url: 'https://www.availity.com', sort_order: 2 },
  { name: 'One Health Port', url: 'https://www.onehealthport.com', sort_order: 3 },
  { name: 'Premera', url: 'https://www.premera.com/provider', sort_order: 4 },
  { name: 'Regence', url: 'https://www.regence.com/provider', sort_order: 5 },
  { name: 'Aetna', url: 'https://www.aetna.com/providers', sort_order: 6 },
  { name: 'UnitedHealthcare', url: 'https://www.uhcprovider.com', sort_order: 7 },
  { name: 'Cigna', url: 'https://www.cigna.com/providers', sort_order: 8 },
  { name: 'Molina', url: 'https://www.molinahealthcare.com/providers', sort_order: 9 },
  { name: 'Blue Cross', url: 'https://www.bluecross.com', sort_order: 10 },
];

function getPortalColor(portalName: string, portals: Portal[]): string {
  const index = portals.findIndex(p => p.name === portalName);
  if (index >= 0) {
    return PORTAL_COLORS[index % PORTAL_COLORS.length];
  }
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

function ClaimsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('action') === 'new';
  const preselectedPatientId = searchParams.get('patientId');

  // Check if claims are enabled for this practice type and feature flag
  const { features } = usePracticeConfig();
  const { flags: featureFlags } = useFeatureFlags();

  // Redirect if claims are disabled (by practice type or feature flag)
  useEffect(() => {
    if (!features.showClaims || !featureFlags.feature_claims_tracking) {
      router.replace('/dashboard');
    }
  }, [features.showClaims, featureFlags.feature_claims_tracking, router]);

  const [claims, setClaims] = useState<ClaimWithPatient[]>([]);
  const [patients, setPatients] = useState<PatientNonPhi[]>([]);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(showNewForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [portalFilter, setPortalFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'portal'>('list');

  // Form state for new claim
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId || '');
  const [dateOfService, setDateOfService] = useState(new Date().toISOString().split('T')[0]);
  const [insurerName, setInsurerName] = useState('');
  const [portalName, setPortalName] = useState('');
  const [billedAmount, setBilledAmount] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  // Mark Paid dialog state
  const [showPaidDialog, setShowPaidDialog] = useState(false);
  const [claimToPay, setClaimToPay] = useState<ClaimWithPatient | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [savingPaid, setSavingPaid] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's practice_id for portals
    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_id')
      .eq('id', user.id)
      .single();

    // Run queries in parallel for faster loading
    const [claimsResult, patientsResult, portalsResult] = await Promise.all([
      supabase
        .from('claims_non_phi')
        .select('*, patient:patients_non_phi(id, display_name, insurer_name)')
        .eq('owner_user_id', user.id)
        .order('date_of_service', { ascending: false }),
      supabase
        .from('patients_non_phi')
        .select('*')
        .eq('owner_user_id', user.id)
        .eq('is_active', true)
        .order('display_name'),
      profile?.practice_id
        ? supabase
            .from('portals')
            .select('*')
            .eq('practice_id', profile.practice_id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: null }),
    ]);

    setClaims((claimsResult.data as ClaimWithPatient[]) || []);
    setPatients((patientsResult.data as PatientNonPhi[]) || []);

    // If no portals exist, seed defaults
    let portalsData = portalsResult.data as Portal[] | null;
    if (profile?.practice_id && (!portalsData || portalsData.length === 0)) {
      console.log('No portals found in claims page, seeding defaults for practice:', profile.practice_id);
      const defaultPortalsWithPractice = DEFAULT_PORTALS.map(p => ({
        ...p,
        practice_id: profile.practice_id,
        is_active: true,
      }));

      const { error: seedError } = await supabase
        .from('portals')
        .insert(defaultPortalsWithPractice);

      if (!seedError) {
        // Re-fetch portals after seeding
        const { data: refreshedPortals } = await supabase
          .from('portals')
          .select('*')
          .eq('practice_id', profile.practice_id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        portalsData = refreshedPortals;
      }
    }

    setPortals(portalsData || []);
    setLoading(false);
  };

  // Load data on mount and when page becomes visible
  useEffect(() => {
    // Only load data if claims are enabled
    if (features.showClaims) {
      loadData();
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && features.showClaims) {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [features.showClaims]);

  // Don't render anything while redirecting (after all hooks)
  if (!features.showClaims) {
    return <LoadingSpinner text="Redirecting..." />;
  }

  const handleAddClaim = async () => {
    if (!selectedPatientId || !dateOfService) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const patient = patients.find(p => p.id === selectedPatientId);

    const { error } = await supabase.from('claims_non_phi').insert({
      owner_user_id: user.id,
      patient_id: selectedPatientId,
      date_of_service: dateOfService,
      insurer_name: insurerName || patient?.insurer_name || null,
      portal_name: portalName || null,
      billed_amount: billedAmount ? parseFloat(billedAmount) : null,
      notes: claimNotes.trim() || null,
      status: 'TO_SUBMIT',
    });

    if (!error) {
      setShowDialog(false);
      setSelectedPatientId('');
      setDateOfService(new Date().toISOString().split('T')[0]);
      setInsurerName('');
      setPortalName('');
      setBilledAmount('');
      setClaimNotes('');
      loadData();
      router.refresh();
      router.replace('/claims');
    }
    setSaving(false);
  };

  const handleStatusChange = async (claimId: string, newStatus: ClaimStatus) => {
    const supabase = createClient();
    const updates: Partial<ClaimNonPhi> = { status: newStatus };

    if (newStatus === 'SUBMITTED') {
      updates.date_submitted = new Date().toISOString().split('T')[0];
    }
    // Note: PAID status is handled by handleMarkPaid with paid_amount dialog

    await supabase
      .from('claims_non_phi')
      .update(updates)
      .eq('id', claimId);

    loadData();
    router.refresh();
  };

  // Open the Mark Paid dialog
  const openMarkPaidDialog = (claim: ClaimWithPatient) => {
    setClaimToPay(claim);
    setPaidAmount(claim.billed_amount?.toString() || '');
    setShowPaidDialog(true);
  };

  // Handle marking claim as paid with actual paid amount
  const handleMarkPaid = async () => {
    if (!claimToPay || !paidAmount) return;

    setSavingPaid(true);
    const supabase = createClient();

    // Try to update with paid_amount first
    let { error } = await supabase
      .from('claims_non_phi')
      .update({
        status: 'PAID',
        date_paid: new Date().toISOString().split('T')[0],
        paid_amount: parseFloat(paidAmount),
      })
      .eq('id', claimToPay.id);

    // If paid_amount column doesn't exist, try without it
    if (error && (error.message?.includes('paid_amount') || error.code === 'PGRST204')) {
      console.log('paid_amount column not found, updating without it');
      const result = await supabase
        .from('claims_non_phi')
        .update({
          status: 'PAID',
          date_paid: new Date().toISOString().split('T')[0],
        })
        .eq('id', claimToPay.id);
      error = result.error;
    }

    if (error) {
      console.error('Error marking claim as paid:', error);
      alert('Failed to mark claim as paid. Please try again.');
      setSavingPaid(false);
      return;
    }

    setShowPaidDialog(false);
    setClaimToPay(null);
    setPaidAmount('');
    setSavingPaid(false);
    loadData();
    router.refresh();
  };

  const pendingClaims = claims.filter(c => ['TO_SUBMIT', 'SUBMITTED', 'PENDING', 'APPEAL'].includes(c.status));
  const completedClaims = claims.filter(c => ['PAID', 'DENIED'].includes(c.status));

  // Filter by portal
  const filterByPortal = (claimsList: ClaimWithPatient[]) => {
    if (portalFilter === 'all') return claimsList;
    if (portalFilter === 'unassigned') return claimsList.filter(c => !c.portal_name);
    return claimsList.filter(c => c.portal_name === portalFilter);
  };

  // Group by portal
  const groupByPortal = (claimsList: ClaimWithPatient[]) => {
    const groups: Record<string, ClaimWithPatient[]> = {};

    claimsList.forEach(claim => {
      const portal = claim.portal_name || 'UNASSIGNED';
      if (!groups[portal]) groups[portal] = [];
      groups[portal].push(claim);
    });

    return groups;
  };

  // Get portals that have pending claims (for "Check Today" indicator)
  const portalsWithPendingClaims = Array.from(new Set(pendingClaims.filter(c => c.portal_name).map(c => c.portal_name)));

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claims</h1>
          <p className="text-gray-500 text-sm">
            {pendingClaims.length} pending - ${pendingClaims.reduce((sum, c) => sum + (c.billed_amount || 0), 0).toLocaleString()}
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>New Claim</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Claim</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Patient *</label>
                <Select value={selectedPatientId} onValueChange={(value) => {
                  setSelectedPatientId(value);
                  const patient = patients.find(p => p.id === value);
                  if (patient?.insurer_name) setInsurerName(patient.insurer_name);
                }}>
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
                <label className="text-sm font-medium text-gray-700">Date of Service *</label>
                <Input
                  type="date"
                  value={dateOfService}
                  onChange={(e) => setDateOfService(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Insurance</label>
                <Input
                  value={insurerName}
                  onChange={(e) => setInsurerName(e.target.value)}
                  placeholder="e.g., Blue Cross"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Portal</label>
                <Select value={portalName} onValueChange={setPortalName}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select portal" />
                  </SelectTrigger>
                  <SelectContent>
                    {portals.length > 0 ? (
                      portals.map((portal) => (
                        <SelectItem key={portal.id} value={portal.name}>
                          {portal.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="Other" disabled>
                        No portals configured
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {portals.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Configure portals in Settings
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Billed Amount</label>
                <Input
                  type="number"
                  value={billedAmount}
                  onChange={(e) => setBilledAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="Any notes about this claim..."
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <Button
                onClick={handleAddClaim}
                disabled={saving || !selectedPatientId || !dateOfService}
                className="w-full"
              >
                {saving ? 'Creating...' : 'Create Claim'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Mark Paid Dialog */}
      <Dialog open={showPaidDialog} onOpenChange={setShowPaidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Claim as Paid</DialogTitle>
          </DialogHeader>
          {claimToPay && (
            <div className="space-y-4 pt-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{claimToPay.patient?.display_name}</p>
                <p className="text-sm text-gray-500">
                  {claimToPay.date_of_service ? formatDate(claimToPay.date_of_service) : 'No date'}
                  {claimToPay.insurer_name && ` - ${claimToPay.insurer_name}`}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Billed: ${claimToPay.billed_amount?.toFixed(2) || '0.00'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Amount Paid by Insurance *
                </label>
                <p className="text-xs text-gray-500 mb-1">
                  Enter the actual amount received (may differ from billed amount)
                </p>
                <Input
                  type="number"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>

              {claimToPay.billed_amount && paidAmount && parseFloat(paidAmount) !== claimToPay.billed_amount && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-800">
                    Adjustment: ${(claimToPay.billed_amount - parseFloat(paidAmount)).toFixed(2)}
                  </p>
                  <p className="text-xs text-amber-600">
                    Difference between billed (${claimToPay.billed_amount.toFixed(2)}) and paid (${parseFloat(paidAmount).toFixed(2)})
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPaidDialog(false);
                    setClaimToPay(null);
                    setPaidAmount('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleMarkPaid}
                  disabled={savingPaid || !paidAmount}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {savingPaid ? 'Saving...' : 'Mark as Paid'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Portals to Check Today */}
      {portalsWithPendingClaims.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Portals to Check Today</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {portalsWithPendingClaims.map(portalName => {
                const count = pendingClaims.filter(c => c.portal_name === portalName).length;
                const portalColor = getPortalColor(portalName || '', portals);
                return (
                  <Badge
                    key={portalName}
                    variant="outline"
                    className={`cursor-pointer ${portalColor}`}
                    onClick={() => {
                      setPortalFilter(portalName || 'all');
                      setActiveTab('pending');
                    }}
                  >
                    {portalName} ({count})
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View toggle and Portal filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'portal' ? 'default' : 'outline'}
            onClick={() => setViewMode('portal')}
          >
            By Portal
          </Button>
        </div>
        {viewMode === 'list' && (
          <Select value={portalFilter} onValueChange={setPortalFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Portals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Portals</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {portals.map((portal) => (
                <SelectItem key={portal.id} value={portal.name}>
                  {portal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {viewMode === 'list' ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">
              Pending ({filterByPortal(pendingClaims).length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({filterByPortal(completedClaims).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {loading ? (
              <LoadingSpinner text="Loading claims..." />
            ) : filterByPortal(pendingClaims).length > 0 ? (
              filterByPortal(pendingClaims).map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  onStatusChange={handleStatusChange}
                  onMarkPaid={openMarkPaidDialog}
                  portals={portals}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No pending claims {portalFilter !== 'all' && 'for this portal'}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3 mt-4">
            {filterByPortal(completedClaims).length > 0 ? (
              filterByPortal(completedClaims).map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  onStatusChange={handleStatusChange}
                  onMarkPaid={openMarkPaidDialog}
                  portals={portals}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No completed claims {portalFilter !== 'all' && 'for this portal'}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        // Portal grouped view
        <div className="space-y-6">
          {Object.entries(groupByPortal(pendingClaims)).map(([portal, portalClaims]) => {
            const portalColor = getPortalColor(portal === 'UNASSIGNED' ? '' : portal, portals);
            return (
              <Card key={portal}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Badge variant="outline" className={portalColor}>
                        {portal === 'UNASSIGNED' ? 'Unassigned' : portal}
                      </Badge>
                      <span className="text-gray-500 font-normal">
                        {portalClaims.length} claim{portalClaims.length !== 1 ? 's' : ''}
                      </span>
                    </CardTitle>
                    <span className="text-sm font-semibold text-gray-700">
                      ${portalClaims.reduce((sum, c) => sum + (c.billed_amount || 0), 0).toLocaleString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {portalClaims.map((claim) => (
                    <ClaimCard
                      key={claim.id}
                      claim={claim}
                      onStatusChange={handleStatusChange}
                      onMarkPaid={openMarkPaidDialog}
                      portals={portals}
                      compact
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
          {Object.keys(groupByPortal(pendingClaims)).length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No pending claims
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to calculate days pending
function getDaysPending(claim: ClaimWithPatient): number | null {
  if (!['SUBMITTED', 'PENDING', 'APPEAL'].includes(claim.status)) return null;
  const submittedDate = claim.date_submitted;
  if (!submittedDate) return null;
  const today = new Date();
  const submitted = new Date(submittedDate);
  const diffTime = today.getTime() - submitted.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function ClaimCard({
  claim,
  onStatusChange,
  onMarkPaid,
  portals,
  compact = false,
  thresholdDays = 21,
}: {
  claim: ClaimWithPatient;
  onStatusChange: (id: string, status: ClaimStatus) => void;
  onMarkPaid: (claim: ClaimWithPatient) => void;
  portals: Portal[];
  compact?: boolean;
  thresholdDays?: number;
}) {
  const statusConfig = CLAIM_STATUSES.find(s => s.value === claim.status);
  const portalColor = getPortalColor(claim.portal_name || '', portals);
  const daysPending = getDaysPending(claim);
  const isOverdue = daysPending !== null && daysPending >= thresholdDays;

  // For paid claims, show the actual paid amount
  const isPaid = claim.status === 'PAID';
  const displayAmount = isPaid && claim.paid_amount != null ? claim.paid_amount : claim.billed_amount;
  const hasAdjustment = isPaid && claim.paid_amount != null && claim.billed_amount != null && claim.paid_amount !== claim.billed_amount;

  return (
    <Card className={`${compact ? 'border-gray-100' : ''} ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-medium text-gray-900">
              {claim.patient?.display_name || 'Unknown'}
            </p>
            <p className="text-sm text-gray-500">
              {claim.date_of_service
                ? formatDate(claim.date_of_service)
                : 'No date'}
              {claim.insurer_name && ` - ${claim.insurer_name}`}
            </p>
            {daysPending !== null && (
              <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                {isOverdue ? '⚠️ ' : ''}{daysPending} day{daysPending !== 1 ? 's' : ''} pending
              </p>
            )}
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <p className={`font-semibold ${isPaid ? 'text-green-600' : ''}`}>
              ${displayAmount?.toFixed(2) || '0.00'}
            </p>
            {hasAdjustment && (
              <p className="text-xs text-gray-400 line-through">
                Billed: ${claim.billed_amount?.toFixed(2)}
              </p>
            )}
            <div className="flex gap-1">
              {!compact && claim.portal_name && (
                <Badge variant="outline" className={`text-xs ${portalColor}`}>
                  {claim.portal_name}
                </Badge>
              )}
              <Badge variant="outline" className={statusConfig?.color}>
                {statusConfig?.label || claim.status}
              </Badge>
            </div>
          </div>
        </div>

        {claim.notes && (
          <p className="text-xs text-gray-500 italic mb-2">{claim.notes}</p>
        )}

        {/* Quick status actions */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {claim.status === 'TO_SUBMIT' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(claim.id, 'SUBMITTED')}
            >
              Mark Submitted
            </Button>
          )}
          {claim.status === 'SUBMITTED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(claim.id, 'PENDING')}
            >
              Mark Pending
            </Button>
          )}
          {['SUBMITTED', 'PENDING'].includes(claim.status) && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600"
                onClick={() => onMarkPaid(claim)}
              >
                Mark Paid
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600"
                onClick={() => onStatusChange(claim.id, 'DENIED')}
              >
                Denied
              </Button>
            </>
          )}
          {claim.status === 'DENIED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(claim.id, 'APPEAL')}
            >
              File Appeal
            </Button>
          )}
          {claim.status === 'APPEAL' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600"
                onClick={() => onMarkPaid(claim)}
              >
                Appeal Won - Paid
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600"
                onClick={() => onStatusChange(claim.id, 'DENIED')}
              >
                Appeal Denied
              </Button>
            </>
          )}
          {claim.status === 'PAID' && (
            <span className="text-xs text-green-600 italic flex items-center gap-1">
              <CheckIcon className="w-3 h-3" />
              Paid {claim.date_paid ? formatDate(claim.date_paid) : ''}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={<PageLoading text="Loading claims..." />}>
      <ClaimsContent />
    </Suspense>
  );
}
