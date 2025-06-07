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

  // Function to load or create user profile with better error handling
  const loadUserProfile = useCallback(
    async (user: User, isInitialLoad = false, retryCount = 0) => {
      try {
        console.log("Loading user profile for:", user.id, "retry:", retryCount)
        const profile = await DatabaseService.getUserProfile(user.id)
        console.log("Profile loaded successfully:", profile)
        return profile
      } catch (error: any) {
        console.error("Error fetching user profile:", error)

        // If profile not found and we haven't retried too many times, wait and retry
        if (error.message === "Profile not found" && retryCount < 3) {
          console.log("Profile not found, retrying in 1 second...")
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return loadUserProfile(user, isInitialLoad, retryCount + 1)
        }

        // Only try to create profile if it's not found and we're configured
        if (error.message === "Profile not found" && isSupabaseConfigured) {
          const username = user.email?.split("@")[0] || "user"
          try {
            console.log("Creating missing user profile...")
            const newProfile = await DatabaseService.createUserProfile(user.id, username)
            console.log("User profile created successfully:", newProfile)
            return newProfile
          } catch (createError: any) {
            console.error("Error creating user profile:", createError)

            // If we're in initial load and profile creation fails, return null
            // This will trigger the login form to show
            if (isInitialLoad) {
              return null
            }

            // Return a fallback profile for non-initial loads
            return {
              id: user.id,
              username,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          }
        }

        // If we're in initial load and there's an error, return null
        if (isInitialLoad) {
          return null
        }

        // Return a fallback profile for non-initial loads
        const username = user.email?.split("@")[0] || "user"
        return {
          id: user.id,
          username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }
    },
    [isSupabaseConfigured],
  )

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

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          setUser(session.user)

          // Try to load profile, but don't fail if it doesn't exist
          const profile = await loadUserProfile(session.user, true)
          if (profile) {
            setUserProfile(profile)
          } else {
            // Profile doesn't exist or couldn't be created, user needs to register/login
            console.log("No profile found, user needs to authenticate")
            setUser(null)
          }
        }
      } catch (error) {
        console.error("Error during initial auth check:", error)
        // Don't fail completely, just set user to null so login form shows
        setUser(null)
      }

      setLoading(false)
    }

    checkAuth()

    if (isSupabaseConfigured) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id)

        if (session?.user) {
          setUser(session.user)
          try {
            // For new registrations, wait a bit longer before trying to load profile
            if (event === "SIGNED_UP") {
              console.log("New user signed up, waiting before loading profile...")
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }

            const profile = await loadUserProfile(session.user, false)
            if (profile) {
              setUserProfile(profile)
            }
          } catch (error) {
            console.error("Error loading user profile during auth state change:", error)
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
  }, [isSupabaseConfigured, loadUserProfile])

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

  if (!userProfile) {
    return (
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 items-center justify-center">
        <div className="text-lg">Setting up your profile...</div>
      </div>
    )
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
