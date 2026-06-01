import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { QUIZZES } from '../../lib/questions';

export default function Quiz() {
  const router = useRouter();
  const { type } = router.query;
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selected, setSelected] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const topRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      const cached = localStorage.getItem('ep_profile');
      if (cached) setProfile(JSON.parse(cached));
      else supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }) => setProfile(p));
    });
  }, []);

  if (!type || !QUIZZES[type]) return <div className="page-center"><div className="card"><p>Loading...</p></div></div>;

  const quiz = QUIZZES[type];
  const questions = quiz.questions;
  const totalQ = questions.length;
  const answeredCount = Object.keys(submitted).length;
  const correctCount = Object.values(submitted).filter(v => v.correct).length;
  const score = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const passed = score >= quiz.passPercent;

  function handleSelect(qId, ci) { if (!submitted[qId]) setSelected(p => ({ ...p, [qId]: ci })); }

  function handleSubmitAnswer(qId) {
    if (selected[qId] === undefined || submitted[qId]) return;
    const q = questions.find(x => x.id === qId);
    setSubmitted(p => ({ ...p, [qId]: { chosen: selected[qId], correct: selected[qId] === q.correct } }));
  }

  async function handleFinish() {
    setSaving(true);
    // Save to Supabase
    const { data: result, error: rErr } = await supabase.from('quiz_results').insert({
      user_id: user.id, quiz_type: type, score: correctCount, total: totalQ, percentage: score, passed,
    }).select().single();

    if (result) {
      const answers = questions.map(q => {
        const s = submitted[q.id];
        return {
          result_id: result.id, question_id: q.id, question_text: q.q,
          chosen_answer: s ? q.choices[s.chosen] : 'Not answered',
          correct_answer: q.choices[q.correct], is_correct: s ? s.correct : false,
        };
      });
      await supabase.from('quiz_answers').insert(answers);
    }
    setSaving(false);
    setFinished(true);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function downloadPDF() {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const W = 612, M = 50, CW = W - 2 * M;
      const ds = new Date().toLocaleDateString();
      const dn = profile?.display_name || 'Unknown';
      let y = 0;
      function chk(n) { if (y + n > 720) { doc.addPage(); y = dH(); } }
      function dH() { doc.setFillColor(11,25,35); doc.rect(0,0,W,50,'F'); doc.setFillColor(252,192,14); doc.rect(0,50,W,4,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(255,255,255); doc.text('Enhanced Patrol LLC',M,32); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(154,154,154); doc.text(quiz.title + ' Results',W-M,32,{align:'right'}); return 74; }

      // Cover
      doc.setFillColor(11,25,35); doc.rect(0,0,W,792,'F'); doc.setFillColor(252,192,14); doc.rect(0,0,W,6,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(28); doc.setTextColor(255,255,255); doc.text(quiz.title.toUpperCase(),W/2,200,{align:'center'});
      doc.setFontSize(18); doc.setTextColor(252,192,14); doc.text('RESULTS REPORT',W/2,232,{align:'center'});
      doc.setFillColor(252,192,14); doc.rect(W/2-40,252,80,3,'F');
      const cx=W/2,cy=330;
      if(passed){doc.setFillColor(232,245,233);doc.setDrawColor(76,175,80)}else{doc.setFillColor(255,235,238);doc.setDrawColor(239,83,80)}
      doc.setLineWidth(3);doc.circle(cx,cy,45,'FD');doc.setFont('helvetica','bold');doc.setFontSize(32);
      if(passed)doc.setTextColor(46,125,50);else doc.setTextColor(198,40,40);doc.text(`${score}%`,cx,cy+12,{align:'center'});
      doc.setFontSize(20);doc.setTextColor(255,255,255);doc.text(passed?'PASSED':'FAILED',cx,cy+75,{align:'center'});
      const dt=[['Student Name',dn],['Date',ds],['Score',`${correctCount}/${totalQ} (${score}%)`],['Passing',`${quiz.passPercent}%`],['Result',passed?'PASS':'FAIL'],['Quiz',quiz.subtitle]];
      let dy=cy+110;doc.setFontSize(10);dt.forEach(([l,v])=>{doc.setFont('helvetica','normal');doc.setTextColor(154,154,154);doc.text(l+':',cx-10,dy,{align:'right'});doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(v,cx+10,dy);dy+=18});
      doc.setFillColor(252,192,14);doc.rect(0,742,W,6,'F');

      // Detail
      doc.addPage(); y=dH(); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(11,25,35); doc.text('Question Detail',M,y); y+=24;
      let curMod='';
      questions.forEach((q,qi)=>{
        if(q.module!==curMod){curMod=q.module;chk(40);doc.setFillColor(242,246,250);doc.rect(M,y-12,CW,20,'F');doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(0,162,233);doc.text(curMod.toUpperCase(),M+8,y);y+=18}
        const s=submitted[q.id],ci=s?s.chosen:-1,ic=s?s.correct:false,L=['A','B','C','D'];
        const ql=doc.splitTextToSize(`${qi+1}. ${q.q}`,CW-16);chk(ql.length*13+q.choices.length*14+30);
        doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(26,26,46);ql.forEach(ln=>{doc.text(ln,M+8,y);y+=13});y+=4;
        q.choices.forEach((ch,i)=>{const isC=i===q.correct,isS=i===ci;let px=`${L[i]}. `;if(isC){doc.setFont('helvetica','bold');doc.setTextColor(46,125,50);px=`${L[i]}. \u2713 `}else if(isS&&!ic){doc.setFont('helvetica','bold');doc.setTextColor(198,40,40);px=`${L[i]}. \u2717 `}else{doc.setFont('helvetica','normal');doc.setTextColor(120,120,120)}const cl=doc.splitTextToSize(px+ch,CW-30);cl.forEach(ln=>{doc.text(ln,M+20,y);y+=13})});
        y+=4;if(ic){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(46,125,50);doc.text('CORRECT',M+20,y)}else{doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(198,40,40);doc.text(`INCORRECT — Correct: ${L[q.correct]}`,M+20,y)}y+=20;
        doc.setDrawColor(220,220,220);doc.setLineWidth(0.5);doc.line(M,y,W-M,y);y+=14;
      });
      doc.save(`${type}_Exam_${dn.replace(/\s+/g,'_')}_${ds.replace(/\//g,'-')}.pdf`);
    });
  }

  // ── RESULTS SCREEN ──
  if (finished) {
    return (
      <div ref={topRef} className="page-center">
        <div className="card" style={{ maxWidth: 520 }}>
          <div className={`score-circle ${passed ? 'pass' : 'fail'}`}><span>{score}%</span></div>
          <h1>{passed ? 'PASSED' : 'FAILED'}</h1>
          <p style={{ color: 'var(--gray)', marginBottom: 8 }}>{profile?.display_name} — {new Date().toLocaleDateString()}</p>
          <p style={{ marginBottom: 24 }}>{correctCount} of {totalQ} correct ({quiz.passPercent}% required)</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-gold" onClick={downloadPDF}>Download PDF</button>
            <button className="btn btn-outline" onClick={() => router.push('/')}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUIZ SCREEN ──
  let currentModule = '';
  return (
    <div ref={topRef}>
      <div className="header">
        <div className="header-inner">
          <span className="title">{quiz.title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="user-info">{answeredCount}/{totalQ}</span>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${(answeredCount/totalQ)*100}%` }} /></div>
          </div>
        </div>
      </div>
      <div className="container" style={{ paddingBottom: answeredCount === totalQ ? 140 : 24 }}>
        {questions.map((q, qi) => {
          const isSubmitted = !!submitted[q.id];
          const sub = submitted[q.id];
          const showModule = q.module !== currentModule;
          if (showModule) currentModule = q.module;
          return (
            <div key={q.id}>
              {showModule && <div className="module-label" style={qi > 0 ? { marginTop: 16 } : {}}>{q.module}</div>}
              <div className={`q-card ${isSubmitted ? (sub.correct ? 'correct' : 'wrong') : ''}`} id={`card-${q.id}`}>
                <div className="q-header">
                  <span className={`q-num ${isSubmitted ? (sub.correct ? 'correct' : 'wrong') : ''}`}>{qi + 1}</span>
                  <p className="q-text">{q.q}</p>
                </div>
                <div className="choices">
                  {q.choices.map((choice, ci) => {
                    const isSelected = selected[q.id] === ci;
                    const isCorrectChoice = ci === q.correct;
                    let cls = 'choice';
                    if (isSubmitted) {
                      cls += ' locked';
                      if (isCorrectChoice) cls += ' is-correct';
                      else if (isSelected && !sub.correct) cls += ' is-wrong';
                      else cls += ' dimmed';
                    } else if (isSelected) cls += ' selected';
                    return (
                      <div key={ci} className={cls} onClick={() => handleSelect(q.id, ci)}>
                        <span className="letter">{String.fromCharCode(65 + ci)}</span>
                        <span className="choice-text">{choice}</span>
                      </div>
                    );
                  })}
                </div>
                {isSubmitted ? (
                  <div className={`feedback ${sub.correct ? 'correct' : 'wrong'}`}>
                    {sub.correct ? '✓ Correct' : `✗ Incorrect — Answer: ${String.fromCharCode(65 + q.correct)}`}
                  </div>
                ) : (
                  <button className={`btn-submit-answer ${selected[q.id] !== undefined ? 'active' : ''}`} onClick={() => handleSubmitAnswer(q.id)} disabled={selected[q.id] === undefined}>
                    Submit Answer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {answeredCount === totalQ && (
        <div className="finish-bar">
          <button className="btn btn-gold" style={{ fontSize: 17, fontWeight: 800, padding: '14px 48px' }} onClick={handleFinish} disabled={saving}>
            {saving ? 'Saving...' : 'Finish Exam — View Results'}
          </button>
        </div>
      )}
    </div>
  );
}
