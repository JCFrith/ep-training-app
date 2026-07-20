import { requireAdmin } from '../../lib/auth';

// Denies a pending request. Approvals for account requests go through /api/create-user
// (which needs a username and password), and password-reset approvals go through
// /api/set-password.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { requestId, status } = req.body;
  if (!requestId) return res.status(400).json({ error: 'Missing request id.' });
  if (!['approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "approved" or "denied".' });
  }

  const { error } = await auth.admin
    .from('admin_requests')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: auth.actor.id })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) return res.status(500).json({ error: 'Could not update request.' });
  return res.status(200).json({ success: true });
}
