import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { PLANS } from '@/lib/stripe';

export interface SubscriptionDetailResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subscription_status: string | null;
  plan_type: string | null;
  monthly_price: number | null;
  current_period_end: string | null;
  billing_started_at: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_status: string | null;
  created_at: string;
  // Activity log
  recent_events: Array<{
    id: string;
    event_type: string;
    description: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    admin_name: string | null;
  }>;
  // Stripe links
  stripe_customer_url: string | null;
  stripe_subscription_url: string | null;
}

// GET /api/admin/subscriptions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Debug: Log incoming request info
    const url = new URL(request.url);
    console.log('[Subscription Detail] Request URL:', request.url);
    console.log('[Subscription Detail] Pathname:', url.pathname);

    // Get ID from params, with URL fallback for robustness
    let id: string;
    let idSource = 'params';
    try {
      const resolvedParams = await params;
      id = resolvedParams.id;
      console.log('[Subscription Detail] ID from params:', id);
    } catch {
      // Fallback: extract ID from URL path
      idSource = 'url_fallback';
      const pathParts = url.pathname.split('/');
      id = pathParts[pathParts.length - 1];
      console.log('[Subscription Detail] ID from URL fallback:', id, 'path parts:', pathParts);
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing subscription ID', debug: { url: request.url, pathname: url.pathname } }, { status: 400 });
    }

    console.log('[Subscription Detail] Using ID:', id, 'from:', idSource);

    const supabase = createServiceRoleClient();

    // Get practitioner details
    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select(`
        id,
        name,
        email,
        phone,
        subscription_status,
        plan_type,
        monthly_price,
        current_period_end,
        billing_started_at,
        trial_ends_at,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        billing_status,
        created_at
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    console.log('[Subscription Detail] Query result:', { practitioner: !!practitioner, error: practitionerError });

    if (practitionerError || !practitioner) {
      console.error('Subscription lookup failed:', { id, idSource, error: practitionerError });
      return NextResponse.json(
        {
          error: 'Subscription not found',
          debug: {
            id,
            idSource,
            url: request.url,
            dbError: practitionerError?.message || null
          }
        },
        { status: 404 }
      );
    }

    // Get recent admin events for this practitioner
    const { data: events, error: eventsError } = await supabase
      .from('admin_events')
      .select(`
        id,
        event_type,
        description,
        metadata,
        created_at,
        admin_users (
          name
        )
      `)
      .eq('target_id', id)
      .eq('target_type', 'practitioner')
      .order('created_at', { ascending: false })
      .limit(20);

    if (eventsError) {
      console.error('Error fetching admin events:', eventsError);
    }

    // Format events
    const recent_events = (events || []).map((event) => ({
      id: event.id,
      event_type: event.event_type,
      description: event.description,
      metadata: event.metadata,
      created_at: event.created_at,
      admin_name: (event.admin_users as { name: string }[] | null)?.[0]?.name || null,
    }));

    // Build Stripe dashboard URLs
    const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
    const stripeBaseUrl = isLiveMode
      ? 'https://dashboard.stripe.com'
      : 'https://dashboard.stripe.com/test';

    const stripe_customer_url = practitioner.stripe_customer_id
      ? `${stripeBaseUrl}/customers/${practitioner.stripe_customer_id}`
      : null;

    const stripe_subscription_url = practitioner.stripe_subscription_id
      ? `${stripeBaseUrl}/subscriptions/${practitioner.stripe_subscription_id}`
      : null;

    // Calculate monthly price if not set
    let monthly_price = practitioner.monthly_price;
    if (!monthly_price && practitioner.plan_type) {
      const plan = PLANS[practitioner.plan_type as keyof typeof PLANS];
      if (plan) {
        monthly_price = plan.price;
      }
    }

    const response: SubscriptionDetailResponse = {
      id: practitioner.id,
      name: practitioner.name || 'Unknown',
      email: practitioner.email || '',
      phone: practitioner.phone,
      subscription_status: practitioner.subscription_status,
      plan_type: practitioner.plan_type,
      monthly_price,
      current_period_end: practitioner.current_period_end,
      billing_started_at: practitioner.billing_started_at,
      trial_ends_at: practitioner.trial_ends_at,
      stripe_customer_id: practitioner.stripe_customer_id,
      stripe_subscription_id: practitioner.stripe_subscription_id,
      stripe_price_id: practitioner.stripe_price_id,
      billing_status: practitioner.billing_status,
      created_at: practitioner.created_at,
      recent_events,
      stripe_customer_url,
      stripe_subscription_url,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching subscription detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription detail' },
      { status: 500 }
    );
  }
}
