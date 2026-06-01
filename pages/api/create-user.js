import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, displayName, role } = req.body;

  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'Username, password, and display name are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "user" or "admin".' });
  }

  // Use the service role key for admin operations
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Supabase Auth requires email — we generate one from the username
  const email = username + '@ep-training.local';

  // Check if username already exists
  const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('username', username).single();
  if (existing) {
    return res.status(400).json({ error: 'Username already exists.' });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm since we don't use real email
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Create profile
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    username,
    display_name: displayName,
    role: role || 'user',
  });

  if (profileError) {
    // Cleanup: delete the auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ error: 'Failed to create profile: ' + profileError.message });
  }

  return res.status(200).json({ success: true, userId: authData.user.id });
}
