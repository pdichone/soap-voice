'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { usePracticeConfig } from '@/lib/practice-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PracticeType } from '@/lib/types-ops';

const PRACTICE_TYPES = [
  { value: 'cash_only', label: 'Cash-Only Practice', description: 'Self-pay clients, no insurance billing' },
  { value: 'insurance', label: 'Insurance Billing', description: 'Claims, referrals, patient collections' },
  { value: 'school', label: 'Massage School', description: 'Student supervision, multi-user support' },
] as const;

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { practiceType: currentPracticeType, features, updatePracticeType, refetch } = usePracticeConfig();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPracticeType, setSavingPracticeType] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [claimThreshold, setClaimThreshold] = useState('21');
  const [referralWarning, setReferralWarning] = useState('30');
  const [practiceType, setPracticeType] = useState<PracticeType>(currentPracticeType);

  useEffect(() => {
    loadProfile();
    // Refresh data when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadProfile();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Sync practice type from context
  useEffect(() => {
    setPracticeType(currentPracticeType);
  }, [currentPracticeType]);

  const loadProfile = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setFullName(data.full_name || '');
      setTimezone(data.timezone || 'America/Los_Angeles');
      setClaimThreshold(String(data.claim_pending_threshold_days || 21));
      setReferralWarning(String(data.referral_warning_days || 30));
    }
    setLoading(false);
  };

  const handlePracticeTypeChange = async (newType: PracticeType) => {
    setSavingPracticeType(true);
    setMessage(null);

    try {
      await updatePracticeType(newType);
      setPracticeType(newType);
      await refetch();
      setMessage({ type: 'success', text: 'Practice type updated. Refreshing...' });
      // Reload the page to update all components
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch {
      setMessage({ type: 'error', text: 'Failed to update practice type' });
    }
    setSavingPracticeType(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName.trim() || null,
        timezone,
        claim_pending_threshold_days: parseInt(claimThreshold) || 21,
        referral_warning_days: parseInt(referralWarning) || 30,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-gray-500 animate-pulse">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your preferences</p>
      </header>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Display Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Timezone</label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Client Documents</CardTitle>
          <CardDescription>
            Create intake forms, consent docs, and policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/documents">
            <Button variant="outline" className="w-full">
              <DocumentIcon className="w-4 h-4 mr-2" />
              Manage Document Templates
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Practice Type Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Practice Type</CardTitle>
          <CardDescription>
            Choose how your practice operates. This affects which features are shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {PRACTICE_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  practiceType === type.value
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                } ${savingPracticeType ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="radio"
                  name="practiceType"
                  value={type.value}
                  checked={practiceType === type.value}
                  onChange={() => handlePracticeTypeChange(type.value)}
                  disabled={savingPracticeType}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-gray-900">{type.label}</p>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </label>
            ))}
          </div>
          {savingPracticeType && (
            <p className="text-sm text-primary animate-pulse">Updating practice type...</p>
          )}
        </CardContent>
      </Card>

      {/* Alert Settings - only for insurance practice */}
      {features.showClaims && (
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Configure when you see warnings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Claim Pending Threshold (days)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Show warning when claims are pending longer than this
              </p>
              <Input
                type="number"
                value={claimThreshold}
                onChange={(e) => setClaimThreshold(e.target.value)}
                className="mt-1 w-24"
                min="1"
                max="90"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Referral Expiration Warning (days)
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Show warning when referrals expire within this many days
              </p>
              <Input
                type="number"
                value={referralWarning}
                onChange={(e) => setReferralWarning(e.target.value)}
                className="mt-1 w-24"
                min="7"
                max="90"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>

      {/* Account Actions */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut} className="text-red-600">
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <div className="text-center text-xs text-gray-400 pt-4">
        <p className="font-heading font-semibold">
          <span className="text-primary">Body</span>
          <span className="text-foreground">Work</span>
          <span className="text-accent">Flow</span>
          <span className="text-gray-400"> v1.0</span>
        </p>
        <p className="mt-1">Practice Management for Bodyworkers</p>
      </div>
    </div>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
