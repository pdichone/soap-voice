import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { stripe, PLANS } from '@/lib/stripe';
import { logAdminEvent } from '@/lib/db/admin-queries';

// POST /api/admin/subscriptions/[id]/sync - Sync subscription status from Stripe
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
    const supabase = createServiceRoleClient();

    // Get practitioner
    const { data: practitioner, error: fetchError } = await supabase
      .from('practitioners')
      .select('id, name, email, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Try to find subscription - either by stored ID or by looking up customer's subscriptions
    let subscriptionId: string;

    if (practitioner.stripe_subscription_id) {
      subscriptionId = practitioner.stripe_subscription_id;
    } else if (practitioner.stripe_customer_id) {
      // Look up subscription by customer ID
      const subscriptions = await stripe.subscriptions.list({
        customer: practitioner.stripe_customer_id,
        limit: 1,
        status: 'all',
      });

      if (subscriptions.data.length === 0) {
        return NextResponse.json(
          { error: 'No Stripe subscription found for this customer' },
          { status: 400 }
        );
      }

      subscriptionId = subscriptions.data[0].id;
    } else {
      return NextResponse.json(
        { error: 'No Stripe customer or subscription ID found' },
        { status: 400 }
      );
    }

    // Fetch full subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Map Stripe status to billing status
    let billingStatus: string;
    switch (subscription.status) {
      case 'active':
        billingStatus = 'paying';
        break;
      case 'trialing':
        billingStatus = 'trial';
        break;
      case 'past_due':
        billingStatus = 'overdue';
        break;
      case 'canceled':
      case 'unpaid':
        billingStatus = 'cancelled';
        break;
      default:
        billingStatus = 'trial';
    }

    // Get plan type from price
    let planType = practitioner.subscription_status;
    const priceId = subscription.items.data[0]?.price.id;

    // Check which plan this price belongs to
    for (const [key, plan] of Object.entries(PLANS)) {
      if (plan.priceId === priceId) {
        planType = key;
        break;
      }
    }

    // Update practitioner with current Stripe data
    const updateData = {
      stripe_subscription_id: subscription.id, // Always save/update the subscription ID
      subscription_status: subscription.status,
      billing_status: billingStatus,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      stripe_price_id: priceId,
      plan_type: planType,
      // Set billing_started_at if not already set and subscription is active
      ...(subscription.status === 'active' && {
        billing_started_at: new Date(subscription.start_date * 1000).toISOString(),
      }),
    };

    const { error: updateError } = await supabase
      .from('practitioners')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error syncing subscription:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    // Log admin event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.subscription_synced',
      practitionerId: id,
      description: `Synced subscription status from Stripe for ${practitioner.name || practitioner.email}: ${practitioner.subscription_status} → ${subscription.status}`,
      metadata: {
        previous_status: practitioner.subscription_status,
        new_status: subscription.status,
        stripe_subscription_id: subscription.id,
      },
    });

    return NextResponse.json({
      success: true,
      previous_status: practitioner.subscription_status,
      new_status: subscription.status,
      billing_status: billingStatus,
    });
  } catch (error) {
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}
