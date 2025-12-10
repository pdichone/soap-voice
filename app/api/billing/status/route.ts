import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

// Admin client for updating data when syncing from Stripe
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
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

    // Get practitioner billing data
    const { data: practitioner, error } = await supabase
      .from('practitioners')
      .select(`
        id,
        plan_type,
        billing_status,
        subscription_status,
        trial_ends_at,
        current_period_end,
        stripe_customer_id,
        stripe_subscription_id
      `)
      .eq('user_id', user.id)
      .single();

    if (error || !practitioner) {
      // Return default status if no practitioner found
      return NextResponse.json({
        plan_type: null,
        billing_status: null,
        subscription_status: null,
        trial_ends_at: null,
        current_period_end: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
      });
    }

    // If user has a Stripe customer ID but no active subscription in our DB,
    // sync from Stripe directly (handles webhook failures)
    console.log('Billing status check:', {
      stripe_customer_id: practitioner.stripe_customer_id,
      subscription_status: practitioner.subscription_status,
      needs_sync: practitioner.stripe_customer_id && practitioner.subscription_status !== 'active',
    });

    if (
      practitioner.stripe_customer_id &&
      practitioner.subscription_status !== 'active'
    ) {
      try {
        console.log('Checking Stripe for subscriptions, customer:', practitioner.stripe_customer_id);

        // Check Stripe for active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: practitioner.stripe_customer_id,
          status: 'active',
          limit: 1,
        });

        console.log('Stripe subscriptions found:', subscriptions.data.length);

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          console.log('Found active subscription:', subscription.id, 'status:', subscription.status);

          // Get plan type from subscription metadata or price
          const planType = subscription.metadata?.plan_type ||
            (subscription.items.data[0].price.id === process.env.STRIPE_FOUNDER_PRICE_ID ? 'founder' : 'solo');

          // Update our database with Stripe data
          const updateData = {
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0].price.id,
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            plan_type: planType,
            billing_status: 'paying',
          };

          const { error: updateError } = await supabaseAdmin
            .from('practitioners')
            .update(updateData)
            .eq('id', practitioner.id);

          if (updateError) {
            console.error('Error updating practitioner with Stripe data:', updateError);
          } else {
            console.log('Successfully synced subscription data to database');
          }

          // Return updated data
          return NextResponse.json({
            ...practitioner,
            ...updateData,
          });
        } else {
          console.log('No active subscriptions found in Stripe');
        }
      } catch (stripeError) {
        console.error('Error syncing from Stripe:', stripeError);
        // Continue with database data if Stripe sync fails
      }
    }

    return NextResponse.json(practitioner);
  } catch (error) {
    console.error('Error fetching billing status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing status' },
      { status: 500 }
    );
  }
}
