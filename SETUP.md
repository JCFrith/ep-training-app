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
- **Admins** see all results, filter by name/date/quiz type, create new accounts
- No self-registration — only admins create accounts
- All quiz history is retained and queryable
