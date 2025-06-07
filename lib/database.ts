import { supabase } from "./supabase"
import type { Chatbot, ChatSession, ChatMessage } from "./types"

export class DatabaseService {
  // Check if Supabase is properly configured
  private static isConfigured(): boolean {
    return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  }

  // User Profile Operations
  static async createUserProfile(userId: string, username: string) {
    if (!this.isConfigured()) {
      throw new Error("Database not configured")
    }

    try {
      // First check if profile already exists
      const { data: existingProfile } = await supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle()

      if (existingProfile) {
        console.log("Profile already exists, returning existing profile")
        return existingProfile
      }

      // Create new profile
      const { data, error } = await supabase.from("user_profiles").insert({ id: userId, username }).select().single()

      if (error) {
        console.error("Database error creating profile:", error)
        throw error
      }

      return data
    } catch (error) {
      console.error("Error in createUserProfile:", error)
      throw error
    }
  }

  static async getUserProfile(userId: string) {
    if (!this.isConfigured()) {
      throw new Error("Database not configured")
    }

    try {
      const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle()

      if (error) {
        console.error("Database error fetching profile:", error)
        throw error
      }

      if (!data) {
        throw new Error("Profile not found")
      }

      return data
    } catch (error) {
      console.error("Error in getUserProfile:", error)
      throw error
    }
  }

  // Chatbot Operations
  static async getChatbots(userId: string): Promise<Chatbot[]> {
    if (!this.isConfigured()) {
      // Return mock data for development
      return [
        { id: "1", name: "Assistant", sessions: [] },
        { id: "2", name: "Coder", sessions: [] },
        { id: "3", name: "Creative", sessions: [] },
      ]
    }

    const { data: chatbotsData, error: chatbotsError } = await supabase
      .from("chatbots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })

    if (chatbotsError) throw chatbotsError

    const chatbots: Chatbot[] = []

    for (const chatbot of chatbotsData) {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("chatbot_id", chatbot.id)
        .order("created_at", { ascending: true })

      if (sessionsError) throw sessionsError

      const sessions: ChatSession[] = []

      for (const session of sessionsData) {
        const { data: messagesData, error: messagesError } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("session_id", session.id)
          .order("timestamp", { ascending: true })

        if (messagesError) throw messagesError

        const messages: ChatMessage[] = messagesData.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
          timestamp: msg.timestamp,
        }))

        sessions.push({
          id: session.id,
          name: session.name,
          messages,
          threadId: session.thread_id,
        })
      }

      chatbots.push({
        id: chatbot.id,
        name: chatbot.name,
        sessions,
        settings: chatbot.settings,
      })
    }

    return chatbots
  }

  static async createChatbot(userId: string, name: string): Promise<string> {
    if (!this.isConfigured()) {
      // Return mock ID for development
      return `bot_${Date.now()}`
    }

    const { data, error } = await supabase
      .from("chatbots")
      .insert({ user_id: userId, name, settings: {} })
      .select()
      .single()

    if (error) throw error
    return data.id
  }

  static async updateChatbot(chatbotId: string, updates: { name?: string; settings?: any }) {
    if (!this.isConfigured()) {
      return // No-op for development
    }

    const { error } = await supabase
      .from("chatbots")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", chatbotId)

    if (error) throw error
  }

  static async deleteChatbot(chatbotId: string) {
    if (!this.isConfigured()) {
      return // No-op for development
    }

    const { error } = await supabase.from("chatbots").delete().eq("id", chatbotId)

    if (error) throw error
  }

  // Session Operations
  static async createSession(chatbotId: string, name: string, threadId: string): Promise<string> {
    if (!this.isConfigured()) {
      // Return mock ID for development
      return `session_${Date.now()}`
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ chatbot_id: chatbotId, name, thread_id: threadId })
      .select()
      .single()

    if (error) throw error
    return data.id
  }

  static async updateSession(sessionId: string, updates: { name?: string }) {
    if (!this.isConfigured()) {
      return // No-op for development
    }

    const { error } = await supabase
      .from("chat_sessions")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", sessionId)

    if (error) throw error
  }

  static async deleteSession(sessionId: string) {
    if (!this.isConfigured()) {
      return // No-op for development
    }

    const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId)

    if (error) throw error
  }

  // Message Operations
  static async addMessage(sessionId: string, message: ChatMessage) {
    if (!this.isConfigured()) {
      return // No-op for development
    }

    const { error } = await supabase.from("chat_messages").insert({
      session_id: sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    })

    if (error) throw error
  }
}
