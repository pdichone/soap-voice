'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient();

      // Check for hash fragment (client-side only)
      if (typeof window !== 'undefined' && window.location.hash) {
        console.log('Hash fragment detected, attempting to handle...');

        // Parse hash fragment
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        console.log('Hash params:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, type });

        if (accessToken && refreshToken) {
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Error setting session:', error);
              setErrorMessage(error.message);
              setStatus('error');
              return;
            }

            console.log('Session set successfully from hash tokens');

            // Link practitioner record to user
            try {
              await fetch('/api/auth/link-practitioner', { method: 'POST' });
              console.log('Practitioner linking completed');
            } catch (linkErr) {
              console.warn('Failed to link practitioner:', linkErr);
            }

            setStatus('success');

            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname);

            // Redirect to dashboard
            const next = searchParams.get('next') || '/dashboard';
            router.push(next);
            return;
          } catch (err) {
            console.error('Exception setting session:', err);
            setErrorMessage('Failed to authenticate');
            setStatus('error');
            return;
          }
        }
      }

      // Check if already authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        console.log('Already authenticated, linking practitioner...');

        // Link practitioner record to user
        try {
          await fetch('/api/auth/link-practitioner', { method: 'POST' });
          console.log('Practitioner linking completed');
        } catch (linkErr) {
          console.warn('Failed to link practitioner:', linkErr);
        }

        setStatus('success');
        const next = searchParams.get('next') || '/dashboard';
        router.push(next);
        return;
      }

      // Check for error in query params
      const error = searchParams.get('error');
      if (error) {
        setErrorMessage(error);
        setStatus('error');
        return;
      }

      // No hash, no user, redirect to login
      console.log('No authentication found, redirecting to login...');
      router.push('/login');
    };

    handleAuth();
  }, [router, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-gray-600">Signing you in...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary/5 to-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-red-600 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-4">{errorMessage || 'Something went wrong. Please try again.'}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary/5 to-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-gray-600">Redirecting...</p>
    </div>
  );
}
