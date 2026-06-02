import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { SECTIONS, LOGO, type Section } from '../lib/checklist';
import {
  determine, buildSummary, assessmentId, dataUrlToBlob, shortRunId,
  type SavedAssessment, type RuleResult,
} from '../lib/assessmentRules';

declare global { interface Window { L?: any } }

type CheckValue = '' | 'checked' | 'na';
type FieldState = Record<string, string>;
type PhotoState = Record<string, string[]>;
type CheckState = Record<string, CheckValue>;
type C2Row = { segment: string; rssi: string; latency: string; packetLoss: string; result: string };

const STORE = 'ep-sa-v4';
const EVIDENCE_BUCKET = 'assessment-evidence';
const blankC2 = (): C2Row[] => [
  { segment: '', rssi: '', latency: '', packetLoss: '', result: '' },
  { segment: '', rssi: '', latency: '', packetLoss: '', result: '' },
  { segment: '', rssi: '', latency: '', packetLoss: '', result: '' },
];

function load(): any { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function sixMonths(d?: string) { const x = d ? new Date(d + 'T00:00:00') : new Date(); x.setMonth(x.getMonth() + 6); return x.toISOString().split('T')[0]; }
function compressImage(file: File, maxW = 1200, q = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(rd.error);
    rd.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unable to load image'));
      img.onload = () => {
        const c = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        c.width = w; c.height = h;
        c.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', q));
      };
      img.src = String(e.target?.result || '');
    };
    rd.readAsDataURL(file);
  });
}

