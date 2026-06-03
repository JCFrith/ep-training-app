import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getSessionUser } from '../lib/supabase';
import AssessmentDetail from '../lib/AssessmentDetail';

// Read-only printable view of one or more submitted assessments.
// /print?id=<uuid>  (or ?ids=a,b,c) -> renders and auto-opens the print dialog (Save as PDF).
export default function PrintAssessments() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [status, setStatus] = useState('Loading…');

  useEffect(() => {
    if (!router.isReady) return;
    (async () => {
      const user = await getSessionUser();
      if (!user) { router.push('/login'); return; }

      const one = router.query.id ? [String(router.query.id)] : [];
      const many = router.query.ids ? String(router.query.ids).split(',').filter(Boolean) : [];
      const ids = [...one, ...many];
      if (!ids.length) { setStatus('No assessment specified.'); return; }

      const { data, error } = await supabase.from('assessments').select('*').in('id', ids);
      if (error) { setStatus('Error loading: ' + error.message); return; }
      if (!data || !data.length) { setStatus('Assessment not found (or you do not have access).'); return; }
      const ordered = ids.map(id => data.find((d: any) => d.id === id)).filter(Boolean);
      setRecords(ordered);
      setStatus('');
    })();
  }, [router.isReady]);

  useEffect(() => {
    if (!records.length) return;
    const t = setTimeout(() => { try { window.print(); } catch (e) {} }, 900);
    return () => clearTimeout(t);
  }, [records]);

  return (
    <>
      <Head><title>EP Site Assessment — Print</title></Head>
      <style>{`
        :root { color-scheme: light; }
        html, body { background: #fff; margin: 0; }
        .print-wrap { max-width: 880px; margin: 0 auto; padding: 24px; }
        .print-toolbar { position: sticky; top: 0; background: #0B1923; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; z-index: 10; }
        .print-toolbar button { background: #FCC00E; color: #0B1923; border: none; padding: 8px 16px; font-weight: 700; border-radius: 6px; cursor: pointer; }
        .doc { page-break-after: always; }
        .doc:last-child { page-break-after: auto; }
        @media print {
          .print-toolbar { display: none !important; }
          .print-wrap { max-width: none; padding: 0; }
          @page { size: letter; margin: 0.5in; }
        }
      `}</style>

      <div className="print-toolbar">
        <strong>Print / Save as PDF</strong>
        <button onClick={() => window.print()}>Print</button>
        <span style={{ fontSize: 13, opacity: 0.8 }}>{records.length ? `${records.length} assessment${records.length !== 1 ? 's' : ''}` : status}</span>
      </div>

      <div className="print-wrap">
        {records.map((r) => (
          <div className="doc" key={r.id}>
            <AssessmentDetail record={r} />
          </div>
        ))}
        {!records.length && <p style={{ padding: 24, color: '#555' }}>{status}</p>}
      </div>
    </>
  );
}
