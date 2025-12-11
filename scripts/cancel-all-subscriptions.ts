import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cancelAllSubscriptions() {
  console.log('Fetching all Stripe subscriptions...\n');
  
  // List all subscriptions (active, trialing, past_due)
  const subscriptions = await stripe.subscriptions.list({
    status: 'all',
    limit: 100,
  });
  
  console.log(`Found ${subscriptions.data.length} subscriptions:\n`);
  
  for (const sub of subscriptions.data) {
    console.log(`- ${sub.id}: ${sub.status} (customer: ${sub.customer})`);
    
    // Only cancel if not already canceled
    if (sub.status !== 'canceled') {
      try {
        await stripe.subscriptions.cancel(sub.id);
        console.log(`  ✓ Canceled`);
      } catch (err) {
        console.log(`  ✗ Error: ${err}`);
      }
    } else {
      console.log(`  (already canceled)`);
    }
  }
  
  console.log('\n--- Resetting practitioners in database ---\n');
  
  // Reset all practitioners' billing fields
  const { data: practitioners, error: fetchError } = await supabase
    .from('practitioners')
    .select('id, email, stripe_subscription_id')
    .not('stripe_subscription_id', 'is', null);
  
  if (fetchError) {
    console.error('Error fetching practitioners:', fetchError);
    return;
  }
  
  console.log(`Found ${practitioners?.length || 0} practitioners with subscriptions\n`);
  
  for (const p of practitioners || []) {
    console.log(`- ${p.email}: ${p.stripe_subscription_id}`);
    
    const { error: updateError } = await supabase
      .from('practitioners')
      .update({
        stripe_subscription_id: null,
        subscription_status: null,
        billing_status: 'none',
        trial_ends_at: null,
        current_period_end: null,
        billing_started_at: null,
      })
      .eq('id', p.id);
    
    if (updateError) {
      console.log(`  ✗ Error: ${updateError.message}`);
    } else {
      console.log(`  ✓ Reset`);
    }
  }
  
  console.log('\n✅ Done! All subscriptions canceled and practitioners reset.');
}

cancelAllSubscriptions().catch(console.error);
