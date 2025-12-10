import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { logAdminEvent } from '@/lib/db/admin-queries';
import { stripe } from '@/lib/stripe';

interface RefundRequest {
  amount_cents?: number; // If not provided, refund full last payment
  reason: string;
}

// POST /api/admin/subscriptions/[id]/refund
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
    const body: RefundRequest = await request.json();
    const { amount_cents, reason } = body;

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json(
        { error: 'A reason is required for refunds' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get practitioner
    const { data: practitioner, error: fetchError } = await supabase
      .from('practitioners')
      .select('id, name, email, stripe_customer_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    if (!practitioner.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this practitioner' },
        { status: 400 }
      );
    }

    // Get the most recent successful charge for this customer
    const charges = await stripe.charges.list({
      customer: practitioner.stripe_customer_id,
      limit: 1,
    });

    if (charges.data.length === 0) {
      return NextResponse.json(
        { error: 'No charges found to refund' },
        { status: 400 }
      );
    }

    const charge = charges.data[0];

    // Check if charge is already fully refunded
    if (charge.refunded) {
      return NextResponse.json(
        { error: 'This charge has already been fully refunded' },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const refundAmount = amount_cents || charge.amount;
    const maxRefundable = charge.amount - (charge.amount_refunded || 0);

    if (refundAmount > maxRefundable) {
      return NextResponse.json(
        { error: `Maximum refundable amount is $${(maxRefundable / 100).toFixed(2)}` },
        { status: 400 }
      );
    }

    // Issue refund via Stripe
    let refund;
    try {
      refund = await stripe.refunds.create({
        charge: charge.id,
        amount: refundAmount,
        reason: 'requested_by_customer',
        metadata: {
          admin_id: admin.id,
          admin_reason: reason,
          practitioner_id: id,
        },
      });
    } catch (stripeError) {
      console.error('Error issuing Stripe refund:', stripeError);
      return NextResponse.json(
        { error: 'Failed to issue refund in Stripe' },
        { status: 500 }
      );
    }

    // Log admin event
    await logAdminEvent({
      admin_id: admin.id,
      event_type: 'subscription_refund_issued',
      description: `Issued $${(refundAmount / 100).toFixed(2)} refund for ${practitioner.name || practitioner.email}`,
      target_type: 'practitioner',
      target_id: id,
      metadata: {
        refund_id: refund.id,
        amount_cents: refundAmount,
        charge_id: charge.id,
        reason,
        original_charge_amount: charge.amount,
      },
    });

    return NextResponse.json({
      success: true,
      refund_id: refund.id,
      amount_refunded: refundAmount,
      amount_refunded_formatted: `$${(refundAmount / 100).toFixed(2)}`,
    });
  } catch (error) {
    console.error('Error issuing refund:', error);
    return NextResponse.json(
      { error: 'Failed to issue refund' },
      { status: 500 }
    );
  }
}
