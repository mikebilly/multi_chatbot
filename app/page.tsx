"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import ChatInterface from "@/components/chat-interface"
import Sidebar from "@/components/sidebar"
import LoginForm from "@/components/auth/login-form"
import type { Chatbot, ChatMessage } from "@/lib/types"
import { supabase } from "@/lib/supabase"
import { DatabaseService } from "@/lib/database"
import type { User } from "@supabase/supabase-js"

export default function Home() {
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [activeChatbotId, setActiveChatbotId] = useState<string>("")
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check if Supabase is configured
  const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // Check authentication state
  useEffect(() => {
    const checkAuth = async () => {
      if (!isSupabaseConfigured) {
        // Mock user for development
        setUser({ id: "dev-user", email: "dev@example.com" } as User)
        setUserProfile({ id: "dev-user", username: "developer" })
        setLoading(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        setUser(session.user)
        try {
          const profile = await DatabaseService.getUserProfile(session.user.id)
          setUserProfile(profile)
        } catch (error) {
          console.error("Error fetching user profile:", error)
        }
      }

      setLoading(false)
    }

    checkAuth()

    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          try {
            const profile = await DatabaseService.getUserProfile(session.user.id)
            setUserProfile(profile)
          } catch (error) {
            console.error("Error fetching user profile:", error)
          }
        } else {
          setUser(null)
          setUserProfile(null)
          setChatbots([])
          setActiveChatbotId("")
          setActiveSessionId(null)
          setIsInitialized(false)
        }
      })

      return () => subscription.unsubscribe()
    }
  }, [isSupabaseConfigured])

  // Load user data when authenticated
  useEffect(() => {
    const loadUserData = async () => {
      if (user && userProfile && !isInitialized) {
        try {
          const userChatbots = await DatabaseService.getChatbots(user.id)

          if (userChatbots.length === 0) {
            // Create default chatbots for new users
            const defaultBots = ["Assistant", "Coder", "Creative"]
            const createdBots: Chatbot[] = []

            for (const botName of defaultBots) {
              const botId = await DatabaseService.createChatbot(user.id, botName)
              createdBots.push({
                id: botId,
                name: botName,
                sessions: [],
              })
            }

            setChatbots(createdBots)
            setActiveChatbotId(createdBots[0].id)
          } else {
            setChatbots(userChatbots)
            setActiveChatbotId(userChatbots[0].id)
          }

          setIsInitialized(true)
        } catch (error) {
          console.error("Error loading user data:", error)
          // Fallback to default chatbots if database fails
          const defaultBots: Chatbot[] = [
            { id: "1", name: "Assistant", sessions: [] },
            { id: "2", name: "Coder", sessions: [] },
            { id: "3", name: "Creative", sessions: [] },
          ]
          setChatbots(defaultBots)
          setActiveChatbotId(defaultBots[0].id)
          setIsInitialized(true)
        }
      }
    }

    loadUserData()
  }, [user, userProfile, isInitialized])

  // Handle URL params
  useEffect(() => {
    if (isInitialized && chatbots.length > 0) {
      const botId = searchParams.get("bot")
      const sessionId = searchParams.get("session")

      if (botId && botId !== activeChatbotId) {
        setActiveChatbotId(botId)
      }

      if (sessionId && sessionId !== activeSessionId) {
        setActiveSessionId(sessionId)
      }
    }
  }, [isInitialized, searchParams, activeChatbotId, activeSessionId, chatbots])

  const createNewSession = useCallback(
    async (chatbotId: string) => {
      if (!user || !userProfile) return ""

      const newSessionId = `session_${Date.now()}`
      const threadId = `${userProfile.username}_${newSessionId}`

      try {
        const dbSessionId = await DatabaseService.createSession(chatbotId, `Chat ${Date.now()}`, threadId)

        setChatbots((prev) =>
          prev.map((bot) =>
            bot.id === chatbotId
              ? {
                  ...bot,
                  sessions: [
                    ...bot.sessions,
                    {
                      id: dbSessionId,
                      name: `Chat ${bot.sessions.length + 1}`,
                      messages: [],
                      threadId,
                    },
                  ],
                }
              : bot,
          ),
        )

        setActiveChatbotId(chatbotId)
        setActiveSessionId(dbSessionId)
        return dbSessionId
      } catch (error) {
        console.error("Error creating session:", error)
        // Fallback to local state if database fails
        const fallbackSessionId = `local_${Date.now()}`
        setChatbots((prev) =>
          prev.map((bot) =>
            bot.id === chatbotId
              ? {
                  ...bot,
                  sessions: [
                    ...bot.sessions,
                    {
                      id: fallbackSessionId,
                      name: `Chat ${bot.sessions.length + 1}`,
                      messages: [],
                      threadId,
                    },
                  ],
                }
              : bot,
          ),
        )
        setActiveChatbotId(chatbotId)
        setActiveSessionId(fallbackSessionId)
        return fallbackSessionId
      }
    },
    [user, userProfile],
  )

  const updateChatbotSettings = useCallback(async (chatbotId: string, settings: any) => {
    try {
      await DatabaseService.updateChatbot(chatbotId, { settings })
      setChatbots((prev) => prev.map((bot) => (bot.id === chatbotId ? { ...bot, settings } : bot)))
    } catch (error) {
      console.error("Error updating chatbot settings:", error)
      // Update local state even if database fails
      setChatbots((prev) => prev.map((bot) => (bot.id === chatbotId ? { ...bot, settings } : bot)))
    }
  }, [])

  const addMessage = useCallback(async (chatbotId: string, sessionId: string, message: ChatMessage) => {
    try {
      await DatabaseService.addMessage(sessionId, message)
      setChatbots((prev) =>
        prev.map((bot) =>
          bot.id === chatbotId
            ? {
                ...bot,
                sessions: bot.sessions.map((session) =>
                  session.id === sessionId
                    ? {
                        ...session,
                        messages: [...session.messages, message],
                      }
                    : session,
                ),
              }
            : bot,
        ),
      )
    } catch (error) {
      console.error("Error adding message:", error)
      // Update local state even if database fails
      setChatbots((prev) =>
        prev.map((bot) =>
          bot.id === chatbotId
            ? {
                ...bot,
                sessions: bot.sessions.map((session) =>
                  session.id === sessionId
                    ? {
                        ...session,
                        messages: [...session.messages, message],
                      }
                    : session,
                ),
              }
            : bot,
        ),
      )
    }
  }, [])

  const addChatbot = useCallback(
    async (name: string) => {
      if (!user) return ""

      try {
        const botId = await DatabaseService.createChatbot(user.id, name)
        const newChatbot: Chatbot = {
          id: botId,
          name,
          sessions: [],
        }
        setChatbots((prev) => [...prev, newChatbot])
        setActiveChatbotId(botId)
        return botId
      } catch (error) {
        console.error("Error adding chatbot:", error)
        // Fallback to local state
        const fallbackId = `local_bot_${Date.now()}`
        const newChatbot: Chatbot = {
          id: fallbackId,
          name,
          sessions: [],
        }
        setChatbots((prev) => [...prev, newChatbot])
        setActiveChatbotId(fallbackId)
        return fallbackId
      }
    },
    [user],
  )

  const removeChatbot = useCallback(
    async (chatbotId: string) => {
      try {
        await DatabaseService.deleteChatbot(chatbotId)
        setChatbots((prev) => prev.filter((bot) => bot.id !== chatbotId))

        if (chatbotId === activeChatbotId) {
          const remainingBots = chatbots.filter((bot) => bot.id !== chatbotId)
          if (remainingBots.length > 0) {
            setActiveChatbotId(remainingBots[0].id)
            setActiveSessionId(null)
          }
        }
      } catch (error) {
        console.error("Error removing chatbot:", error)
        // Update local state even if database fails
        setChatbots((prev) => prev.filter((bot) => bot.id !== chatbotId))

        if (chatbotId === activeChatbotId) {
          const remainingBots = chatbots.filter((bot) => bot.id !== chatbotId)
          if (remainingBots.length > 0) {
            setActiveChatbotId(remainingBots[0].id)
            setActiveSessionId(null)
          }
        }
      }
    },
    [activeChatbotId, chatbots],
  )

  const renameChatbot = useCallback(async (chatbotId: string, newName: string) => {
    try {
      await DatabaseService.updateChatbot(chatbotId, { name: newName })
      setChatbots((prev) => prev.map((bot) => (bot.id === chatbotId ? { ...bot, name: newName } : bot)))
    } catch (error) {
      console.error("Error renaming chatbot:", error)
      // Update local state even if database fails
      setChatbots((prev) => prev.map((bot) => (bot.id === chatbotId ? { ...bot, name: newName } : bot)))
    }
  }, [])

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    } else {
      // Mock logout for development
      setUser(null)
      setUserProfile(null)
      setChatbots([])
      setActiveChatbotId("")
      setActiveSessionId(null)
      setIsInitialized(false)
    }
  }

  const activeChatbot = useMemo(
    () => chatbots.find((bot) => bot.id === activeChatbotId) || chatbots[0],
    [chatbots, activeChatbotId],
  )

  const activeSession = useMemo(
    () => (activeSessionId ? activeChatbot?.sessions.find((session) => session.id === activeSessionId) : null),
    [activeSessionId, activeChatbot?.sessions],
  )

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm onSuccess={() => {}} />
  }

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 items-center justify-center">
        <div className="text-lg">Initializing...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50">
      <Sidebar
        chatbots={chatbots}
        activeChatbotId={activeChatbotId}
        activeSessionId={activeSessionId}
        setActiveChatbotId={setActiveChatbotId}
        setActiveSessionId={setActiveSessionId}
        createNewSession={createNewSession}
        addChatbot={addChatbot}
        removeChatbot={removeChatbot}
        renameChatbot={renameChatbot}
        userId={userProfile?.username || ""}
        setUserId={() => {}} // Username is read-only now
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatInterface
          chatbot={activeChatbot}
          session={activeSession}
          createNewSession={createNewSession}
          addMessage={addMessage}
          updateChatbotSettings={updateChatbotSettings}
          userId={userProfile?.username || ""}
        />
      </main>
    </div>
  )
}
