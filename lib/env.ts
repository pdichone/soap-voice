// Centralized environment variable config
// Handles different env var names between environments

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Production Vercel uses NEXT_PUBLIC_SUPABASE_ANON, other environments use NEXT_PUBLIC_SUPABASE_ANON_KEY
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
