import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, getSessionUser } from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const router = useRouter();

  useEffect(() => {
    getSessionUser().then((u) => {
      if (!u) { router.push('/login'); return; }
      setUser(u);
      supabase.from('profiles').select('*').eq('id', u.id).single().then(({ data: p }) => {
        setProfile(p);
        localStorage.setItem('ep_profile', JSON.stringify(p));
      });
      supabase.from('quiz_results').select('*').eq('user_id', u.id).order('completed_at', { ascending: false }).limit(10).then(({ data: r }) => {
        if (r) setHistory(r);
      });
    });
  }, []);

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
          <span className="title">BVLOS Training Program</span>
          <div>
            <span className="user-info">{profile.display_name}</span>
            {profile.role === 'admin' && (
              <span className="logout" onClick={() => router.push('/admin')} style={{ marginLeft: 16, color: '#00A2E9' }}>Admin</span>
            )}
            <span className="logout" onClick={handleLogout}>Sign Out</span>
          </div>
        </div>
      </div>
      <div className="container">
        <h2 style={{ color: 'var(--navy)', marginBottom: 8 }}>Welcome, {profile.display_name}</h2>
        <p style={{ color: 'var(--gray)', marginBottom: 24 }}>Select a quiz to begin, or open the field site assessment tool.</p>

        <div className="module-label" style={{ paddingTop: 0 }}>Training Exams</div>
        <div className="quiz-select-grid">
          <div className="quiz-option" onClick={() => router.push('/quiz/ep-rpic')}>
            <h3>EP RPIC Exam</h3>
            <p>20 questions — 85% to pass</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--blue)' }}>Full BVLOS qualification</p>
          </div>
          <div className="quiz-option" onClick={() => router.push('/quiz/thp-deployer')}>
            <h3>THP Deployer Exam</h3>
            <p>10 questions — 80% to pass</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--blue)' }}>AGP/Field Deployer</p>
          </div>
        </div>

        <div className="module-label">Field Tools</div>
        <div className="quiz-select-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="quiz-option" onClick={() => router.push('/assessment')}>
            <h3>BVLOS Site Assessment</h3>
            <p>11-section field checklist — map, evidence photos, C2 validation, COA/waiver determination</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--blue)' }}>Submissions are saved to your account</p>
          </div>
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h3 style={{ color: 'var(--navy)', marginBottom: 12 }}>Your Recent Results</h3>
            <table className="admin-table">
              <thead><tr><th>Quiz</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id}>
                    <td>{r.quiz_type === 'ep-rpic' ? 'EP RPIC' : 'THP Deployer'}</td>
                    <td>{r.score}/{r.total} ({r.percentage}%)</td>
                    <td><span className={r.passed ? 'pass-badge' : 'fail-badge'}>{r.passed ? 'PASS' : 'FAIL'}</span></td>
                    <td>{new Date(r.completed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
