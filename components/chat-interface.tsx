"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Chatbot, ChatSession, ChatMessage } from "@/lib/types"
import { Settings, Send, Loader2 } from "lucide-react"
import ChatMessages from "@/components/chat-messages"
import SettingsModal from "@/components/settings-modal"
import LoadingAnimation from "@/components/loading-animation"

interface ChatInterfaceProps {
  chatbot: Chatbot | null
  session: ChatSession | null
  createNewSession: (chatbotId: string) => string
  addMessage: (chatbotId: string, sessionId: string, message: ChatMessage) => void
  updateChatbotSettings: (chatbotId: string, settings: any) => void
  userId: string
}

export default function ChatInterface({
  chatbot,
  session,
  createNewSession,
  addMessage,
  updateChatbotSettings,
  userId,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!input.trim() || isLoading) return

      let sessionId = session?.id

      if (!sessionId) {
        sessionId = createNewSession(chatbot.id)
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: input,
        timestamp: new Date().toISOString(),
      }

      addMessage(chatbot.id, sessionId, userMessage)
      const currentInput = input
      setInput("")
      setIsLoading(true)

      try {
        // Check if webhook settings are configured
        if (chatbot.settings?.webhookUrl) {
          const {
            webhookUrl,
            botIdKey = "botId",
            botIdValue = chatbot.id,
            threadIdKey = "threadId",
            messageKey = "message",
            responseKey = "server_response_message",
          } = chatbot.settings

          // Prepare request body with dynamic keys
          const requestBody: Record<string, string> = {
            [botIdKey]: botIdValue,
            [threadIdKey]: session?.threadId || `${userId}_${sessionId}`,
            [messageKey]: currentInput,
          }

          // Send request to webhook
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            throw new Error(`Webhook error: ${response.status}`)
          }

          const data = await response.json()

          // Add bot response using the configured response key
          const botMessage: ChatMessage = {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            content: data[responseKey] || "No response received",
            timestamp: new Date().toISOString(),
          }

          addMessage(chatbot.id, sessionId, botMessage)
        } else {
          // Fallback response if no webhook is configured
          await new Promise((resolve) => setTimeout(resolve, 1500)) // Simulate processing time

          const botMessage: ChatMessage = {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            content: "Please configure a webhook URL in settings to receive responses.",
            timestamp: new Date().toISOString(),
          }

          addMessage(chatbot.id, sessionId, botMessage)
        }
      } catch (error) {
        console.error("Error sending message:", error)

        // Add error message
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: "Error: Failed to get a response. Please check your webhook configuration.",
          timestamp: new Date().toISOString(),
        }

        addMessage(chatbot.id, sessionId, errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, session, createNewSession, chatbot?.id, chatbot?.settings, addMessage, userId],
  )

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [session?.messages, isLoading])

  // Add null check for chatbot
  if (!chatbot) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">No chatbot selected</h3>
          <p className="text-zinc-500">Please select or create a chatbot</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">{chatbot.name}</h2>
        <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={18} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {session ? (
          <>
            <ChatMessages messages={session.messages} />
            {isLoading && <LoadingAnimation />}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">No chat selected</h3>
              <Button onClick={() => createNewSession(chatbot.id)} variant="outline">
                Start a new chat
              </Button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {session && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={18} />}
            </Button>
          </form>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        chatbot={chatbot}
        updateSettings={(settings) => updateChatbotSettings(chatbot.id, settings)}
      />
    </>
  )
}
