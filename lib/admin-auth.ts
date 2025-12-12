// =============================================
// ADMIN AUTH HELPERS
// Authentication and authorization for Super Admin portal
// =============================================

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import type { AdminUser, ImpersonationContext } from '@/lib/types-ops';

// Admin session cookie name
const ADMIN_SESSION_COOKIE = 'admin_session';

// =============================================
// Get Current Admin User (from cookie-based session)
// Uses service role client to bypass RLS
// =============================================
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

    if (!sessionCookie) {
      return null;
    }

    // Parse the session data
    const sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());

    if (!sessionData.adminId) {
      return null;
    }

    // Verify admin still exists and is active
    // Use service role client to bypass RLS (since we're not using Supabase Auth)
    const supabase = createServiceRoleClient();
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', sessionData.adminId)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return null;
    }

    return admin as AdminUser;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}

// =============================================
// Set Admin Session Cookie
// =============================================
export function setAdminSessionCookie(response: Response, admin: AdminUser): void {
  const sessionData = {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    timestamp: Date.now(),
  };

  const encodedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  const cookieOptions = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'; // 24 hours

  response.headers.append(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=${encodedSession}; ${cookieOptions}`
  );
}

// =============================================
// Clear Admin Session Cookie
// =============================================
export function clearAdminSessionCookie(response: Response): void {
  response.headers.append(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

// =============================================
// Check if Current User is Admin
// =============================================
export async function isAdmin(): Promise<boolean> {
  const admin = await getAdminUser();
  return admin !== null;
}

// =============================================
// Check if Current User is Super Admin
// =============================================
export async function isSuperAdmin(): Promise<boolean> {
  const admin = await getAdminUser();
  return admin?.role === 'super_admin';
}

// =============================================
// Require Admin Authentication
// Throws an error if user is not an admin
// =============================================
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();

  if (!admin) {
    throw new Error('Unauthorized: Admin access required');
  }

  return admin;
}

// =============================================
// Impersonation Context
// =============================================
const IMPERSONATION_COOKIES = {
  WORKSPACE_ID: 'impersonating_workspace_id',
  SESSION_ID: 'impersonation_session_id',
  PRACTITIONER_NAME: 'impersonating_practitioner_name',
  PRACTITIONER_ID: 'impersonating_practitioner_id',
  ADMIN_RETURN_URL: 'admin_return_url',
} as const;

export async function getImpersonationContext(): Promise<ImpersonationContext> {
  const cookieStore = await cookies();

  const workspaceId = cookieStore.get(IMPERSONATION_COOKIES.WORKSPACE_ID)?.value || null;
  const sessionId = cookieStore.get(IMPERSONATION_COOKIES.SESSION_ID)?.value || null;
  const practitionerName = cookieStore.get(IMPERSONATION_COOKIES.PRACTITIONER_NAME)?.value || null;
  const practitionerId = cookieStore.get(IMPERSONATION_COOKIES.PRACTITIONER_ID)?.value || null;
  const adminReturnUrl = cookieStore.get(IMPERSONATION_COOKIES.ADMIN_RETURN_URL)?.value || null;

  // Check for practitionerId (most reliable) or sessionId for impersonation
  const isImpersonating = !!practitionerId && !!sessionId;

  return {
    isImpersonating,
    practitionerId,
    practitionerName,
    workspaceId,
    sessionId,
    adminReturnUrl,
  };
}

export function setImpersonationCookies(
  response: Response,
  data: {
    workspaceId: string;
    sessionId: string;
    practitionerName: string;
    practitionerId: string;
    adminReturnUrl: string;
  }
): void {
  const cookieOptions = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=86400';

  response.headers.append(
    'Set-Cookie',
    `${IMPERSONATION_COOKIES.WORKSPACE_ID}=${data.workspaceId}; ${cookieOptions}`
  );
  response.headers.append(
    'Set-Cookie',
    `${IMPERSONATION_COOKIES.SESSION_ID}=${data.sessionId}; ${cookieOptions}`
  );
  response.headers.append(
    'Set-Cookie',
    `${IMPERSONATION_COOKIES.PRACTITIONER_NAME}=${encodeURIComponent(data.practitionerName)}; ${cookieOptions}`
  );
  response.headers.append(
    'Set-Cookie',
    `${IMPERSONATION_COOKIES.PRACTITIONER_ID}=${data.practitionerId}; ${cookieOptions}`
  );
  response.headers.append(
    'Set-Cookie',
    `${IMPERSONATION_COOKIES.ADMIN_RETURN_URL}=${encodeURIComponent(data.adminReturnUrl)}; ${cookieOptions}`
  );
}

export function clearImpersonationCookies(response: Response): void {
  const clearCookie = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

  Object.values(IMPERSONATION_COOKIES).forEach((cookie) => {
    response.headers.append('Set-Cookie', `${cookie}=; ${clearCookie}`);
  });
}

// =============================================
// Get Effective User ID for Queries
// Returns the impersonated user's ID if impersonating,
// otherwise the current user's ID
// =============================================
export async function getEffectiveUserId(): Promise<string | null> {
  const impersonation = await getImpersonationContext();

  if (impersonation.isImpersonating && impersonation.workspaceId) {
    // When impersonating, we need to get the practitioner's user_id
    const supabase = await createServerSupabaseClient();
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('user_id')
      .eq('workspace_id', impersonation.workspaceId)
      .single();

    return practitioner?.user_id || null;
  }

  // Not impersonating, return current user
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

// =============================================
// Admin Login with Email/Password
// Uses custom password_hash verification (no Supabase Auth required)
// =============================================
export async function adminLogin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; admin?: AdminUser }> {
  try {
    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // Check admin credentials using password_hash
    // RPC returns an array (SETOF), so we get the first item
    const { data: admins, error: adminError } = await supabase
      .rpc('verify_admin_password', {
        admin_email: email,
        admin_password: password,
      });

    if (adminError) {
      console.error('Admin login RPC error:', adminError);
      return { success: false, error: 'Invalid email or password' };
    }

    // Check if we got a result (array with at least one item)
    if (!admins || !Array.isArray(admins) || admins.length === 0) {
      return { success: false, error: 'Invalid email or password' };
    }

    const admin = admins[0] as AdminUser;

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('email', email);

    return { success: true, admin };
  } catch (error) {
    console.error('Admin login error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =============================================
// Admin Logout
// =============================================
export async function adminLogout(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
