import { useState } from 'react';
import Link from 'next/link';

export default function Signup() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', company: '', note: '' });
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    const res = await fetch('/api/request-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setDone(true);
    } else {
      setMsg({ type: 'error', text: json.error || 'Could not submit request.' });
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="page-center">
        <div className="card">
          <div className="bar" />
          <h1>Request Submitted</h1>
          <p className="sub">Enhanced Patrol LLC — BVLOS Training</p>
          <div className="msg msg-success">
            Thanks. Your request has been sent to an administrator for review. You&apos;ll be contacted at{' '}
            <strong>{form.email}</strong> once your account is approved.
          </div>
          <div className="link-row"><Link href="/login">Back to sign in</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="card">
        <div className="bar" />
        <h1>Request an Account</h1>
        <p className="sub">Accounts are approved manually by an administrator</p>
        {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Full name" value={form.fullName} onChange={e => set('fullName', e.target.value)} autoComplete="name" />
          <input type="email" placeholder="Email address" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" />
          <input type="tel" placeholder="Phone number" value={form.phone} onChange={e => set('phone', e.target.value)} autoComplete="tel" />
          <input type="text" placeholder="Company / operator (optional)" value={form.company} onChange={e => set('company', e.target.value)} autoComplete="organization" />
          <textarea placeholder="Reason for access (optional)" rows={3} value={form.note} onChange={e => set('note', e.target.value)} />
          <button type="submit" className="btn btn-gold btn-full" disabled={!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
        <div className="link-row"><Link href="/login">Back to sign in</Link></div>
      </div>
    </div>
  );
}
