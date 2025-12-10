import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';

export interface SubscriptionListItem {
  id: string;
  name: string;
  email: string;
  subscription_status: string | null;
  plan_type: string | null;
  monthly_price: number | null;
  current_period_end: string | null;
  billing_started_at: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// GET /api/admin/subscriptions?status=all&search=&page=1&limit=20
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const supabase = createServiceRoleClient();

    // Build query
    let query = supabase
      .from('practitioners')
      .select(`
        id,
        name,
        email,
        subscription_status,
        plan_type,
        monthly_price,
        current_period_end,
        billing_started_at,
        trial_ends_at,
        stripe_customer_id,
        stripe_subscription_id,
        created_at
      `, { count: 'exact' })
      .is('deleted_at', null);

    // Filter by status
    if (status !== 'all') {
      if (status === 'trialing') {
        // Check both subscription_status and billing_status for trial
        query = query.or('subscription_status.eq.trialing,billing_status.eq.trial');
      } else if (status === 'past_due') {
        query = query.or('subscription_status.eq.past_due,billing_status.eq.overdue');
      } else if (status === 'canceled') {
        query = query.or('subscription_status.eq.canceled,billing_status.eq.cancelled');
      } else {
        query = query.eq('subscription_status', status);
      }
    }

    // Search by name or email
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    // Paginate
    query = query.range(offset, offset + limit - 1);

    const { data: practitioners, error, count } = await query;

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    const subscriptions: SubscriptionListItem[] = (practitioners || []).map((p) => ({
      id: p.id,
      name: p.name || 'Unknown',
      email: p.email || '',
      subscription_status: p.subscription_status,
      plan_type: p.plan_type,
      monthly_price: p.monthly_price,
      current_period_end: p.current_period_end,
      billing_started_at: p.billing_started_at,
      trial_ends_at: p.trial_ends_at,
      stripe_customer_id: p.stripe_customer_id,
      stripe_subscription_id: p.stripe_subscription_id,
      created_at: p.created_at,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    const response: SubscriptionsResponse = {
      subscriptions,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
