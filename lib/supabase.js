import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Returns the current user, or null. If the stored session is invalid
// (e.g. a stale or rotated refresh token — common after the app has been
// open in multiple tabs), it clears the bad session so the app can send the
// person cleanly back to login instead of throwing refresh-token errors.
export async function getSessionUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      try { await supabase.auth.signOut(); } catch (e) {}
      return null;
    }
    return data.user;
  } catch (e) {
    try { await supabase.auth.signOut(); } catch (e2) {}
    return null;
  }
}

// Server-side admin client (for creating users)
export function getServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
