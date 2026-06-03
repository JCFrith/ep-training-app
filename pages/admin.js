import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, getSessionUser } from '../lib/supabase';
import AssessmentDetail from '../lib/AssessmentDetail';

const ASSESSMENT_LIST_COLS = 'id, assessment_id, site_name, site_address, latitude, longitude, assessment_type, assessment_date, assessor, rpic_reviewer, launch_method, operation_types, c2_validation_result, risk_level, oop_oomv_exposure, coa_waiver_determination, program_review_required, failed_rule_ids, corrective_actions, operating_conditions, reassessment_date, rule_matrix_version, photo_count, submitted_by, submitted_at, status';

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
  const [checkedIds, setCheckedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState('');

  useEffect(() => {
    getSessionUser().then((u) => {
      if (!u) { router.push('/login'); return; }
      supabase.from('profiles').select('*').eq('id', u.id).single().then(({ data: p }) => {
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
      .select(ASSESSMENT_LIST_COLS)
      .order('submitted_at', { ascending: false })
      .limit(300);
    if (data) setAssessments(data);
  }

  async function viewAssessment(a) {
    setSelected({ ...a, _loading: true });
    // Fetch the full record (including full_assessment with all answers + photos)
    const { data } = await supabase.from('assessments').select('*').eq('id', a.id).single();
    setSelected(data || a);
  }

  function toggleChecked(id) {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleAll() {
    const visible = filteredAssessments.map(a => a.id);
    const allSelected = visible.length > 0 && visible.every(id => checkedIds.includes(id));
    setCheckedIds(allSelected ? [] : visible);
  }
  function openPdf(ids) {
    if (!ids.length) return;
    window.open(`/print?ids=${ids.join(',')}`, '_blank');
  }

  // Bulk: render each selected assessment to its own PDF and bundle into one ZIP download.
  async function exportSelectedPdfsZip() {
    if (!checkedIds.length) return;
    setPdfBusy('Loading…');
    try {
      const { data, error } = await supabase.from('assessments').select('*').in('id', checkedIds);
      if (error || !data) throw new Error(error?.message || 'Failed to load assessments');
      const ordered = checkedIds.map(id => data.find(d => d.id === id)).filter(Boolean);

      const { renderToStaticMarkup } = await import('react-dom/server');
      const jsPDFmod = await import('jspdf');
      const JsPDF = jsPDFmod.jsPDF || jsPDFmod.default;
      const JSZip = (await import('jszip')).default;
      await import('html2canvas');
      const zip = new JSZip();

      for (let i = 0; i < ordered.length; i++) {
        const r = ordered[i];
        setPdfBusy(`Rendering ${i + 1}/${ordered.length}…`);
        const html = renderToStaticMarkup(<AssessmentDetail record={r} plainLogo />);
        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:760px;background:#fff;padding:24px;';
        holder.innerHTML = html;
        document.body.appendChild(holder);
        await new Promise(res => setTimeout(res, 50));
        const pdf = new JsPDF('p', 'pt', 'letter');
        await new Promise((resolve) => {
          pdf.html(holder, { x: 24, y: 24, width: 540, windowWidth: 760, autoPaging: 'text', callback: () => resolve() });
        });
        const safe = String(r.assessment_id || r.id).replace(/[^a-z0-9._-]+/gi, '-');
        zip.file(`${safe}.pdf`, pdf.output('blob'));
        holder.remove();
      }

      setPdfBusy('Zipping…');
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ep-assessments-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      alert('Could not export PDFs: ' + (e?.message || e));
    } finally {
      setPdfBusy('');
    }
  }
  async function bulkDelete() {
    if (!checkedIds.length) return;
    if (!confirm(`Delete ${checkedIds.length} assessment${checkedIds.length !== 1 ? 's' : ''}? This permanently removes the record(s) and their evidence manifest. This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from('assessments').delete().in('id', checkedIds);
    setBusy(false);
    if (error) { alert('Delete failed: ' + error.message); return; }
    setCheckedIds([]);
    loadAssessments();
  }

  function decisionBadge(d) {
    const s = String(d || '');
    const tone = /approved with conditions/i.test(s) ? 'pass-badge' : /not approved/i.test(s) ? 'fail-badge' : 'pass-badge';
    const bg = /not approved/i.test(s) ? undefined : /review/i.test(s) ? { background: 'var(--gold)', color: 'var(--navy)' } : undefined;
    return <span className={tone} style={bg}>{s || '—'}</span>;
  }

  function exportAssessmentsCsv() {
    const rows = checkedIds.length ? filteredAssessments.filter(a => checkedIds.includes(a.id)) : filteredAssessments;
    if (!rows.length) return;
    // Audit-complete column set, mirroring the View detail at the record level.
    const cols = [
      'assessment_id', 'status', 'site_name', 'site_address', 'latitude', 'longitude',
      'assessment_type', 'assessment_date', 'assessor', 'rpic_reviewer', 'launch_method',
      'operation_types', 'c2_validation_result', 'risk_level', 'oop_oomv_exposure',
      'coa_waiver_determination', 'program_review_required', 'failed_rule_ids',
      'corrective_actions', 'operating_conditions', 'reassessment_date',
      'rule_matrix_version', 'photo_count', 'submitted_by', 'submitted_at',
    ];
    const headers = {
      assessment_id: 'Assessment ID', status: 'Status', site_name: 'Site Name', site_address: 'Address',
      latitude: 'Latitude', longitude: 'Longitude', assessment_type: 'Assessment Type',
      assessment_date: 'Assessment Date', assessor: 'Assessed By', rpic_reviewer: 'RPIC Reviewing',
      launch_method: 'Launch Method', operation_types: 'Operation Types', c2_validation_result: 'C2 Result',
      risk_level: 'Risk Level', oop_oomv_exposure: 'OOP/OOMV Exposure', coa_waiver_determination: 'COA/Waiver Determination',
      program_review_required: 'Program Review Required', failed_rule_ids: 'Failed Rule IDs',
      corrective_actions: 'Corrective Actions', operating_conditions: 'Operating Conditions',
      reassessment_date: 'Reassessment Date', rule_matrix_version: 'Rule Matrix Version',
      photo_count: 'Photo Count', submitted_by: 'Submitted By', submitted_at: 'Submitted At',
    };
    const esc = v => { const str = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; };
    const csv = cols.map(c => headers[c]).join(',') + '\n' + rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n') + '\n';
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
              <button className="btn btn-navy" style={{ padding: '12px 18px' }} onClick={exportAssessmentsCsv}>
                Export CSV{checkedIds.length ? ` (${checkedIds.length})` : ''}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--gray)', fontSize: 13 }}>
                {filteredAssessments.length} assessment{filteredAssessments.length !== 1 ? 's' : ''}
                {checkedIds.length ? ` · ${checkedIds.length} selected` : ''}
              </span>
              {checkedIds.length > 0 && (
                <>
                  <button className="btn btn-gold" style={{ padding: '8px 16px', fontSize: 13 }} disabled={!!pdfBusy} onClick={exportSelectedPdfsZip}>{pdfBusy || `Export PDF (${checkedIds.length})`}</button>
                  <button className="btn btn-red" style={{ padding: '8px 16px', fontSize: 13 }} disabled={busy} onClick={bulkDelete}>{busy ? 'Deleting…' : `Delete Selected (${checkedIds.length})`}</button>
                  <span className="logout" style={{ color: 'var(--gray)', cursor: 'pointer', fontSize: 13 }} onClick={() => setCheckedIds([])}>Clear</span>
                </>
              )}
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}><input type="checkbox" checked={filteredAssessments.length > 0 && filteredAssessments.every(a => checkedIds.includes(a.id))} onChange={toggleAll} /></th>
                  <th>Assessment ID</th><th>Site</th><th>Determination</th><th>Risk</th><th>Assessor</th><th>Submitted</th><th>Photos</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map(a => (
                  <tr key={a.id}>
                    <td><input type="checkbox" checked={checkedIds.includes(a.id)} onChange={() => toggleChecked(a.id)} /></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.assessment_id}</td>
                    <td>{a.site_name || '—'}</td>
                    <td>{decisionBadge(a.coa_waiver_determination)}</td>
                    <td>{a.risk_level || '—'}</td>
                    <td>{a.submitted_by || a.assessor || '—'}</td>
                    <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '—'}</td>
                    <td>{a.photo_count || 0}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="logout" style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => viewAssessment(a)}>View</span>
                      <span className="logout" style={{ color: 'var(--blue)', cursor: 'pointer', marginLeft: 12 }} onClick={() => openPdf([a.id])}>PDF</span>
                    </td>
                  </tr>
                ))}
                {filteredAssessments.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray)' }}>No assessments found</td></tr>}
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
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 12, maxWidth: 900, width: '100%', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'sticky', top: 0, background: '#fff', paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-gold" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => openPdf([selected.id])}>Open Printable / PDF</button>
              </div>
              <span className="logout" style={{ color: 'var(--navy)', cursor: 'pointer', fontSize: 24, lineHeight: 1 }} onClick={() => setSelected(null)}>×</span>
            </div>
            {selected._loading ? (
              <p style={{ color: 'var(--gray)' }}>Loading full assessment…</p>
            ) : (
              <AssessmentDetail record={selected} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