export default function Assessment() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [fields, setFields] = useState<FieldState>({});
  const [checks, setChecks] = useState<CheckState>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PhotoState>({});
  const [open, setOpen] = useState<Record<string, boolean>>({ header: true });
  const [ops, setOps] = useState<string[]>([]);
  const [c2rows, setC2rows] = useState<C2Row[]>(blankC2());
  const [cameraKey, setCameraKey] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<(RuleResult & { submitted?: boolean; id?: string; photos?: number; warning?: string }) | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Auth gate
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (!data.user) { router.push('/login'); return; }
      supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }: any) => {
        setProfile(p ? { ...p, id: data.user.id } : { id: data.user.id, display_name: 'User', role: 'user' });
        setAuthChecked(true);
      });
    });
  }, []);

  // Load saved draft from localStorage after mount (avoids SSR/hydration issues)
  useEffect(() => {
    const s = load();
    if (s.fields) setFields(s.fields);
    if (s.checks) setChecks(s.checks);
    if (s.notes) setNotes(s.notes);
    if (s.photos) setPhotos(s.photos);
    if (s.open) setOpen(s.open); else setOpen({ header: true });
    if (s.ops) setOps(s.ops);
    if (s.c2rows?.length) setC2rows(s.c2rows);
    setHydrated(true);
  }, []);

  // Persist draft
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORE, JSON.stringify({ fields, checks, notes, photos, open, ops, c2rows }));
  }, [fields, checks, notes, photos, open, ops, c2rows, hydrated]);

  // Init the map only once the page is past the auth gate (so the map container exists)
  // and the Site Information section is open. loadLeaflet() polls for both Leaflet and the
  // container before drawing, so it can't fire too early and give up.
  useEffect(() => { if (authChecked && open.header) loadLeaflet(); }, [authChecked, open.header]);
  useEffect(() => {
    const before = () => setOpen({ header: true, ...Object.fromEntries(SECTIONS.map(s => [s.id, true])) });
    window.addEventListener('beforeprint', before);
    return () => window.removeEventListener('beforeprint', before);
  }, []);

  const progress = useMemo(() => {
    let total = 0, done = 0;
    SECTIONS.forEach(s => s.checks.forEach((_, i) => { total++; const v = checks[`${s.id}-${i}`]; if (v === 'checked' || v === 'na') done++; }));
    return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
  }, [checks]);

  function persistField(k: string, v: string) { setFields(p => ({ ...p, [k]: v })); }
  function cycle(k: string) { setChecks(p => ({ ...p, [k]: !p[k] ? 'checked' : p[k] === 'checked' ? 'na' : '' })); }
  function sectionDone(s: Section) { return s.checks.filter((_, i) => ['checked', 'na'].includes(checks[`${s.id}-${i}`] || '')).length; }
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2200); }
  function clearAll() {
    if (!confirm('Clear ALL data including photos? Cannot be undone.')) return;
    localStorage.removeItem(STORE);
    setFields({}); setChecks({}); setNotes({}); setPhotos({}); setOpen({ header: true }); setOps([]); setC2rows(blankC2());
    setResult(null);
    flash('Assessment cleared');
  }

  function backupJson() {
    const data = JSON.stringify(currentSaved(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ep-site-assessment-${(fields.siteName || 'draft').replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    flash('Backup downloaded');
  }
  function restoreJson(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(String(r.result));
        if (s.fields) setFields(s.fields);
        if (s.checks) setChecks(s.checks);
        if (s.notes) setNotes(s.notes);
        if (s.photos) setPhotos(s.photos);
        if (s.ops) setOps(s.ops);
        if (s.c2rows) setC2rows(s.c2rows);
        setOpen({ header: true });
        flash('Assessment restored');
      } catch { flash('Invalid backup file'); }
    };
    r.readAsText(file);
    e.target.value = '';
  }

  function loadLeaflet() {
    // Ensure Leaflet CSS + JS are present, then init the map once ready.
    // Polls for window.L so we never race a single onload/timeout.
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }
    if (!window.L && !document.getElementById('leaflet-js')) {
      const s = document.createElement('script');
      s.id = 'leaflet-js';
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      document.body.appendChild(s);
    }
    const start = Date.now();
    const poll = setInterval(() => {
      // Wait for BOTH Leaflet and the map container to exist before initializing.
      if (window.L && document.getElementById('locationMap')) { clearInterval(poll); initMap(); }
      else if (Date.now() - start > 15000) clearInterval(poll);
    }, 100);
  }
  function initMap() {
    if (!window.L) return;
    const div = document.getElementById('locationMap');
    if (!div) return;
    // Idempotent: if the map already exists, just refresh its size (e.g. after the section reopens).
    if (mapRef.current) { setTimeout(() => mapRef.current?.invalidateSize(), 50); return; }
    const lat = parseFloat(fields.mapLat) || 35.71, lng = parseFloat(fields.mapLng) || -86.4;
    mapRef.current = window.L.map('locationMap', { center: [lat, lng], zoom: fields.mapLat ? 17 : 10, attributionControl: false });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 }).addTo(mapRef.current);
    if (fields.mapLat) placeMarker(lat, lng, false);
    mapRef.current.on('click', (e: any) => placeMarker(e.latlng.lat, e.latlng.lng, true));
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
  }
  function mkIcon() {
    return window.L.divIcon({ className: '', html: '<div style="width:30px;height:30px;position:relative"><div style="width:20px;height:20px;background:#FCC00E;border:3px solid #164998;border-radius:50%;position:absolute;top:0;left:5px;box-shadow:0 2px 6px #0008"></div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #164998;position:absolute;top:17px;left:9px"></div></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
  }
  function placeMarker(lat: number, lng: number, rev: boolean) {
    if (!window.L || !mapRef.current) return;
    if (!markerRef.current) {
      markerRef.current = window.L.marker([lat, lng], { draggable: true, icon: mkIcon() }).addTo(mapRef.current);
      markerRef.current.on('dragend', () => { const p = markerRef.current.getLatLng(); setCoords(p.lat, p.lng, true); });
    } else markerRef.current.setLatLng([lat, lng]);
    setCoords(lat, lng, rev);
  }
  function setCoords(lat: number, lng: number, rev: boolean) {
    setFields(p => ({ ...p, mapLat: lat.toFixed(6), mapLng: lng.toFixed(6) }));
    if (rev) reverseGeo(lat, lng);
  }
  async function reverseGeo(lat: number, lng: number) {
    try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`); const d = await r.json(); if (d?.display_name) persistField('mapAddress', d.display_name); } catch {}
  }
  function locateMe() {
    if (!navigator.geolocation) return flash('Geolocation not available');
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return flash('Geolocation requires HTTPS');
    navigator.geolocation.getCurrentPosition(
      p => { mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 17); placeMarker(p.coords.latitude, p.coords.longitude, true); flash('Location found'); },
      e => flash(e.message), { enableHighAccuracy: true, timeout: 15000 });
  }
  function lookupCoords() {
    const lat = parseFloat(fields.mapLat), lng = parseFloat(fields.mapLng);
    if (isNaN(lat) || isNaN(lng)) return flash('Enter valid coordinates first');
    mapRef.current?.setView([lat, lng], 17); placeMarker(lat, lng, true);
  }
  function addPhoto(key: string, data: string) { setPhotos(p => ({ ...p, [key]: [...(p[key] || []), data] })); }
  function removePhoto(key: string, i: number) { setPhotos(p => ({ ...p, [key]: (p[key] || []).filter((_, idx) => idx !== i) })); }

  function currentSaved(): SavedAssessment { return { fields, checks, notes, photos, ops, c2rows }; }

  async function checkCompliance() {
    const r = await determine(currentSaved());
    setResult({ ...r, submitted: false });
    flash(`Determination: ${r.decision}`);
    document.getElementById('ep-determination')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function uploadEvidence(saved: SavedAssessment, idValue: string) {
    const rows: any[] = [];
    const ph = saved.photos || {};
    const run = shortRunId();
    for (const [key, items] of Object.entries(ph)) {
      if (!Array.isArray(items)) continue;
      for (let i = 0; i < items.length; i++) {
        const dataUrl = items[i];
        if (!dataUrl || !dataUrl.startsWith('data:')) continue;
        const { blob, contentType, extension } = dataUrlToBlob(dataUrl);
        const safeKey = key.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
        const path = `${idValue}/${safeKey}/${run}-${String(i + 1).padStart(3, '0')}.${extension}`;
        const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, blob, { contentType, upsert: false });
        if (error) throw error;
        rows.push({ evidence_key: key, photo_index: i, storage_path: path, original_data_url_present: true });
      }
    }
    return rows;
  }

  async function submit() {
    if (!profile) return;
    setSubmitting(true);
    try {
      const saved = currentSaved();
      const ruleResult = await determine(saved);
      const summary: any = buildSummary(saved, ruleResult, profile.id, profile.display_name);

      let uploaded: any[] = [];
      let warning = '';
      try { uploaded = await uploadEvidence(saved, summary.assessment_id); }
      catch (e: any) { warning = e?.message || 'Evidence upload failed.'; }

      summary.full_assessment = { ...summary.full_assessment, uploaded_photo_paths: uploaded, evidence_upload_warning: warning || undefined };

      const { data: inserted, error } = await supabase.from('assessments').insert(summary).select('id').single();
      if (error) throw error;

      if (inserted?.id && uploaded.length) {
        const manifest = uploaded.map(u => ({ assessment_id: inserted.id, ...u }));
        await supabase.from('assessment_photos').insert(manifest);
      }

      setResult({ ...ruleResult, submitted: true, id: summary.assessment_id, photos: uploaded.length, warning });
      flash(`Submitted: ${summary.assessment_id}`);
      document.getElementById('ep-determination')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e: any) {
      alert(`Assessment could not be submitted.\n\n${e?.message || e}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) return <div className="page-center"><div className="card"><p>Loading...</p></div></div>;

  return (
    <>
      <Head>
        <link rel="stylesheet" href="/assessment.css" />
        <title>BVLOS Site Assessment — Enhanced Patrol</title>
      </Head>

      {/* App bar (consistent with training app) */}
      <div className="header no-print">
        <div className="header-inner">
          <span className="title">BVLOS Site Assessment</span>
          <div>
            <span className="user-info">{profile?.display_name}</span>
            <span className="logout" onClick={() => router.push('/')} style={{ marginLeft: 16, color: '#00A2E9' }}>Home</span>
            {profile?.role === 'admin' && (
              <span className="logout" onClick={() => router.push('/admin')} style={{ marginLeft: 16, color: '#00A2E9' }}>Admin</span>
            )}
            <span className="logout" onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}>Sign Out</span>
          </div>
        </div>
      </div>

      <div className="print-header">
        <img src={LOGO} alt="Enhanced Patrol" />
        <div>
          <div className="print-header-title">BVLOS Site Assessment</div>
          <div className="print-header-sub">Enhanced Patrol LLC &bull; enhancedpatrol.com &bull; Confidential</div>
        </div>
      </div>

      <section className="page-hero">
        <h1>BVLOS SITE ASSESSMENT</h1>
        <p className="page-hero-sub">Nationwide BVLOS Waiver -- Enhanced Patrol LLC</p>
      </section>

      <div className="main-container">
        <div className="progress-wrap">
          <div className="progress-info"><span>{progress.done} of {progress.total} items checked</span><span>{progress.pct}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress.pct}%` }} /></div>
        </div>

        <ActionBar clearAll={clearAll} backupJson={backupJson} restoreJson={restoreJson} />

        <SiteInfo open={!!open.header} toggle={() => setOpen(p => ({ ...p, header: !p.header }))} fields={fields} setField={persistField} ops={ops} setOps={setOps} locateMe={locateMe} lookupCoords={lookupCoords} />

        {SECTIONS.map(s => (
          <div className={`section ${open[s.id] ? 'open' : ''}`} key={s.id}>
            <button className="section-header" onClick={() => setOpen(p => ({ ...p, [s.id]: !p[s.id] }))}>
              <div className="section-num">{s.num}</div>
              <div className="section-title">{s.title}</div>
              {s.checks.length > 0 && <div className="section-progress">{sectionDone(s)}/{s.checks.length}</div>}
              <div className="section-toggle">▾</div>
            </button>
            <div className="section-body">
              {s.checks.map((c, i) => {
                const k = `${s.id}-${i}`, v = checks[k] || '';
                return (
                  <div key={k}>
                    <div className="check-item">
                      <button className={`check-box ${v}`} onClick={() => cycle(k)} />
                      <div className={`check-text ${v === 'checked' ? 'done' : ''}`}>{c.text}</div>
                    </div>
                    {(c.photo || c.field || c.options || c.contact || c.tree || c.autodate) && (
                      <div className={`evidence-panel ${v === 'checked' ? 'visible' : ''}`}>
                        {c.photo && <PhotoArea photoKey={c.photo} photos={photos[c.photo] || []} openCamera={setCameraKey} removePhoto={removePhoto} />}
                        {c.tree && <TreeEvidence fields={fields} setField={persistField} photos={photos.trees || []} openCamera={setCameraKey} removePhoto={removePhoto} />}
                        {c.contact && <ContactEvidence fields={fields} setField={persistField} />}
                        {c.autodate && <AutoDate fields={fields} setField={persistField} />}
                        {c.field && <><div className="fg-label">Findings</div><input value={fields[`ev-${k}`] || ''} placeholder={c.field} onChange={e => persistField(`ev-${k}`, e.target.value)} /></>}
                        {c.options && <><div className="fg-label">Selection</div><select value={fields[`ev-${k}`] || ''} onChange={e => persistField(`ev-${k}`, e.target.value)}><option value="">— Select —</option>{c.options.map(o => <option key={o}>{o}</option>)}</select></>}
                      </div>
                    )}
                  </div>
                );
              })}
              {s.id === 'rf' && <C2 fields={fields} setField={persistField} />}
              {s.id === 'approval' && <ApprovalSubmit fields={fields} setField={persistField} result={result} onRun={checkCompliance} onSubmit={submit} submitting={submitting} />}
              {s.notes && (
                <div className="section-notes">
                  <label>{s.id === 'risk' ? 'Risk Mitigations & Follow-Up Actions' : 'Notes'}</label>
                  <textarea value={notes[s.id] || ''} onChange={e => setNotes(p => ({ ...p, [s.id]: e.target.value }))} placeholder="Enter notes..." />
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="bottom-action-bar no-print">
          <ActionBar clearAll={clearAll} backupJson={backupJson} restoreJson={restoreJson} />
        </div>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
      {cameraKey && <CameraModal photoKey={cameraKey} close={() => setCameraKey(null)} addPhoto={addPhoto} />}
    </>
  );
}

function ApprovalSubmit({ fields, setField, result, onRun, onSubmit, submitting }: any) {
  const d = result ? String(result.decision || '') : '';
  const tone = /approved with conditions/i.test(d) ? 'conditional' : /not approved/i.test(d) ? 'not-approved' : '';
  return (
    <>
      <button className="action-btn export no-print" style={{ marginBottom: 14 }} onClick={onRun}>Run COA/Waiver Determination</button>

      <div id="ep-determination" className="ep-waiver-decision-panel" data-decision={tone}>
        <div className="ep-waiver-decision-head">
          <span>COA / Waiver Determination</span>
          <strong>{d || 'NOT RUN'}</strong>
        </div>
        <div className="ep-waiver-decision-body">
          {!result && <p>Tap Run COA/Waiver Determination to evaluate this site.</p>}
          {result?.submitted && (
            <p style={{ color: 'var(--ep-gold)' }}>
              Submitted to the Admin portal. ID: {result.id} &bull; Evidence photos uploaded: {result.photos ?? 0}
              {result.warning ? ` (storage warning: ${result.warning})` : ''}
            </p>
          )}
          {result && result.failedRuleIds?.length > 0 && (
            <>
              <h4>Open Items ({result.failedRuleIds.length})</h4>
              {result.correctiveActions?.length > 0 && (
                <ul>{result.correctiveActions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              )}
              <p style={{ fontSize: '.75rem', color: 'var(--ep-gray)' }}>Failed rule IDs: {result.failedRuleIds.join(', ')}</p>
            </>
          )}
          {result && result.failedRuleIds?.length === 0 && <p>All evaluated rules passed.</p>}
          {result && result.operatingConditions?.length > 0 && (
            <>
              <h4>Operating Conditions</h4>
              <ul>{result.operatingConditions.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
            </>
          )}
        </div>
      </div>

      <div className="field-row">
        <div className="field-group"><label>Approving RPIC</label><input value={fields.approverName || ''} onChange={e => setField('approverName', e.target.value)} /></div>
        <div className="field-group"><label>Date</label><input type="date" value={fields.approvalDate || new Date().toISOString().split('T')[0]} onChange={e => setField('approvalDate', e.target.value)} /></div>
      </div>

      <div className="ep-submit-actions">
        <button id="ep-submit-completed-assessment" className="action-btn export" disabled={submitting} onClick={onSubmit}>
          {submitting ? 'Submitting…' : 'Submit Completed Assessment'}
        </button>
        <p className="ep-submit-hint">Submits the completed assessment to the Admin portal. Photos are uploaded to the private assessment-evidence storage bucket when Storage policies allow it.</p>
      </div>
    </>
  );
}

function ActionBar({ clearAll, backupJson, restoreJson }: any) {
  return (
    <div className="action-bar no-print">
      <button className="action-btn clear" onClick={clearAll}>Clear All</button>
      <button className="action-btn clear json-backup-btn" onClick={backupJson}>Backup JSON</button>
      <label className="action-btn clear json-restore-btn" style={{ cursor: 'pointer' }}>Restore JSON
        <input type="file" accept="application/json" style={{ display: 'none' }} onChange={restoreJson} />
      </label>
      <button className="action-btn export" onClick={() => window.print()}>Export / Print</button>
    </div>
  );
}

function SiteInfo({ open, toggle, fields, setField, ops, setOps, locateMe, lookupCoords }: any) {
  const choices = ['Automated BVLOS', 'Shielded BVLOS', 'Non-Shielded BVLOS', 'Tactical BVLOS', 'Linear Infrastructure', 'OOP Exposure Expected', 'OOMV Exposure Expected'];
  return (
    <div className={`section ${open ? 'open' : ''}`}>
      <button className="section-header" onClick={toggle}>
        <div className="section-num">—</div><div className="section-title">Site Information</div><div className="section-toggle">▾</div>
      </button>
      <div className="section-body">
        <div className="field-group"><label>Site Name / ID</label><input value={fields.siteName || ''} onChange={e => setField('siteName', e.target.value)} /></div>
        <div className="map-container">
          <label>Location</label>
          <div className="map-wrap" style={{ isolation: 'isolate', position: 'relative', zIndex: 0 }}><div id="locationMap"></div><button className="map-locate-btn" onClick={locateMe}>📍 MY LOCATION</button></div>
          <div className="map-coords-row">
            <div className="field-group"><label>Latitude</label><input value={fields.mapLat || ''} onChange={e => setField('mapLat', e.target.value)} placeholder="e.g. 35.8456" /></div>
            <div className="field-group"><label>Longitude</label><input value={fields.mapLng || ''} onChange={e => setField('mapLng', e.target.value)} placeholder="e.g. -86.3903" /></div>
            <button className="btn-lookup" onClick={lookupCoords}>📍 LOOKUP</button>
          </div>
          <div className="field-group" style={{ marginTop: 12 }}><label>Address</label><input value={fields.mapAddress || ''} onChange={e => setField('mapAddress', e.target.value)} placeholder="Auto-populates from coordinates, or enter manually" /></div>
          <div className="map-hint">Drag pin to adjust location. Tap Lookup after entering coordinates manually. Geolocation requires HTTPS.</div>
        </div>
        <div className="field-row">
          <div className="field-group"><label>Assessment Date</label><input type="date" value={fields.assessDate || ''} onChange={e => setField('assessDate', e.target.value)} /></div>
          <div className="field-group"><label>Assessed By</label><input value={fields.assessedBy || ''} onChange={e => setField('assessedBy', e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field-group"><label>RPIC Reviewing</label><input value={fields.rpicReviewing || ''} onChange={e => setField('rpicReviewing', e.target.value)} /></div>
          <div className="field-group"><label>Launch Method</label><select value={fields.launchMethod || ''} onChange={e => setField('launchMethod', e.target.value)}><option value="">— Select —</option><option>Tactical Deployment</option><option>Dock Deployment</option><option>Both</option></select></div>
        </div>
        <div className="field-group">
          <label>Type of Operation</label>
          <div className="checkbox-group">
            {choices.map((o: string) => (
              <button key={o} type="button" className={`checkbox-opt ${ops.includes(o) ? 'selected' : ''}`} onClick={() => setOps(ops.includes(o) ? ops.filter((x: string) => x !== o) : [...ops, o])}>
                <div className="checkbox-mark" /><span>{o}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoArea({ photoKey, photos, openCamera, removePhoto }: any) {
  return (
    <><div className="fg-label">Photos</div>
      <div className="photo-upload-area">
        {photos.map((p: string, i: number) => (
          <div className="photo-thumb" key={i}><img src={p} alt="Site evidence" /><button className="remove-photo" onClick={() => removePhoto(photoKey, i)}>×</button></div>
        ))}
        <button className="photo-add-btn" onClick={() => openCamera(photoKey)}>+<span>Camera</span></button>
      </div>
    </>
  );
}
function ContactEvidence({ fields, setField }: any) {
  return (
    <><div className="fg-label">Client POC</div>
      <div className="field-row-3">
        <input value={fields.pocName || ''} onChange={e => setField('pocName', e.target.value)} placeholder="Name" />
        <input type="tel" value={fields.pocPhone || ''} onChange={e => setField('pocPhone', e.target.value)} placeholder="Phone" />
        <input type="email" value={fields.pocEmail || ''} onChange={e => setField('pocEmail', e.target.value)} placeholder="Email" />
      </div>
    </>
  );
}
function TreeEvidence({ fields, setField, photos, openCamera, removePhoto }: any) {
  return (
    <><PhotoArea photoKey="trees" photos={photos} openCamera={openCamera} removePhoto={removePhoto} />
      <div className="field-row" style={{ marginTop: 8 }}>
        <div><div className="fg-label">Max Height (ft)</div><input type="number" value={fields.treeMaxHeight || ''} onChange={e => setField('treeMaxHeight', e.target.value)} placeholder="Height" /></div>
        <div><div className="fg-label">Proximity to Route (ft)</div><input type="number" value={fields.treeProximity || ''} onChange={e => setField('treeProximity', e.target.value)} placeholder="Distance" /></div>
      </div>
    </>
  );
}
function AutoDate({ fields, setField }: any) {
  const v = fields.reassessDate || sixMonths(fields.assessDate);
  return (
    <><div className="fg-label">Reassessment Date (auto: 6 months)</div>
      <input type="date" value={v} onFocus={() => !fields.reassessDate && setField('reassessDate', v)} onChange={e => setField('reassessDate', e.target.value)} />
    </>
  );
}
function C2({ fields, setField }: any) {
  return (
    <>
      <div className="section-divider" />
      <div className="field-group">
        <label>C2 Validation Result</label>
        <select value={fields.c2OverallResult || ''} onChange={e => setField('c2OverallResult', e.target.value)}>
          <option value="">— Select —</option>
          <option>PASS</option>
          <option>FAIL</option>
          <option>CONDITIONAL</option>
        </select>
      </div>
    </>
  );
}
function Approval({ fields, setField }: any) {
  return (
    <>
      <div className="field-group"><label>Approval Decision</label><select value={fields.approvalDecision || ''} onChange={e => setField('approvalDecision', e.target.value)}><option value="">— Select —</option><option value="APPROVED">Approved -- No Restrictions</option><option value="CONDITIONAL">Approved with Conditions</option><option value="NOT APPROVED">Not Approved</option></select></div>
      {fields.approvalDecision === 'CONDITIONAL' && <div className="field-group"><label>Conditions</label><textarea value={fields.approvalConditions || ''} onChange={e => setField('approvalConditions', e.target.value)} placeholder="List conditions..." /></div>}
      {fields.approvalDecision === 'NOT APPROVED' && <div className="field-group"><label>Reasons for Non-Approval</label><textarea value={fields.approvalReasons || ''} onChange={e => setField('approvalReasons', e.target.value)} placeholder="List reasons..." /></div>}
      <div className="field-row">
        <div className="field-group"><label>Approving RPIC</label><input value={fields.approverName || ''} onChange={e => setField('approverName', e.target.value)} /></div>
        <div className="field-group"><label>Date</label><input type="date" value={fields.approvalDate || new Date().toISOString().split('T')[0]} onChange={e => setField('approvalDate', e.target.value)} /></div>
      </div>
    </>
  );
}
function CameraModal({ photoKey, close, addPhoto }: any) {
  const video = useRef<HTMLVideoElement | null>(null), stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') throw new Error('Live camera requires HTTPS or localhost. Use Upload Photo instead.');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (!ok) { s.getTracks().forEach(t => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play(); setReady(true); }
      } catch (e) { setError(e instanceof Error ? e.message : 'Camera could not be opened.'); }
    })();
    return () => { ok = false; stream.current?.getTracks().forEach(t => t.stop()); };
  }, []);
  function cap() {
    if (!video.current || !video.current.videoWidth) return;
    const c = document.createElement('canvas'), v = video.current;
    const scale = Math.min(1, 1200 / v.videoWidth);
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    addPhoto(photoKey, c.toDataURL('image/jpeg', .7)); close();
  }
  async function upload(files: FileList | null) {
    const list = Array.from(files || []);
    if (!list.length) return;
    for (const f of list) { try { addPhoto(photoKey, await compressImage(f)); } catch { const r = new FileReader(); r.onload = () => addPhoto(photoKey, String(r.result)); r.readAsDataURL(f); } }
    close();
  }
  return (
    <div className="camera-modal-backdrop">
      <div className="camera-modal">
        <div className="camera-modal-head">
          <div><div className="fg-label">Evidence Capture</div><h2>Open Camera / Take Site Photo</h2></div>
          <button className="camera-close" onClick={close}>×</button>
        </div>
        <div className="camera-modal-body">
          <video className="camera-preview" ref={video} autoPlay muted playsInline />
          {error && <div className="camera-error">{error}</div>}
          <div className="camera-actions">
            <label className="action-btn clear">Upload Photo<input type="file" accept="image/*" capture="environment" multiple onChange={e => upload(e.target.files)} style={{ display: 'none' }} /></label>
            <button className="action-btn export" disabled={!ready} onClick={cap}>Capture Photo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
