// components/MatchesSection.tsx
"use client";

import { useState, useMemo } from "react";

export type MatchRecord = {
  id: number | string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null | undefined;
  awayScore: number | null | undefined;
  homePenaltyScore?: number | null | undefined;
  awayPenaltyScore?: number | null | undefined;
  matchType: string | null | undefined;
  matchDate: string | Date | null | undefined;
  processedForPoints: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage",
  round16: "Round of 16",
  round_of_16: "Round of 16",
  quarterfinal: "Quarter-Final",
  quarter_final: "Quarter-Final",
  semifinal: "Semi-Final",
  semi_final: "Semi-Final",
  final: "Final",
};

const STAGE_PRIORITY: Record<string, number> = {
  group: 0,
  round16: 1,
  round_of_16: 1,
  quarterfinal: 2,
  quarter_final: 2,
  semifinal: 3,
  semi_final: 3,
  final: 4,
};

function formatStage(type: string) {
  return STAGE_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function stagePriority(type: string) {
  return STAGE_PRIORITY[type] ?? 99;
}

// Updated to calculate winner based on penalties if regular time is a draw
function matchResult(
  home: number | null | undefined,
  away: number | null | undefined,
  homePen?: number | null | undefined,
  awayPen?: number | null | undefined
): "home" | "away" | "draw" | null {
  if (home == null || away == null) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  
  if (homePen != null && awayPen != null) {
    if (homePen > awayPen) return "home";
    if (awayPen > homePen) return "away";
  }
  
  return "draw";
}

function fmtDate(d: string | Date | null | undefined, long = false) {
  if (!d) return "—";
  return new Date(d as string).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(long ? { year: "numeric" } : {}),
  });
}

type SortKey = "newest" | "oldest" | "most-goals" | "fewest-goals";
type ViewMode = "grid" | "list";

// ─── Component ─────────────────────────────────────────────────────────────

