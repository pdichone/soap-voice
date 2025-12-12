'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface EffectiveUser {
  id: string;
  email: string;
}

interface EffectiveUserContextType {
  user: EffectiveUser | null;
  isImpersonating: boolean;
  practitionerName: string | null;
  adminReturnUrl: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EffectiveUserContext = createContext<EffectiveUserContextType | undefined>(undefined);

export function EffectiveUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<EffectiveUser | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [practitionerName, setPractitionerName] = useState<string | null>(null);
  const [adminReturnUrl, setAdminReturnUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setIsImpersonating(data.isImpersonating || false);
        setPractitionerName(data.practitionerName || null);
        setAdminReturnUrl(data.adminReturnUrl || null);
        setError(null);
      } else {
        setError(data.error || 'Failed to get user');
      }
    } catch (err) {
      setError('Failed to fetch user');
      console.error('Error fetching effective user:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <EffectiveUserContext.Provider
      value={{
        user,
        isImpersonating,
        practitionerName,
        adminReturnUrl,
        loading,
        error,
        refetch: fetchUser,
      }}
    >
      {children}
    </EffectiveUserContext.Provider>
  );
}

export function useEffectiveUser(): EffectiveUserContextType {
  const context = useContext(EffectiveUserContext);
  if (context === undefined) {
    throw new Error('useEffectiveUser must be used within an EffectiveUserProvider');
  }
  return context;
}
