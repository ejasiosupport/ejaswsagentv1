"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

interface BotConfig {
  id: string;
  bot_name: string;
  system_prompt: string;
  updated_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [botName, setBotName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BotConfig>;
      })
      .then((data) => {
        setConfig(data);
        setBotName(data.bot_name ?? "");
        setSystemPrompt(data.system_prompt ?? "");
      })
      .catch(() => setError("Failed to load settings. Make sure the bot_config migration has been applied in Supabase."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_name: botName, system_prompt: systemPrompt }),
    });

    if (res.ok) {
      const updated: BotConfig = await res.json();
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError("Failed to save settings");
    }
    setSaving(false);
  }

  const isDirty =
    config && (botName !== config.bot_name || systemPrompt !== config.system_prompt);

  return (
    <div className="min-h-dvh bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 p-1 -ml-1"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 flex-1">Bot Settings</h1>
        <button
          onClick={toggle}
          className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-8">Loading settings...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Bot Name */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bot Name
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                The name the bot introduces itself as.
              </p>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="e.g. Ejaz"
                required
              />
            </div>

            {/* System Prompt */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                System Prompt
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                This is the full instructions the AI follows. Edit this to change the bot&apos;s personality, business info, pricing, and behaviour.
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={20}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 resize-y"
                placeholder="You are a helpful assistant..."
                required
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {systemPrompt.length} characters
              </p>
            </div>

            {/* Footer */}
            {config && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Last updated: {new Date(config.updated_at).toLocaleString()}
              </p>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={saving || !isDirty}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl text-sm transition"
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
