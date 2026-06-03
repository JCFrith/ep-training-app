// Native jsPDF builders for exam-result and site-assessment PDFs.
// Uses jsPDF's text/image API directly (no html2canvas) so output is never blank.

const NAVY = [11, 25, 33];
const GOLD = [252, 192, 14];
const GREEN = [46, 125, 50];
const RED = [198, 40, 40];
const GRAY = [120, 120, 120];

function decColor(d) {
  if (/not approved/i.test(d)) return RED;
  if (/approved with conditions/i.test(d)) return [10, 119, 80];
  return [184, 134, 11]; // needs review / other
}

export async function buildExamPdf(result, answers) {
  const { jsPDF } = await import('jspdf');
  let QUIZZES = {};
  try { QUIZZES = (await import('./questions')).QUIZZES || {}; } catch (e) {}
  const quiz = QUIZZES[result.quiz_type] || {};
  const title = quiz.title || (result.quiz_type === 'ep-rpic' ? 'EP RPIC Exam' : result.quiz_type === 'thp-deployer' ? 'THP Deployer Exam' : 'Exam');

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, M = 50, CW = W - 2 * M;
  const name = result.profiles?.display_name || result.display_name || 'Unknown';
  const ds = result.completed_at ? new Date(result.completed_at).toLocaleString() : '';
  const score = result.percentage;
  const passed = !!result.passed;
  let y = 0;

  function header() {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 50, 'F');
    doc.setFillColor(...GOLD); doc.rect(0, 50, W, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
    doc.text('Enhanced Patrol LLC', M, 32);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text(title + ' Results', W - M, 32, { align: 'right' });
    return 74;
  }
  function chk(n) { if (y + n > 740) { doc.addPage(); y = header(); } }

  // Cover
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 792, 'F');
  doc.setFillColor(...GOLD); doc.rect(0, 0, W, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), W / 2, 200, { align: 'center' });
  doc.setFontSize(18); doc.setTextColor(...GOLD); doc.text('RESULTS REPORT', W / 2, 232, { align: 'center' });
  const cx = W / 2, cy = 330;
  if (passed) { doc.setFillColor(232, 245, 233); doc.setDrawColor(76, 175, 80); } else { doc.setFillColor(255, 235, 238); doc.setDrawColor(239, 83, 80); }
  doc.setLineWidth(3); doc.circle(cx, cy, 45, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  doc.setTextColor(...(passed ? GREEN : RED)); doc.text(`${score}%`, cx, cy + 11, { align: 'center' });
  doc.setFontSize(20); doc.setTextColor(255, 255, 255); doc.text(passed ? 'PASSED' : 'FAILED', cx, cy + 75, { align: 'center' });
  const rows = [['Student', name], ['Date', ds], ['Score', `${result.score}/${result.total} (${score}%)`]];
  if (quiz.passPercent != null) rows.push(['Passing', `${quiz.passPercent}%`]);
  rows.push(['Result', passed ? 'PASS' : 'FAIL']);
  let dy = cy + 110; doc.setFontSize(10);
  rows.forEach(([l, v]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY); doc.text(l + ':', cx - 10, dy, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(String(v), cx + 10, dy); dy += 18;
  });

  // Question detail
  doc.addPage(); y = header();
  const sorted = [...(answers || [])].sort((a, b) => (a.question_id || 0) - (b.question_id || 0));
  const missed = sorted.filter(a => !a.is_correct).length;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...NAVY);
  doc.text(`Question Detail (${missed} missed)`, M, y); y += 24;

  sorted.forEach((a, i) => {
    const ok = !!a.is_correct;
    const ql = doc.splitTextToSize(`${i + 1}. ${a.question_text}`, CW);
    chk(ql.length * 13 + 46);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
    ql.forEach(ln => { doc.text(ln, M, y); y += 13; }); y += 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...(ok ? GREEN : RED));
    const lbl = ok ? 'CORRECT' : 'INCORRECT';
    const ch = doc.splitTextToSize(`${lbl} — Chosen: ${a.chosen_answer || 'Not answered'}`, CW - 12);
    ch.forEach(ln => { doc.text(ln, M + 12, y); y += 13; });
    if (!ok) {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREEN);
      const co = doc.splitTextToSize(`Correct answer: ${a.correct_answer}`, CW - 12);
      co.forEach(ln => { doc.text(ln, M + 12, y); y += 13; });
    }
    y += 4; doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 12;
  });

  if (!sorted.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...GRAY); doc.text('Per-question detail not available for this attempt.', M, y); }
  return doc;
}

