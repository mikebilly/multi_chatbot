export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  threadId: string
}

export interface ChatbotSettings {
  webhookUrl?: string
  botIdKey?: string
  botIdValue?: string
  threadIdKey?: string
  messageKey?: string
  responseKey?: string
}

export interface Chatbot {
  id: string
  name: string
  sessions: ChatSession[]
  settings?: ChatbotSettings
}
