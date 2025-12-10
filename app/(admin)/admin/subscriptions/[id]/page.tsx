'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SubscriptionDetailResponse } from '@/app/api/admin/subscriptions/[id]/route';

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

function formatDate(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [subscription, setSubscription] = useState<SubscriptionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [extendDays, setExtendDays] = useState('7');
  const [extendLoading, setExtendLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, [id]);

  async function fetchSubscription() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch subscription');
      }
      const data = await res.json();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  }

  async function handleExtendTrial() {
    if (!extendDays || parseInt(extendDays) < 1) return;
    setExtendLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/extend-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: parseInt(extendDays) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to extend trial');
      }
      await fetchSubscription();
      alert(`Trial extended by ${extendDays} days`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to extend trial');
    } finally {
      setExtendLoading(false);
    }
  }

  async function handleCancel(immediate: boolean) {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate, reason: 'Admin cancellation' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel subscription');
      }
      await fetchSubscription();
      setShowCancelConfirm(false);
      alert(`Subscription canceled ${immediate ? 'immediately' : 'at period end'}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleRefund() {
    if (!refundReason.trim()) {
      alert('Please provide a reason for the refund');
      return;
    }
    setRefundLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: refundReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to issue refund');
      }
      const data = await res.json();
      await fetchSubscription();
      setShowRefundForm(false);
      setRefundReason('');
      alert(`Refund of ${data.amount_refunded_formatted} issued successfully`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to issue refund');
    } finally {
      setRefundLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/subscriptions">
            <Button variant="ghost" size="sm">
              &larr; Back
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/subscriptions">
            <Button variant="ghost" size="sm">
              &larr; Back
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-red-500">{error || 'Subscription not found'}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/subscriptions">
            <Button variant="ghost" size="sm">
              &larr; Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{subscription.name}</h1>
            <p className="text-slate-600">{subscription.email}</p>
          </div>
        </div>
        {getStatusBadge(subscription.subscription_status)}
      </div>

      {/* Subscription Details */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm font-medium text-slate-500">Plan</div>
              <div className="text-lg font-semibold capitalize">
                {subscription.plan_type || 'None'}
              </div>
              {subscription.monthly_price && (
                <div className="text-sm text-slate-500">${subscription.monthly_price}/month</div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Status</div>
              <div className="text-lg font-semibold capitalize">
                {subscription.subscription_status || 'None'}
              </div>
              <div className="text-sm text-slate-500">{subscription.billing_status}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Started</div>
              <div className="text-lg font-semibold">
                {formatDate(subscription.billing_started_at)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">
                {subscription.subscription_status === 'trialing' ? 'Trial Ends' : 'Next Billing'}
              </div>
              <div className="text-lg font-semibold">
                {subscription.subscription_status === 'trialing'
                  ? formatDate(subscription.trial_ends_at)
                  : formatDate(subscription.current_period_end)}
              </div>
            </div>
          </div>

          {/* Stripe Links */}
          {(subscription.stripe_customer_url || subscription.stripe_subscription_url) && (
            <div className="mt-6 pt-6 border-t flex gap-4">
              {subscription.stripe_customer_url && (
                <a
                  href={subscription.stripe_customer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View Customer in Stripe &rarr;
                </a>
              )}
              {subscription.stripe_subscription_url && (
                <a
                  href={subscription.stripe_subscription_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View Subscription in Stripe &rarr;
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
          <CardDescription>Manage this subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Extend Trial */}
          <div className="flex items-end gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Extend Trial</label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-slate-500">days</span>
              </div>
            </div>
            <Button
              onClick={handleExtendTrial}
              disabled={extendLoading}
              variant="outline"
            >
              {extendLoading ? 'Extending...' : 'Extend Trial'}
            </Button>
          </div>

          {/* Cancel Subscription */}
          {subscription.stripe_subscription_id && subscription.subscription_status !== 'canceled' && (
            <div className="pt-4 border-t">
              {!showCancelConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel Subscription
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">How would you like to cancel?</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCancel(false)}
                      disabled={cancelLoading}
                    >
                      Cancel at Period End
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleCancel(true)}
                      disabled={cancelLoading}
                    >
                      Cancel Immediately
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={cancelLoading}
                    >
                      Never mind
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Refund */}
          {subscription.stripe_customer_id && (
            <div className="pt-4 border-t">
              {!showRefundForm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowRefundForm(true)}
                >
                  Issue Refund
                </Button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Reason for refund</label>
                    <Input
                      type="text"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="e.g., Customer requested refund"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRefund}
                      disabled={refundLoading || !refundReason.trim()}
                    >
                      {refundLoading ? 'Processing...' : 'Confirm Refund'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowRefundForm(false);
                        setRefundReason('');
                      }}
                      disabled={refundLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Recent admin events for this subscriber</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription.recent_events.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {subscription.recent_events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 py-3 border-b last:border-0"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {event.description}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {event.admin_name && `by ${event.admin_name} - `}
                      {formatDateTime(event.created_at)}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {event.event_type.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
