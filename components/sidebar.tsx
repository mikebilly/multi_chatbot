"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PlusCircle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  User,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  LogOut,
} from "lucide-react"
import type { Chatbot } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SidebarProps {
  chatbots: Chatbot[]
  activeChatbotId: string
  activeSessionId: string | null
  setActiveChatbotId: (id: string) => void
  setActiveSessionId: (id: string | null) => void
  createNewSession: (chatbotId: string) => string
  addChatbot: (name: string) => string
  removeChatbot: (chatbotId: string) => void
  renameChatbot: (chatbotId: string, newName: string) => void
  userId: string
  setUserId: (id: string) => void
  onSignOut: () => void
  currentUser: any
}

export default function Sidebar({
  chatbots,
  activeChatbotId,
  activeSessionId,
  setActiveChatbotId,
  setActiveSessionId,
  createNewSession,
  addChatbot,
  removeChatbot,
  renameChatbot,
  userId,
  setUserId,
  onSignOut,
  currentUser,
}: SidebarProps) {
  const [expandedChatbots, setExpandedChatbots] = useState<Record<string, boolean>>(() =>
    chatbots.reduce((acc, bot) => ({ ...acc, [bot.id]: true }), {}),
  )
  const [isUserIdModalOpen, setIsUserIdModalOpen] = useState(false)
  const [isAddingChatbot, setIsAddingChatbot] = useState(false)
  const [newChatbotName, setNewChatbotName] = useState("")
  const [editingChatbotId, setEditingChatbotId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  useEffect(() => {
    setExpandedChatbots((prev) => {
      const newExpanded = { ...prev }
      chatbots.forEach((bot) => {
        if (!(bot.id in newExpanded)) {
          newExpanded[bot.id] = true
        }
      })
      return newExpanded
    })
  }, [chatbots])

  const toggleChatbotExpanded = (chatbotId: string) => {
    setExpandedChatbots((prev) => ({
      ...prev,
      [chatbotId]: !prev[chatbotId],
    }))
  }

  const handleAddChatbot = () => {
    if (newChatbotName.trim()) {
      addChatbot(newChatbotName.trim())
      setNewChatbotName("")
      setIsAddingChatbot(false)
    }
  }

  const handleStartEdit = (chatbot: Chatbot) => {
    setEditingChatbotId(chatbot.id)
    setEditingName(chatbot.name)
  }

  const handleSaveEdit = () => {
    if (editingChatbotId && editingName.trim()) {
      renameChatbot(editingChatbotId, editingName.trim())
    }
    setEditingChatbotId(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingChatbotId(null)
    setEditingName("")
  }

  const handleRemoveChatbot = (chatbotId: string) => {
    if (chatbots && chatbots.length > 1) {
      if (confirm("Are you sure you want to delete this chatbot? All conversations will be lost.")) {
        removeChatbot(chatbotId)
      }
    } else {
      alert("You must have at least one chatbot.")
    }
  }

  return (
    <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-white dark:bg-zinc-950">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Chatbots</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsAddingChatbot(true)} title="Add new chatbot">
            <Plus size={16} />
          </Button>
        </div>

        {isAddingChatbot && (
          <div className="mt-3 space-y-2">
            <Input
              value={newChatbotName}
              onChange={(e) => setNewChatbotName(e.target.value)}
              placeholder="Chatbot name"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddChatbot()
                } else if (e.key === "Escape") {
                  setIsAddingChatbot(false)
                  setNewChatbotName("")
                }
              }}
              autoFocus
            />
            <div className="flex gap-1">
              <Button size="sm" onClick={handleAddChatbot} disabled={!newChatbotName.trim()}>
                <Check size={12} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAddingChatbot(false)
                  setNewChatbotName("")
                }}
              >
                <X size={12} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {chatbots && chatbots.length > 0 ? (
          chatbots.map((chatbot) => (
            <div key={chatbot.id} className="mb-2">
              <div
                className={cn(
                  "flex items-center px-4 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 group",
                  activeChatbotId === chatbot.id && "bg-zinc-100 dark:bg-zinc-800",
                )}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleChatbotExpanded(chatbot.id)
                  }}
                  className="mr-2"
                >
                  {expandedChatbots[chatbot.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {editingChatbotId === chatbot.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="text-sm h-6"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveEdit()
                        } else if (e.key === "Escape") {
                          handleCancelEdit()
                        }
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
                      <Check size={12} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                      <X size={12} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span
                      className="flex-1"
                      onClick={() => {
                        setActiveChatbotId(chatbot.id)
                        if (chatbot.sessions.length === 0) {
                          createNewSession(chatbot.id)
                        } else if (chatbot.sessions.length > 0 && !activeSessionId) {
                          setActiveSessionId(chatbot.sessions[0].id)
                        }
                      }}
                    >
                      {chatbot.name}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEdit(chatbot)
                        }}
                        className="h-6 w-6"
                        title="Rename chatbot"
                      >
                        <Edit2 size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          const newSessionId = createNewSession(chatbot.id)
                          setActiveSessionId(newSessionId)
                        }}
                        className="h-6 w-6"
                        title="New chat"
                      >
                        <PlusCircle size={12} />
                      </Button>
                      {chatbots.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveChatbot(chatbot.id)
                          }}
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          title="Delete chatbot"
                        >
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {expandedChatbots[chatbot.id] && (
                <div className="ml-6">
                  {chatbot.sessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "flex items-center px-4 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm",
                        activeSessionId === session.id && "bg-zinc-100 dark:bg-zinc-800",
                      )}
                      onClick={() => {
                        setActiveChatbotId(chatbot.id)
                        setActiveSessionId(session.id)
                      }}
                    >
                      <MessageSquare size={14} className="mr-2" />
                      <span className="truncate">{session.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-zinc-500">
            <p>No chatbots available</p>
            <p className="text-sm mt-1">Click the + button to create one</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        <Button variant="outline" className="w-full mb-2 justify-start" onClick={() => setIsUserIdModalOpen(true)}>
          <User size={16} className="mr-2" />
          User: {currentUser?.profile?.username || userId}
        </Button>

        <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700" onClick={onSignOut}>
          <LogOut size={16} className="mr-2" />
          Sign Out
        </Button>
      </div>

      {isUserIdModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg w-80">
            <h2 className="text-lg font-semibold mb-4">Set User ID</h2>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
              className="mb-4"
            />
            <div className="flex justify-end">
              <Button onClick={() => setIsUserIdModalOpen(false)}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
