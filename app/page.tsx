"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import ChatInterface from "@/components/chat-interface"
import Sidebar from "@/components/sidebar"
import AuthForm from "@/components/auth-form"
import { DatabaseService } from "@/lib/database-service"
import { supabase } from "@/lib/supabase"
import type { Chatbot, ChatMessage } from "@/lib/types"
import { toast } from "@/components/ui/use-toast"

export default function Home() {
  const searchParams = useSearchParams()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [activeChatbotId, setActiveChatbotId] = useState<string>("")
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authDebug, setAuthDebug] = useState("")

  // Check database health on startup
  useEffect(() => {
    const checkDatabase = async () => {
      console.log("Checking database health...")
      const health = await DatabaseService.checkDatabaseHealth()
      console.log("Database health check:", health)

      if (!health.success) {
        toast({
          title: "Database Setup Issue",
          description: "Some database tables may be missing or inaccessible. Please check your setup.",
          variant: "destructive",
        })
      }
    }

    checkDatabase()
  }, [])

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthDebug("Checking authentication status...")
        console.log("Checking auth status...")

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("Session error:", sessionError)
          setAuthDebug(`Session error: ${sessionError.message}`)
          setIsAuthenticated(false)
          return
        }

        console.log("Session:", session?.user?.id ? "Found" : "None")
        setAuthDebug(session?.user?.id ? "Session found, loading user data..." : "No session found")

        if (session?.user) {
          console.log("User found, getting user data...")
          const userData = await DatabaseService.getCurrentUser()

          if (userData) {
            console.log("User data loaded:", userData.user.id)
            setCurrentUser(userData)
            setUserId(userData.profile?.username || userData.user.email?.split("@")[0] || "user")
            setIsAuthenticated(true)
            setAuthDebug("Authentication successful")
          } else {
            console.log("Failed to load user data")
            setAuthDebug("Failed to load user data")
            setIsAuthenticated(false)
          }
        } else {
          console.log("No user session")
          setAuthDebug("No user session")
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("Auth check error:", error)
        setAuthDebug(`Auth check error: ${error instanceof Error ? error.message : "Unknown error"}`)
        setIsAuthenticated(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id)
      setAuthDebug(`Auth state changed: ${event}`)

      if (event === "SIGNED_IN" && session?.user) {
        console.log("User signed in, loading data...")
        setAuthDebug("User signed in, loading data...")

        const userData = await DatabaseService.getCurrentUser()
        if (userData) {
          setCurrentUser(userData)
          setUserId(userData.profile?.username || userData.user.email?.split("@")[0] || "user")
          setIsAuthenticated(true)
          setAuthDebug("Sign in complete")
        } else {
          setIsAuthenticated(false)
          setAuthDebug("Failed to load user data after sign in")
        }
      } else if (event === "SIGNED_OUT" || !session) {
        console.log("User signed out")
        setAuthDebug("User signed out")
        setIsAuthenticated(false)
        setCurrentUser(null)
        setChatbots([])
        setUserId("")
        setIsInitialized(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load user data when authenticated
  useEffect(() => {
    const loadUserData = async () => {
      if (isAuthenticated && !isInitialized) {
        setIsLoading(true)
        setAuthDebug("Loading user chatbots...")

        try {
          console.log("Loading user chatbots...")
          const userChatbots = await DatabaseService.loadUserChatbots()
          console.log("Loaded chatbots:", userChatbots.length)

          setChatbots(userChatbots)

          if (userChatbots.length > 0) {
            setActiveChatbotId(userChatbots[0].id)

            // If the first chatbot has sessions, select the first session
            if (userChatbots[0].sessions && userChatbots[0].sessions.length > 0) {
              setActiveSessionId(userChatbots[0].sessions[0].id)
            }
          }

          setIsInitialized(true)
          setAuthDebug("Data loading complete")
        } catch (error) {
          console.error("Error loading user data:", error)
          setAuthDebug(`Error loading data: ${error instanceof Error ? error.message : "Unknown error"}`)
          toast({
            title: "Error Loading Data",
            description: "Failed to load your chatbots. Please try again later.",
            variant: "destructive",
          })
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadUserData()
  }, [isAuthenticated, isInitialized])

  // Handle URL params
  useEffect(() => {
    if (isInitialized) {
      const botId = searchParams.get("bot")
      const sessionId = searchParams.get("session")

      if (botId && botId !== activeChatbotId) {
        setActiveChatbotId(botId)
      }

      if (sessionId && sessionId !== activeSessionId) {
        setActiveSessionId(sessionId)
      }
    }
  }, [isInitialized, searchParams, activeChatbotId, activeSessionId])

  const createNewSession = useCallback(
    async (chatbotId: string) => {
      try {
        console.log("Creating new session for chatbot:", chatbotId)

        if (!chatbotId) {
          console.error("Cannot create session: Missing chatbot ID")
          return null
        }

        const newSessionId = `session_${Date.now()}`
        const chatbot = chatbots.find((bot) => bot.id === chatbotId)

        if (!chatbot) {
          console.error("Cannot create session: Chatbot not found")
          return null
        }

        const newSession = {
          id: newSessionId,
          name: `Chat ${(chatbot?.sessions.length || 0) + 1}`,
          messages: [],
          threadId: `${userId}_${newSessionId}`,
        }

        // Update local state
        setChatbots((prev) =>
          prev.map((bot) =>
            bot.id === chatbotId
              ? {
                  ...bot,
                  sessions: [...bot.sessions, newSession],
                }
              : bot,
          ),
        )

        // Save to database
        console.log("Saving new session to database:", newSessionId)
        const result = await DatabaseService.saveSession(chatbotId, newSession)

        if (!result.success) {
          console.error("Failed to save session:", result.error)
          toast({
            title: "Error",
            description: `Failed to save session: ${result.error}`,
            variant: "destructive",
          })
        } else {
          console.log("Session saved successfully:", newSessionId)
        }

        setActiveChatbotId(chatbotId)
        setActiveSessionId(newSessionId)
        return newSessionId
      } catch (error) {
        console.error("Error creating session:", error)
        toast({
          title: "Error",
          description: "Failed to create new session.",
          variant: "destructive",
        })
        return null
      }
    },
    [userId, chatbots],
  )

  const updateChatbotSettings = useCallback(
    async (chatbotId: string, settings: any) => {
      try {
        if (!chatbotId) {
          console.error("Cannot update settings: Missing chatbot ID")
          return
        }

        console.log("Updating settings for chatbot:", chatbotId)

        // Update local state
        setChatbots((prev) => prev.map((bot) => (bot.id === chatbotId ? { ...bot, settings } : bot)))

        // Save to database
        const chatbot = chatbots.find((bot) => bot.id === chatbotId)
        if (chatbot) {
          const result = await DatabaseService.saveChatbot({ ...chatbot, settings })
          if (!result.success) {
            console.error("Failed to save settings:", result.error)
            toast({
              title: "Error",
              description: `Failed to save settings: ${result.error}`,
              variant: "destructive",
            })
          } else {
            console.log("Settings saved successfully")
            toast({
              title: "Success",
              description: "Settings saved successfully!",
            })
          }
        }
      } catch (error) {
        console.error("Error updating settings:", error)
        toast({
          title: "Error",
          description: "Failed to update chatbot settings.",
          variant: "destructive",
        })
      }
    },
    [chatbots],
  )

  const addMessage = useCallback(async (chatbotId: string, sessionId: string, message: ChatMessage) => {
    try {
      if (!chatbotId || !sessionId || !message) {
        console.error("Cannot add message: Missing required parameters")
        return
      }

      console.log("Adding message to session:", sessionId, "in chatbot:", chatbotId)

      // Update local state
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

      // Save to database
      console.log("Saving message to database:", message.id)
      const result = await DatabaseService.saveMessage(sessionId, message)

      if (!result.success) {
        console.error("Failed to save message:", result.error)
      } else {
        console.log("Message saved successfully:", message.id)
      }
    } catch (error) {
      console.error("Error adding message:", error)
    }
  }, [])

  const addChatbot = useCallback(async (name: string) => {
    try {
      if (!name.trim()) {
        console.error("Cannot add chatbot: Missing name")
        return null
      }

      console.log("Adding new chatbot:", name)

      const newChatbot: Chatbot = {
        id: `bot_${Date.now()}`,
        name,
        sessions: [],
      }

      // Update local state
      setChatbots((prev) => [...prev, newChatbot])
      setActiveChatbotId(newChatbot.id)

      // Save to database
      console.log("Saving chatbot to database:", newChatbot.id)
      const result = await DatabaseService.saveChatbot(newChatbot)

      if (!result.success) {
        console.error("Failed to save chatbot:", result.error)
        toast({
          title: "Error",
          description: `Failed to save chatbot: ${result.error}`,
          variant: "destructive",
        })
      } else {
        console.log("Chatbot saved successfully:", newChatbot.id)
        toast({
          title: "Success",
          description: "Chatbot created successfully!",
        })
      }

      return newChatbot.id
    } catch (error) {
      console.error("Error adding chatbot:", error)
      toast({
        title: "Error",
        description: "Failed to create new chatbot.",
        variant: "destructive",
      })
      return null
    }
  }, [])

  const removeChatbot = useCallback(
    async (chatbotId: string) => {
      try {
        if (!chatbotId) {
          console.error("Cannot remove chatbot: Missing chatbot ID")
          return
        }

        console.log("Removing chatbot:", chatbotId)

        // Update local state
        setChatbots((prev) => prev.filter((bot) => bot.id !== chatbotId))

        // Remove from database
        console.log("Deleting chatbot from database:", chatbotId)
        const result = await DatabaseService.deleteChatbot(chatbotId)

        if (!result.success) {
          console.error("Failed to delete chatbot:", result.error)
          toast({
            title: "Error",
            description: `Failed to delete chatbot: ${result.error}`,
            variant: "destructive",
          })
        } else {
          console.log("Chatbot deleted successfully:", chatbotId)
          toast({
            title: "Success",
            description: "Chatbot deleted successfully!",
          })
        }

        // If we're removing the active chatbot, switch to the first available one
        if (chatbotId === activeChatbotId) {
          const remainingBots = chatbots.filter((bot) => bot.id !== chatbotId)
          if (remainingBots.length > 0) {
            setActiveChatbotId(remainingBots[0].id)
            setActiveSessionId(null)
          }
        }
      } catch (error) {
        console.error("Error removing chatbot:", error)
        toast({
          title: "Error",
          description: "Failed to remove chatbot.",
          variant: "destructive",
        })
      }
    },
    [activeChatbotId, chatbots],
  )

  const renameChatbot = useCallback(
    async (chatbotId: string, newName: string) => {
      try {
        if (!chatbotId || !newName.trim()) {
          console.error("Cannot rename chatbot: Missing required parameters")
          return
        }

        console.log("Renaming chatbot:", chatbotId, "to:", newName)

        // Update local state
        setChatbots((prev) => prev.map((bot) => (bot.id === chatbotId ? { ...bot, name: newName } : bot)))

        // Save to database
        const chatbot = chatbots.find((bot) => bot.id === chatbotId)
        if (chatbot) {
          console.log("Saving renamed chatbot to database")
          const result = await DatabaseService.saveChatbot({ ...chatbot, name: newName })

          if (!result.success) {
            console.error("Failed to rename chatbot:", result.error)
            toast({
              title: "Error",
              description: `Failed to rename chatbot: ${result.error}`,
              variant: "destructive",
            })
          } else {
            console.log("Chatbot renamed successfully")
          }
        }
      } catch (error) {
        console.error("Error renaming chatbot:", error)
        toast({
          title: "Error",
          description: "Failed to rename chatbot.",
          variant: "destructive",
        })
      }
    },
    [chatbots],
  )

  const handleSignOut = useCallback(async () => {
    console.log("Sign out initiated...")

    try {
      // Clear local state immediately
      setIsAuthenticated(false)
      setCurrentUser(null)
      setChatbots([])
      setUserId("")
      setIsInitialized(false)

      // Then sign out from Supabase
      const result = await DatabaseService.signOut()

      if (!result.success) {
        console.error("Sign out error:", result.error)
        toast({
          title: "Error",
          description: `Failed to sign out: ${result.error}`,
          variant: "destructive",
        })
      } else {
        console.log("Sign out successful")
        toast({
          title: "Success",
          description: "Signed out successfully!",
        })
      }
    } catch (error) {
      console.error("Error signing out:", error)
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      })
    }
  }, [])

  const activeChatbot = useMemo(() => {
    if (chatbots.length === 0) return null
    return chatbots.find((bot) => bot.id === activeChatbotId) || chatbots[0]
  }, [chatbots, activeChatbotId])

  const activeSession = useMemo(
    () => (activeSessionId ? activeChatbot?.sessions.find((session) => session.id === activeSessionId) : null),
    [activeSessionId, activeChatbot?.sessions],
  )

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Loading...</div>
          {authDebug && <div className="text-sm text-zinc-500">{authDebug}</div>}
        </div>
      </div>
    )
  }

  // Show auth form if not authenticated
  if (!isAuthenticated) {
    return <AuthForm onAuthSuccess={() => setIsAuthenticated(true)} />
  }

  // Show loading while initializing user data
  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">Loading your data...</div>
          {authDebug && <div className="text-sm text-zinc-500">{authDebug}</div>}
        </div>
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
        userId={userId}
        setUserId={setUserId}
        onSignOut={handleSignOut}
        currentUser={currentUser}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeChatbot ? (
          <ChatInterface
            chatbot={activeChatbot}
            session={activeSession}
            createNewSession={createNewSession}
            addMessage={addMessage}
            updateChatbotSettings={updateChatbotSettings}
            userId={userId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">No chatbots available</h3>
              <p className="text-zinc-500 mb-4">Create your first chatbot to get started</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
