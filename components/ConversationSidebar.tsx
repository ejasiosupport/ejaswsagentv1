"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Conversation } from "@/lib/types";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  theme: string;
  onToggleTheme: () => void;
  onLogout: () => void;
  isAdmin?: boolean;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  onDelete,
  theme,
  onToggleTheme,
  onLogout,
  isAdmin,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this conversation and all its messages?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className="w-full h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">WhatsApp Agent</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onToggleTheme}
              className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button
              onClick={onLogout}
              className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-8 px-4">
            No conversations yet. Messages will appear here once users contact your WhatsApp number.
          </p>
        ) : (
          conversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const displayName = conv.name ?? conv.phone;
            const preview = conv.lastMessage?.content ?? "No messages yet";
            const time = conv.lastMessage?.created_at
              ? formatTime(conv.lastMessage.created_at)
              : "";

            return (
              <div
                key={conv.id}
                className={`relative group border-b border-gray-100 dark:border-gray-800 ${
                  isSelected ? "bg-green-50 dark:bg-green-950 border-l-4 border-l-green-500" : ""
                }`}
              >
                <button
                  onClick={() => onSelect(conv.id)}
                  className="w-full text-left px-4 py-3 pr-10 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                          {displayName}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            conv.mode === "agent"
                              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                              : "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
                          }`}
                        >
                          {conv.mode === "agent" ? "AI" : "Human"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {preview}
                      </p>
                    </div>
                    {time && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {time}
                      </span>
                    )}
                  </div>
                </button>
                {/* Delete — always visible on touch, hover-only on desktop */}
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  disabled={deletingId === conv.id}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-2 disabled:opacity-30"
                  title="Delete conversation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-col gap-2">
        {isAdmin && (
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Clients
          </button>
        )}
        <button
          onClick={() => router.push("/settings")}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Bot Settings
        </button>
      </div>
    </aside>
  );
}
