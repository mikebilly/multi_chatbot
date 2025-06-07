import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          username: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          created_at?: string
          updated_at?: string
        }
      }
      chatbots: {
        Row: {
          id: string
          user_id: string
          name: string
          settings: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          name: string
          settings?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          settings?: any
          created_at?: string
          updated_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          chatbot_id: string
          name: string
          thread_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          chatbot_id: string
          name: string
          thread_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chatbot_id?: string
          name?: string
          thread_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: string
          content: string
          timestamp: string
        }
        Insert: {
          id: string
          session_id: string
          role: string
          content: string
          timestamp?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: string
          content?: string
          timestamp?: string
        }
      }
    }
  }
}
