'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(isDevMode);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle magic link redirect - if code or token_hash is present, redirect to callback
  useEffect(() => {
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');

    if (code || tokenHash) {
      // Redirect to auth callback with the same parameters
      const params = new URLSearchParams();
      if (code) params.set('code', code);
      if (tokenHash) params.set('token_hash', tokenHash);
      const type = searchParams.get('type');
      if (type) params.set('type', type);

      router.replace(`/auth/callback?${params.toString()}`);
      return;
    }
  }, [searchParams, router]);

  // Auto-login in dev mode
  useEffect(() => {
    if (!isDevMode) return;

    const devLogin = async () => {
      try {
        // Get dev credentials from API (creates user if needed)
        const res = await fetch('/api/dev-auth', { method: 'POST' });
        const { email, password, error } = await res.json();

        if (error) {
          console.error('Dev auth error:', error);
          setDevLoading(false);
          return;
        }

        // Sign in with dev credentials
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error('Dev sign-in error:', signInError);
          setDevLoading(false);
          return;
        }

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (err) {
        console.error('Dev login failed:', err);
        setDevLoading(false);
      }
    };

    devLogin();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Use /auth/callback for server-side token verification
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Check your email for the login link!' });
    }

    setLoading(false);
  };

  // Show loading while dev auto-login is happening
  if (devLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dev Mode</h1>
          <p className="text-gray-600">Signing in as dev user...</p>
          <div className="mt-4 animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SOAP Voice</h1>
          <p className="text-gray-600 mt-2">Voice-to-SOAP notes for massage therapists</p>
        </div>

        {isDevMode && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            Dev Mode: Auto-login failed. Use manual login below.
          </div>
        )}

        <form onSubmit={handleLogin} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {loading ? 'Sending...' : 'Send magic link'}
          </button>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No password needed. We&apos;ll send you a login link.
        </p>
      </div>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
