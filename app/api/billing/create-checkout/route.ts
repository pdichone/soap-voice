import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { stripe, PLANS, TRIAL_DAYS, type PlanType } from '@/lib/stripe';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const { planType } = await request.json() as { planType: PlanType };

    if (!planType || !PLANS[planType]) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get practitioner record
    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select('id, email, name, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (practitionerError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Create or retrieve Stripe customer
    let customerId = practitioner.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: practitioner.email,
        name: practitioner.name,
        metadata: {
          practitioner_id: practitioner.id,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await supabase
        .from('practitioners')
        .update({ stripe_customer_id: customerId })
        .eq('id', practitioner.id);
    }

    // Get the site URL for redirects
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PLANS[planType].priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          practitioner_id: practitioner.id,
          plan_type: planType,
        },
      },
      success_url: `${siteUrl}/settings/billing?success=true`,
      cancel_url: `${siteUrl}/settings/billing?canceled=true`,
      metadata: {
        practitioner_id: practitioner.id,
        plan_type: planType,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
