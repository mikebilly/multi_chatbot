-- Check if tables exist before creating them
DO $$
BEGIN
    -- Create user_profiles table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        CREATE TABLE public.user_profiles (
            id UUID PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add foreign key constraint if auth.users exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
            ALTER TABLE public.user_profiles ADD CONSTRAINT fk_user_profiles_auth_users
            FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Create chatbots table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatbots') THEN
        CREATE TABLE public.chatbots (
            id TEXT PRIMARY KEY,
            user_id UUID NOT NULL,
            name TEXT NOT NULL,
            settings JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add foreign key constraint if user_profiles exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
            ALTER TABLE public.chatbots ADD CONSTRAINT fk_chatbots_user_profiles
            FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Create chat_sessions table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_sessions') THEN
        CREATE TABLE public.chat_sessions (
            id TEXT PRIMARY KEY,
            chatbot_id TEXT NOT NULL,
            name TEXT NOT NULL,
            thread_id TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add foreign key constraint if chatbots exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chatbots') THEN
            ALTER TABLE public.chat_sessions ADD CONSTRAINT fk_chat_sessions_chatbots
            FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Create chat_messages table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages') THEN
        CREATE TABLE public.chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add foreign key constraint if chat_sessions exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_sessions') THEN
            ALTER TABLE public.chat_messages ADD CONSTRAINT fk_chat_messages_chat_sessions
            FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own chatbots" ON public.chatbots;
DROP POLICY IF EXISTS "Users can manage own chatbots" ON public.chatbots;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can manage own messages" ON public.chat_messages;

-- Create policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own chatbots" ON public.chatbots
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own chatbots" ON public.chatbots
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own sessions" ON public.chat_sessions
  FOR SELECT USING (chatbot_id IN (
    SELECT id FROM public.chatbots WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own sessions" ON public.chat_sessions
  FOR ALL USING (chatbot_id IN (
    SELECT id FROM public.chatbots WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT USING (session_id IN (
    SELECT cs.id FROM public.chat_sessions cs
    JOIN public.chatbots cb ON cs.chatbot_id = cb.id
    WHERE cb.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own messages" ON public.chat_messages
  FOR ALL USING (session_id IN (
    SELECT cs.id FROM public.chat_sessions cs
    JOIN public.chatbots cb ON cs.chatbot_id = cb.id
    WHERE cb.user_id = auth.uid()
  ));
