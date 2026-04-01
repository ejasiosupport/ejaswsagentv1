"use client";

import { useState, useRef, useEffect } from "react";
import { Conversation, Message } from "@/lib/types";

interface Props {
  conversation: Conversation;
  messages: Message[];
  onModeChange: (mode: "agent" | "human") => void;
  onMessageSent: (msg: Message) => void;
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
}: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#e5ddd5]">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200 shadow-sm">
        <div>
          <h2 className="font-semibold text-gray-900">{displayName}</h2>
          <p className="text-xs text-gray-500">{conversation.phone}</p>
        </div>
        <button
          onClick={toggleMode}
          disabled={togglingMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            conversation.mode === "agent"
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
          } disabled:opacity-50`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              conversation.mode === "agent" ? "bg-green-500" : "bg-orange-500"
            }`}
          />
          {conversation.mode === "agent" ? "Agent Mode" : "Human Mode"}
          <span className="text-xs opacity-70">
            → Switch to {conversation.mode === "agent" ? "Human" : "Agent"}
          </span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 text-sm mt-8">
            No messages yet
          </p>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                  isUser
                    ? "bg-white text-gray-900 rounded-tl-sm"
                    : "bg-[#dcf8c6] text-gray-900 rounded-tr-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs text-gray-400">
                    {isUser ? "User" : "You"}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">
                    {formatTimestamp(msg.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="bg-white px-4 py-3 border-t border-gray-200 flex items-center gap-3"
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
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors flex-shrink-0"
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
