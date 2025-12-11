import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

// Use service role for webhook processing (no user auth)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`Processing Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'invoice.paid':
      case 'invoice_payment.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const practitionerId = session.metadata?.practitioner_id;
  const planType = session.metadata?.plan_type;

  if (!practitionerId) {
    console.error('No practitioner_id in checkout session metadata');
    return;
  }

  // Get subscription details
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update practitioner with subscription info
  const { error } = await supabaseAdmin
    .from('practitioners')
    .update({
      stripe_subscription_id: subscriptionId,
      stripe_price_id: subscription.items.data[0].price.id,
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_type: planType || 'solo',
      billing_status: subscription.status === 'trialing' ? 'trial' : 'paying',
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      billing_started_at: new Date().toISOString(),
    })
    .eq('id', practitionerId);

  if (error) {
    console.error('Error updating practitioner after checkout:', error);
  }

  // Mark the payment link as completed
  const { error: linkError } = await supabaseAdmin
    .from('payment_links')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('stripe_checkout_session_id', session.id);

  if (linkError) {
    console.error('Error updating payment link status:', linkError);
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find practitioner by Stripe customer ID
  const { data: practitioner, error: findError } = await supabaseAdmin
    .from('practitioners')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (findError || !practitioner) {
    console.error('Practitioner not found for customer:', customerId);
    return;
  }

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

  const { error } = await supabaseAdmin
    .from('practitioners')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0].price.id,
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      billing_status: billingStatus,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    })
    .eq('id', practitioner.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: practitioner } = await supabaseAdmin
    .from('practitioners')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!practitioner) return;

  const { error } = await supabaseAdmin
    .from('practitioners')
    .update({
      subscription_status: 'canceled',
      billing_status: 'cancelled',
    })
    .eq('id', practitioner.id);

  if (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: practitioner } = await supabaseAdmin
    .from('practitioners')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!practitioner) return;

  const { error } = await supabaseAdmin
    .from('practitioners')
    .update({
      billing_status: 'overdue',
    })
    .eq('id', practitioner.id);

  if (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: practitioner } = await supabaseAdmin
    .from('practitioners')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!practitioner) return;

  // Only update to paying if it was overdue
  const { error } = await supabaseAdmin
    .from('practitioners')
    .update({
      billing_status: 'paying',
    })
    .eq('id', practitioner.id)
    .eq('billing_status', 'overdue');

  if (error) {
    console.error('Error handling payment success:', error);
  }
}
