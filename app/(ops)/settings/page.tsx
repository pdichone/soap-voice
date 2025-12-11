'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { usePracticeConfig } from '@/lib/practice-config';
import { useFeatureFlags } from '@/lib/feature-flags';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PracticeSettings, ServiceConfig } from '@/lib/types-ops';

// Practice type display configuration (read-only for users)
const PRACTICE_TYPE_INFO = {
  cash_only: {
    label: 'Cash-Only Practice',
    description: 'Self-pay clients, no insurance billing',
    terminology: 'Client / Session',
    features: ['Year-end statements', 'Payment tracking', 'Client management'],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  insurance: {
    label: 'Insurance Billing',
    description: 'Claims, referrals, patient collections',
    terminology: 'Patient / Visit',
    features: ['Claims tracking', 'Referral management', 'Insurance calculations', 'Year-end statements'],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  school: {
    label: 'Massage School',
    description: 'Student supervision, multi-user support',
    terminology: 'Client / Session',
    features: ['Supervisor approval', 'Student management', 'Session tracking'],
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
} as const;

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
  const { practiceType, features } = usePracticeConfig();
  const { flags: featureFlags } = useFeatureFlags();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPracticeInfo, setSavingPracticeInfo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [claimThreshold, setClaimThreshold] = useState('21');
  const [referralWarning, setReferralWarning] = useState('30');

  // Practice branding state
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [practiceInfo, setPracticeInfo] = useState<PracticeSettings>({
    business_name: '',
    logo_url: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Onboarding data from questionnaire
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);

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

  const loadProfile = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[Settings] User:', user?.id, user?.email);
    if (!user) return;

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('[Settings] Profile:', { data, error: profileError?.message });

    if (data) {
      setFullName(data.full_name || '');
      setTimezone(data.timezone || 'America/Los_Angeles');
      setClaimThreshold(String(data.claim_pending_threshold_days || 21));
      setReferralWarning(String(data.referral_warning_days || 30));

      // Load practice settings if user has a practice
      console.log('[Settings] Practice ID from profile:', data.practice_id);
      if (data.practice_id) {
        setPracticeId(data.practice_id);
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select('settings')
          .eq('id', data.practice_id)
          .single();

        console.log('[Settings] Practice data:', { practiceData, error: practiceError?.message });

        if (practiceData?.settings) {
          const settings = practiceData.settings as PracticeSettings;
          console.log('[Settings] Settings object:', settings);
          setPracticeInfo({
            business_name: settings.business_name || '',
            logo_url: settings.logo_url || '',
            address_line1: settings.address_line1 || '',
            address_line2: settings.address_line2 || '',
            city: settings.city || '',
            state: settings.state || '',
            zip: settings.zip || '',
            phone: settings.phone || '',
          });

          // Load onboarding questionnaire data
          if (settings.services) {
            console.log('[Settings] Services:', settings.services);
            setServices(settings.services);
          }
          if (settings.specialties) {
            console.log('[Settings] Specialties:', settings.specialties);
            setSpecialties(settings.specialties);
          }
        }
      }
    }
    setLoading(false);
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMessage({ type: 'error', text: 'No file selected' });
      return;
    }

    if (!practiceId) {
      setMessage({ type: 'error', text: 'Practice not found. Please refresh the page.' });
      return;
    }

    // Validate file type - check both MIME type and file extension
    // Include macOS screenshot formats (TIFF, HEIC) and common web formats
    const supportedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/tiff',
      'image/heic',
      'image/heif'
    ];
    const supportedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'tiff', 'tif', 'heic', 'heif'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

    // Accept if either MIME type OR file extension matches
    const isMimeTypeValid = supportedMimeTypes.includes(file.type);
    const isExtensionValid = supportedExtensions.includes(fileExt);

    if (!isMimeTypeValid && !isExtensionValid) {
      setMessage({
        type: 'error',
        text: `Unsupported file: ${file.name} (type: ${file.type || 'unknown'}). Please use PNG, JPG, GIF, WebP, SVG, TIFF, or HEIC.`
      });
      // Reset the file input
      e.target.value = '';
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setMessage({ type: 'error', text: `Logo is ${sizeMB}MB. Please use an image smaller than 2MB.` });
      e.target.value = '';
      return;
    }

    setUploadingLogo(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const fileName = `${practiceId}/logo.${fileExt || 'png'}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('practice-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);

        // Provide specific error messages
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          setMessage({
            type: 'error',
            text: 'Storage bucket "practice-assets" not found. Please create it in your Supabase dashboard.'
          });
        } else if (uploadError.message?.includes('permission') || uploadError.message?.includes('policy')) {
          setMessage({
            type: 'error',
            text: 'Permission denied. Please check your Supabase storage policies.'
          });
        } else {
          setMessage({
            type: 'error',
            text: `Upload failed: ${uploadError.message || 'Unknown error'}`
          });
        }
        e.target.value = '';
        setUploadingLogo(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('practice-assets')
        .getPublicUrl(fileName);

      // Add cache buster to URL
      const logoUrl = `${publicUrl}?t=${Date.now()}`;
      console.log('Logo uploaded, URL:', logoUrl);
      setPracticeInfo((prev) => ({ ...prev, logo_url: logoUrl }));
      setMessage({ type: 'success', text: 'Logo uploaded! Click "Save Practice Info" to apply.' });
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setMessage({ type: 'error', text: `Failed to upload: ${errorMessage}` });
      e.target.value = '';
    }

    setUploadingLogo(false);
  };

  const handleRemoveLogo = () => {
    setPracticeInfo({ ...practiceInfo, logo_url: '' });
    setMessage({ type: 'success', text: 'Logo removed. Click Save to apply.' });
  };

  const handleSavePracticeInfo = async () => {
    if (!practiceId) return;

    setSavingPracticeInfo(true);
    setMessage(null);

    const supabase = createClient();

    // Get current practice settings to merge with new branding info
    const { data: currentPractice } = await supabase
      .from('practices')
      .select('settings')
      .eq('id', practiceId)
      .single();

    const currentSettings = (currentPractice?.settings || {}) as PracticeSettings;
    const updatedSettings = {
      ...currentSettings,
      business_name: practiceInfo.business_name?.trim() || undefined,
      logo_url: practiceInfo.logo_url || undefined,
      address_line1: practiceInfo.address_line1?.trim() || undefined,
      address_line2: practiceInfo.address_line2?.trim() || undefined,
      city: practiceInfo.city?.trim() || undefined,
      state: practiceInfo.state?.trim() || undefined,
      zip: practiceInfo.zip?.trim() || undefined,
      phone: practiceInfo.phone?.trim() || undefined,
    };

    const { error } = await supabase
      .from('practices')
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', practiceId);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save practice information' });
    } else {
      setMessage({ type: 'success', text: 'Practice information saved' });
    }
    setSavingPracticeInfo(false);
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

      {/* Billing & Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
          <CardDescription>
            Manage your subscription plan and payment details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/billing">
            <Button variant="outline" className="w-full">
              <BillingIcon className="w-4 h-4 mr-2" />
              Manage Billing
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Documents - Only shown if feature is enabled */}
      {featureFlags.feature_documents && (
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
      )}

      {/* Practice Information - For PDFs and documents */}
      {practiceId && (
        <Card>
          <CardHeader>
            <CardTitle>Practice Information</CardTitle>
            <CardDescription>
              Used on year-end statements and receipts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Business Name</label>
              <Input
                value={practiceInfo.business_name || ''}
                onChange={(e) => setPracticeInfo({ ...practiceInfo, business_name: e.target.value })}
                placeholder="Healing Touch Massage Therapy"
                className="mt-1"
              />
            </div>

            {/* Logo Upload */}
            <div>
              <label className="text-sm font-medium text-gray-700">Business Logo</label>
              <p className="text-xs text-gray-500 mb-2">Appears on PDFs and receipts (max 2MB)</p>
              <div className="flex items-center gap-4">
                {practiceInfo.logo_url ? (
                  <div className="relative">
                    <img
                      src={practiceInfo.logo_url}
                      alt="Business logo"
                      className="h-16 w-auto max-w-[120px] object-contain rounded border border-gray-200 bg-white p-1"
                      onError={(e) => {
                        console.error('Logo image failed to load:', practiceInfo.logo_url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.tiff,.tif,.heic,.heif,image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/tiff,image/heic,image/heif"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  <span className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border ${
                    uploadingLogo
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}>
                    {uploadingLogo ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                        Uploading...
                      </>
                    ) : (
                      practiceInfo.logo_url ? 'Change Logo' : 'Upload Logo'
                    )}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Address Line 1</label>
              <Input
                value={practiceInfo.address_line1 || ''}
                onChange={(e) => setPracticeInfo({ ...practiceInfo, address_line1: e.target.value })}
                placeholder="123 Main Street, Suite 100"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Address Line 2 (optional)</label>
              <Input
                value={practiceInfo.address_line2 || ''}
                onChange={(e) => setPracticeInfo({ ...practiceInfo, address_line2: e.target.value })}
                placeholder="Building B"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <label className="text-sm font-medium text-gray-700">City</label>
                <Input
                  value={practiceInfo.city || ''}
                  onChange={(e) => setPracticeInfo({ ...practiceInfo, city: e.target.value })}
                  placeholder="Seattle"
                  className="mt-1"
                />
              </div>
              <div className="col-span-1">
                <label className="text-sm font-medium text-gray-700">State</label>
                <Input
                  value={practiceInfo.state || ''}
                  onChange={(e) => setPracticeInfo({ ...practiceInfo, state: e.target.value })}
                  placeholder="WA"
                  maxLength={2}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">ZIP</label>
                <Input
                  value={practiceInfo.zip || ''}
                  onChange={(e) => setPracticeInfo({ ...practiceInfo, zip: e.target.value })}
                  placeholder="98101"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <Input
                value={practiceInfo.phone || ''}
                onChange={(e) => setPracticeInfo({ ...practiceInfo, phone: e.target.value })}
                placeholder="(206) 555-1234"
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleSavePracticeInfo}
              disabled={savingPracticeInfo}
              variant="outline"
              className="w-full"
            >
              {savingPracticeInfo ? 'Saving...' : 'Save Practice Info'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Services - From Onboarding (Read Only) */}
      {services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Services</CardTitle>
            <CardDescription>
              Services configured from your onboarding questionnaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-900">{service.name}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({service.duration_minutes} min)
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    ${(service.price_cents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Contact support to update your service offerings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Specialties - From Onboarding (Read Only) */}
      {specialties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Specialties</CardTitle>
            <CardDescription>
              Massage modalities you offer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {specialties.map((specialty, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 bg-primary/10 text-primary text-sm rounded-full capitalize"
                >
                  {specialty.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Contact support to update your specialties.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Practice Type - Read Only */}
      <Card>
        <CardHeader>
          <CardTitle>Your Practice Type</CardTitle>
          <CardDescription>
            Your practice configuration determines terminology and available features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const typeInfo = PRACTICE_TYPE_INFO[practiceType];
            return (
              <div className="space-y-4">
                {/* Current Type Display */}
                <div className="flex items-start gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="text-primary mt-0.5">
                    {typeInfo.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{typeInfo.label}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        Active
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{typeInfo.description}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Terminology</p>
                    <p className="font-medium text-gray-900">{typeInfo.terminology}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Features</p>
                    <p className="font-medium text-gray-900">{typeInfo.features.length} enabled</p>
                  </div>
                </div>

                {/* Feature List */}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Included Features</p>
                  <div className="flex flex-wrap gap-2">
                    {typeInfo.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                      >
                        <CheckIcon className="w-3 h-3 text-green-600" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contact Support Note */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Need to change your practice type? Contact support for assistance with upgrades.
                  </p>
                </div>
              </div>
            );
          })()}
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

      {/* Insurance Portals - only for insurance practice */}
      {features.showClaims && (
        <Card>
          <CardHeader>
            <CardTitle>Insurance Portals</CardTitle>
            <CardDescription>
              Manage the list of portals where you submit claims
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/portals">
              <Button variant="outline" className="w-full">
                <PortalIcon className="w-4 h-4 mr-2" />
                Manage Portals
              </Button>
            </Link>
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

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function PortalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}
