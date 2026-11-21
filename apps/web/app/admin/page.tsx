"use client";

import { useEffect, useState } from "react";
import { VOCAB_DOMAIN_LABELS, type VocabDomain } from "@/app/course/types";

interface InviteRow {
  code: string;
  note: string;
  maxUses: number;
  uses: number;
  revokedAt: string | null;
}

interface StudentRow {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    inviteCodeUsed?: string;
    lastSeenAt: string;
  };
  currentDay: number;
  streak: number;
  placementStatus: string;
  errorsCount: number;
  notesCount: number;
  domainsCoveredCount: number;
}

export default function AdminDashboardPage() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [users, setUsers] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newCode, setNewCode] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newMaxUses, setNewMaxUses] = useState(25);
  const [copiedCode, setCopiedCode] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [invRes, usrRes] = await Promise.all([
        fetch("/api/admin/invites"),
        fetch("/api/admin/users"),
      ]);
      if (invRes.status === 403 || usrRes.status === 403) {
        setError("Admin privileges required. Sign in on the start page using ADMIN_EMAILS or ADMIN_PASSWORD.");
        setLoading(false);
        return;
      }
      const invData = await invRes.json();
      const usrData = await usrRes.json();
      setInvites(invData.invites ?? []);
      setUsers(usrData.users ?? []);
    } catch {
      setError("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: newCode.trim().toUpperCase() || undefined,
        note: newNote.trim() || "Cohort Invite",
        maxUses: Number(newMaxUses) || 25,
      }),
    });
    setNewCode("");
    setNewNote("");
    loadAll();
  }

  async function handleRevoke(code: string) {
    await fetch(`/api/admin/invites?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    loadAll();
  }

  async function inspectStudent(id: string) {
    setSelectedUserId(id);
    const res = await fetch(`/api/admin/users/${id}`);
    if (res.ok) {
      setSelectedDetail(await res.json());
    }
  }

  async function setStudentDay(id: string, currentDay: number) {
    await fetch(`/api/admin/users/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_day", currentDay }),
    });
    await inspectStudent(id);
    await loadAll();
  }

  function copyJoinLink(code: string) {
    const url = `${window.location.origin}/?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        Loading Admin Dashboard…
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-800/30 bg-[#fbf7ee] p-6 text-center">
          <h1 className="font-serif text-xl font-bold text-red-900">{error}</h1>
          <a href="/" className="mt-4 inline-block rounded-xl bg-[#231b12] px-5 py-2.5 text-xs font-bold text-white">
            ← Return to Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] pb-16">
      <header className="border-b border-[#3c2d1e]/15 bg-[#231b12] text-[#fbf7ee] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">
              Instructor &amp; Admin Console
            </div>
            <h1 className="font-serif text-2xl font-bold">Le Séjour · Invite Codes &amp; Student Dossiers</h1>
          </div>
          <a
            href="/home"
            className="rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            ← Back to Course Hub
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pt-6 space-y-8">
        {/* Invite Codes Management */}
        <section className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] p-6 shadow-sm">
          <h2 className="font-serif text-xl font-bold text-[#231b12]">1. Invite Codes</h2>
          <p className="text-xs text-[#6e563a]">
            Create invite codes or copy direct join links (`/?code=...`) to share with students.
          </p>

          <form onSubmit={handleCreateInvite} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4a3b2a]">Custom Code (optional)</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="AUTO-GENERATED"
                className="mt-1 rounded-lg border border-[#3c2d1e]/30 bg-white px-3 py-2 text-xs font-mono uppercase"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-bold text-[#4a3b2a]">Cohort / Note</label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Friends & Beta Testers"
                className="mt-1 w-full rounded-lg border border-[#3c2d1e]/30 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-bold text-[#4a3b2a]">Max Uses</label>
              <input
                type="number"
                min={1}
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[#3c2d1e]/30 bg-white px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#231b12] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#3a2d1f]"
            >
              + Create Invite Code
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#3c2d1e]/15 text-[#6e563a]">
                  <th className="py-2">Code</th>
                  <th className="py-2">Note</th>
                  <th className="py-2">Uses</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3c2d1e]/10">
                {invites.map((inv) => (
                  <tr key={inv.code}>
                    <td className="py-2.5 font-mono font-bold text-sm">{inv.code}</td>
                    <td className="py-2.5">{inv.note}</td>
                    <td className="py-2.5">
                      {inv.uses} / {inv.maxUses}
                    </td>
                    <td className="py-2.5">
                      {inv.revokedAt ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-red-800 font-bold">Revoked</span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 font-bold">Active</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => copyJoinLink(inv.code)}
                        className="rounded-lg border border-[#3c2d1e]/25 bg-white px-2.5 py-1 font-bold hover:bg-[#f4ecdc]"
                      >
                        {copiedCode === inv.code ? "✓ Copied Join Link" : "Copy Join Link"}
                      </button>
                      {!inv.revokedAt && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv.code)}
                          className="rounded-lg border border-red-800/30 bg-red-50 px-2.5 py-1 font-bold text-red-900 hover:bg-red-100"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Student Roster & Teacher Dossier Inspector */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] p-6 shadow-sm">
            <h2 className="font-serif text-xl font-bold text-[#231b12]">
              2. Enrolled Students ({users.length})
            </h2>
            <p className="text-xs text-[#6e563a]">
              Click any student to inspect their hidden Teacher bot notes, grammar error log, and vocab coverage.
            </p>
            <div className="mt-4 space-y-2.5">
              {users.map((row) => (
                <button
                  key={row.user.id}
                  type="button"
                  onClick={() => inspectStudent(row.user.id)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    selectedUserId === row.user.id
                      ? "border-2 border-[#231b12] bg-amber-50"
                      : "border-[#3c2d1e]/15 bg-white hover:bg-[#f4ecdc]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#231b12]">
                      {row.user.name} <span className="font-normal text-xs text-[#6e563a]">({row.user.email})</span>
                    </span>
                    <span className="rounded-full bg-[#efe6d4] px-2.5 py-0.5 text-xs font-bold">
                      Day {row.currentDay} · 🔥 {row.streak}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[#6e563a]">
                    <span>Placement: {row.placementStatus}</span>
                    <span>Domains covered: {row.domainsCoveredCount}/15</span>
                    <span>Errors tracked: {row.errorsCount}</span>
                    <span>Teacher notes: {row.notesCount}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#3c2d1e]/20 bg-[#fbf7ee] p-6 shadow-sm">
            {!selectedDetail ? (
              <div className="py-16 text-center text-sm text-[#6e563a]">
                Select a student on the left to inspect their Teacher Bot notebook, learner facts, and progress controls.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3c2d1e]/15 pb-3">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#231b12]">
                      {selectedDetail.user.name}
                    </h3>
                    <div className="text-xs text-[#6e563a]">{selectedDetail.user.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold">Jump to Day:</label>
                    <select
                      value={selectedDetail.bundle?.course?.currentDay ?? 1}
                      onChange={(e) => setStudentDay(selectedDetail.user.id, Number(e.target.value))}
                      className="rounded-lg border border-[#3c2d1e]/30 bg-white px-2.5 py-1 text-xs font-bold"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Day {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Extracted Learner Facts */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                    Stored Student Facts (Remembered by LLMs)
                  </h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.values(selectedDetail.bundle?.learnerFacts ?? {}).length === 0 ? (
                      <span className="text-xs text-[#6e563a]">No personal facts recorded yet.</span>
                    ) : (
                      Object.values(selectedDetail.bundle.learnerFacts).map((f: any) => (
                        <span
                          key={f.key}
                          className="rounded-full border border-[#3c2d1e]/20 bg-white px-2.5 py-0.5 text-xs"
                        >
                          <strong>{f.key}:</strong> {f.value}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Teacher Scribe Notes */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                    Hidden Teacher Bot Scribe Notes
                  </h4>
                  <div className="mt-1.5 max-h-44 overflow-y-auto space-y-1.5 rounded-xl border border-[#3c2d1e]/15 bg-white p-3 text-xs">
                    {(selectedDetail.bundle?.teacherNotes ?? []).length === 0 ? (
                      <span className="text-[#6e563a]">No teacher notes scribed yet.</span>
                    ) : (
                      selectedDetail.bundle.teacherNotes
                        .slice()
                        .reverse()
                        .map((n: any) => (
                          <div key={n.id} className="border-b border-[#3c2d1e]/10 pb-1.5">
                            <span className="font-bold text-[#8b5e34]">
                              [Day {n.day} · {n.kind}]
                            </span>{" "}
                            {n.body}
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Recent Grammar Errors */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                    Recent Tracked Grammar &amp; Vocab Mistakes
                  </h4>
                  <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1.5 rounded-xl border border-[#3c2d1e]/15 bg-white p-3 text-xs">
                    {(selectedDetail.bundle?.errors ?? []).length === 0 ? (
                      <span className="text-[#6e563a]">No grammar errors logged yet.</span>
                    ) : (
                      selectedDetail.bundle.errors
                        .slice()
                        .reverse()
                        .map((err: any) => (
                          <div key={err.id} className="border-b border-[#3c2d1e]/10 pb-1.5">
                            <span className="font-bold text-red-800">[{err.topic}]</span> Said:{" "}
                            <em>“{err.said}”</em> → Correction:{" "}
                            <strong className="text-emerald-900">“{err.correct}”</strong>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Vocab Domains List */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8b5e34]">
                    15 Curriculum Vocabulary Domains
                  </h4>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                    {(Object.keys(VOCAB_DOMAIN_LABELS) as VocabDomain[]).map((dom) => (
                      <div key={dom} className="flex justify-between rounded bg-white px-2 py-1">
                        <span className="truncate">{VOCAB_DOMAIN_LABELS[dom].label}</span>
                        <span className="font-bold">W{VOCAB_DOMAIN_LABELS[dom].week}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
