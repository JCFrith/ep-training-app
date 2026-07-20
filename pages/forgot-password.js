import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const looksLikeEmail = identifier.includes('@');

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    const res = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: identifier.trim(),
        contactEmail: contactEmail.trim(),
        redirectTo: window.location.origin + '/reset-password',
      }),
    });
    const json = await res.json();
    if (res.ok) setDone(true);
    else setMsg({ type: 'error', text: json.error || 'Could not submit request.' });
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="page-center">
        <div className="card">
          <div className="bar" />
          <h1>Request Received</h1>
          <div className="msg msg-success">
            If an account matches what you entered, a reset link has been emailed to it. Accounts that
            sign in with a username instead of an email are reset manually — an administrator will
            contact you.
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
        <h1>Forgot Password</h1>
        <p className="sub">Enter your username or email address</p>
        {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username or email" value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" />
          {/* Username accounts have no mailbox, so we need somewhere to reach the person. */}
          {identifier.trim() && !looksLikeEmail && (
            <>
              <p className="hint">
                Username accounts can&apos;t receive email. Leave an address and an administrator will
                reset it for you.
              </p>
              <input type="email" placeholder="Email to contact you at" value={contactEmail} onChange={e => setContactEmail(e.target.value)} autoComplete="email" />
            </>
          )}
          <button type="submit" className="btn btn-gold btn-full" disabled={!identifier.trim() || (!looksLikeEmail && !contactEmail.trim()) || submitting}>
            {submitting ? 'Submitting...' : 'Continue'}
          </button>
        </form>
        <div className="link-row"><Link href="/login">Back to sign in</Link></div>
      </div>
    </div>
  );
}
