# Enhanced Patrol BVLOS Training App — Setup Guide

## Architecture
- **Frontend/Backend**: Next.js (hosted on Vercel)
- **Database + Auth**: Supabase (free tier)
- **Code**: GitHub (auto-deploys to Vercel)

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in (or create account)
2. Click "New Project"
3. Name: `ep-training`
4. Set a database password (save this)
5. Region: US East
6. Click "Create"
7. Once created, go to **Settings → API**
8. Copy your **Project URL** and **anon public key** — you'll need these

## Step 2: Create Database Tables

Go to **SQL Editor** in Supabase and run the contents of `supabase-schema.sql` (included in this project).

This creates:
- `profiles` table (usernames, roles, display names)
- `quiz_results` table (scores, pass/fail, timestamps)
- `quiz_answers` table (per-question detail)
- Row Level Security policies
- Admin user function

## Step 2b: Unified Platform Migration (training + site assessment)

The site assessment tool is now part of this app. After Step 2, run the contents of
`supabase-assessment-migration.sql` in the SQL Editor **once**. It:

- Adds `assessments` and `assessment_photos` tables linked to the same `profiles`
  (each submission is stamped with `submitted_by_user_id`).
- Adds the `assessment_master_register` export view.
- Fixes the `Chase Frtith` -> `Chase Frith` display-name typo.
- Installs a non-recursive `is_admin()` helper and clean RLS policies on **all**
  tables — this is the fix for the previous circular-reference 500 errors.
- Sets storage policies for the private `assessment-evidence` bucket.

**Then create the evidence bucket:** Supabase -> **Storage** -> New bucket -> name
`assessment-evidence`, **Public: OFF**. (If you skip this, assessments still submit;
only the evidence photo upload is skipped, with a warning.)

## Step 3: Create Your Admin Account

In the Supabase SQL Editor, run:

```sql
SELECT create_app_user('admin', 'your-secure-password-here', 'Chase Frith', 'admin');
```

This creates your admin login. You'll use the admin dashboard to create all other accounts.

## Step 4: Create GitHub Repository

1. Go to https://github.com and create a new repository: `ep-training-app`
2. Upload all project files from this folder
3. Make sure `.env.local` is in your `.gitignore` (it already is)

## Step 5: Deploy to Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "Import Project" → select `ep-training-app`
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key (from Settings → API → service_role)
4. Click "Deploy"
5. Your app is live at `https://ep-training-app.vercel.app` (or custom domain)

## Step 6: Create User Accounts

1. Log in with your admin credentials
2. Go to Admin Dashboard → "Create User" tab
3. Enter username, password, display name, and role (user or admin)
4. Hand out credentials to your pilots/officers

## How It Works

- **Users** log in with username/password → select quiz (EP RPIC or THP Deployer) → take quiz → results saved to database + PDF download
- **Users** can also open the **BVLOS Site Assessment** field tool (`/assessment`): 11-section checklist, map, evidence photos, C2 validation, and an automatic COA/waiver determination. Each submission is saved to their account.
- **Admins** see all quiz results AND all site assessments (new "Site Assessments" tab: filter, view full detail + evidence photos, export CSV), and create new accounts
- No self-registration — only admins create accounts
- All quiz history and assessment records are retained and queryable

## Environment Variables (unchanged)

The site assessment tool reuses the **same** Supabase env vars as the training app —
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
There is no separate site-assessment project anymore: one codebase, one database, one login.
