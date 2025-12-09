import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

export async function DELETE() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
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
              // Ignore
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Count demo patients before deletion
    const { count: demoPatientCount } = await supabase
      .from('patients_non_phi')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .like('display_name', '%(Demo)%');

    if (!demoPatientCount || demoPatientCount === 0) {
      return NextResponse.json(
        { error: 'No demo data found to delete' },
        { status: 400 }
      );
    }

    // Delete demo patients (cascades to visits, payments, referrals due to ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from('patients_non_phi')
      .delete()
      .eq('owner_user_id', user.id)
      .like('display_name', '%(Demo)%');

    if (deleteError) {
      console.error('Error deleting demo data:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete demo data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Demo data deleted successfully`,
      data: {
        patients_deleted: demoPatientCount,
      },
    });
  } catch (error) {
    console.error('Error deleting demo data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
