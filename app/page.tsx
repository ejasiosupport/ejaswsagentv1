"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Conversation, Message } from "@/lib/types";
import ConversationSidebar from "@/components/ConversationSidebar";
import ChatPanel from "@/components/ChatPanel";
import { useTheme } from "@/components/ThemeProvider";

export default function DashboardPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const selectedConversation =
    conversations.find((c) => c.id === selectedId) ?? null;

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data: Conversation[] = await res.json();
      setConversations(data);
    }
  }, []);

  const fetchMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    if (res.ok) {
      const data: Message[] = await res.json();
      setMessages(data);
    }
  }, []);

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, fetchMessages]);

  // Supabase Realtime — live message updates
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (
              selectedId &&
              newMsg.conversation_id === selectedId &&
              !prev.find((m) => m.id === newMsg.id)
            ) {
              return [...prev, newMsg];
            }
            return prev;
          });
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, fetchConversations]);

  function handleModeChange(mode: "agent" | "human") {
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, mode } : c))
    );
  }

  function handleMessageSent(msg: Message) {
    setMessages((prev) =>
      prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]
    );
    fetchConversations();
  }

  function handleConversationDeleted(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setMessages([]);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400 text-sm">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900">
      <div className="absolute top-3 right-4 z-10 flex items-center gap-2">
        <button
          onClick={toggle}
          className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
        >
          Sign out
        </button>
      </div>
      <ConversationSidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDelete={handleConversationDeleted}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedConversation ? (
          <ChatPanel
            conversation={selectedConversation}
            messages={messages}
            onModeChange={handleModeChange}
            onMessageSent={handleMessageSent}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#e5ddd5] dark:bg-gray-800">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                Select a conversation to start
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                Choose from the list on the left
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
