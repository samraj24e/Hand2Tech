-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'laborer');
CREATE TYPE project_status AS ENUM ('open', 'matched', 'closed');
CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'rejected');

-- Users table (Extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  skills JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  bio TEXT,
  document_url TEXT
);

-- Projects table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  required_skills JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  budget TEXT,
  status project_status DEFAULT 'open'
);

-- Connections table
CREATE TABLE public.connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status connection_status DEFAULT 'pending',
  UNIQUE(project_id, requester_id)
);

-- Messages table
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Milestones table
CREATE TABLE public.milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Disable RLS for MVP ease, or set simple policies:
CREATE POLICY "Allow all public read/write for MVP" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all public read/write for MVP" ON public.projects FOR ALL USING (true);
CREATE POLICY "Allow all public read/write for MVP" ON public.connections FOR ALL USING (true);
CREATE POLICY "Allow all public read/write for MVP" ON public.messages FOR ALL USING (true);
CREATE POLICY "Allow all public read/write for MVP" ON public.milestones FOR ALL USING (true);

-- Enable Realtime for messages, connections, and milestones
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.connections;
alter publication supabase_realtime add table public.milestones;

-- Function for AI Matchmaking: Find users whose skills match project required skills
CREATE OR REPLACE FUNCTION find_matching_innovators(req_skills JSONB, req_location TEXT DEFAULT NULL)
RETURNS SETOF public.users
LANGUAGE sql
AS $$
  SELECT * FROM public.users
  WHERE skills ?| ARRAY(SELECT jsonb_array_elements_text(req_skills))
  ORDER BY 
    CASE 
      WHEN req_location IS NOT NULL AND location ILIKE '%' || req_location || '%' THEN 1
      ELSE 2
    END ASC;
$$;
