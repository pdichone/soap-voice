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

  // Fetch the consent link with document template and patient info
  const { data: link, error: linkError } = await supabaseAdmin
    .from('consent_links')
    .select(`
      *,
      document_templates (*),
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

  // Check if already signed
  if (link.signed_at) {
    return NextResponse.json({
      already_signed: true,
      patient_name: link.patients_non_phi?.display_name || 'Client',
    });
  }

  return NextResponse.json({
    document: link.document_templates,
    patient_name: link.patients_non_phi?.display_name || 'Client',
    already_signed: false,
    expired: false,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  // Fetch the consent link
  const { data: link, error: linkError } = await supabaseAdmin
    .from('consent_links')
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

  // Check if already signed
  if (link.signed_at) {
    return NextResponse.json(
      { error: 'This document has already been signed' },
      { status: 400 }
    );
  }

  // Get client info
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const now = new Date().toISOString();

  // Check if a client_document record already exists for this combination
  const { data: existingDoc } = await supabaseAdmin
    .from('client_documents')
    .select('id')
    .eq('owner_user_id', link.owner_user_id)
    .eq('patient_id', link.patient_id)
    .eq('template_id', link.template_id)
    .single();

  let docError;

  if (existingDoc) {
    // Update existing record
    const { error } = await supabaseAdmin
      .from('client_documents')
      .update({
        status: 'SIGNED',
        signed_at: now,
        signature_data: `Signed electronically via link. IP: ${ip}, User-Agent: ${userAgent}`,
      })
      .eq('id', existingDoc.id);
    docError = error;
  } else {
    // Insert new record
    const { error } = await supabaseAdmin
      .from('client_documents')
      .insert({
        owner_user_id: link.owner_user_id,
        patient_id: link.patient_id,
        template_id: link.template_id,
        status: 'SIGNED',
        signed_at: now,
        signature_data: `Signed electronically via link. IP: ${ip}, User-Agent: ${userAgent}`,
      });
    docError = error;
  }

  if (docError) {
    console.error('Error saving signature:', docError);
    return NextResponse.json(
      { error: 'Failed to save signature' },
      { status: 500 }
    );
  }

  // Mark the link as signed
  await supabaseAdmin
    .from('consent_links')
    .update({ signed_at: now })
    .eq('id', link.id);

  return NextResponse.json({ success: true });
}
