"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Loader2, Eye, EyeOff } from "lucide-react"

interface AuthFormProps {
  onAuthSuccess: () => void
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [debugInfo, setDebugInfo] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setDebugInfo("")

    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields")
      setIsLoading(false)
      return
    }

    const email = `${username.trim()}@gmail.com`
    setDebugInfo(`Attempting ${isLogin ? "sign in" : "sign up"} with email: ${email}`)

    try {
      if (isLogin) {
        // Login
        setDebugInfo("Signing in...")
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          console.error("Sign in error:", error)
          throw error
        }

        if (data.user) {
          setDebugInfo("Sign in successful, checking user data...")

          // Wait a moment for the auth state to update
          await new Promise((resolve) => setTimeout(resolve, 1000))

          onAuthSuccess()
        } else {
          throw new Error("No user data returned")
        }
      } else {
        // Register
        setDebugInfo("Creating new account...")
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        })

        if (error) {
          console.error("Sign up error:", error)
          throw error
        }

        if (data.user) {
          setDebugInfo("Account created, setting up profile...")

          // Wait for the user to be fully created
          await new Promise((resolve) => setTimeout(resolve, 2000))

          // Check if we need email confirmation
          if (!data.session) {
            setError("Please check your email for a confirmation link before signing in.")
            setIsLogin(true) // Switch to login mode
            setIsLoading(false)
            return
          }

          onAuthSuccess()
        } else {
          throw new Error("No user data returned from registration")
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error)

      let errorMessage = error.message || "An error occurred"

      // Handle specific error cases
      if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Invalid username or password. Please check your credentials."
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage = "Please check your email and click the confirmation link before signing in."
      } else if (error.message?.includes("User already registered")) {
        errorMessage = "This username is already taken. Please try signing in instead."
        setIsLogin(true)
      } else if (error.message?.includes("Password should be at least")) {
        errorMessage = "Password must be at least 6 characters long."
      }

      setError(errorMessage)
      setDebugInfo(`Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setDebugInfo("Testing Supabase connection...")
    try {
      const { data, error } = await supabase.from("user_profiles").select("count").limit(1)
      if (error) {
        setDebugInfo(`Connection test failed: ${error.message}`)
      } else {
        setDebugInfo("Connection test successful!")
      }
    } catch (error: any) {
      setDebugInfo(`Connection test error: ${error.message}`)
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
                autoComplete="username"
              />
              <p className="text-xs text-zinc-500">Email will be: {username}@gmail.com</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={isLoading}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {!isLogin && <p className="text-xs text-zinc-500">Password must be at least 6 characters long</p>}
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center p-2 bg-red-50 dark:bg-red-950 rounded">{error}</div>
            )}

            {debugInfo && (
              <div className="text-blue-600 text-xs text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                {debugInfo}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError("")
                  setDebugInfo("")
                }}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                disabled={isLoading}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>

              <div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                  disabled={isLoading}
                >
                  Test Connection
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
