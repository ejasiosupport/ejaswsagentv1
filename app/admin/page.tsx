"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import type { TenantStat } from "@/app/api/admin/stats/route";

interface Tenant {
  id: string;
  name: string;
  whatsapp_phone_number_id: string;
  created_at: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusDot(lastMessageAt: string | null): { color: string; label: string } {
  if (!lastMessageAt) return { color: "bg-gray-300 dark:bg-gray-600", label: "No activity" };
  const hrs = (Date.now() - new Date(lastMessageAt).getTime()) / 3600000;
  if (hrs < 24) return { color: "bg-green-500", label: "Active" };
  if (hrs < 72) return { color: "bg-yellow-400", label: "Quiet" };
  return { color: "bg-red-500", label: "Inactive" };
}

export default function AdminPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [stats, setStats] = useState<TenantStat[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [name, setName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [assignTenantId, setAssignTenantId] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then(async (r) => {
        if (r.status === 403) { setForbidden(true); return []; }
        return r.ok ? (r.json() as Promise<TenantStat[]>) : [];
      }),
      fetch("/api/admin/tenants").then((r) =>
        r.ok ? (r.json() as Promise<Tenant[]>) : []
      ),
    ])
      .then(([s, t]) => { setStats(s); setTenants(t); })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_access_token: accessToken,
        user_email: userEmail || undefined,
      }),
    });
    if (res.ok) {
      const tenant: Tenant = await res.json();
      setTenants((prev) => [tenant, ...prev]);
      const newStat: TenantStat = {
        ...tenant, total_conversations: 0, messages_today: 0, last_message_at: null,
      };
      setStats((prev) => [...prev, newStat]);
      setName(""); setPhoneNumberId(""); setAccessToken(""); setUserEmail("");
    } else {
      const err = await res.json() as { error: string };
      setCreateError(err.error);
    }
    setCreating(false);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssigning(true);
    setAssignMsg("");
    const res = await fetch(`/api/admin/tenants/${assignTenantId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: assignEmail }),
    });
    const data = await res.json() as { success?: boolean; error?: string };
    setAssignMsg(data.success ? "User assigned successfully." : (data.error ?? "Failed"));
    setAssigning(false);
  }

  if (forbidden) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Access denied. Only super admins can view this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/")} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 flex-1">Admin — Client Overview</h1>
        <button onClick={toggle} className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Monitoring panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-medium text-gray-900 dark:text-gray-100">Bot Status</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Green = active in last 24h · Yellow = quiet 1–3 days · Red = inactive 3+ days</p>
          </div>
          {loading ? (
            <p className="px-4 py-6 text-sm text-gray-400 dark:text-gray-500">Loading...</p>
          ) : stats.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 dark:text-gray-500">No clients yet.</p>
          ) : (
            stats.map((s) => {
              const { color, label } = statusDot(s.last_message_at);
              return (
                <div key={s.id} className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} title={label} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">{s.whatsapp_phone_number_id}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Last: {timeAgo(s.last_message_at)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400 dark:text-gray-500 pl-5">
                    <span>{s.total_conversations} conversations</span>
                    <span>{s.messages_today} messages today</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create tenant */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Add New Client</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Business Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Kedai Maju Sdn Bhd"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">WhatsApp Phone Number ID</label>
              <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} required placeholder="From Meta Business Dashboard"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">WhatsApp Access Token</label>
              <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required placeholder="From Meta Business Dashboard"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Assign User Email <span className="text-gray-400">(optional)</span>
              </label>
              <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="client@example.com"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            {createError && <p className="text-red-500 text-sm">{createError}</p>}
            <button type="submit" disabled={creating}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl text-sm transition">
              {creating ? "Creating..." : "Create Client"}
            </button>
          </form>
        </div>

        {/* Assign user */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Assign User to Client</h2>
          <form onSubmit={handleAssign} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Select Client</label>
              <select value={assignTenantId} onChange={(e) => setAssignTenantId(e.target.value)} required
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="">Select client...</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">User Email</label>
              <input type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} required placeholder="client@example.com"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            {assignMsg && (
              <p className={`text-sm ${assignMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>{assignMsg}</p>
            )}
            <button type="submit" disabled={assigning || !assignTenantId}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl text-sm transition">
              {assigning ? "Assigning..." : "Assign User"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
