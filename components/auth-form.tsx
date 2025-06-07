"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

interface AuthFormProps {
  onAuthSuccess: () => void
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }

    const email = `${username.trim()}@gmail.com`

    try {
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          onAuthSuccess()
        }
      } else {
        // Register
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        })

        if (error) throw error

        if (data.user) {
          // Check if user profile already exists
          const { data: existingProfile, error: checkError } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("id", data.user.id)
            .maybeSingle()

          if (checkError) {
            console.error("Error checking existing profile:", checkError)
          }

          // Only create profile if it doesn't exist
          if (!existingProfile) {
            const { error: profileError } = await supabase.from("user_profiles").insert({
              id: data.user.id,
              username: username.trim(),
            })

            if (profileError) {
              console.error("Error creating profile:", profileError)
              // Don't throw here - the user is still created successfully
            }
          }

          // Create default chatbots only if they don't exist
          const { data: existingChatbots, error: chatbotsCheckError } = await supabase
            .from("chatbots")
            .select("id")
            .eq("user_id", data.user.id)

          if (chatbotsCheckError) {
            console.error("Error checking existing chatbots:", chatbotsCheckError)
          }

          // Only create default chatbots if none exist
          if (!existingChatbots || existingChatbots.length === 0) {
            const defaultChatbots = [
              { id: `${data.user.id}_assistant`, name: "Assistant" },
              { id: `${data.user.id}_coder`, name: "Coder" },
              { id: `${data.user.id}_creative`, name: "Creative" },
            ]

            for (const bot of defaultChatbots) {
              const { error: botError } = await supabase.from("chatbots").insert({
                id: bot.id,
                user_id: data.user.id,
                name: bot.name,
                settings: {},
              })

              if (botError) {
                console.error(`Error creating default chatbot ${bot.name}:`, botError)
                // Don't throw here - continue with other bots
              }
            }
          }

          onAuthSuccess()
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error)
      setError(error.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{isLogin ? "Welcome Back" : "Create Account"}</CardTitle>
          <CardDescription>
            {isLogin ? "Sign in to access your chatbots" : "Create an account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={isLoading}
                required
              />
              <p className="text-xs text-zinc-500">Email will be: {username}@gmail.com</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isLoading}
                required
              />
            </div>

            {error && <div className="text-red-500 text-sm text-center">{error}</div>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError("")
                }}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                disabled={isLoading}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
