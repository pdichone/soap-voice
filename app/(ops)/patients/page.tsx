'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { PatientWithStats } from '@/lib/types-ops';

function PatientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewForm = searchParams.get('action') === 'new';

  const [patients, setPatients] = useState<PatientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(showNewForm);
  const [saving, setSaving] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [insurerName, setInsurerName] = useState('');
  const [copayAmount, setCopayAmount] = useState('');

  useEffect(() => {
    loadPatients();
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
    }
    setLoading(false);
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
      display_name: displayName.trim(),
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
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 text-sm">{patients.length} active patients</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>Add Patient</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Display Name *</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., John D. or Patient #123"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Use an alias - no real names for privacy</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Insurance</label>
                <Input
                  value={insurerName}
                  onChange={(e) => setInsurerName(e.target.value)}
                  placeholder="e.g., Blue Cross, Aetna, Self-Pay"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Default Copay</label>
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
                {saving ? 'Adding...' : 'Add Patient'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Search */}
      {patients.length > 0 && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients..."
            className="pl-9"
          />
        </div>
      )}

      {/* Patient List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
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
            <p className="text-gray-500 mb-4">No patients yet</p>
            <Button onClick={() => setShowDialog(true)}>Add Your First Patient</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">No patients match &quot;{searchQuery}&quot;</p>
          </CardContent>
        </Card>
      )}
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

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-gray-500">Loading...</div>}>
      <PatientsContent />
    </Suspense>
  );
}
