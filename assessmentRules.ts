// COA/Waiver determination engine — ported from the site-assessment app.
// Loads /coa-waiver-rules.json and evaluates a saved assessment deterministically.

export type SavedAssessment = {
  fields?: Record<string, string>;
  checks?: Record<string, string>;
  photos?: Record<string, string[]>;
  notes?: Record<string, string>;
  ops?: string[];
  c2rows?: unknown[];
};

export type RuleResult = {
  decision: string;
  failedRuleIds: string[];
  programReviewRequired: boolean;
  correctiveActions: string[];
  operatingConditions: string[];
  ruleMatrixVersion: string;
};

function field(saved: SavedAssessment, key: string): string {
  return String(saved.fields?.[key] || '').trim();
}

export function photoCount(saved: SavedAssessment): number {
  return Object.values(saved.photos || {}).reduce(
    (total, arr) => total + (Array.isArray(arr) ? arr.length : 0),
    0
  );
}

function dateToken(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function shortId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8).toUpperCase();
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function assessmentId(saved: SavedAssessment): string {
  const existing = field(saved, 'assessmentId');
  if (existing) return existing;
  const site = field(saved, 'siteName').replace(/[^a-z0-9]+/gi, '').slice(0, 10).toUpperCase() || 'SITE';
  return `EP-SA-${dateToken()}-${site}-${shortId()}`;
}

async function loadRuleMatrix(): Promise<any | null> {
  try {
    const res = await fetch('/coa-waiver-rules.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function checkPass(saved: SavedAssessment, rule: any): boolean {
  const fields = saved.fields || {};
  const checks = saved.checks || {};
  const photos = saved.photos || {};
  const value = (key: string) => String(fields[key] || '').trim();
  if (rule.type === 'fieldRequired') return Boolean(value(rule.field));
  if (rule.type === 'locationRequired') return Boolean(value('mapAddress') || value('mapLat') || value('mapLng'));
  if (rule.type === 'checkRequired') return checks[rule.check] === 'checked' || checks[rule.check] === 'na';
  if (rule.type === 'photoRequired') return Boolean(photos[rule.photo] && photos[rule.photo].length);
  if (rule.type === 'fieldEquals') return value(rule.field) !== String(rule.value || '');
  if (rule.type === 'fieldEqualsNot') return value(rule.field) === String(rule.value || '');
  return true;
}

function conditionApplies(saved: SavedAssessment, condition: any): boolean {
  const value = (key: string) => String(saved.fields?.[key] || '').trim();
  if (!condition.type) return true;
  if (condition.type === 'ifFieldContains') return value(condition.field).includes(condition.contains || '');
  if (condition.type === 'ifFieldNotEquals') return Boolean(value(condition.field)) && value(condition.field) !== String(condition.value || '');
  return true;
}

export async function determine(saved: SavedAssessment): Promise<RuleResult> {
  const matrix = await loadRuleMatrix();
  if (!matrix?.rules) {
    return {
      decision: 'NEEDS PROGRAM REVIEW',
      failedRuleIds: ['RULE-MATRIX-MISSING'],
      programReviewRequired: true,
      correctiveActions: ['Rule matrix could not be loaded. Review assessment manually before approval.'],
      operatingConditions: [],
      ruleMatrixVersion: 'unavailable',
    };
  }

  const failed: string[] = [];
  const needsReview: string[] = [];
  const actions: string[] = [];
  const conditions: string[] = [];

  for (const rule of matrix.rules) {
    if (checkPass(saved, rule)) continue;
    if (rule.severity === 'needsProgramReview') needsReview.push(rule.id);
    else failed.push(rule.id);
    if (rule.correctiveAction) actions.push(rule.correctiveAction);
  }

  for (const condition of matrix.conditions || []) {
    if (conditionApplies(saved, condition) && condition.text) conditions.push(condition.text);
  }

  const decision = failed.length
    ? matrix.decisions?.notApproved || 'NOT APPROVED'
    : needsReview.length
      ? matrix.decisions?.needsProgramReview || 'NEEDS PROGRAM REVIEW'
      : matrix.decisions?.approvedWithConditions || 'APPROVED WITH CONDITIONS';

  return {
    decision,
    failedRuleIds: [...failed, ...needsReview],
    programReviewRequired: needsReview.length > 0,
    correctiveActions: Array.from(new Set(actions)),
    operatingConditions: Array.from(new Set(conditions)),
    ruleMatrixVersion: String(matrix.version || 'unversioned'),
  };
}

export const APP_VERSION = 'EP-SA-2026.05.27-r1';
export const APP_RELEASE_NAME = 'Controlled Operational Readiness Build';

// Build the row inserted into public.assessments.
export function buildSummary(saved: SavedAssessment, result: RuleResult, userId: string, displayName: string) {
  const id = assessmentId(saved);
  const latitude = field(saved, 'mapLat');
  const longitude = field(saved, 'mapLng');
  return {
    assessment_id: id,
    status: 'submitted',
    site_name: field(saved, 'siteName'),
    site_address: field(saved, 'mapAddress'),
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    assessment_type: field(saved, 'assessmentType'),
    assessment_date: field(saved, 'assessDate') || null,
    assessor: field(saved, 'assessedBy'),
    rpic_reviewer: field(saved, 'rpicReviewing'),
    launch_method: field(saved, 'launchMethod'),
    operation_types: saved.ops || [],
    c2_validation_result: field(saved, 'c2OverallResult'),
    risk_level: field(saved, 'ev-risk-0'),
    oop_oomv_exposure: field(saved, 'ev-ground-15'),
    coa_waiver_determination: result.decision,
    program_review_required: result.programReviewRequired,
    failed_rule_ids: result.failedRuleIds,
    corrective_actions: result.correctiveActions,
    operating_conditions: result.operatingConditions,
    reassessment_date: field(saved, 'reassessDate') || null,
    rule_matrix_version: result.ruleMatrixVersion,
    app_version: APP_VERSION,
    app_release_name: APP_RELEASE_NAME,
    full_assessment: {
      ...saved,
      app_version: APP_VERSION,
      app_release_name: APP_RELEASE_NAME,
      rule_matrix_version: result.ruleMatrixVersion,
    },
    photo_count: photoCount(saved),
    submitted_by_user_id: userId,
    submitted_by: displayName || field(saved, 'assessedBy') || field(saved, 'rpicReviewing'),
    submitted_at: new Date().toISOString(),
  };
}

export function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string; extension: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error('Unsupported photo format.');
  const contentType = match[1] || 'image/jpeg';
  const base64 = match[2] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const extension = contentType.includes('png') ? 'png'
    : contentType.includes('webp') ? 'webp'
      : contentType.includes('heic') ? 'heic'
        : contentType.includes('heif') ? 'heif'
          : 'jpg';
  return { blob: new Blob([bytes], { type: contentType }), contentType, extension };
}

export function shortRunId(): string {
  return shortId().toLowerCase();
}
