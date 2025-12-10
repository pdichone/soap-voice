import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { PLANS } from '@/lib/stripe';

export interface SubscriptionStatsResponse {
  mrr: number;
  active_count: number;
  trialing_count: number;
  past_due_count: number;
  canceled_count: number;
  churn_rate: number;
  total_revenue: number;
  revenue_this_month: number;
  trial_conversion_rate: number;
  founder_count: number;
  solo_count: number;
}

// GET /api/admin/subscriptions/stats
export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Get all practitioners with billing data
    const { data: practitioners, error } = await supabase
      .from('practitioners')
      .select(`
        subscription_status,
        plan_type,
        billing_status,
        billing_started_at,
        current_period_end,
        monthly_price
      `)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching subscription stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscription stats' },
        { status: 500 }
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    // Future use: revenue_this_month calculation
    const _startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    void _startOfMonth;

    // Count by subscription status
    const active_count = practitioners?.filter(
      (p) => p.subscription_status === 'active'
    ).length || 0;

    const trialing_count = practitioners?.filter(
      (p) => p.subscription_status === 'trialing' || p.billing_status === 'trial'
    ).length || 0;

    const past_due_count = practitioners?.filter(
      (p) => p.subscription_status === 'past_due' || p.billing_status === 'overdue'
    ).length || 0;

    const canceled_count = practitioners?.filter(
      (p) => p.subscription_status === 'canceled' || p.billing_status === 'cancelled'
    ).length || 0;

    // Count by plan type (among active subscribers)
    const activeSubscribers = practitioners?.filter(
      (p) => p.subscription_status === 'active'
    ) || [];

    const founder_count = activeSubscribers.filter(
      (p) => p.plan_type === 'founder'
    ).length;

    const solo_count = activeSubscribers.filter(
      (p) => p.plan_type === 'solo'
    ).length;

    // Calculate MRR: (founder_count × $29) + (solo_count × $39)
    const mrr = (founder_count * PLANS.founder.price) + (solo_count * PLANS.solo.price);

    // Estimate total revenue (MRR × months since first billing)
    // For simplicity, calculate based on current active subscribers
    const total_revenue = mrr * 3; // Placeholder - would need actual payment data from Stripe

    // Revenue this month (same as MRR for monthly subscriptions)
    const revenue_this_month = mrr;

    // Calculate churn rate: canceled in last 30 days / (active + canceled in last 30 days)
    const recentlyCanceled = practitioners?.filter(
      (p) =>
        (p.subscription_status === 'canceled' || p.billing_status === 'cancelled') &&
        p.current_period_end &&
        new Date(p.current_period_end) > thirtyDaysAgo
    ).length || 0;

    const churnDenominator = active_count + recentlyCanceled;
    const churn_rate = churnDenominator > 0
      ? Math.round((recentlyCanceled / churnDenominator) * 100 * 10) / 10
      : 0;

    // Trial conversion rate: paying / (paying + canceled with billing_started)
    const convertedFromTrial = practitioners?.filter(
      (p) => p.subscription_status === 'active' && p.billing_started_at
    ).length || 0;

    const totalWithTrial = practitioners?.filter(
      (p) => p.billing_started_at || p.billing_status === 'trial'
    ).length || 1;

    const trial_conversion_rate = Math.round((convertedFromTrial / totalWithTrial) * 100);

    const stats: SubscriptionStatsResponse = {
      mrr,
      active_count,
      trialing_count,
      past_due_count,
      canceled_count,
      churn_rate,
      total_revenue,
      revenue_this_month,
      trial_conversion_rate,
      founder_count,
      solo_count,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription stats' },
      { status: 500 }
    );
  }
}
