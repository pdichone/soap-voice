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
import type { PatientNonPhi, ClaimNonPhi, ClaimStatus } from '@/lib/types-ops';

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

const PORTAL_OPTIONS = [
  { value: 'AVAILITY', label: 'Availity', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'OFFICE_ALLY', label: 'Office Ally', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'UHC_PORTAL', label: 'UHC Portal', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'UMR_PORTAL', label: 'UMR Portal', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'ONE_HEALTH_PORT', label: 'OneHealthPort', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'BOULDER', label: 'Boulder Admin', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'OTHER', label: 'Other', color: 'bg-gray-50 text-gray-700 border-gray-200' },
];

function ClaimsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('action') === 'new';
  const preselectedPatientId = searchParams.get('patientId');

  const [claims, setClaims] = useState<ClaimWithPatient[]>([]);
  const [patients, setPatients] = useState<PatientNonPhi[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(showNewForm);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [portalFilter, setPortalFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'portal'>('list');

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId || '');
  const [dateOfService, setDateOfService] = useState(new Date().toISOString().split('T')[0]);
  const [insurerName, setInsurerName] = useState('');
  const [portalName, setPortalName] = useState('');
  const [billedAmount, setBilledAmount] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: claimsData } = await supabase
      .from('claims_non_phi')
      .select('*, patient:patients_non_phi(id, display_name, insurer_name)')
      .eq('owner_user_id', user.id)
      .order('date_of_service', { ascending: false });

    setClaims(claimsData || []);

    const { data: patientsData } = await supabase
      .from('patients_non_phi')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('is_active', true)
      .order('display_name');

    setPatients(patientsData || []);
    setLoading(false);
  };

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
      router.replace('/claims');
    }
    setSaving(false);
  };

  const handleStatusChange = async (claimId: string, newStatus: ClaimStatus) => {
    const supabase = createClient();
    const updates: Partial<ClaimNonPhi> = { status: newStatus };

    if (newStatus === 'SUBMITTED') {
      updates.date_submitted = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'PAID') {
      updates.date_paid = new Date().toISOString().split('T')[0];
    }

    await supabase
      .from('claims_non_phi')
      .update(updates)
      .eq('id', claimId);

    loadData();
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
                    {PORTAL_OPTIONS.map((portal) => (
                      <SelectItem key={portal.value} value={portal.value}>
                        {portal.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* Portals to Check Today */}
      {portalsWithPendingClaims.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Portals to Check Today</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {portalsWithPendingClaims.map(portal => {
                const portalConfig = PORTAL_OPTIONS.find(p => p.value === portal);
                const count = pendingClaims.filter(c => c.portal_name === portal).length;
                return (
                  <Badge
                    key={portal}
                    variant="outline"
                    className={`cursor-pointer ${portalConfig?.color || ''}`}
                    onClick={() => {
                      setPortalFilter(portal || 'all');
                      setActiveTab('pending');
                    }}
                  >
                    {portalConfig?.label || portal} ({count})
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
              {PORTAL_OPTIONS.map((portal) => (
                <SelectItem key={portal.value} value={portal.value}>
                  {portal.label}
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
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : filterByPortal(pendingClaims).length > 0 ? (
              filterByPortal(pendingClaims).map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  onStatusChange={handleStatusChange}
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
            const portalConfig = PORTAL_OPTIONS.find(p => p.value === portal);
            return (
              <Card key={portal}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Badge variant="outline" className={portalConfig?.color || 'bg-gray-50'}>
                        {portalConfig?.label || (portal === 'UNASSIGNED' ? 'Unassigned' : portal)}
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
  compact = false,
  thresholdDays = 21,
}: {
  claim: ClaimWithPatient;
  onStatusChange: (id: string, status: ClaimStatus) => void;
  compact?: boolean;
  thresholdDays?: number;
}) {
  const statusConfig = CLAIM_STATUSES.find(s => s.value === claim.status);
  const portalConfig = PORTAL_OPTIONS.find(p => p.value === claim.portal_name);
  const daysPending = getDaysPending(claim);
  const isOverdue = daysPending !== null && daysPending >= thresholdDays;

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
            <p className="font-semibold">${claim.billed_amount?.toFixed(2) || '0.00'}</p>
            <div className="flex gap-1">
              {!compact && claim.portal_name && (
                <Badge variant="outline" className={`text-xs ${portalConfig?.color || ''}`}>
                  {portalConfig?.label || claim.portal_name}
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
                onClick={() => onStatusChange(claim.id, 'PAID')}
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
                onClick={() => onStatusChange(claim.id, 'PAID')}
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
            <span className="text-xs text-gray-400 italic">Claim completed</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-gray-500">Loading...</div>}>
      <ClaimsContent />
    </Suspense>
  );
}
