"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Chatbot } from "@/lib/types"
import { X } from "lucide-react"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  chatbot: Chatbot
  updateSettings: (settings: any) => void
}

export default function SettingsModal({ isOpen, onClose, chatbot, updateSettings }: SettingsModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [settings, setSettings] = useState({
    webhookUrl: "",
    botIdKey: "botId",
    botIdValue: chatbot.id,
    threadIdKey: "threadId",
    messageKey: "message",
    responseKey: "server_response_message",
  })

  useEffect(() => {
    if (isOpen) {
      setIsAuthenticated(false)
      setPassword("")
      setPasswordError("")

      // Load existing settings if available
      if (chatbot.settings) {
        setSettings({
          webhookUrl: chatbot.settings.webhookUrl || "",
          botIdKey: chatbot.settings.botIdKey || "botId",
          botIdValue: chatbot.settings.botIdValue || chatbot.id,
          threadIdKey: chatbot.settings.threadIdKey || "threadId",
          messageKey: chatbot.settings.messageKey || "message",
          responseKey: chatbot.settings.responseKey || "server_response_message",
        })
      }
    }
  }, [isOpen, chatbot])

  const handleAuthenticate = () => {
    // Check against environment variable or fallback to hardcoded password
    const correctPassword = process.env.NEXT_PUBLIC_SETTINGS_PASSWORD || "hdm123"

    if (password === correctPassword) {
      setIsAuthenticated(true)
      setPasswordError("")
    } else {
      setPasswordError("Incorrect password")
    }
  }

  const handleSaveSettings = () => {
    updateSettings(settings)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Chatbot Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        {!isAuthenticated ? (
          <div className="p-6">
            <div className="mb-6">
              <Label htmlFor="password">Enter password to access settings</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
              />
              {passwordError && <p className="text-red-500 text-sm mt-1">{passwordError}</p>}
            </div>

            <Button onClick={handleAuthenticate} className="w-full">
              Authenticate
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                value={settings.webhookUrl}
                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                placeholder="https://your-api-endpoint.com/webhook"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="botIdKey">Bot ID Key</Label>
                <Input
                  id="botIdKey"
                  value={settings.botIdKey}
                  onChange={(e) => setSettings({ ...settings, botIdKey: e.target.value })}
                  placeholder="botId"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="botIdValue">Bot ID Value</Label>
                <Input
                  id="botIdValue"
                  value={settings.botIdValue}
                  onChange={(e) => setSettings({ ...settings, botIdValue: e.target.value })}
                  placeholder={chatbot.id}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="threadIdKey">Thread ID Key</Label>
              <Input
                id="threadIdKey"
                value={settings.threadIdKey}
                onChange={(e) => setSettings({ ...settings, threadIdKey: e.target.value })}
                placeholder="threadId"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="messageKey">Message Key</Label>
              <Input
                id="messageKey"
                value={settings.messageKey}
                onChange={(e) => setSettings({ ...settings, messageKey: e.target.value })}
                placeholder="message"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="responseKey">Response Key</Label>
              <Input
                id="responseKey"
                value={settings.responseKey}
                onChange={(e) => setSettings({ ...settings, responseKey: e.target.value })}
                placeholder="server_response_message"
                className="mt-1"
              />
            </div>

            <Button onClick={handleSaveSettings} className="w-full">
              Save Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
