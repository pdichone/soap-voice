import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { logAdminEvent } from '@/lib/db/admin-queries';
import { stripe, PRICES, PLANS } from '@/lib/stripe';
import type { GeneratePaymentLinkRequest, PaymentLink } from '@/lib/types-billing';

// Helper to get the correct base URL for Stripe redirects
// Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > request host
function getBaseUrl(request: NextRequest): string {
  // 1. Explicit app URL (set in env for production/preview)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Vercel's automatic deployment URL (works for preview deploys)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Fallback to request headers (for self-hosted or other platforms)
  // Use x-forwarded-host if behind a proxy, otherwise use host header
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');

  return `${protocol}://${host}`;
}

// GET /api/admin/practitioners/[id]/payment-link - Get existing payment links
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServiceRoleClient();

    // Get practitioner to check subscription status
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('billing_status, stripe_subscription_id')
      .eq('id', id)
      .single();

    // Get all payment links for this practitioner
    const { data: paymentLinks, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('practitioner_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment links:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment links' },
        { status: 500 }
      );
    }

    // Check for expired links and update status
    // Also mark pending links as completed if practitioner has an active subscription
    const now = new Date();
    const hasActiveSubscription = practitioner?.billing_status === 'paying' ||
                                   practitioner?.billing_status === 'trial';

    const updatedLinks = paymentLinks?.map((link: PaymentLink) => {
      if (link.status === 'pending') {
        // If practitioner has active subscription, mark as completed
        if (hasActiveSubscription) {
          return { ...link, status: 'completed' };
        }
        // Otherwise check if expired
        if (new Date(link.expires_at) < now) {
          return { ...link, status: 'expired' };
        }
      }
      return link;
    }) || [];

    // Also update in database if any pending links should be completed
    if (hasActiveSubscription) {
      const pendingLinks = paymentLinks?.filter((link: PaymentLink) => link.status === 'pending') || [];
      if (pendingLinks.length > 0) {
        await supabase
          .from('payment_links')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('practitioner_id', id)
          .eq('status', 'pending');
      }
    }

    return NextResponse.json({ payment_links: updatedLinks });
  } catch (error) {
    console.error('Error in GET payment-link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/practitioners/[id]/payment-link - Generate new payment link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body: GeneratePaymentLinkRequest = await request.json();
    const { plan_type, trial_days } = body;

    // Validate plan type
    if (!plan_type || !['founder', 'solo'].includes(plan_type)) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "founder" or "solo".' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get practitioner
    const { data: practitioner, error: fetchError } = await supabase
      .from('practitioners')
      .select('id, name, email, stripe_customer_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Create or get Stripe customer
    let stripeCustomerId = practitioner.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: practitioner.email,
        name: practitioner.name || undefined,
        metadata: {
          practitioner_id: id,
        },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to practitioner
      await supabase
        .from('practitioners')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', id);
    }

    // Get the price ID for the selected plan
    const priceId = PRICES[plan_type as keyof typeof PRICES];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured for this plan' },
        { status: 500 }
      );
    }

    // Build the success and cancel URLs using the helper function
    const baseUrl = getBaseUrl(request);
    const successUrl = `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/admin/practitioners/${id}`;

    console.log('[Payment Link] Using baseUrl:', baseUrl);

    // Create Stripe checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Allow customers to enter promotion/coupon codes at checkout
      allow_promotion_codes: true,
      metadata: {
        practitioner_id: id,
        plan_type,
        created_by_admin: admin.id,
      },
      subscription_data: {
        metadata: {
          practitioner_id: id,
          plan_type,
        },
        trial_period_days: trial_days && trial_days > 0 ? trial_days : undefined,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    // Calculate expiration (Stripe checkout sessions expire after 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save payment link to database
    const { data: paymentLink, error: insertError } = await supabase
      .from('payment_links')
      .insert({
        practitioner_id: id,
        stripe_checkout_session_id: session.id,
        stripe_customer_id: stripeCustomerId,
        plan_type,
        checkout_url: session.url,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_by: admin.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving payment link:', insertError);
      return NextResponse.json(
        { error: 'Failed to save payment link' },
        { status: 500 }
      );
    }

    // Log admin event
    const planInfo = PLANS[plan_type as keyof typeof PLANS];
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.payment_link_generated',
      practitionerId: id,
      description: `Generated ${planInfo.name} plan payment link for ${practitioner.name || practitioner.email}`,
      metadata: {
        plan_type,
        trial_days: trial_days || 0,
        checkout_session_id: session.id,
        expires_at: expiresAt.toISOString(),
      },
    });

    return NextResponse.json({
      payment_link: paymentLink,
      checkout_url: session.url,
    });
  } catch (error) {
    console.error('Error generating payment link:', error);
    return NextResponse.json(
      { error: 'Failed to generate payment link' },
      { status: 500 }
    );
  }
}
