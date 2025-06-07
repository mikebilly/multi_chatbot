"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { DatabaseService } from "@/lib/database-service"

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)

  const runDiagnostics = async () => {
    setIsLoading(true)
    const info: any = {}

    try {
      // Check Supabase connection
      info.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing"
      info.supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Missing"

      // Check auth status
      const { data: session, error: sessionError } = await supabase.auth.getSession()
      info.session = {
        exists: !!session.session,
        userId: session.session?.user?.id || "None",
        error: sessionError?.message || "None",
      }

      // Check database health
      const health = await DatabaseService.checkDatabaseHealth()
      info.database = health

      // Test basic queries
      try {
        const { data, error } = await supabase.from("user_profiles").select("count").limit(1)
        info.userProfilesQuery = error ? error.message : "Success"
      } catch (e: any) {
        info.userProfilesQuery = e.message
      }

      try {
        const { data, error } = await supabase.from("chatbots").select("count").limit(1)
        info.chatbotsQuery = error ? error.message : "Success"
      } catch (e: any) {
        info.chatbotsQuery = e.message
      }

      setDebugInfo(info)
    } catch (error: any) {
      info.error = error.message
      setDebugInfo(info)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      runDiagnostics()
    }
  }, [isOpen])

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="fixed bottom-4 right-4 z-50">
        Debug
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Debug Information
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              ×
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button onClick={runDiagnostics} disabled={isLoading} className="w-full">
              {isLoading ? "Running Diagnostics..." : "Refresh Diagnostics"}
            </Button>

            <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded text-xs overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
