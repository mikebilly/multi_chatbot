-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chatbots table
CREATE TABLE IF NOT EXISTS public.chatbots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chatbot_id UUID REFERENCES public.chatbots(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own chatbots" ON public.chatbots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chatbots" ON public.chatbots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chatbots" ON public.chatbots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chatbots" ON public.chatbots
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON public.chat_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chatbots 
      WHERE chatbots.id = chat_sessions.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own sessions" ON public.chat_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chatbots 
      WHERE chatbots.id = chat_sessions.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own sessions" ON public.chat_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chatbots 
      WHERE chatbots.id = chat_sessions.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own sessions" ON public.chat_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.chatbots 
      WHERE chatbots.id = chat_sessions.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      JOIN public.chatbots cb ON cs.chatbot_id = cb.id
      WHERE cs.id = chat_messages.session_id 
      AND cb.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      JOIN public.chatbots cb ON cs.chatbot_id = cb.id
      WHERE cs.id = chat_messages.session_id 
      AND cb.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chatbots_user_id ON public.chatbots(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON public.chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
