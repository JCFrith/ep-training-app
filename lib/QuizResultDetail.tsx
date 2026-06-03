// Full rendering of a finished exam — used by the admin "View" modal and PDF export.
import { LOGO } from './checklist';
import { QUIZZES } from './questions';

export default function QuizResultDetail({ record, answers, plainLogo }: any) {
  const quiz = (QUIZZES as any)[record?.quiz_type] || {};
  const quizTitle = quiz.title || (record?.quiz_type === 'ep-rpic' ? 'EP RPIC Exam' : record?.quiz_type === 'thp-deployer' ? 'THP Deployer Exam' : record?.quiz_type || 'Exam');
  const name = record?.profiles?.display_name || record?.display_name || '—';
  const username = record?.profiles?.username || '';
  const passed = !!record?.passed;
  const passColor = passed ? '#2E7D32' : '#C62828';
  const sorted = Array.isArray(answers) ? [...answers].sort((a, b) => (a.question_id || 0) - (b.question_id || 0)) : [];

  const th: any = { textAlign: 'left', padding: '6px 10px', background: '#11324a', color: '#fff', fontSize: 12, border: '1px solid #ccc', width: 160 };
  const td: any = { padding: '6px 10px', fontSize: 13, border: '1px solid #ccc', verticalAlign: 'top' };
  const h2: any = { color: '#0B1923', fontSize: 15, margin: '22px 0 8px', borderBottom: '2px solid #FCC00E', paddingBottom: 4 };

  return (
    <div className="quiz-detail" style={{ color: '#111', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* Letterhead */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid #164998', paddingBottom: 12, marginBottom: 12 }}>
        {plainLogo
          ? <div style={{ fontWeight: 900, color: '#0B1923', fontSize: 20, letterSpacing: 1 }}>ENHANCED PATROL</div>
          : <img src={LOGO} alt="Enhanced Patrol" style={{ height: 46 }} crossOrigin="anonymous" />}
        <div>
          <div style={{ fontWeight: 800, color: '#0B1923', fontSize: 18 }}>{quizTitle} — Results</div>
          <div style={{ color: '#555', fontSize: 12 }}>Enhanced Patrol LLC &bull; BVLOS Training Program &bull; Confidential</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', border: `2px solid ${passColor}`, color: passColor, fontWeight: 800, fontSize: 16 }}>
            {record?.percentage}% &middot; {passed ? 'PASS' : 'FAIL'}
          </div>
        </div>
      </div>

      {/* Summary */}
      <h2 style={h2}>Summary</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><th style={th}>Student</th><td style={td}>{name}{username ? ` (${username})` : ''}</td></tr>
          <tr><th style={th}>Exam</th><td style={td}>{quizTitle}</td></tr>
          <tr><th style={th}>Date</th><td style={td}>{record?.completed_at ? new Date(record.completed_at).toLocaleString() : '—'}</td></tr>
          <tr><th style={th}>Score</th><td style={td}>{record?.score}/{record?.total} ({record?.percentage}%)</td></tr>
          {quiz.passPercent != null && <tr><th style={th}>Passing Threshold</th><td style={td}>{quiz.passPercent}%</td></tr>}
          <tr><th style={th}>Result</th><td style={{ ...td, fontWeight: 700, color: passColor }}>{passed ? 'PASS' : 'FAIL'}</td></tr>
        </tbody>
      </table>

      {/* Per-question detail */}
      <h2 style={h2}>Question Detail{sorted.length ? ` (${sorted.filter(a => !a.is_correct).length} missed)` : ''}</h2>
      {sorted.length === 0 && <p style={{ fontSize: 13, color: '#777' }}>Per-question detail not available for this attempt.</p>}
      {sorted.map((a, i) => {
        const ok = !!a.is_correct;
        return (
          <div key={i} style={{ border: '1px solid #ddd', borderLeft: `4px solid ${ok ? '#4CAF50' : '#EF5350'}`, padding: '8px 12px', marginBottom: 8, breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{i + 1}. {a.question_text}</div>
            <div style={{ fontSize: 13, color: ok ? '#2E7D32' : '#C62828' }}>
              {ok ? '✓' : '✗'} Chosen: {a.chosen_answer || 'Not answered'}
            </div>
            {!ok && <div style={{ fontSize: 13, color: '#2E7D32', marginTop: 2 }}>Correct: {a.correct_answer}</div>}
          </div>
        );
      })}
    </div>
  );
}
