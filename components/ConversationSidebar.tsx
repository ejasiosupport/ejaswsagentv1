"use client";

import { Conversation } from "@/lib/types";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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
}: Props) {
  return (
    <aside className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">WhatsApp Agent</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-8 px-4">
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
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  isSelected ? "bg-green-50 border-l-4 border-l-green-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {displayName}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          conv.mode === "agent"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {conv.mode === "agent" ? "AI" : "Human"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {preview}
                    </p>
                  </div>
                  {time && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {time}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
