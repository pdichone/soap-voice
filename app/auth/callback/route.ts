import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
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
              // Can't set cookies in edge runtime in some cases
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if therapist profile exists, create if not
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: therapist } = await supabase
          .from('therapists')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!therapist) {
          await supabase.from('therapists').insert({
            id: user.id,
            name: user.email?.split('@')[0] || 'Therapist',
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong, redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
