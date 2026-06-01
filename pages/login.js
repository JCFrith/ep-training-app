import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Supabase Auth uses email, so we append the domain
    const email = username.trim() + '@ep-training.local';
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError('Invalid username or password.'); setLoading(false); return; }
    // Get profile to check role
    const { data: profile } = await supabase.from('profiles').select('role, display_name').eq('id', data.user.id).single();
    if (profile) localStorage.setItem('ep_profile', JSON.stringify(profile));
    router.push('/');
  }

  return (
    <div className="page-center">
      <div className="card">
        <div className="bar" />
        <h1>BVLOS Training</h1>
        <p className="sub">Enhanced Patrol LLC — Sign In</p>
        {error && <div className="msg msg-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          <button type="submit" className="btn btn-gold btn-full" disabled={!username.trim() || !password || loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
