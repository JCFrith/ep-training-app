import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Admin() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('results');
  const [results, setResults] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterName, setFilterName] = useState('');
  const [filterQuiz, setFilterQuiz] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  // Create user
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [createMsg, setCreateMsg] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }) => {
        if (!p || p.role !== 'admin') { router.push('/'); return; }
        setProfile(p);
        loadResults();
        loadUsers();
      });
    });
  }, []);

  async function loadResults() {
    const { data } = await supabase.from('quiz_results')
      .select('*, profiles(display_name, username)')
      .order('completed_at', { ascending: false })
      .limit(200);
    if (data) setResults(data);
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateMsg(null);
    setCreating(true);
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUser.trim(), password: newPass, displayName: newName.trim(), role: newRole }),
    });
    const json = await res.json();
    if (res.ok) {
      setCreateMsg({ type: 'success', text: `User "${newUser.trim()}" created successfully.` });
      setNewUser(''); setNewPass(''); setNewName(''); setNewRole('user');
      loadUsers();
    } else {
      setCreateMsg({ type: 'error', text: json.error || 'Failed to create user.' });
    }
    setCreating(false);
  }

  const filteredResults = results.filter(r => {
    if (filterQuiz !== 'all' && r.quiz_type !== filterQuiz) return false;
    if (filterName && !r.profiles?.display_name?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterDate) {
      const rd = new Date(r.completed_at).toISOString().split('T')[0];
      if (rd !== filterDate) return false;
    }
    return true;
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem('ep_profile');
    router.push('/login');
  }

  if (!profile) return <div className="page-center"><div className="card"><p>Loading...</p></div></div>;

  return (
    <div>
      <div className="header">
        <div className="header-inner">
          <span className="title">Admin Dashboard</span>
          <div>
            <span className="user-info">{profile.display_name}</span>
            <span className="logout" onClick={() => router.push('/')} style={{ marginLeft: 16, color: '#00A2E9' }}>Home</span>
            <span className="logout" onClick={handleLogout}>Sign Out</span>
          </div>
        </div>
      </div>
      <div className="container">
        <div className="tabs">
          <div className={`tab ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>Exam Results</div>
          <div className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</div>
          <div className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>Create User</div>
        </div>

        {tab === 'results' && (
          <div>
            <div className="filter-row">
              <input type="text" placeholder="Filter by name..." value={filterName} onChange={e => setFilterName(e.target.value)} />
              <select value={filterQuiz} onChange={e => setFilterQuiz(e.target.value)}>
                <option value="all">All Quizzes</option>
                <option value="ep-rpic">EP RPIC</option>
                <option value="thp-deployer">THP Deployer</option>
              </select>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            <p style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 8 }}>{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}</p>
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Quiz</th><th>Score</th><th>%</th><th>Result</th><th>Date</th></tr>
              </thead>
              <tbody>
                {filteredResults.map(r => (
                  <tr key={r.id}>
                    <td>{r.profiles?.display_name || '—'}</td>
                    <td>{r.quiz_type === 'ep-rpic' ? 'EP RPIC' : 'THP Deployer'}</td>
                    <td>{r.score}/{r.total}</td>
                    <td>{r.percentage}%</td>
                    <td><span className={r.passed ? 'pass-badge' : 'fail-badge'}>{r.passed ? 'PASS' : 'FAIL'}</span></td>
                    <td>{new Date(r.completed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filteredResults.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray)' }}>No results found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'users' && (
          <div>
            <p style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 8 }}>{users.length} user{users.length !== 1 ? 's' : ''}</p>
            <table className="admin-table">
              <thead><tr><th>Username</th><th>Display Name</th><th>Role</th><th>Created</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.display_name}</td>
                    <td><span style={{ background: u.role === 'admin' ? 'var(--navy)' : 'var(--light)', color: u.role === 'admin' ? 'var(--gold)' : 'var(--dark)', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{u.role}</span></td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'create' && (
          <div style={{ maxWidth: 400 }}>
            <h3 style={{ color: 'var(--navy)', marginBottom: 16 }}>Create New User</h3>
            {createMsg && <div className={`msg ${createMsg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{createMsg.text}</div>}
            <form onSubmit={handleCreateUser}>
              <input type="text" placeholder="Username (no spaces)" value={newUser} onChange={e => setNewUser(e.target.value.replace(/\s/g, ''))} />
              <input type="password" placeholder="Password (min 6 characters)" value={newPass} onChange={e => setNewPass(e.target.value)} />
              <input type="text" placeholder="Display Name (e.g. John Smith)" value={newName} onChange={e => setNewName(e.target.value)} />
              <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" className="btn btn-gold btn-full" disabled={!newUser.trim() || newPass.length < 6 || !newName.trim() || creating}>
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
