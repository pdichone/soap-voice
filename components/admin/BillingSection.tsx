'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BillingSectionProps, PaymentLink, PlanType } from '@/lib/types-billing';

function formatDate(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number | null) {
  if (amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-500">Active</Badge>;
    case 'trialing':
      return <Badge variant="outline" className="border-blue-500 text-blue-600">Trial</Badge>;
    case 'past_due':
      return <Badge variant="destructive">Past Due</Badge>;
    case 'canceled':
      return <Badge variant="secondary">Canceled</Badge>;
    default:
      return <Badge variant="outline">None</Badge>;
  }
}

function getBillingStatusBadge(status: string | null) {
  switch (status) {
    case 'paying':
      return <Badge className="bg-green-500">Paying</Badge>;
    case 'trial':
      return <Badge variant="outline" className="border-blue-500 text-blue-600">Trial</Badge>;
    case 'overdue':
      return <Badge variant="destructive">Overdue</Badge>;
    case 'cancelled':
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">None</Badge>;
  }
}

export function BillingSection({
  practitionerId,
  practitionerEmail,
  practitionerName,
  planType,
  billingStatus,
  subscriptionStatus,
  monthlyPrice,
  trialEndsAt,
  stripeCustomerId,
  stripeSubscriptionId,
}: BillingSectionProps) {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('founder');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practitionerId]);

  async function fetchPaymentLinks() {
    try {
      const res = await fetch(`/api/admin/practitioners/${practitionerId}/payment-link`);
      if (res.ok) {
        const data = await res.json();
        setPaymentLinks(data.payment_links || []);
      }
    } catch (err) {
      console.error('Error fetching payment links:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLink() {
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/practitioners/${practitionerId}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: selectedPlan }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate payment link');
      }

      setPaymentLinks([data.payment_link, ...paymentLinks]);
      setSuccessMessage('Payment link generated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate payment link');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendEmail(linkId: string) {
    setSendingEmail(linkId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/practitioners/${practitionerId}/send-payment-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_link_id: linkId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setSuccessMessage(data.message || 'Email sent successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSendingEmail(null);
    }
  }

  async function handleCopyLink(url: string, linkId: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(linkId);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  const activeLink = paymentLinks.find(
    (link) => link.status === 'pending' && new Date(link.expires_at) > new Date()
  );

  const stripeCustomerUrl = stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${stripeCustomerId}`
    : null;
  const stripeSubscriptionUrl = stripeSubscriptionId
    ? `https://dashboard.stripe.com/subscriptions/${stripeSubscriptionId}`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Subscription</CardTitle>
        <CardDescription>Manage billing and generate payment links</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {/* Current Status */}
        <div>
          <h4 className="text-sm font-medium text-slate-900 mb-3">Current Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Plan</label>
              <p className="mt-1 text-sm font-medium capitalize">{planType || 'None'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Subscription</label>
              <div className="mt-1">{getStatusBadge(subscriptionStatus)}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Billing</label>
              <div className="mt-1">{getBillingStatusBadge(billingStatus)}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Monthly Price</label>
              <p className="mt-1 text-sm font-medium">{formatCurrency(monthlyPrice)}</p>
            </div>
          </div>
          {trialEndsAt && subscriptionStatus === 'trialing' && (
            <p className="mt-2 text-sm text-slate-500">
              Trial ends: {formatDate(trialEndsAt)}
            </p>
          )}
        </div>

        {/* Payment Link Section */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium text-slate-900 mb-3">Payment Link</h4>

          {/* Generate Link Form */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as PlanType)}
              className="px-3 py-2 border rounded-md bg-white text-sm"
            >
              <option value="founder">Founder ($29/mo)</option>
              <option value="solo">Solo ($39/mo)</option>
            </select>
            <Button onClick={handleGenerateLink} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Link'}
            </Button>
          </div>

          {/* Active Payment Link */}
          {loading ? (
            <div className="text-sm text-slate-500">Loading payment links...</div>
          ) : activeLink ? (
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    {activeLink.plan_type} Plan
                  </span>
                  <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">
                    Pending
                  </Badge>
                </div>
                <span className="text-xs text-slate-500">
                  Expires {formatDateTime(activeLink.expires_at)}
                </span>
              </div>

              <div className="bg-white border rounded-md p-2">
                <code className="text-xs text-slate-600 break-all">
                  {activeLink.checkout_url}
                </code>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(activeLink.checkout_url, activeLink.id)}
                >
                  {copied === activeLink.id ? 'Copied!' : 'Copy Link'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendEmail(activeLink.id)}
                  disabled={sendingEmail === activeLink.id}
                >
                  {sendingEmail === activeLink.id ? 'Sending...' : 'Send Email'}
                </Button>
                <a
                  href={activeLink.checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Open Link
                </a>
              </div>

              <p className="text-xs text-amber-600">
                Link expires in {Math.ceil((new Date(activeLink.expires_at).getTime() - Date.now()) / (1000 * 60 * 60))} hours
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No active payment link. Generate one above to send to {practitionerName || practitionerEmail}.
            </p>
          )}

          {/* Previous Links */}
          {paymentLinks.filter((l) => l.id !== activeLink?.id).length > 0 && (
            <div className="mt-4">
              <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">Previous Links</h5>
              <div className="space-y-2">
                {paymentLinks
                  .filter((l) => l.id !== activeLink?.id)
                  .slice(0, 3)
                  .map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between text-sm text-slate-500 py-1"
                    >
                      <span className="capitalize">{link.plan_type}</span>
                      <span>
                        {link.status === 'completed' ? (
                          <Badge className="bg-green-500 text-xs">Completed</Badge>
                        ) : link.status === 'expired' || new Date(link.expires_at) < new Date() ? (
                          <Badge variant="secondary" className="text-xs">Expired</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Pending</Badge>
                        )}
                      </span>
                      <span>{formatDate(link.created_at)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Stripe Links */}
        {(stripeCustomerUrl || stripeSubscriptionUrl) && (
          <div className="border-t pt-4 flex gap-4">
            {stripeCustomerUrl && (
              <a
                href={stripeCustomerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View Customer in Stripe
              </a>
            )}
            {stripeSubscriptionUrl && (
              <a
                href={stripeSubscriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View Subscription in Stripe
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
