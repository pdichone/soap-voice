import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';

// GET /api/data/settings - Get profile and practice settings for effective user
export async function GET() {
  try {
    const impersonation = await getImpersonationContext();
    let userId: string | null = null;
    let client;

    if (impersonation.isImpersonating && impersonation.practitionerId) {
      // Get practitioner's user_id using service role
      const adminClient = createServiceRoleClient();
      const { data: practitioner } = await adminClient
        .from('practitioners')
        .select('user_id')
        .eq('id', impersonation.practitionerId)
        .single();

      userId = practitioner?.user_id || null;
      client = adminClient;

      if (!userId) {
        return NextResponse.json({ profile: null, practice: null });
      }
    } else {
      // Not impersonating - use regular Supabase client with RLS
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      userId = user.id;
      client = supabase;
    }

    // Get profile
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Get practice settings if user has a practice
    let practice = null;
    if (profile?.practice_id) {
      const { data: practiceData } = await client
        .from('practices')
        .select('*')
        .eq('id', profile.practice_id)
        .single();
      practice = practiceData;
    }

    return NextResponse.json({ profile, practice, userId });
  } catch (error) {
    console.error('Error in settings API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/data/settings - Update profile settings
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { profile: profileUpdates, practice: practiceUpdates } = body;

    const impersonation = await getImpersonationContext();
    let userId: string | null = null;
    let client;

    if (impersonation.isImpersonating && impersonation.practitionerId) {
      const adminClient = createServiceRoleClient();
      const { data: practitioner } = await adminClient
        .from('practitioners')
        .select('user_id')
        .eq('id', impersonation.practitionerId)
        .single();

      userId = practitioner?.user_id || null;
      client = adminClient;

      if (!userId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    } else {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      userId = user.id;
      client = supabase;
    }

    // Update profile if provided
    if (profileUpdates) {
      const { error: profileError } = await client
        .from('profiles')
        .upsert({ id: userId, ...profileUpdates });

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }
    }

    // Update practice if provided
    if (practiceUpdates && practiceUpdates.practice_id) {
      const { error: practiceError } = await client
        .from('practices')
        .update({ settings: practiceUpdates.settings })
        .eq('id', practiceUpdates.practice_id);

      if (practiceError) {
        console.error('Error updating practice:', practiceError);
        return NextResponse.json({ error: 'Failed to update practice' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in settings update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
