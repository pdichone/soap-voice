'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { PractitionerPlanType, BillingStatus } from '@/lib/types-ops';

const PLAN_TYPES: { value: PractitionerPlanType; label: string; description: string; price?: number }[] = [
  { value: 'trial', label: 'Trial', description: '14 days free trial' },
  { value: 'founder', label: 'Founder', description: 'Early adopter rate', price: 29 },
  { value: 'solo', label: 'Solo', description: 'Standard pricing', price: 39 },
  { value: 'professional', label: 'Professional', description: 'For busy practices', price: 59 },
  { value: 'custom', label: 'Custom', description: 'Custom pricing' },
];

const BILLING_STATUSES: { value: BillingStatus; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'paying', label: 'Paying' },
  { value: 'comped', label: 'Comped (Free)' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function NewPractitionerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [planType, setPlanType] = useState<PractitionerPlanType>('trial');
  const [billingStatus, setBillingStatus] = useState<BillingStatus>('trial');
  const [monthlyPrice, setMonthlyPrice] = useState<string>('');
  const [billingNotes, setBillingNotes] = useState('');
  const [sendMagicLink, setSendMagicLink] = useState(true);

  // Update price when plan type changes
  const handlePlanTypeChange = (value: PractitionerPlanType) => {
    setPlanType(value);
    const plan = PLAN_TYPES.find(p => p.value === value);
    if (plan?.price) {
      setMonthlyPrice(plan.price.toString());
    }
    // Update billing status based on plan
    if (value === 'trial') {
      setBillingStatus('trial');
    } else {
      setBillingStatus('paying');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/practitioners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          workspace_name: workspaceName.trim() || undefined,
          plan_type: planType,
          billing_status: billingStatus,
          monthly_price: monthlyPrice ? parseFloat(monthlyPrice) : undefined,
          billing_notes: billingNotes.trim() || undefined,
          // Feature flags default to sensible values
          feature_claims_tracking: true,
          feature_year_end_summary: true,
          feature_intake_forms: true,
          feature_documents: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create practitioner');
        setSaving(false);
        return;
      }

      // Send magic link if checkbox is checked
      if (sendMagicLink) {
        try {
          const magicLinkResponse = await fetch(`/api/admin/practitioners/${data.id}/send-magic-link`, {
            method: 'POST',
          });

          if (!magicLinkResponse.ok) {
            const magicLinkData = await magicLinkResponse.json();
            console.warn('Failed to send magic link:', magicLinkData.error);
            // Don't block the redirect if magic link fails - user can resend from detail page
          }
        } catch (magicLinkError) {
          console.warn('Error sending magic link:', magicLinkError);
          // Don't block the redirect if magic link fails
        }
      }

      // Redirect to the new practitioner's detail page
      router.push(`/admin/practitioners/${data.id}`);
      router.refresh();
    } catch (err) {
      console.error('Error creating practitioner:', err);
      setError('Failed to create practitioner');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/practitioners">
          <Button variant="ghost" size="sm">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Add Practitioner</h1>
          <p className="text-slate-600">Create a new practitioner account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Account Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Basic details for the practitioner</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Jess Martinez"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g., jess@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Practice Name <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g., Healing Hands Massage"
              />
              <p className="text-xs text-slate-500 mt-1">
                If left blank, defaults to &quot;[Name]&apos;s Practice&quot;
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Plan & Billing */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Plan & Billing</CardTitle>
            <CardDescription>Set pricing and billing status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Plan Type <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {PLAN_TYPES.map((plan) => (
                  <label
                    key={plan.value}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      planType === plan.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="planType"
                      value={plan.value}
                      checked={planType === plan.value}
                      onChange={() => handlePlanTypeChange(plan.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{plan.label}</div>
                      <div className="text-sm text-slate-500">{plan.description}</div>
                    </div>
                    {plan.price && (
                      <div className="text-slate-600 font-medium">${plan.price}/mo</div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Billing Status
                </label>
                <select
                  value={billingStatus}
                  onChange={(e) => setBillingStatus(e.target.value as BillingStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {BILLING_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Monthly Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Billing Notes <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                value={billingNotes}
                onChange={(e) => setBillingNotes(e.target.value)}
                placeholder="e.g., Founder pricing, referred by Jess"
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Send Magic Link */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sendMagicLink}
                onChange={(e) => setSendMagicLink(e.target.checked)}
                className="mr-3 rounded border-slate-300"
              />
              <div>
                <div className="font-medium text-slate-900">
                  Send welcome email with magic link
                </div>
                <div className="text-sm text-slate-500">
                  The practitioner will receive an email to set up their account
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Link href="/admin/practitioners" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? (
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
                Creating...
              </>
            ) : (
              'Create Practitioner'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
