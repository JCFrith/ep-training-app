-- ============================================================================
-- Enhanced Patrol — Unified Platform Migration
-- Run this ONCE in the Supabase SQL Editor for the ep-training project
-- (https://xuaypaqogtjedmyvixjs.supabase.co).
--
-- What it does:
--   1. Adds the Site Assessment tables (assessments, assessment_photos)
--      linked to the SAME user profiles as the training app.
--   2. Adds the flattened master-register view for CSV/export.
--   3. Fixes the Chase Frtith -> Chase Frith display_name typo.
--   4. Installs a non-recursive is_admin() helper and clean RLS policies
--      on ALL tables (this is the fix for the circular-reference 500 errors).
--   5. Sets storage policies for the private "assessment-evidence" bucket.
--
-- Safe to re-run: every object uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0. Fix the admin display_name typo
-- ----------------------------------------------------------------------------
update public.profiles set display_name = 'Chase Frith'
where display_name = 'Chase Frtith';

-- ----------------------------------------------------------------------------
-- 1. Site Assessment tables (linked to profiles)
-- ----------------------------------------------------------------------------
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  assessment_id text not null unique,
  status text not null default 'submitted',
  site_name text,
  site_address text,
  latitude numeric,
  longitude numeric,
  assessment_type text,
  assessment_date date,
  assessor text,
  rpic_reviewer text,
  launch_method text,
  operation_types text[],
  c2_validation_result text,
  risk_level text,
  oop_oomv_exposure text,
  coa_waiver_determination text,
  program_review_required boolean not null default false,
  failed_rule_ids text[],
  corrective_actions jsonb not null default '[]'::jsonb,
  operating_conditions jsonb not null default '[]'::jsonb,
  reassessment_date date,
  rule_matrix_version text,
  app_version text,
  app_release_name text,
  full_assessment jsonb not null,
  photo_count integer not null default 0,
  -- Link to the shared training-app user who submitted this assessment.
  submitted_by_user_id uuid references public.profiles(id) on delete set null,
  submitted_by text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  superseded_by uuid references public.assessments(id),
  notes text
);

create index if not exists assessments_assessment_id_idx on public.assessments (assessment_id);
create index if not exists assessments_site_name_idx on public.assessments (site_name);
create index if not exists assessments_submitted_at_idx on public.assessments (submitted_at desc);
create index if not exists assessments_determination_idx on public.assessments (coa_waiver_determination);
create index if not exists assessments_submitted_by_user_idx on public.assessments (submitted_by_user_id);

create table if not exists public.assessment_photos (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  evidence_key text not null,
  photo_index integer not null default 0,
  storage_path text,
  original_data_url_present boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists assessment_photos_assessment_id_idx on public.assessment_photos (assessment_id);

-- ----------------------------------------------------------------------------
-- 2. Flattened master register view (CSV / export)
-- ----------------------------------------------------------------------------
create or replace view public.assessment_master_register as
select
  assessment_id,
  site_name,
  site_address,
  latitude,
  longitude,
  assessment_date,
  assessor,
  rpic_reviewer,
  launch_method,
  array_to_string(operation_types, '; ') as operation_types,
  c2_validation_result,
  risk_level,
  oop_oomv_exposure,
  coa_waiver_determination,
  program_review_required,
  array_to_string(failed_rule_ids, '; ') as failed_rule_ids,
  reassessment_date,
  rule_matrix_version,
  photo_count,
  submitted_at,
  submitted_by,
  status
from public.assessments;

-- ----------------------------------------------------------------------------
-- 3. Non-recursive admin helper.
--    SECURITY DEFINER bypasses RLS on profiles, so admin policies that call
--    this do NOT recurse into the profiles policies (the old 500 cause).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Enable RLS + clean policies on ALL tables
-- ----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.quiz_results   enable row level security;
alter table public.quiz_answers   enable row level security;
alter table public.assessments    enable row level security;
alter table public.assessment_photos enable row level security;

-- ---- profiles ----
drop policy if exists "Users read own profile"   on public.profiles;
drop policy if exists "Admins read all profiles"  on public.profiles;
drop policy if exists "read own or admin profiles" on public.profiles;

create policy "read own or admin profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- ---- quiz_results ----
drop policy if exists "Users read own results"  on public.quiz_results;
drop policy if exists "Admins read all results" on public.quiz_results;
drop policy if exists "Users insert own results" on public.quiz_results;
drop policy if exists "read own or admin results" on public.quiz_results;
drop policy if exists "insert own results" on public.quiz_results;

create policy "read own or admin results" on public.quiz_results
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "insert own results" on public.quiz_results
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---- quiz_answers ----
drop policy if exists "Users read own answers"  on public.quiz_answers;
drop policy if exists "Admins read all answers" on public.quiz_answers;
drop policy if exists "Users insert own answers" on public.quiz_answers;
drop policy if exists "read own or admin answers" on public.quiz_answers;
drop policy if exists "insert own answers" on public.quiz_answers;

create policy "read own or admin answers" on public.quiz_answers
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.quiz_results r
      where r.id = quiz_answers.result_id and r.user_id = auth.uid()
    )
  );

