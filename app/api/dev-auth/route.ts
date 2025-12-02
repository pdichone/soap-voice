import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// This route only works in dev mode
export async function POST() {
  // Only allow in dev mode
  if (process.env.NEXT_PUBLIC_DEV_MODE !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const devEmail = process.env.DEV_USER_EMAIL || 'dev@soapvoice.test';
  const devPassword = process.env.DEV_USER_PASSWORD || 'devpassword123';

  // Use service role to create user if needed
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Check if dev user exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const devUser = existingUsers?.users.find(u => u.email === devEmail);

  let userId: string;

  if (!devUser) {
    // Create the dev user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: devEmail,
      password: devPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: { full_name: 'Dev User' }
    });

    if (createError) {
      console.error('Error creating dev user:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    userId = newUser.user.id;
    console.log('Created dev user:', userId);

    // Create profile for dev user
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: 'Dev User',
      timezone: 'America/Los_Angeles'
    });
  } else {
    userId = devUser.id;
  }

  // Return credentials for client-side sign in
  return NextResponse.json({
    email: devEmail,
    password: devPassword,
    userId
  });
}
