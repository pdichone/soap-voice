import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { logAdminEvent } from '@/lib/db/admin-queries';
import { stripe, PRICES, PLANS } from '@/lib/stripe';
import type { GeneratePaymentLinkRequest, PaymentLink } from '@/lib/types-billing';

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
    const now = new Date();
    const updatedLinks = paymentLinks?.map((link: PaymentLink) => {
      if (link.status === 'pending' && new Date(link.expires_at) < now) {
        return { ...link, status: 'expired' };
      }
      return link;
    }) || [];

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

    // Build the success and cancel URLs dynamically from the request
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    const successUrl = `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/admin/practitioners/${id}`;

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
