// Full audit-ready rendering of a submitted assessment.
// Used by the admin "View" modal and the /print PDF page so they stay identical.
import { SECTIONS, LOGO } from './checklist';

function statusLabel(v: string) {
  if (v === 'checked') return { text: '✓ Confirmed', color: '#2E7D32', bg: '#E8F5E9' };
  if (v === 'na') return { text: 'N/A', color: '#555', bg: '#EEE' };
  return { text: 'Not checked', color: '#C62828', bg: '#FFEBEE' };
}

export default function AssessmentDetail({ record }: any) {
  const fa = record?.full_assessment || {};
  const fields = fa.fields || {};
  const checks = fa.checks || {};
  const notes = fa.notes || {};
  const photos = fa.photos || {};
  const ops = fa.ops || record?.operation_types || [];
  const f = (k: string) => String(fields[k] || '').trim();

  const meta: Array<[string, any]> = [
    ['Assessment ID', record?.assessment_id],
    ['Site Name / ID', f('siteName') || record?.site_name],
    ['Address', f('mapAddress') || record?.site_address],
    ['Coordinates', record?.latitude != null ? `${record.latitude}, ${record.longitude}` : (f('mapLat') ? `${f('mapLat')}, ${f('mapLng')}` : '')],
    ['Assessment Date', f('assessDate') || record?.assessment_date],
    ['Assessed By', f('assessedBy') || record?.assessor],
    ['RPIC Reviewing', f('rpicReviewing') || record?.rpic_reviewer],
    ['Launch Method', f('launchMethod') || record?.launch_method],
    ['Type of Operation', Array.isArray(ops) ? ops.join(', ') : ''],
    ['C2 Validation Result', f('c2OverallResult') || record?.c2_validation_result],
    ['Overall Risk Level', f('ev-risk-0') || record?.risk_level],
    ['OOP/OOMV Exposure', f('ev-ground-15') || record?.oop_oomv_exposure],
    ['Reassessment Date', f('reassessDate') || record?.reassessment_date],
    ['Submitted By', record?.submitted_by],
    ['Submitted At', record?.submitted_at ? new Date(record.submitted_at).toLocaleString() : ''],
    ['Rule Matrix Version', record?.rule_matrix_version],
    ['App Version', record?.app_version || fa.app_version],
  ];

  const decision = String(record?.coa_waiver_determination || '');
  const decTone = /approved with conditions/i.test(decision) ? '#0a7' : /not approved/i.test(decision) ? '#C62828' : '#B8860B';

  const th: any = { textAlign: 'left', padding: '6px 10px', background: '#0B1923', color: '#fff', fontSize: 12, border: '1px solid #ccc' };
  const td: any = { padding: '6px 10px', fontSize: 13, border: '1px solid #ccc', verticalAlign: 'top' };
  const h2: any = { color: '#0B1923', fontSize: 15, margin: '22px 0 8px', borderBottom: '2px solid #FCC00E', paddingBottom: 4 };

  return (
    <div className="assessment-detail" style={{ color: '#111', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* Letterhead */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid #164998', paddingBottom: 12, marginBottom: 12 }}>
        <img src={LOGO} alt="Enhanced Patrol" style={{ height: 46 }} />
        <div>
          <div style={{ fontWeight: 800, color: '#0B1923', fontSize: 18 }}>BVLOS Site Assessment</div>
          <div style={{ color: '#555', fontSize: 12 }}>Enhanced Patrol LLC &bull; Nationwide BVLOS Waiver &bull; Confidential</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#333' }}>{record?.assessment_id}</div>
          <div style={{ marginTop: 4, display: 'inline-block', padding: '4px 10px', border: `2px solid ${decTone}`, color: decTone, fontWeight: 700, fontSize: 12 }}>{decision || 'NO DETERMINATION'}</div>
        </div>
      </div>

      {/* Metadata */}
      <h2 style={h2}>Assessment Summary</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {meta.map(([k, v]) => (
            <tr key={k}><th style={{ ...th, width: 200, background: '#11324a' }}>{k}</th><td style={td}>{v || '—'}</td></tr>
          ))}
        </tbody>
      </table>

      {/* Determination detail */}
      <h2 style={h2}>COA / Waiver Determination</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><th style={{ ...th, width: 200, background: '#11324a' }}>Decision</th><td style={{ ...td, fontWeight: 700, color: decTone }}>{decision || '—'}</td></tr>
          <tr><th style={{ ...th, width: 200, background: '#11324a' }}>Program Review Required</th><td style={td}>{record?.program_review_required ? 'YES' : 'No'}</td></tr>
          <tr><th style={{ ...th, width: 200, background: '#11324a' }}>Open / Failed Rule IDs</th><td style={td}>{Array.isArray(record?.failed_rule_ids) && record.failed_rule_ids.length ? record.failed_rule_ids.join(', ') : 'None'}</td></tr>
        </tbody>
      </table>
      {Array.isArray(record?.corrective_actions) && record.corrective_actions.length > 0 && (
        <>
          <div style={{ fontWeight: 700, margin: '12px 0 4px', color: '#0B1923' }}>Corrective Actions</div>
          <ul style={{ paddingLeft: 20, fontSize: 13, margin: 0 }}>{record.corrective_actions.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
        </>
      )}
      {Array.isArray(record?.operating_conditions) && record.operating_conditions.length > 0 && (
        <>
          <div style={{ fontWeight: 700, margin: '12px 0 4px', color: '#0B1923' }}>Operating Conditions</div>
          <ul style={{ paddingLeft: 20, fontSize: 13, margin: 0 }}>{record.operating_conditions.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
        </>
      )}

      {/* Full checklist, section by section */}
      {SECTIONS.map((s) => {
        if (s.id === 'approval') return null;
        return (
          <div key={s.id} style={{ breakInside: 'avoid' }}>
            <h2 style={h2}>{s.num}. {s.title}</h2>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {s.checks.map((c: any, i: number) => {
                  const key = `${s.id}-${i}`;
                  const st = statusLabel(checks[key] || '');
                  const finding = f(`ev-${key}`);
                  const photoArr = c.photo ? (photos[c.photo] || []) : [];
                  const treeArr = c.tree ? (photos.trees || []) : [];
                  return (
                    <tr key={key}>
                      <td style={{ ...td, width: 130 }}><span style={{ background: st.bg, color: st.color, padding: '2px 6px', borderRadius: 3, fontSize: 11, fontWeight: 700 }}>{st.text}</span></td>
                      <td style={td}>
                        <div>{c.text}</div>
                        {finding && <div style={{ fontSize: 12, color: '#0B5', marginTop: 3 }}><strong>Finding:</strong> {finding}</div>}
                        {c.contact && (f('pocName') || f('pocPhone') || f('pocEmail')) && (
                          <div style={{ fontSize: 12, color: '#333', marginTop: 3 }}><strong>POC:</strong> {f('pocName')} {f('pocPhone')} {f('pocEmail')}</div>
                        )}
                        {c.tree && (f('treeMaxHeight') || f('treeProximity')) && (
                          <div style={{ fontSize: 12, color: '#333', marginTop: 3 }}><strong>Trees:</strong> max height {f('treeMaxHeight') || '—'} ft, proximity {f('treeProximity') || '—'} ft</div>
                        )}
                        {[...photoArr, ...treeArr].length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {[...photoArr, ...treeArr].map((p: string, pi: number) => (
                              <img key={pi} src={p} alt="evidence" style={{ width: 120, height: 120, objectFit: 'cover', border: '1px solid #999' }} />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {s.notes && notes[s.id] && (
              <div style={{ fontSize: 12, marginTop: 6 }}><strong>{s.id === 'risk' ? 'Risk Mitigations & Follow-Up:' : 'Notes:'}</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{notes[s.id]}</span></div>
            )}
          </div>
        );
      })}

      {/* Approval */}
      <h2 style={h2}>11. Site Approval Decision</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr><th style={{ ...th, width: 200, background: '#11324a' }}>COA/Waiver Determination</th><td style={{ ...td, fontWeight: 700, color: decTone }}>{decision || '—'}</td></tr>
          <tr><th style={{ ...th, width: 200, background: '#11324a' }}>Approving RPIC</th><td style={td}>{f('approverName') || '—'}</td></tr>
          <tr><th style={{ ...th, width: 200, background: '#11324a' }}>Approval Date</th><td style={td}>{f('approvalDate') || '—'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
