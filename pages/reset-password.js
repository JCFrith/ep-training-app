import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase puts the recovery token in the URL fragment and the JS client exchanges
  // it for a session automatically. We just wait for that session to appear.
  useEffect(() => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        settled = true;
        setValid(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      setValid(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 6) { setMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }
    if (password !== confirm) { setMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMsg({ type: 'error', text: error.message }); setSaving(false); return; }
    setDone(true);
    setSaving(false);
    setTimeout(() => router.push('/login'), 2500);
  }

  if (!ready) {
    return <div className="page-center"><div className="card"><p>Loading...</p></div></div>;
  }

  if (!valid) {
    return (
      <div className="page-center">
        <div className="card">
          <div className="bar" />
          <h1>Link Expired</h1>
          <div className="msg msg-error">
            This password reset link is invalid or has already been used. Request a new one.
          </div>
          <div className="link-row"><Link href="/forgot-password">Request a new link</Link></div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="page-center">
        <div className="card">
          <div className="bar" />
          <h1>Password Updated</h1>
          <div className="msg msg-success">Your password has been changed. Redirecting to sign in...</div>
          <div className="link-row"><Link href="/login">Sign in now</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="card">
        <div className="bar" />
        <h1>Set a New Password</h1>
        <p className="sub">Choose a password of at least 6 characters</p>
        {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}
        <form onSubmit={handleSubmit}>
          <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          <button type="submit" className="btn btn-gold btn-full" disabled={!password || !confirm || saving}>
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
