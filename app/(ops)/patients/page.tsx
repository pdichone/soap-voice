'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { PatientWithStats } from '@/lib/types-ops';
import { LoadingSpinner, PageLoading } from '@/components/ui/loading-spinner';
import { usePracticeConfig } from '@/lib/practice-config';
import { deidentifyName } from '@/lib/name-utils';

function PatientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('action') === 'new';

  // Get practice config for terminology
  const { practiceType } = usePracticeConfig();
  const isCashOnly = practiceType === 'cash_only';
  const clientLabel = isCashOnly ? 'Client' : 'Patient';
  const clientLabelPlural = isCashOnly ? 'Clients' : 'Patients';

  const [patients, setPatients] = useState<PatientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(showNewForm);
  const [saving, setSaving] = useState(false);

  // Demo data state
  const [demoPatientCount, setDemoPatientCount] = useState(0);
  const [deletingDemo, setDeletingDemo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [insurerName, setInsurerName] = useState('');
  const [copayAmount, setCopayAmount] = useState('');

  useEffect(() => {
    loadPatients();
    // Refresh data when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadPatients();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadPatients = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('patients_non_phi')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('is_active', true)
      .order('display_name');

    if (data) {
      setPatients(data);
      // Count demo patients (those with "(Demo)" in name)
      const demoCount = data.filter(p => p.display_name.includes('(Demo)')).length;
      setDemoPatientCount(demoCount);
    }
    setLoading(false);
  };

  const handleDeleteDemoData = async () => {
    setDeletingDemo(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/patients/delete-demo', {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload patients to update the list and demo count
        await loadPatients();
        setShowDeleteConfirm(false);
      } else {
        const data = await response.json();
        setDeleteError(data.error || 'Failed to delete demo data');
      }
    } catch (err) {
      console.error('Error deleting demo data:', err);
      setDeleteError('Failed to delete demo data');
    } finally {
      setDeletingDemo(false);
    }
  };

  const handleAddPatient = async () => {
    if (!displayName.trim()) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Ensure profile exists (for existing users who signed up before migration)
    await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });

    const { error } = await supabase.from('patients_non_phi').insert({
      owner_user_id: user.id,
      display_name: deidentifyName(displayName.trim()),
      insurer_name: insurerName.trim() || null,
      default_copay_amount: copayAmount ? parseFloat(copayAmount) : null,
    });

    if (error) {
      console.error('Error adding patient:', error);
    } else {
      setShowDialog(false);
      setDisplayName('');
      setInsurerName('');
      setCopayAmount('');
      loadPatients();
      router.refresh();
      router.replace('/patients');
    }
    setSaving(false);
  };

  const filteredPatients = patients.filter(p =>
    p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.insurer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{clientLabelPlural}</h1>
          <p className="text-gray-500 text-sm">{patients.length} active {clientLabelPlural.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Delete Demo Data button - only shown when demo patients exist */}
          {demoPatientCount > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Delete Demo Data ({demoPatientCount})
            </Button>
          )}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button>Add {clientLabel}</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New {clientLabel}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Display Name *</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Paulo Dichone"
                  className="mt-1"
                />
                {displayName.trim() && displayName.trim().includes(' ') && (
                  <p className="text-xs text-blue-600 mt-1">
                    Will be saved as: <strong>{deidentifyName(displayName.trim())}</strong>
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Names are auto-abbreviated for privacy (e.g., Paulo Dichone → Paulo D.)
                </p>
              </div>
              {/* Only show insurance field for insurance practices */}
              {!isCashOnly && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Insurance</label>
                  <Input
                    value={insurerName}
                    onChange={(e) => setInsurerName(e.target.value)}
                    placeholder="e.g., Blue Cross, Aetna, Self-Pay"
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {isCashOnly ? 'Default Session Rate' : 'Default Collect'}
                </label>
                <Input
                  type="number"
                  value={copayAmount}
                  onChange={(e) => setCopayAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleAddPatient}
                disabled={saving || !displayName.trim()}
                className="w-full"
              >
                {saving ? 'Adding...' : `Add ${clientLabel}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      {/* Search */}
      {patients.length > 0 && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${clientLabelPlural.toLowerCase()}...`}
            className="pl-9"
          />
        </div>
      )}

      {/* Client/Patient List */}
      {loading ? (
        <LoadingSpinner text={`Loading ${clientLabelPlural.toLowerCase()}...`} />
      ) : filteredPatients.length > 0 ? (
        <div className="space-y-3">
          {filteredPatients.map((patient) => (
            <Link key={patient.id} href={`/patients/${patient.id}`}>
              <Card className="hover:border-blue-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{patient.display_name}</h3>
                      {patient.insurer_name && (
                        <p className="text-sm text-gray-500">{patient.insurer_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {patient.default_copay_amount && (
                        <Badge variant="outline" className="text-xs">
                          ${patient.default_copay_amount}
                        </Badge>
                      )}
                      <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : patients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No {clientLabelPlural.toLowerCase()} yet</p>
            <Button onClick={() => setShowDialog(true)}>Add Your First {clientLabel}</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No {clientLabelPlural.toLowerCase()} match &quot;{searchQuery}&quot;</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Demo Data Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => {
        setShowDeleteConfirm(open);
        if (!open) setDeleteError(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Demo Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all demo data? This will remove all {demoPatientCount} {clientLabelPlural.toLowerCase()} with &quot;(Demo)&quot; in their name and their associated visits, referrals, and payments.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deletingDemo}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDemoData}
              disabled={deletingDemo}
            >
              {deletingDemo ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Deleting...
                </>
              ) : (
                'Delete Demo Data'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<PageLoading text="Loading..." />}>
      <PatientsContent />
    </Suspense>
  );
}
