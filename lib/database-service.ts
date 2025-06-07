import { supabase } from "./supabase"
import type { Chatbot, ChatSession, ChatMessage } from "./types"

export class DatabaseService {
  static async getCurrentUser() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("Error getting user:", userError)
        return null
      }

      if (!user) return null

      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError) {
        console.error("Error fetching user profile:", profileError)
      }

      // If profile doesn't exist, create it
      if (!profile) {
        const username = user.user_metadata?.username || user.email?.split("@")[0] || `user_${Date.now()}`

        const { data: newProfile, error: insertError } = await supabase
          .from("user_profiles")
          .upsert(
            {
              id: user.id,
              username,
            },
            {
              onConflict: "id",
            },
          )
          .select()
          .maybeSingle()

        if (insertError) {
          console.error("Error creating user profile:", insertError)
          // Return user data even if profile creation fails
          return {
            user,
            profile: {
              id: user.id,
              username,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }
        }

        return {
          user,
          profile: newProfile || {
            id: user.id,
            username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }
      }

      return { user, profile }
    } catch (error) {
      console.error("Error in getCurrentUser:", error)
      return null
    }
  }

  static async loadUserChatbots(): Promise<Chatbot[]> {
    try {
      console.log("Loading user chatbots...")
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("Error getting user:", userError)
        return []
      }

      if (!user) {
        console.log("No authenticated user found")
        return []
      }

      console.log("User found:", user.id)

      // Ensure user profile exists first
      const userData = await this.getCurrentUser()
      if (!userData) {
        console.error("Failed to get current user data")
        return []
      }

      // Check if user has any chatbots
      console.log("Fetching chatbots for user:", user.id)
      const { data: chatbots, error: chatbotsError } = await supabase
        .from("chatbots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at")

      if (chatbotsError) {
        console.error("Error loading chatbots:", chatbotsError)
        return []
      }

      console.log(`Found ${chatbots?.length || 0} chatbots`)

      // If no chatbots, create default ones
      if (!chatbots || chatbots.length === 0) {
        console.log("No chatbots found, creating default ones...")
        const defaultChatbots = [
          { id: `${user.id}_assistant`, name: "Assistant" },
          { id: `${user.id}_coder`, name: "Coder" },
          { id: `${user.id}_creative`, name: "Creative" },
        ]

        const newChatbots: Chatbot[] = []

        for (const bot of defaultChatbots) {
          const { data: insertedBot, error } = await supabase
            .from("chatbots")
            .upsert(
              {
                id: bot.id,
                user_id: user.id,
                name: bot.name,
                settings: {},
              },
              {
                onConflict: "id",
              },
            )
            .select()
            .maybeSingle()

          if (error) {
            console.error(`Error creating default chatbot ${bot.name}:`, error)
          } else {
            console.log(`Created default chatbot: ${bot.name}`)
            newChatbots.push({
              id: bot.id,
              name: bot.name,
              settings: {},
              sessions: [],
            })
          }
        }

        return newChatbots
      }

      // Load sessions for each chatbot
      const chatbotsWithSessions: Chatbot[] = []

      for (const chatbot of chatbots) {
        console.log(`Loading sessions for chatbot ${chatbot.id}`)
        const { data: sessions, error: sessionsError } = await supabase
          .from("chat_sessions")
          .select("*")
          .eq("chatbot_id", chatbot.id)
          .order("created_at")

        if (sessionsError) {
          console.error(`Error loading sessions for chatbot ${chatbot.id}:`, sessionsError)
          chatbotsWithSessions.push({
            id: chatbot.id,
            name: chatbot.name,
            settings: chatbot.settings || {},
            sessions: [],
          })
          continue
        }

        console.log(`Found ${sessions?.length || 0} sessions for chatbot ${chatbot.id}`)

        // Load messages for each session
        const sessionsWithMessages: ChatSession[] = []

        for (const session of sessions || []) {
          console.log(`Loading messages for session ${session.id}`)
          const { data: messages, error: messagesError } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("session_id", session.id)
            .order("timestamp")

          if (messagesError) {
            console.error(`Error loading messages for session ${session.id}:`, messagesError)
            sessionsWithMessages.push({
              id: session.id,
              name: session.name,
              threadId: session.thread_id,
              messages: [],
            })
            continue
          }

          console.log(`Found ${messages?.length || 0} messages for session ${session.id}`)

          sessionsWithMessages.push({
            id: session.id,
            name: session.name,
            threadId: session.thread_id,
            messages:
              messages?.map((msg) => ({
                id: msg.id,
                role: msg.role as "user" | "assistant" | "system",
                content: msg.content,
                timestamp: msg.timestamp,
              })) || [],
          })
        }

        chatbotsWithSessions.push({
          id: chatbot.id,
          name: chatbot.name,
          settings: chatbot.settings || {},
          sessions: sessionsWithMessages,
        })
      }

      console.log("Successfully loaded all chatbots with sessions and messages")
      return chatbotsWithSessions
    } catch (error) {
      console.error("Error in loadUserChatbots:", error)
      return []
    }
  }

  static async saveChatbot(chatbot: Chatbot): Promise<{ success: boolean; error?: string }> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        return { success: false, error: `Auth error: ${userError.message}` }
      }

      if (!user) {
        return { success: false, error: "User not authenticated" }
      }

      console.log("Saving chatbot:", chatbot.id, chatbot.name)

      // Use upsert to handle both insert and update cases
      const { error } = await supabase.from("chatbots").upsert(
        {
          id: chatbot.id,
          user_id: user.id,
          name: chatbot.name,
          settings: chatbot.settings || {},
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      )

      if (error) {
        console.error("Error saving chatbot:", error)
        return { success: false, error: error.message }
      }

      console.log("Chatbot saved successfully")
      return { success: true }
    } catch (error) {
      console.error("Error in saveChatbot:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  static async deleteChatbot(chatbotId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from("chatbots").delete().eq("id", chatbotId)

      if (error) {
        console.error("Error deleting chatbot:", error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("Error in deleteChatbot:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  static async saveSession(chatbotId: string, session: ChatSession): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("Saving session:", session.id, "for chatbot:", chatbotId)

      if (!chatbotId) {
        return { success: false, error: "Missing chatbot ID" }
      }

      if (!session.id) {
        return { success: false, error: "Missing session ID" }
      }

      // Use upsert to handle both insert and update cases
      const { error } = await supabase.from("chat_sessions").upsert(
        {
          id: session.id,
          chatbot_id: chatbotId,
          name: session.name || `Chat ${Date.now()}`,
          thread_id: session.threadId || `thread_${Date.now()}`,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      )

      if (error) {
        console.error("Error saving session:", error)
        return { success: false, error: error.message }
      }

      console.log("Session saved successfully")

      // If the session has messages, save them too
      if (session.messages && session.messages.length > 0) {
        console.log(`Saving ${session.messages.length} messages for session ${session.id}`)

        for (const message of session.messages) {
          await this.saveMessage(session.id, message)
        }
      }

      return { success: true }
    } catch (error) {
      console.error("Error in saveSession:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  static async saveMessage(sessionId: string, message: ChatMessage): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("Saving message:", message.id, "to session:", sessionId)

      if (!sessionId) {
        return { success: false, error: "Missing session ID" }
      }

      if (!message.id) {
        return { success: false, error: "Missing message ID" }
      }

      if (!message.role) {
        return { success: false, error: "Missing message role" }
      }

      if (!message.content) {
        return { success: false, error: "Missing message content" }
      }

      // Use upsert to handle duplicate message IDs
      const { error } = await supabase.from("chat_messages").upsert(
        {
          id: message.id,
          session_id: sessionId,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp || new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      )

      if (error) {
        console.error("Error saving message:", error)
        return { success: false, error: error.message }
      }

      console.log("Message saved successfully")
      return { success: true }
    } catch (error) {
      console.error("Error in saveMessage:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  static async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Error signing out:", error)
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (error) {
      console.error("Error in signOut:", error)
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }

  // Helper method to check if tables exist and test permissions
  static async checkDatabaseHealth(): Promise<{ success: boolean; details: Record<string, any> }> {
    try {
      const results = {
        user_profiles: { exists: false, canRead: false, canWrite: false },
        chatbots: { exists: false, canRead: false, canWrite: false },
        chat_sessions: { exists: false, canRead: false, canWrite: false },
        chat_messages: { exists: false, canRead: false, canWrite: false },
      }

      // Test user_profiles
      try {
        const { error: readError } = await supabase.from("user_profiles").select("count").limit(1)
        results.user_profiles.exists = !readError
        results.user_profiles.canRead = !readError

        if (!readError) {
          const { error: writeError } = await supabase.from("user_profiles").select("id").limit(1)
          results.user_profiles.canWrite = !writeError
        }
      } catch (e) {
        console.error("Error testing user_profiles:", e)
      }

      // Test chatbots
      try {
        const { error: readError } = await supabase.from("chatbots").select("count").limit(1)
        results.chatbots.exists = !readError
        results.chatbots.canRead = !readError

        if (!readError) {
          const { error: writeError } = await supabase.from("chatbots").select("id").limit(1)
          results.chatbots.canWrite = !writeError
        }
      } catch (e) {
        console.error("Error testing chatbots:", e)
      }

      // Test chat_sessions
      try {
        const { error: readError } = await supabase.from("chat_sessions").select("count").limit(1)
        results.chat_sessions.exists = !readError
        results.chat_sessions.canRead = !readError

        if (!readError) {
          const { error: writeError } = await supabase.from("chat_sessions").select("id").limit(1)
          results.chat_sessions.canWrite = !writeError
        }
      } catch (e) {
        console.error("Error testing chat_sessions:", e)
      }

      // Test chat_messages
      try {
        const { error: readError } = await supabase.from("chat_messages").select("count").limit(1)
        results.chat_messages.exists = !readError
        results.chat_messages.canRead = !readError

        if (!readError) {
          const { error: writeError } = await supabase.from("chat_messages").select("id").limit(1)
          results.chat_messages.canWrite = !writeError
        }
      } catch (e) {
        console.error("Error testing chat_messages:", e)
      }

      const allTablesExist = Object.values(results).every((table) => table.exists)
      const allCanRead = Object.values(results).every((table) => table.canRead)
      const allCanWrite = Object.values(results).every((table) => table.canWrite)

      return {
        success: allTablesExist && allCanRead && allCanWrite,
        details: {
          tables: results,
          summary: {
            allTablesExist,
            allCanRead,
            allCanWrite,
          },
        },
      }
    } catch (error) {
      console.error("Error in checkDatabaseHealth:", error)
      return {
        success: false,
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      }
    }
  }
}
