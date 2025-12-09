import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

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
      // Return default trial status if no practitioner found
      return NextResponse.json({
        plan_type: 'trial',
        billing_status: 'trial',
        subscription_status: 'trialing',
        trial_ends_at: null,
        current_period_end: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
      });
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
