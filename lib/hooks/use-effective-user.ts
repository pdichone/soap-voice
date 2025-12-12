'use client';

import { useState, useEffect } from 'react';

interface EffectiveUser {
  id: string;
  email: string;
}

interface UseEffectiveUserResult {
  user: EffectiveUser | null;
  isImpersonating: boolean;
  practitionerName: string | null;
  adminReturnUrl: string | null;
  loading: boolean;
  error: string | null;
}

export function useEffectiveUser(): UseEffectiveUserResult {
  const [user, setUser] = useState<EffectiveUser | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [practitionerName, setPractitionerName] = useState<string | null>(null);
  const [adminReturnUrl, setAdminReturnUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (response.ok) {
          setUser(data.user);
          setIsImpersonating(data.isImpersonating || false);
          setPractitionerName(data.practitionerName || null);
          setAdminReturnUrl(data.adminReturnUrl || null);
        } else {
          setError(data.error || 'Failed to get user');
        }
      } catch (err) {
        setError('Failed to fetch user');
        console.error('Error fetching effective user:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return { user, isImpersonating, practitionerName, adminReturnUrl, loading, error };
}
