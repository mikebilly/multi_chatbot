-- First, let's check if the tables exist and create them if they don't
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chatbots (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id TEXT PRIMARY KEY,
    chatbot_id TEXT NOT NULL,
    name TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add foreign key for user_profiles if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_profiles_id_fkey' 
        AND table_name = 'user_profiles'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT user_profiles_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for chatbots if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chatbots_user_id_fkey' 
        AND table_name = 'chatbots'
    ) THEN
        ALTER TABLE public.chatbots 
        ADD CONSTRAINT chatbots_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for chat_sessions if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_sessions_chatbot_id_fkey' 
        AND table_name = 'chat_sessions'
    ) THEN
        ALTER TABLE public.chat_sessions 
        ADD CONSTRAINT chat_sessions_chatbot_id_fkey 
        FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for chat_messages if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_messages_session_id_fkey' 
        AND table_name = 'chat_messages'
    ) THEN
        ALTER TABLE public.chat_messages 
        ADD CONSTRAINT chat_messages_session_id_fkey 
        FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create or replace policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.chatbots;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.chat_sessions;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.chat_messages;

-- Simple policies that allow authenticated users to manage their own data
CREATE POLICY "Enable all for authenticated users" ON public.user_profiles
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Enable all for authenticated users" ON public.chatbots
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Enable all for authenticated users" ON public.chat_sessions
    FOR ALL USING (
        chatbot_id IN (
            SELECT id FROM public.chatbots WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Enable all for authenticated users" ON public.chat_messages
    FOR ALL USING (
        session_id IN (
            SELECT cs.id FROM public.chat_sessions cs
            JOIN public.chatbots cb ON cs.chatbot_id = cb.id
            WHERE cb.user_id = auth.uid()
        )
    );
