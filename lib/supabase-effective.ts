'use client';

// Cache the effective user to avoid repeated API calls
let cachedEffectiveUser: { id: string; email: string } | null = null;
let cachePromise: Promise<{ id: string; email: string } | null> | null = null;

/**
 * Get the effective user ID (supports impersonation)
 * This should be used instead of supabase.auth.getUser() in client components
 */
export async function getEffectiveUserId(): Promise<string | null> {
  const user = await getEffectiveUser();
  return user?.id || null;
}

/**
 * Get the effective user (supports impersonation)
 */
export async function getEffectiveUser(): Promise<{ id: string; email: string } | null> {
  // Return cached value if available
  if (cachedEffectiveUser) {
    return cachedEffectiveUser;
  }

  // If a fetch is already in progress, wait for it
  if (cachePromise) {
    return cachePromise;
  }

  // Start a new fetch
  cachePromise = fetchEffectiveUser();
  const result = await cachePromise;
  cachedEffectiveUser = result;
  cachePromise = null;

  return result;
}

async function fetchEffectiveUser(): Promise<{ id: string; email: string } | null> {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();

    if (response.ok && data.user) {
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the effective user cache (call when user logs out or impersonation ends)
 */
export function clearEffectiveUserCache(): void {
  cachedEffectiveUser = null;
  cachePromise = null;
}

/**
 * Check if currently impersonating
 */
export async function isImpersonating(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    return data.isImpersonating || false;
  } catch {
    return false;
  }
}

// =============================================
// Data Query Helper (supports impersonation)
// =============================================

interface QueryOptions {
  table: string;
  select?: string;
  filters?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

/**
 * Query data for the effective user (supports impersonation)
 * Use this instead of direct Supabase queries in client components
 */
export async function queryData<T = unknown>(options: QueryOptions): Promise<T[]> {
  try {
    const response = await fetch('/api/data/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Query error:', result.error);
      return [];
    }

    return result.data as T[];
  } catch (error) {
    console.error('Error querying data:', error);
    return [];
  }
}
