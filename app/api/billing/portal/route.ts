import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

export async function POST(request: NextRequest) {
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

    // Get practitioner's Stripe customer ID
    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (practitionerError || !practitioner?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 }
      );
    }

    // Get the site URL for redirect - use the origin from the request to maintain session cookies
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/');
    const siteUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: practitioner.stripe_customer_id,
      return_url: `${siteUrl}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