create policy "insert own answers" on public.quiz_answers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.quiz_results r
      where r.id = quiz_answers.result_id and r.user_id = auth.uid()
    )
  );

-- ---- assessments ----
drop policy if exists "insert own assessments"   on public.assessments;
drop policy if exists "read own or admin assessments" on public.assessments;
drop policy if exists "admin delete assessments"  on public.assessments;

create policy "insert own assessments" on public.assessments
  for insert to authenticated
  with check (submitted_by_user_id = auth.uid());

create policy "read own or admin assessments" on public.assessments
  for select to authenticated
  using (submitted_by_user_id = auth.uid() or public.is_admin());

create policy "admin delete assessments" on public.assessments
  for delete to authenticated
  using (public.is_admin());

-- ---- assessment_photos ----
drop policy if exists "insert own assessment photos" on public.assessment_photos;
drop policy if exists "read own or admin assessment photos" on public.assessment_photos;
drop policy if exists "admin delete assessment photos" on public.assessment_photos;

create policy "insert own assessment photos" on public.assessment_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.assessments a
      where a.id = assessment_photos.assessment_id
        and a.submitted_by_user_id = auth.uid()
    )
  );

create policy "read own or admin assessment photos" on public.assessment_photos
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.assessments a
      where a.id = assessment_photos.assessment_id
        and a.submitted_by_user_id = auth.uid()
    )
  );

create policy "admin delete assessment photos" on public.assessment_photos
  for delete to authenticated
  using (public.is_admin());

-- Master register view follows caller RLS where supported.
do $$
begin
  begin
    execute 'alter view public.assessment_master_register set (security_invoker = true)';
  exception when others then
    raise notice 'Could not set security_invoker on assessment_master_register: %', sqlerrm;
  end;
end $$;

grant select on public.assessment_master_register to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Storage policies for the private "assessment-evidence" bucket.
--    NOTE: create the bucket first in Storage UI (name: assessment-evidence,
--    Public: OFF). These policies then apply.
-- ----------------------------------------------------------------------------
drop policy if exists "authd upload assessment evidence" on storage.objects;
drop policy if exists "admin read assessment evidence"   on storage.objects;
drop policy if exists "admin delete assessment evidence" on storage.objects;

create policy "authd upload assessment evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assessment-evidence');

create policy "admin read assessment evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'assessment-evidence' and public.is_admin());

create policy "admin delete assessment evidence" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assessment-evidence' and public.is_admin());

-- Reload PostgREST schema/policy cache.
select pg_notify('pgrst', 'reload schema');

commit;

-- Verification
select 'profiles typo check' as check, count(*) as chase_frith_rows
from public.profiles where display_name = 'Chase Frith';

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public','storage')
  and tablename in ('profiles','quiz_results','quiz_answers','assessments','assessment_photos','objects')
order by tablename, policyname;
