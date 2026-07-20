import { createClient } from '@supabase/supabase-js';

export const FAKE_DOMAIN = '@ep-training.local';

// A login identifier is either a real email or a bare username. Usernames get the
// placeholder domain appended so Supabase Auth (which requires an email) accepts them.
export function toAuthEmail(identifier) {
  const id = String(identifier || '').trim().toLowerCase();
  return id.includes('@') ? id : id + FAKE_DOMAIN;
}

// True for the placeholder addresses that can never receive mail.
export function isPlaceholderEmail(email) {
  return String(email || '').toLowerCase().endsWith(FAKE_DOMAIN);
}

export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Guards service-role API routes. Without this any visitor could POST to the
// admin endpoints and mint themselves an admin account.
export async function requireAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: 'Not signed in.', status: 401 };

  const admin = serviceClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return { error: 'Session expired. Sign in again.', status: 401 };

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();

  if (!profile || profile.role !== 'admin') return { error: 'Admin access required.', status: 403 };
  return { admin, actor: profile };
}