export async function buildAssessmentPdf(record) {
  const { jsPDF } = await import('jspdf');
  let SECTIONS = [];
  try { SECTIONS = (await import('./checklist')).SECTIONS || []; } catch (e) {}
  const fa = record.full_assessment || {};
  const fields = fa.fields || {}, checks = fa.checks || {}, notes = fa.notes || {}, photos = fa.photos || {};
  const ops = fa.ops || record.operation_types || [];
  const f = (k) => String(fields[k] || '').trim();

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, M = 50, CW = W - 2 * M; let y = 0;

  function header() {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 50, 'F');
    doc.setFillColor(...GOLD); doc.rect(0, 50, W, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text('Enhanced Patrol LLC — BVLOS Site Assessment', M, 32);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text(record.assessment_id || '', W - M, 32, { align: 'right' });
    return 72;
  }
  function chk(n) { if (y + n > 740) { doc.addPage(); y = header(); } }
  function heading(t) {
    chk(28); doc.setFillColor(...NAVY); doc.rect(M, y - 12, CW, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...GOLD);
    doc.text(t, M + 8, y + 2); y += 26;
  }
  function line(label, val) {
    const ls = doc.splitTextToSize(`${label}: ${val || '—'}`, CW);
    chk(ls.length * 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    ls.forEach(l => { doc.text(l, M, y); y += 13; });
  }
  function bullet(txt, color) {
    const ls = doc.splitTextToSize('• ' + txt, CW - 6);
    chk(ls.length * 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...(color || [40, 40, 40]));
    ls.forEach(l => { doc.text(l, M + 6, y); y += 13; });
  }
  function addPhotos(arr) {
    if (!arr || !arr.length) return;
    const tw = 150, th = 112, gap = 8; let col = 0, rowX = M;
    chk(th + 6);
    for (const dataUrl of arr) {
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) continue;
      const fmt = /image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG';
      try { doc.addImage(dataUrl, fmt, rowX, y, tw, th); } catch (e) { /* unsupported format -> skip */ }
      col++; rowX += tw + gap;
      if (col >= 3) { col = 0; rowX = M; y += th + gap; chk(th + 6); }
    }
    if (col !== 0) { y += th + gap; }
  }

  y = header();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...NAVY);
  doc.text('BVLOS Site Assessment', M, y); y += 20;
  const decision = String(record.coa_waiver_determination || '');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...decColor(decision));
  doc.text(`Determination: ${decision || '—'}`, M, y); y += 22;

  heading('ASSESSMENT SUMMARY');
  line('Assessment ID', record.assessment_id);
  line('Site Name / ID', f('siteName') || record.site_name);
  line('Address', f('mapAddress') || record.site_address);
  line('Coordinates', record.latitude != null ? `${record.latitude}, ${record.longitude}` : (f('mapLat') ? `${f('mapLat')}, ${f('mapLng')}` : ''));
  line('Assessment Date', f('assessDate') || record.assessment_date);
  line('Assessed By', f('assessedBy') || record.assessor);
  line('RPIC Reviewing', f('rpicReviewing') || record.rpic_reviewer);
  line('Launch Method', f('launchMethod') || record.launch_method);
  line('Type of Operation', Array.isArray(ops) ? ops.join(', ') : '');
  line('C2 Validation Result', f('c2OverallResult') || record.c2_validation_result);
  line('Overall Risk Level', f('ev-risk-0') || record.risk_level);
  line('OOP/OOMV Exposure', f('ev-ground-15') || record.oop_oomv_exposure);
  line('Reassessment Date', f('reassessDate') || record.reassessment_date);
  line('Submitted By', record.submitted_by);
  line('Submitted At', record.submitted_at ? new Date(record.submitted_at).toLocaleString() : '');

  heading('COA / WAIVER DETERMINATION');
  line('Decision', decision);
  line('Program Review Required', record.program_review_required ? 'YES' : 'No');
  line('Failed / Open Rule IDs', Array.isArray(record.failed_rule_ids) && record.failed_rule_ids.length ? record.failed_rule_ids.join(', ') : 'None');
  if (Array.isArray(record.corrective_actions) && record.corrective_actions.length) {
    y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY); chk(14); doc.text('Corrective Actions', M, y); y += 14;
    record.corrective_actions.forEach(c => bullet(c, RED));
  }
  if (Array.isArray(record.operating_conditions) && record.operating_conditions.length) {
    y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY); chk(14); doc.text('Operating Conditions', M, y); y += 14;
    record.operating_conditions.forEach(c => bullet(c));
  }

  for (const s of SECTIONS) {
    if (s.id === 'approval') continue;
    heading(`${s.num}. ${s.title}`.toUpperCase());
    s.checks.forEach((c, i) => {
      const key = `${s.id}-${i}`;
      const v = checks[key] || '';
      const stTxt = v === 'checked' ? 'CONFIRMED' : v === 'na' ? 'N/A' : 'NOT CHECKED';
      const stCol = v === 'checked' ? GREEN : v === 'na' ? GRAY : RED;
      const ls = doc.splitTextToSize(c.text, CW - 90);
      chk(Math.max(13, ls.length * 13));
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...stCol);
      doc.text(stTxt, M, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      ls.forEach((ln, li) => { doc.text(ln, M + 80, y + li * 13); });
      y += Math.max(13, ls.length * 13) + 2;
      const finding = f(`ev-${key}`);
      if (finding) { doc.setTextColor(...GREEN); const fl = doc.splitTextToSize(`Finding: ${finding}`, CW - 80); chk(fl.length * 12); fl.forEach(ln => { doc.text(ln, M + 80, y); y += 12; }); }
      if (c.contact && (f('pocName') || f('pocPhone') || f('pocEmail'))) { doc.setTextColor(60, 60, 60); doc.text(`POC: ${f('pocName')} ${f('pocPhone')} ${f('pocEmail')}`, M + 80, y); y += 12; }
      if (c.tree && (f('treeMaxHeight') || f('treeProximity'))) { doc.setTextColor(60, 60, 60); doc.text(`Trees: max ${f('treeMaxHeight') || '—'} ft, proximity ${f('treeProximity') || '—'} ft`, M + 80, y); y += 12; }
      if (c.photo) addPhotos(photos[c.photo]);
      if (c.tree) addPhotos(photos.trees);
      y += 3;
    });
    if (s.notes && notes[s.id]) { line(s.id === 'risk' ? 'Risk Mitigations & Follow-Up' : 'Notes', notes[s.id]); }
    y += 4;
  }

  heading('11. SITE APPROVAL DECISION');
  line('COA/Waiver Determination', decision);
  line('Approving RPIC', f('approverName'));
  line('Approval Date', f('approvalDate'));
  return doc;
}
