import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { logAdminEvent } from '@/lib/db/admin-queries';
import { stripe } from '@/lib/stripe';

interface ExtendTrialRequest {
  days: number;
}

// POST /api/admin/subscriptions/[id]/extend-trial
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
    const body: ExtendTrialRequest = await request.json();
    const { days } = body;

    if (!days || days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'Days must be between 1 and 90' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get practitioner
    const { data: practitioner, error: fetchError } = await supabase
      .from('practitioners')
      .select('id, name, email, trial_ends_at, stripe_subscription_id, subscription_status')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Calculate new trial end date
    const baseDate = practitioner.trial_ends_at
      ? new Date(practitioner.trial_ends_at)
      : new Date();

    const newTrialEndsAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    // If there's a Stripe subscription in trial, update it
    if (practitioner.stripe_subscription_id && practitioner.subscription_status === 'trialing') {
      try {
        await stripe.subscriptions.update(practitioner.stripe_subscription_id, {
          trial_end: Math.floor(newTrialEndsAt.getTime() / 1000),
        });
      } catch (stripeError) {
        console.error('Error updating Stripe trial:', stripeError);
        // Continue anyway to update our database
      }
    }

    // Update practitioner record
    const { error: updateError } = await supabase
      .from('practitioners')
      .update({
        trial_ends_at: newTrialEndsAt.toISOString(),
        billing_status: 'trial',
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error extending trial:', updateError);
      return NextResponse.json(
        { error: 'Failed to extend trial' },
        { status: 500 }
      );
    }

    // Log admin event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.subscription_trial_extended',
      practitionerId: id,
      description: `Extended trial by ${days} days for ${practitioner.name || practitioner.email}`,
      metadata: {
        days_added: days,
        new_trial_ends_at: newTrialEndsAt.toISOString(),
        previous_trial_ends_at: practitioner.trial_ends_at,
      },
    });

    return NextResponse.json({
      success: true,
      new_trial_ends_at: newTrialEndsAt.toISOString(),
    });
  } catch (error) {
    console.error('Error extending trial:', error);
    return NextResponse.json(
      { error: 'Failed to extend trial' },
      { status: 500 }
    );
  }
}
