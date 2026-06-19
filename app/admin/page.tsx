// app/admin/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type LogLine = {
  id: number;
  text: string;
  kind: "info" | "success" | "error";
};

let lineId = 0;

export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);

  function push(text: string, kind: LogLine["kind"] = "info") {
    setLog((prev) => [...prev, { id: lineId++, text, kind }]);
  }

  const handleManualSync = async () => {
    if (!secret.trim()) {
      push("Admin secret is required.", "error");
      return;
    }

    setIsLoading(true);
    setLog([]);
    push("Connecting to sync engine…", "info");

    try {
      push("POST /api/cron → awaiting response", "info");
      const res = await fetch("/api/cron", {
        headers: { "x-admin-secret": secret },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      push(`HTTP ${res.status} OK`, "success");
      push(data.message ?? "Sync completed.", "success");
    } catch (err: unknown) {
      if (err instanceof Error) {
        push(err.message ?? "Unknown error", "error");
      } else {
        push(String(err) || "Unknown error", "error");
      }
    } finally {
      setIsLoading(false);
      push("Done.", "info");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleManualSync();
  };

  const logColor: Record<LogLine["kind"], string> = {
    info: "text-[#93A696]",
    success: "text-[#2ED47E]",
    error: "text-red-400",
  };

  const logPrefix: Record<LogLine["kind"], string> = {
    info: "·",
    success: "✓",
    error: "✗",
  };

  return (
    <main className="min-h-screen bg-[#060D09] text-[#EFF5EE] font-sans selection:bg-[#2ED47E]/30 flex flex-col">
      {/* Floodlight glow — same as leaderboard */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(46,212,126,0.10),transparent)]"
      />

      <div className="relative z-10 flex flex-col min-h-screen max-w-2xl mx-auto w-full px-4 md:px-8 py-10 md:py-16">

        {/* TOP NAV */}
        <nav className="flex items-center justify-between mb-14 border-b border-[#1B2D21] pb-5">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2ED47E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ED47E]" />
            FIFA World Cup 2026 · Admin
          </span>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696] hover:text-[#EFF5EE] transition-colors group"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5"
              aria-hidden
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Leaderboard
          </Link>
        </nav>

        {/* HEADER */}
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-[0.95] mb-3">
            Control<br />Panel
          </h1>
          <p className="text-[#93A696] text-sm max-w-sm">
            Manually trigger the points calculation engine. Enter the admin secret and run the sync.
          </p>
        </header>

        {/* FORM PANEL */}
        <div className="border border-[#1B2D21] bg-[#0A1610]">
          {/* Panel header */}
          <div className="border-b border-[#1B2D21] px-5 py-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#1B2D21]" />
            <span className="h-2 w-2 rounded-full bg-[#1B2D21]" />
            <span className="h-2 w-2 rounded-full bg-[#2ED47E]/40" />
            <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696]">
              sync-engine.sh
            </span>
          </div>

          <div className="p-5 md:p-6 space-y-4">
            {/* Secret input */}
            <div>
              <label
                htmlFor="admin-secret"
                className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-2"
              >
                Admin Secret
              </label>
              <div className="relative">
                <input
                  id="admin-secret"
                  type={showSecret ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="w-full bg-[#060D09] border border-[#1B2D21] text-[#EFF5EE] font-mono text-sm px-4 py-3 pr-11 placeholder:text-[#2D3F33] focus:outline-none focus:border-[#2ED47E]/60 disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  disabled={isLoading}
                  aria-label={showSecret ? "Hide secret" : "Show secret"}
                  className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-[#93A696] hover:text-[#2ED47E] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:text-[#2ED47E]"
                >
                  {showSecret ? (
                    /* Eye-off icon */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Eye icon */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={handleManualSync}
              disabled={isLoading}
              className="w-full py-3.5 font-bold text-sm uppercase tracking-[0.12em] transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED47E]/60 disabled:cursor-not-allowed
                enabled:bg-[#2ED47E] enabled:text-[#060D09] enabled:border-[#2ED47E] enabled:hover:bg-[#26C070] enabled:hover:border-[#26C070]
                disabled:bg-transparent disabled:text-[#2D3F33] disabled:border-[#1B2D21]"
            >
              {isLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Running engine…
                </span>
              ) : (
                "Run Points Engine"
              )}
            </button>
          </div>

          {/* Log output — only shown once sync has been attempted */}
          {log.length > 0 && (
            <div className="border-t border-[#1B2D21] bg-[#060D09] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-3">
                Output
              </p>
              <div className="space-y-1 font-mono text-xs">
                {log.map((line) => (
                  <div key={line.id} className={`flex gap-2 ${logColor[line.kind]}`}>
                    <span aria-hidden className="select-none shrink-0">
                      {logPrefix[line.kind]}
                    </span>
                    <span>{line.text}</span>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2 text-[#93A696]">
                    <span aria-hidden className="select-none">·</span>
                    <span className="animate-pulse">waiting…</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER LINK */}
        <div className="mt-10 pt-6 border-t border-[#1B2D21]">
          <Link
            href="/"
            className="inline-flex items-center gap-3 group"
          >
            <div className="w-8 h-8 border border-[#1B2D21] flex items-center justify-center group-hover:border-[#2ED47E]/40 transition-colors">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-3.5 h-3.5 text-[#93A696] group-hover:text-[#2ED47E] transition-colors"
                aria-hidden
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-[#EFF5EE] group-hover:text-[#2ED47E] transition-colors">
                View Leaderboard
              </p>
              <p className="text-[11px] text-[#93A696]">FIFA World Cup 2026 · Fantasy League</p>
            </div>
          </Link>
        </div>

      </div>
    </main>
  );
}