"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"
import { DatabaseService } from "@/lib/database"

interface LoginFormProps {
  onSuccess: () => void
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Check if Supabase is configured
  const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!isSupabaseConfigured) {
        // Mock authentication for development
        if (username && password) {
          // Simulate successful login
          setTimeout(() => {
            onSuccess()
          }, 500)
          return
        } else {
          throw new Error("Please enter username and password")
        }
      }

      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: `${username}@gmail.com`, // Use username as email prefix
          password,
        })

        if (error) throw error

        if (data.user) {
          // Let the auth state change handle the rest
          console.log("Login successful")
        }
      } else {
        // Register
        const { data, error } = await supabase.auth.signUp({
          email: `${username}@gmail.com`, // Use username as email prefix
          password,
        })

        if (error) throw error

        if (data.user) {
          // Create user profile immediately after successful registration
          try {
            console.log("Creating user profile for:", data.user.id)
            await DatabaseService.createUserProfile(data.user.id, username)
            console.log("User profile created successfully")
          } catch (profileError: any) {
            console.error("Error creating user profile:", profileError)
            // Don't throw here - the auth state change will handle profile creation as fallback
          }

          console.log("Registration successful")
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? "Login" : "Register"}</CardTitle>
          <CardDescription>
            {isLogin ? "Enter your credentials to access your chatbots" : "Create a new account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured && (
            <Alert className="mb-4">
              <AlertDescription>
                <strong>Development Mode:</strong> Supabase is not configured. Any username/password will work for
                testing.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="mt-1"
              />
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : isLogin ? "Login" : "Register"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-blue-600 hover:underline"
              >
                {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