export default function MatchesSection({ matches }: { matches: MatchRecord[] }) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");

  const stages = useMemo(() => {
    const unique = [...new Set(matches.map((m) => m.matchType ?? "other"))];
    return unique.sort((a, b) => stagePriority(a) - stagePriority(b) || a.localeCompare(b));
  }, [matches]);

  const filtered = useMemo(() => {
    let result = [...matches];

    if (stage !== "all") {
      result = result.filter((m) => (m.matchType ?? "other") === stage);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (m) =>
          m.homeTeam.toLowerCase().includes(q) ||
          m.awayTeam.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sort === "newest" || sort === "oldest") {
        const ta = a.matchDate ? new Date(a.matchDate as string).getTime() : 0;
        const tb = b.matchDate ? new Date(b.matchDate as string).getTime() : 0;
        return sort === "newest" ? tb - ta : ta - tb;
      }
      const ga = (a.homeScore ?? 0) + (a.awayScore ?? 0);
      const gb = (b.homeScore ?? 0) + (b.awayScore ?? 0);
      return sort === "most-goals" ? gb - ga : ga - gb;
    });

    return result;
  }, [matches, stage, search, sort]);

  const hasFilters = search.trim() !== "" || stage !== "all";

  const clearFilters = () => {
    setSearch("");
    setStage("all");
  };

  // ── chevron SVG for select ──
  const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2393A696' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696]">
          Full-Time Results
        </h2>
        <span className="text-xs font-mono text-[#93A696] tabular-nums">
          <span className={filtered.length < matches.length ? "text-[#2ED47E]" : ""}>
            {filtered.length}
          </span>
          {" / "}
          {matches.length}
        </span>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="space-y-3 mb-5">
        {/* Row 1: search + sort + view toggle */}
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#93A696] pointer-events-none"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0A1610] border border-[#1B2D21] text-[#EFF5EE] text-sm pl-8 pr-8 py-2.5 placeholder:text-[#2D3F33] focus:outline-none focus:border-[#2ED47E]/60 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#93A696] hover:text-[#EFF5EE] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort select */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="hidden sm:block bg-[#0A1610] border border-[#1B2D21] text-[#93A696] text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-2.5 pr-8 focus:outline-none focus:border-[#2ED47E]/60 transition-colors cursor-pointer appearance-none"
            style={{
              backgroundImage: chevronBg,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most-goals">Most goals</option>
            <option value="fewest-goals">Fewest goals</option>
          </select>

          {/* View toggle */}
          <div className="flex border border-[#1B2D21] shrink-0">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={`px-3 py-2.5 transition-colors ${
                view === "grid"
                  ? "bg-[#1B2D21] text-[#2ED47E]"
                  : "bg-[#0A1610] text-[#93A696] hover:text-[#EFF5EE]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden>
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
              className={`px-3 py-2.5 border-l border-[#1B2D21] transition-colors ${
                view === "list"
                  ? "bg-[#1B2D21] text-[#2ED47E]"
                  : "bg-[#0A1610] text-[#93A696] hover:text-[#EFF5EE]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="3" cy="6" r="0.5" fill="currentColor" />
                <circle cx="3" cy="12" r="0.5" fill="currentColor" />
                <circle cx="3" cy="18" r="0.5" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: stage filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
          <button
            onClick={() => setStage("all")}
            className={`shrink-0 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors ${
              stage === "all"
                ? "bg-[#2ED47E] text-[#060D09] border-[#2ED47E]"
                : "text-[#93A696] border-[#1B2D21] hover:border-[#2ED47E]/50 hover:text-[#2ED47E] bg-transparent"
            }`}
          >
            All <span className={stage === "all" ? "text-[#060D09]/60" : "text-[#2D3F33]"}>·</span> {matches.length}
          </button>

          {stages.map((s) => {
            const count = matches.filter((m) => (m.matchType ?? "other") === s).length;
            const active = stage === s;
            return (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={`shrink-0 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                  active
                    ? "bg-[#2ED47E] text-[#060D09] border-[#2ED47E]"
                    : "text-[#93A696] border-[#1B2D21] hover:border-[#2ED47E]/50 hover:text-[#2ED47E] bg-transparent"
                }`}
              >
                {formatStage(s)} <span className={active ? "text-[#060D09]/60" : "text-[#2D3F33]"}>·</span> {count}
              </button>
            );
          })}
        </div>

        {/* Mobile sort (below pills) */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="sm:hidden w-full bg-[#0A1610] border border-[#1B2D21] text-[#93A696] text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-2.5 pr-8 focus:outline-none focus:border-[#2ED47E]/60 transition-colors cursor-pointer appearance-none"
          style={{
            backgroundImage: chevronBg,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
          <option value="most-goals">Sort: Most goals</option>
          <option value="fewest-goals">Sort: Fewest goals</option>
        </select>
      </div>

      {/* ── EMPTY STATE ── */}
      {filtered.length === 0 && (
        <div className="border border-[#1B2D21] bg-[#0A1610] py-16 flex flex-col items-center gap-4 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-8 h-8 text-[#2D3F33]"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <p className="text-sm text-[#93A696]">No matches found</p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] font-bold uppercase tracking-widest text-[#2ED47E] border border-[#2ED47E]/30 px-4 py-1.5 hover:border-[#2ED47E] transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {filtered.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((match) => {
            const result = matchResult(match.homeScore, match.awayScore, match.homePenaltyScore, match.awayPenaltyScore);
            const hasPenalties = match.homePenaltyScore != null && match.awayPenaltyScore != null;

            return (
              <div
                key={match.id}
                className="border border-[#1B2D21] bg-[#0D1B13] p-4 flex flex-col gap-3 hover:border-[#2ED47E]/25 transition-colors"
              >
                {/* Card header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2ED47E] truncate">
                    {formatStage(match.matchType ?? "other")}
                  </span>
                  <span className="text-[10px] font-mono text-[#93A696] shrink-0">
                    {fmtDate(match.matchDate)}
                  </span>
                </div>

                {/* Scoreline */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-semibold truncate ${
                        result === "home" ? "text-[#EFF5EE]" : "text-[#93A696]"
                      }`}
                    >
                      {match.homeTeam}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      {match.homePenaltyScore != null && (
                        <span className="text-[11px] text-[#93A696] font-bold">({match.homePenaltyScore})</span>
                      )}
                      <span
                        className={`font-mono font-black text-xl tabular-nums ${
                          result === "home" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                        }`}
                      >
                        {match.homeScore ?? "—"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-px bg-[#1B2D21]" />
                  
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-semibold truncate ${
                        result === "away" ? "text-[#EFF5EE]" : "text-[#93A696]"
                      }`}
                    >
                      {match.awayTeam}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      {match.awayPenaltyScore != null && (
                        <span className="text-[11px] text-[#93A696] font-bold">({match.awayPenaltyScore})</span>
                      )}
                      <span
                        className={`font-mono font-black text-xl tabular-nums ${
                          result === "away" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                        }`}
                      >
                        {match.awayScore ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* FT badge */}
                <div className="flex justify-end pt-1">
                  <span className="text-[10px] font-bold tracking-[0.15em] text-[#93A696] border border-[#1B2D21] px-1.5 py-0.5">
                    {hasPenalties ? "FT · PENS" : result === "draw" ? "FT · DRAW" : "FT"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {filtered.length > 0 && view === "list" && (
        <div className="border border-[#1B2D21]">
          {/* Table header (desktop only) */}
          <div className="hidden md:grid grid-cols-[90px_1fr_120px_1fr_120px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] border-b border-[#1B2D21] bg-[#060D09]">
            <div>Date</div>
            <div>Home</div>
            <div className="text-center">Score</div>
            <div>Away</div>
            <div className="text-right">Stage</div>
          </div>

          <div className="divide-y divide-[#1B2D21]">
            {filtered.map((match) => {
              const result = matchResult(match.homeScore, match.awayScore, match.homePenaltyScore, match.awayPenaltyScore);
              const hasPenalties = match.homePenaltyScore != null && match.awayPenaltyScore != null;

              return (
                <div
                  key={match.id}
                  className="hover:bg-[#0D1B13] transition-colors"
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[90px_1fr_120px_1fr_120px] items-center px-4 py-3 gap-x-3">
                    <span className="font-mono text-[11px] text-[#93A696] tabular-nums">
                      {fmtDate(match.matchDate)}
                    </span>

                    <span
                      className={`text-sm font-semibold truncate pr-2 ${
                        result === "home" ? "text-[#EFF5EE]" : "text-[#93A696]"
                      }`}
                    >
                      {match.homeTeam}
                    </span>

                    {/* Score box */}
                    <div className="flex items-center justify-center gap-1.5">
                      {match.homePenaltyScore != null && (
                        <span className="text-[10px] font-bold text-[#93A696]">({match.homePenaltyScore})</span>
                      )}
                      
                      <span
                        className={`font-mono font-black text-base tabular-nums w-4 text-right ${
                          result === "home" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                        }`}
                      >
                        {match.homeScore ?? "—"}
                      </span>
                      <span className="text-[#2D3F33] font-bold select-none">–</span>
                      <span
                        className={`font-mono font-black text-base tabular-nums w-4 text-left ${
                          result === "away" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                        }`}
                      >
                        {match.awayScore ?? "—"}
                      </span>
                      
                      {match.awayPenaltyScore != null && (
                        <span className="text-[10px] font-bold text-[#93A696]">({match.awayPenaltyScore})</span>
                      )}
                    </div>

                    <span
                      className={`text-sm font-semibold truncate pl-2 ${
                        result === "away" ? "text-[#EFF5EE]" : "text-[#93A696]"
                      }`}
                    >
                      {match.awayTeam}
                    </span>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#2ED47E]">
                        {formatStage(match.matchType ?? "other")}
                      </span>
                    </div>
                  </div>

                  {/* Mobile row */}
                  <div className="md:hidden px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 text-center pt-0.5">
                        <p className="font-mono text-[10px] text-[#93A696] tabular-nums leading-tight">
                          {fmtDate(match.matchDate)}
                        </p>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`text-xs font-semibold truncate ${
                              result === "home" ? "text-[#EFF5EE]" : "text-[#93A696]"
                            }`}
                          >
                            {match.homeTeam}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            {match.homePenaltyScore != null && (
                              <span className="text-[10px] text-[#93A696] font-bold">({match.homePenaltyScore})</span>
                            )}
                            <span
                              className={`font-mono font-black text-sm tabular-nums ${
                                result === "home" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                              }`}
                            >
                              {match.homeScore ?? "—"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold truncate ${
                              result === "away" ? "text-[#EFF5EE]" : "text-[#93A696]"
                            }`}
                          >
                            {match.awayTeam}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            {match.awayPenaltyScore != null && (
                              <span className="text-[10px] text-[#93A696] font-bold">({match.awayPenaltyScore})</span>
                            )}
                            <span
                              className={`font-mono font-black text-sm tabular-nums ${
                                result === "away" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                              }`}
                            >
                              {match.awayScore ?? "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1B2D21]">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#2ED47E]">
                        {formatStage(match.matchType ?? "other")}
                      </span>
                      <span className="text-[10px] font-bold tracking-[0.12em] text-[#93A696] border border-[#1B2D21] px-1.5 py-0.5">
                        {hasPenalties ? "FT · PENS" : result === "draw" ? "FT · DRAW" : "FT"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}