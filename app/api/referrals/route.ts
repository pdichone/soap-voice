import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const clientId = formData.get('client_id') as string;
    const providerName = formData.get('provider_name') as string;
    const referralDate = formData.get('referral_date') as string;
    const diagnosis = formData.get('diagnosis') as string | null;
    const icdCode = formData.get('icd_code') as string | null;
    const visitsAuthorized = formData.get('visits_authorized') as string | null;
    const expirationDate = formData.get('expiration_date') as string | null;
    const referringProviderId = formData.get('referring_provider_id') as string | null;
    const notes = formData.get('notes') as string | null;
    const file = formData.get('document') as File | null;

    if (!clientId || !providerName || !referralDate) {
      return NextResponse.json(
        { error: 'Client ID, provider name, and referral date are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Verify client belongs to this therapist
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('therapist_id', user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    let documentUrl: string | null = null;
    let documentName: string | null = null;

    // Upload document if provided
    if (file && file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${clientId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('referral-documents')
        .upload(fileName, file, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
      }

      // Get the public URL (or signed URL for private bucket)
      const { data: urlData } = supabase.storage
        .from('referral-documents')
        .getPublicUrl(uploadData.path);

      documentUrl = urlData.publicUrl;
      documentName = file.name;
    }

    // Create referral record
    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        client_id: clientId,
        therapist_id: user.id,
        referring_provider_id: referringProviderId || null,
        provider_name: providerName,
        referral_date: referralDate,
        diagnosis: diagnosis || null,
        icd_code: icdCode || null,
        visits_authorized: visitsAuthorized ? parseInt(visitsAuthorized) : null,
        expiration_date: expirationDate || null,
        document_url: documentUrl,
        document_name: documentName,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: 'Failed to create referral' }, { status: 500 });
    }

    return NextResponse.json({ referral, message: 'Referral created successfully' });
  } catch (error) {
    console.error('Referral creation error:', error);
    return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 });
  }
}
