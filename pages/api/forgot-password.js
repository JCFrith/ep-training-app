import { serviceClient, toAuthEmail, isPlaceholderEmail } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const identifier = String(req.body.identifier || '').trim();
  const contactEmail = String(req.body.contactEmail || '').trim().toLowerCase();
  const redirectTo = String(req.body.redirectTo || '').trim();

  if (!identifier) return res.status(400).json({ error: 'Enter your username or email.' });

  const authEmail = toAuthEmail(identifier);
  const supabase = serviceClient();

  // Real mailbox: hand off to Supabase's built-in recovery email.
  if (!isPlaceholderEmail(authEmail)) {
    await supabase.auth.resetPasswordForEmail(authEmail, redirectTo ? { redirectTo } : undefined);
    // Always report success so this can't be used to probe which emails exist.
    return res.status(200).json({ success: true });
  }

  // Username account: no mailbox exists, so queue it for an admin to handle.
  if (!contactEmail) {
    return res.status(400).json({ error: 'Enter an email address where we can reach you.' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .ilike('username', identifier)
    .maybeSingle();

  // Only queue a request if the account actually exists, but report success either way.
  if (profile) {
    const { data: pending } = await supabase
      .from('admin_requests')
      .select('id')
      .eq('kind', 'password_reset')
      .eq('status', 'pending')
      .eq('note', profile.username)
      .maybeSingle();

    if (!pending) {
      await supabase.from('admin_requests').insert({
        kind: 'password_reset',
        status: 'pending',
        email: contactEmail,
        full_name: profile.display_name,
        note: profile.username,
      });
    }
  }

  return res.status(200).json({ success: true });
}
