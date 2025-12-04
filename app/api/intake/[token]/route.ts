import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for public access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  // Fetch the intake link with form and patient info
  const { data: link, error: linkError } = await supabaseAdmin
    .from('intake_links')
    .select(`
      *,
      intake_forms (*),
      patients_non_phi (display_name)
    `)
    .eq('token', token)
    .single();

  if (linkError || !link) {
    return NextResponse.json(
      { error: 'Invalid or expired link' },
      { status: 404 }
    );
  }

  // Check if expired
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired' },
      { status: 410 }
    );
  }

  // Check if already completed
  if (link.completed_at) {
    return NextResponse.json({
      already_completed: true,
      patient_name: link.patients_non_phi?.display_name || 'Client',
    });
  }

  return NextResponse.json({
    form: link.intake_forms,
    patient_name: link.patients_non_phi?.display_name || 'Client',
    already_completed: false,
    expired: false,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  const body = await request.json();
  const { responses } = body;

  // Fetch the intake link
  const { data: link, error: linkError } = await supabaseAdmin
    .from('intake_links')
    .select('*')
    .eq('token', token)
    .single();

  if (linkError || !link) {
    return NextResponse.json(
      { error: 'Invalid or expired link' },
      { status: 404 }
    );
  }

  // Check if expired
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired' },
      { status: 410 }
    );
  }

  // Check if already completed
  if (link.completed_at) {
    return NextResponse.json(
      { error: 'This form has already been submitted' },
      { status: 400 }
    );
  }

  // Get client info
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Save the response
  const { error: responseError } = await supabaseAdmin
    .from('intake_responses')
    .insert({
      link_id: link.id,
      form_id: link.form_id,
      patient_id: link.patient_id,
      owner_user_id: link.owner_user_id,
      responses,
      ip_address: ip,
      user_agent: userAgent,
    });

  if (responseError) {
    console.error('Error saving response:', responseError);
    return NextResponse.json(
      { error: 'Failed to save response' },
      { status: 500 }
    );
  }

  // Mark the link as completed
  await supabaseAdmin
    .from('intake_links')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', link.id);

  return NextResponse.json({ success: true });
}
