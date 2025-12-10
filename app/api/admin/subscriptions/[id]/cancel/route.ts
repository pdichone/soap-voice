import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { logAdminEvent } from '@/lib/db/admin-queries';
import { stripe } from '@/lib/stripe';

interface CancelRequest {
  immediate?: boolean;
  reason?: string;
}

// POST /api/admin/subscriptions/[id]/cancel
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
    const body: CancelRequest = await request.json();
    const { immediate = false, reason = '' } = body;

    const supabase = createServiceRoleClient();

    // Get practitioner
    const { data: practitioner, error: fetchError } = await supabase
      .from('practitioners')
      .select('id, name, email, stripe_subscription_id, subscription_status, current_period_end')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    if (!practitioner.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription to cancel' },
        { status: 400 }
      );
    }

    // Cancel via Stripe
    try {
      if (immediate) {
        // Cancel immediately
        await stripe.subscriptions.cancel(practitioner.stripe_subscription_id);
      } else {
        // Cancel at period end
        await stripe.subscriptions.update(practitioner.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      }
    } catch (stripeError) {
      console.error('Error canceling Stripe subscription:', stripeError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription in Stripe' },
        { status: 500 }
      );
    }

    // Update practitioner record
    const updateData: Record<string, unknown> = {
      billing_status: 'cancelled',
    };

    if (immediate) {
      updateData.subscription_status = 'canceled';
      updateData.current_period_end = new Date().toISOString();
    } else {
      // Will be canceled at period end, status remains active until then
      updateData.subscription_status = 'active'; // Stripe keeps it active until period end
    }

    const { error: updateError } = await supabase
      .from('practitioners')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating practitioner:', updateError);
      // Continue anyway since Stripe was already updated
    }

    // Log admin event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: immediate ? 'admin.subscription_canceled_immediate' : 'admin.subscription_canceled_period_end',
      practitionerId: id,
      description: `Canceled subscription for ${practitioner.name || practitioner.email}${immediate ? ' (immediate)' : ' (at period end)'}`,
      metadata: {
        immediate,
        reason,
        previous_status: practitioner.subscription_status,
        period_end: practitioner.current_period_end,
      },
    });

    return NextResponse.json({
      success: true,
      canceled_immediately: immediate,
      effective_date: immediate
        ? new Date().toISOString()
        : practitioner.current_period_end,
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
