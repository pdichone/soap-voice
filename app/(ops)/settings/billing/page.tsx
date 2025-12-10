'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PLANS, isSubscriptionActive } from '@/lib/stripe';

interface BillingData {
  plan_type: string;
  billing_status: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

function BillingPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const pollCountRef = useRef(0);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const fetchBillingData = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/status');
      if (res.ok) {
        const data = await res.json();
        setBilling(data);
        return data;
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  // Initial fetch and polling for post-checkout
  useEffect(() => {
    fetchBillingData();

    // If we just came from checkout success, poll for subscription activation
    if (success === 'true') {
      setIsProcessingCheckout(true);
      pollCountRef.current = 0;

      const pollInterval = setInterval(async () => {
        pollCountRef.current += 1;
        const data = await fetchBillingData();

        // Stop polling if subscription is active or we've polled enough times
        if (data?.subscription_status && isSubscriptionActive(data.subscription_status)) {
          setIsProcessingCheckout(false);
          clearInterval(pollInterval);
          // Remove the success param from URL after subscription is confirmed
          router.replace('/settings/billing');
        } else if (pollCountRef.current >= 10) {
          // After ~30 seconds, stop polling but keep showing success
          setIsProcessingCheckout(false);
          clearInterval(pollInterval);
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(pollInterval);
    }
  }, [success, fetchBillingData, router]);

  async function handleCheckout(planType: 'founder' | 'solo') {
    setCheckoutLoading(planType);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open billing portal');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const hasActiveSubscription = billing?.subscription_status
    ? isSubscriptionActive(billing.subscription_status)
    : false;

  // Consider checkout as successful if success param is present (even if webhook hasn't processed yet)
  const showAsSubscribed = hasActiveSubscription || (success === 'true');

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
          <p className="text-slate-600 mt-1">Manage your subscription</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
          <p className="text-slate-600 mt-1">Manage your subscription</p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Back to Settings</Button>
        </Link>
      </div>

      {/* Success/Cancel Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          Your subscription has been activated! Thank you for subscribing.
        </div>
      )}

      {canceled && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          Checkout was canceled. You can try again when you&apos;re ready.
        </div>
      )}

      {/* Current Status - Enhanced for subscribed users */}
      {showAsSubscribed ? (
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl capitalize">
                    {billing?.plan_type || 'Solo'} Plan
                  </CardTitle>
                  {isProcessingCheckout ? (
                    <Badge className="bg-blue-500">
                      <div className="flex items-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        Activating...
                      </div>
                    </Badge>
                  ) : (
                    <Badge className="bg-green-500">Active</Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  {isProcessingCheckout
                    ? 'Your subscription is being activated. This usually takes just a moment.'
                    : billing?.plan_type && PLANS[billing.plan_type as keyof typeof PLANS]
                    ? PLANS[billing.plan_type as keyof typeof PLANS].description
                    : 'Full access to ZenLeef'}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  ${billing?.plan_type && PLANS[billing.plan_type as keyof typeof PLANS]
                    ? PLANS[billing.plan_type as keyof typeof PLANS].price
                    : 39}
                  <span className="text-sm font-normal text-slate-500">/month</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Features list */}
              <div className="grid md:grid-cols-2 gap-2">
                {(billing?.plan_type && PLANS[billing.plan_type as keyof typeof PLANS]
                  ? PLANS[billing.plan_type as keyof typeof PLANS].features
                  : PLANS.solo.features
                ).map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <svg
                      className="w-4 h-4 text-green-600 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Billing info and actions */}
              <div className="flex items-center justify-between pt-4 border-t border-green-200">
                <div>
                  {billing?.current_period_end && !isProcessingCheckout && (
                    <p className="text-sm text-slate-600">
                      Next billing date:{' '}
                      <span className="font-medium">
                        {new Date(billing.current_period_end).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </p>
                  )}
                  {isProcessingCheckout && (
                    <p className="text-sm text-slate-600">
                      Waiting for payment confirmation...
                    </p>
                  )}
                </div>
                <Button
                  onClick={handlePortal}
                  disabled={portalLoading || isProcessingCheckout}
                >
                  {portalLoading ? 'Loading...' : 'Manage Billing'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your subscription status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">
                    No Active Subscription
                  </span>
                  {billing?.billing_status === 'overdue' && (
                    <Badge variant="destructive">Payment Overdue</Badge>
                  )}
                  {billing?.billing_status === 'cancelled' && (
                    <Badge variant="secondary">Cancelled</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Choose a plan below to get started
                </p>
              </div>

              {billing?.stripe_customer_id && (
                <Button
                  variant="outline"
                  onClick={handlePortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? 'Loading...' : 'Manage Billing'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing History & Receipts - Only show for subscribed users */}
      {hasActiveSubscription && !isProcessingCheckout && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Billing History & Receipts
            </CardTitle>
            <CardDescription>
              View and download your invoices and payment receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Access your complete billing history, download invoices, and view payment receipts through the billing portal.
              </p>
              <Button
                variant="outline"
                onClick={handlePortal}
                disabled={portalLoading}
                className="ml-4 whitespace-nowrap"
              >
                {portalLoading ? 'Loading...' : 'View Receipts'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Plans - Hidden when subscribed or after successful checkout */}
      {!showAsSubscribed && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Choose a Plan</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Founder Plan */}
            <Card className="border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-4">
                <Badge className="bg-blue-500">Best Value</Badge>
              </div>
              <CardHeader>
                <CardTitle className="flex items-baseline gap-2">
                  {PLANS.founder.name}
                  <span className="text-3xl font-bold">${PLANS.founder.price}</span>
                  <span className="text-sm text-slate-500">/month</span>
                </CardTitle>
                <CardDescription>{PLANS.founder.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {PLANS.founder.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  onClick={() => handleCheckout('founder')}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === 'founder' ? 'Loading...' : 'Subscribe to Founder'}
                </Button>
              </CardContent>
            </Card>

            {/* Solo Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-baseline gap-2">
                  {PLANS.solo.name}
                  <span className="text-3xl font-bold">${PLANS.solo.price}</span>
                  <span className="text-sm text-slate-500">/month</span>
                </CardTitle>
                <CardDescription>{PLANS.solo.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {PLANS.solo.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCheckout('solo')}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === 'solo' ? 'Loading...' : 'Subscribe to Solo'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium">Can I cancel anytime?</h3>
            <p className="text-sm text-slate-600">
              Yes, you can cancel your subscription at any time. You&apos;ll continue to have
              access until the end of your billing period.
            </p>
          </div>
          <div>
            <h3 className="font-medium">What payment methods do you accept?</h3>
            <p className="text-sm text-slate-600">
              We accept all major credit cards through Stripe.
            </p>
          </div>
          <div>
            <h3 className="font-medium">What&apos;s the difference between plans?</h3>
            <p className="text-sm text-slate-600">
              The Founder plan is our early adopter rate - $29/month locked in forever.
              The Solo plan is $39/month. Both plans include all features.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
          <p className="text-slate-600 mt-1">Manage your subscription</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    }>
      <BillingPageContent />
    </Suspense>
  );
}
