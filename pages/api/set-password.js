import { requireAdmin } from '../../lib/auth';

// Lets an admin set any user's password directly — the manual path for accounts that
// sign in with a username and therefore can't receive a reset email.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { userId, password, requestId } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'User and password are required.' });
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const { error } = await auth.admin.auth.admin.updateUserById(userId, { password });
  if (error) return res.status(400).json({ error: error.message });

  if (requestId) {
    await auth.admin
      .from('admin_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: auth.actor.id })
      .eq('id', requestId);
  }

  return res.status(200).json({ success: true });
}
