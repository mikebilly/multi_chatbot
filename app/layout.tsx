import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/toaster"
import DebugPanel from "@/components/debug-panel"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Multi-Chatbot Interface",
  description: "Chat with multiple AI chatbots in a modern, minimalist interface",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          {process.env.NODE_ENV === "development" && <DebugPanel />}
        </ThemeProvider>
      </body>
    </html>
  )
}
