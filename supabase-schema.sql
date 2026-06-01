-- Enhanced Patrol BVLOS Training App — Supabase Schema
-- Run this in your Supabase SQL Editor

-- 1. Profiles table (linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Quiz results table
CREATE TABLE quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('ep-rpic', 'thp-deployer')),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Quiz answers (per-question detail)
CREATE TABLE quiz_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id UUID REFERENCES quiz_results(id) ON DELETE CASCADE NOT NULL,
  question_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  chosen_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL
);

-- 4. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Profiles: users can read their own, admins can read all
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Quiz results: users see their own, admins see all
CREATE POLICY "Users read own results" ON quiz_results
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins read all results" ON quiz_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users insert own results" ON quiz_results
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Quiz answers: users see their own, admins see all
CREATE POLICY "Users read own answers" ON quiz_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM quiz_results WHERE quiz_results.id = quiz_answers.result_id AND quiz_results.user_id = auth.uid())
  );

CREATE POLICY "Admins read all answers" ON quiz_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users insert own answers" ON quiz_answers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM quiz_results WHERE quiz_results.id = quiz_answers.result_id AND quiz_results.user_id = auth.uid())
  );

-- 6. Function to create users (called from admin API)
-- This is used by the server-side API route, not directly by clients
CREATE OR REPLACE FUNCTION create_app_user(
  p_username TEXT,
  p_password TEXT,
  p_display_name TEXT,
  p_role TEXT DEFAULT 'user'
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
  fake_email TEXT;
BEGIN
  -- Supabase Auth requires email, so we generate one from the username
  fake_email := p_username || '@ep-training.local';
  
  -- Create the auth user
  new_user_id := (
    SELECT id FROM auth.users 
    WHERE email = fake_email
  );
  
  IF new_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Username already exists';
  END IF;

  -- Insert into auth.users via Supabase admin API (done in the API route instead)
  -- This function just creates the profile after the auth user is created
  -- The actual user creation happens in the /api/create-user endpoint
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create indexes for performance
CREATE INDEX idx_quiz_results_user ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_type ON quiz_results(quiz_type);
CREATE INDEX idx_quiz_results_date ON quiz_results(completed_at);
CREATE INDEX idx_quiz_answers_result ON quiz_answers(result_id);
CREATE INDEX idx_profiles_username ON profiles(username);
