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
  // Site assessments
  const [assessments, setAssessments] = useState([]);
  const [aFilterSite, setAFilterSite] = useState('');
  const [aFilterDecision, setAFilterDecision] = useState('all');
  const [selected, setSelected] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }) => {
        if (!p || p.role !== 'admin') { router.push('/'); return; }
        setProfile(p);
        loadResults();
        loadUsers();
        loadAssessments();
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

  async function loadAssessments() {
    const { data } = await supabase.from('assessments')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(300);
    if (data) setAssessments(data);
  }

  async function viewAssessment(a) {
    setSelected(a);
    setSelectedPhotos([]);
    // Pull photo manifest + sign each storage path (admin can read the bucket)
    const { data: rows } = await supabase.from('assessment_photos')
      .select('*').eq('assessment_id', a.id).order('evidence_key');
    if (!rows || !rows.length) return;
    const signed = [];
    for (const r of rows) {
      if (!r.storage_path) continue;
      const { data: s } = await supabase.storage.from('assessment-evidence').createSignedUrl(r.storage_path, 3600);
      if (s?.signedUrl) signed.push({ key: r.evidence_key, url: s.signedUrl });
    }
    setSelectedPhotos(signed);
  }

  function decisionBadge(d) {
    const s = String(d || '');
    const tone = /approved with conditions/i.test(s) ? 'pass-badge' : /not approved/i.test(s) ? 'fail-badge' : 'pass-badge';
    const bg = /not approved/i.test(s) ? undefined : /review/i.test(s) ? { background: 'var(--gold)', color: 'var(--navy)' } : undefined;
    return <span className={tone} style={bg}>{s || '—'}</span>;
  }

  function exportAssessmentsCsv() {
    if (!filteredAssessments.length) return;
    const cols = ['assessment_id', 'site_name', 'site_address', 'coa_waiver_determination', 'risk_level', 'assessor', 'rpic_reviewer', 'launch_method', 'assessment_date', 'reassessment_date', 'photo_count', 'submitted_by', 'submitted_at', 'status'];
    const esc = v => { const str = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
    const csv = cols.join(',') + '\n' + filteredAssessments.map(r => cols.map(c => esc(r[c])).join(',')).join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `ep-assessments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
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

  const filteredAssessments = assessments.filter(a => {
    if (aFilterDecision !== 'all') {
      const d = String(a.coa_waiver_determination || '');
      if (aFilterDecision === 'approved' && !/approved with conditions/i.test(d)) return false;
      if (aFilterDecision === 'review' && !/review/i.test(d)) return false;
      if (aFilterDecision === 'not' && !/not approved/i.test(d)) return false;
    }
    if (aFilterSite) {
      const hay = `${a.site_name || ''} ${a.site_address || ''} ${a.assessment_id || ''}`.toLowerCase();
      if (!hay.includes(aFilterSite.toLowerCase())) return false;
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
          <div className={`tab ${tab === 'assessments' ? 'active' : ''}`} onClick={() => setTab('assessments')}>Site Assessments</div>
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

        {tab === 'assessments' && (
          <div>
            <div className="filter-row">
              <input type="text" placeholder="Filter by site, address, or ID..." value={aFilterSite} onChange={e => setAFilterSite(e.target.value)} />
              <select value={aFilterDecision} onChange={e => setAFilterDecision(e.target.value)}>
                <option value="all">All Determinations</option>
                <option value="approved">Approved w/ Conditions</option>
                <option value="review">Needs Program Review</option>
                <option value="not">Not Approved</option>
              </select>
              <button className="btn btn-navy" style={{ padding: '12px 18px' }} onClick={exportAssessmentsCsv}>Export CSV</button>
            </div>
            <p style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 8 }}>{filteredAssessments.length} assessment{filteredAssessments.length !== 1 ? 's' : ''}</p>
            <table className="admin-table">
              <thead>
                <tr><th>Assessment ID</th><th>Site</th><th>Determination</th><th>Risk</th><th>Assessor</th><th>Submitted</th><th>Photos</th><th></th></tr>
              </thead>
              <tbody>
                {filteredAssessments.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.assessment_id}</td>
                    <td>{a.site_name || '—'}</td>
                    <td>{decisionBadge(a.coa_waiver_determination)}</td>
                    <td>{a.risk_level || '—'}</td>
                    <td>{a.submitted_by || a.assessor || '—'}</td>
                    <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '—'}</td>
                    <td>{a.photo_count || 0}</td>
                    <td><span className="logout" style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => viewAssessment(a)}>View</span></td>
                  </tr>
                ))}
                {filteredAssessments.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray)' }}>No assessments found</td></tr>}
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

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,25,35,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 12, maxWidth: 760, width: '100%', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ color: 'var(--navy)', marginBottom: 4 }}>{selected.site_name || 'Site Assessment'}</h3>
                <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray)' }}>{selected.assessment_id}</p>
              </div>
              <span className="logout" style={{ color: 'var(--navy)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }} onClick={() => setSelected(null)}>×</span>
            </div>

            <div style={{ marginBottom: 16 }}>{decisionBadge(selected.coa_waiver_determination)}</div>

            <table className="admin-table" style={{ marginTop: 0, marginBottom: 16 }}>
              <tbody>
                <tr><th style={{ width: 180 }}>Address</th><td>{selected.site_address || '—'}</td></tr>
                <tr><th>Coordinates</th><td>{selected.latitude != null ? `${selected.latitude}, ${selected.longitude}` : '—'}</td></tr>
                <tr><th>Assessor</th><td>{selected.assessor || '—'}</td></tr>
                <tr><th>RPIC Reviewer</th><td>{selected.rpic_reviewer || '—'}</td></tr>
                <tr><th>Launch Method</th><td>{selected.launch_method || '—'}</td></tr>
                <tr><th>Operation Types</th><td>{Array.isArray(selected.operation_types) ? selected.operation_types.join(', ') : '—'}</td></tr>
                <tr><th>C2 Result</th><td>{selected.c2_validation_result || '—'}</td></tr>
                <tr><th>Risk Level</th><td>{selected.risk_level || '—'}</td></tr>
                <tr><th>OOP/OOMV Exposure</th><td>{selected.oop_oomv_exposure || '—'}</td></tr>
                <tr><th>Program Review</th><td>{selected.program_review_required ? 'Required' : 'No'}</td></tr>
                <tr><th>Assessment Date</th><td>{selected.assessment_date || '—'}</td></tr>
                <tr><th>Reassessment Date</th><td>{selected.reassessment_date || '—'}</td></tr>
                <tr><th>Submitted By</th><td>{selected.submitted_by || '—'}</td></tr>
                <tr><th>Submitted At</th><td>{selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : '—'}</td></tr>
                <tr><th>Rule Matrix</th><td>{selected.rule_matrix_version || '—'}</td></tr>
              </tbody>
            </table>

            {Array.isArray(selected.corrective_actions) && selected.corrective_actions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ color: 'var(--navy)', marginBottom: 8 }}>Open Items / Corrective Actions</h4>
                <ul style={{ paddingLeft: 18, color: 'var(--dark)', fontSize: 13 }}>
                  {selected.corrective_actions.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
                </ul>
              </div>
            )}

            {Array.isArray(selected.operating_conditions) && selected.operating_conditions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ color: 'var(--navy)', marginBottom: 8 }}>Operating Conditions</h4>
                <ul style={{ paddingLeft: 18, color: 'var(--dark)', fontSize: 13 }}>
                  {selected.operating_conditions.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
                </ul>
              </div>
            )}

            {Array.isArray(selected.failed_rule_ids) && selected.failed_rule_ids.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 16 }}>Failed rule IDs: {selected.failed_rule_ids.join(', ')}</p>
            )}

            <div>
              <h4 style={{ color: 'var(--navy)', marginBottom: 8 }}>Evidence Photos ({selected.photo_count || 0})</h4>
              {selectedPhotos.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--gray)' }}>
                  {selected.photo_count ? 'Loading photos, or evidence bucket not yet configured.' : 'No photos attached.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedPhotos.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer" title={p.key}>
                      <img src={p.url} alt={p.key} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 6, border: '1px solid #E0E0E0' }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
