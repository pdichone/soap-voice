import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAdminUser } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { logAdminEvent } from '@/lib/db/admin-queries';
import { PLANS } from '@/lib/stripe';
import { generatePaymentLinkEmail } from '@/lib/email-templates/payment-link';
import type { SendPaymentEmailRequest, PaymentLink } from '@/lib/types-billing';

// Lazy-initialize Resend to avoid build-time errors
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// POST /api/admin/practitioners/[id]/send-payment-email
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
    const body: SendPaymentEmailRequest = await request.json();
    const { payment_link_id } = body;

    if (!payment_link_id) {
      return NextResponse.json(
        { error: 'payment_link_id is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get practitioner
    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select('id, name, email')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (practitionerError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Get payment link
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', payment_link_id)
      .eq('practitioner_id', id)
      .single();

    if (linkError || !paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    const typedPaymentLink = paymentLink as PaymentLink;

    // Check if link is expired
    if (new Date(typedPaymentLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Payment link has expired. Please generate a new link.' },
        { status: 400 }
      );
    }

    // Check if link is already completed
    if (typedPaymentLink.status === 'completed') {
      return NextResponse.json(
        { error: 'This payment link has already been used.' },
        { status: 400 }
      );
    }

    // Get plan info
    const planType = typedPaymentLink.plan_type as keyof typeof PLANS;
    const planInfo = PLANS[planType] || PLANS.founder;

    // Generate email content
    const { subject, html } = generatePaymentLinkEmail({
      practitionerName: practitioner.name || 'there',
      checkoutUrl: typedPaymentLink.checkout_url,
      planName: planInfo.name,
      planPrice: planInfo.price,
      expiresAt: typedPaymentLink.expires_at,
    });

    // Send email via Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@zenleef.com';

    try {
      const { error: emailError } = await getResend().emails.send({
        from: `ZenLeef <${fromEmail}>`,
        to: practitioner.email,
        subject,
        html,
      });

      if (emailError) {
        console.error('Resend error:', emailError);
        return NextResponse.json(
          { error: 'Failed to send email' },
          { status: 500 }
        );
      }
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    // Log admin event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.payment_email_sent',
      practitionerId: id,
      description: `Sent ${planInfo.name} plan payment email to ${practitioner.email}`,
      metadata: {
        payment_link_id,
        plan_type: typedPaymentLink.plan_type,
        email: practitioner.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Payment link email sent to ${practitioner.email}`,
    });
  } catch (error) {
    console.error('Error sending payment email:', error);
    return NextResponse.json(
      { error: 'Failed to send payment email' },
      { status: 500 }
    );
  }
}
