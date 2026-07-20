import { serviceClient } from '../../lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const company = String(req.body.company || '').trim();
  const note = String(req.body.note || '').trim();

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (fullName.length > 120 || email.length > 254 || phone.length > 40 || company.length > 120 || note.length > 1000) {
    return res.status(400).json({ error: 'One or more fields is too long.' });
  }

  const supabase = serviceClient();

  // Don't tell the submitter whether the address is already known — just no-op.
  const { data: existing } = await supabase
    .from('admin_requests')
    .select('id')
    .eq('email', email)
    .eq('kind', 'account')
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) return res.status(200).json({ success: true });

  const { error } = await supabase.from('admin_requests').insert({
    kind: 'account',
    status: 'pending',
    email,
    full_name: fullName,
    phone,
    company: company || null,
    note: note || null,
  });

  if (error) return res.status(500).json({ error: 'Could not submit request. Try again.' });
  return res.status(200).json({ success: true });
}
