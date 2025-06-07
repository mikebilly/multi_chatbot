import type { ChatMessage } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ChatMessagesProps {
  messages: ChatMessage[]
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 dark:text-zinc-400">No messages yet. Start a conversation!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[80%] rounded-lg px-4 py-2",
              message.role === "user" ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800",
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            <div className="text-xs opacity-70 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
