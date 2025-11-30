import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface Props {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { id } = await params;

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

    // Get referral to check ownership and get document URL for cleanup
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', id)
      .eq('therapist_id', user.id)
      .single();

    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    // Delete document from storage if exists
    if (referral.document_url) {
      // Extract path from URL
      const urlParts = referral.document_url.split('/referral-documents/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage
          .from('referral-documents')
          .remove([filePath]);
      }
    }

    // Delete referral record
    const { error } = await supabase
      .from('referrals')
      .delete()
      .eq('id', id)
      .eq('therapist_id', user.id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete referral' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Referral deleted successfully' });
  } catch (error) {
    console.error('Referral deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete referral' }, { status: 500 });
  }
}
