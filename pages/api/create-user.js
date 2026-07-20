import { requireAdmin, toAuthEmail } from '../../lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // This route holds the service role key. Without a guard, anyone could POST to it
  // and create themselves an admin account.
  const auth = await requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const supabaseAdmin = auth.admin;

  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || '').trim();
  const role = req.body.role || 'user';
  const email = String(req.body.email || '').trim().toLowerCase();
  const requestId = req.body.requestId || null;

  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'Username, password, and display name are required.' });
  }
  if (/\s|@/.test(username)) {
    return res.status(400).json({ error: 'Username cannot contain spaces or @.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "user" or "admin".' });
  }
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  // With an email the person signs in with that address and can self-serve a password
  // reset. Without one they sign in with the username and a placeholder address.
  const authEmail = email || toAuthEmail(username);

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();
  if (existing) {
    return res.status(400).json({ error: 'Username already exists.' });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true, // Approval already happened out of band
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    username,
    display_name: displayName,
    role,
    email: email || null,
  });

  if (profileError) {
    // Cleanup: delete the auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ error: 'Failed to create profile: ' + profileError.message });
  }

  // If this came from approving a signup request, close that request out.
  if (requestId) {
    await supabaseAdmin
      .from('admin_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: auth.actor.id })
      .eq('id', requestId);
  }

  return res.status(200).json({ success: true, userId: authData.user.id, signInWith: authEmail });
}
