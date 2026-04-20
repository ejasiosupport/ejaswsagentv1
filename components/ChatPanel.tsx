"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, Message } from "@/lib/types";

interface Props {
  conversation: Conversation;
  messages: Message[];
  onModeChange: (mode: "agent" | "human") => void;
  onMessageSent: (msg: Message) => void;
  onBack?: () => void;
}

function formatTimestamp(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPanel({
  conversation,
  messages,
  onModeChange,
  onMessageSent,
  onBack,
}: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  async function toggleMode() {
    const newMode = conversation.mode === "agent" ? "human" : "agent";
    setTogglingMode(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        onModeChange(newMode);
      }
    } finally {
      setTogglingMode(false);
    }
  }

  async function deleteMessage(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLocalMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const msg: Message = await res.json();
        onMessageSent(msg);
      }
    } finally {
      setSending(false);
    }
  }

  const displayName = conversation.name ?? conversation.phone;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#e5ddd5] dark:bg-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-3 py-3 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Back button — mobile only */}
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 p-1 -ml-1"
            aria-label="Back to conversations"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conversation.phone}</p>
        </div>
        <button
          onClick={toggleMode}
          disabled={togglingMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
            conversation.mode === "agent"
              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
              : "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800"
          } disabled:opacity-50`}
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              conversation.mode === "agent" ? "bg-green-500" : "bg-orange-500"
            }`}
          />
          <span>{conversation.mode === "agent" ? "Agent" : "Human"}</span>
          <span className="opacity-60 hidden sm:inline">
            → {conversation.mode === "agent" ? "Human" : "Agent"}
          </span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 text-sm mt-8">
            No messages yet
          </p>
        )}
        {localMessages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-1 group ${isUser ? "justify-start" : "justify-end"}`}
            >
              {!isUser && (
                <button
                  onClick={() => deleteMessage(msg.id)}
                  disabled={deletingId === msg.id}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-1 flex-shrink-0 disabled:opacity-30"
                  title="Delete message"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                  isUser
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm"
                    : "bg-[#dcf8c6] dark:bg-green-900 text-gray-900 dark:text-gray-100 rounded-tr-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {isUser ? "User" : "You"}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTimestamp(msg.created_at)}
                  </span>
                </div>
              </div>
              {isUser && (
                <button
                  onClick={() => deleteMessage(msg.id)}
                  disabled={deletingId === msg.id}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-1 flex-shrink-0 disabled:opacity-30"
                  title="Delete message"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="bg-white dark:bg-gray-900 px-3 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            conversation.mode === "human"
              ? "Type a reply..."
              : "Send a manual message..."
          }
          className="flex-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors flex-shrink-0"
        >
          <svg
            className="w-4 h-4 rotate-45"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
