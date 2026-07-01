// components/MatchesSection.tsx
"use client";

import Image from "next/image";
import { useState, useMemo } from "react";

export type MatchRecord = {
  id: number | string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null | undefined;
  awayScore: number | null | undefined;
  homePenaltyScore?: number | null | undefined;
  awayPenaltyScore?: number | null | undefined;
  homePointsBreakdown?: string | null;
  awayPointsBreakdown?: string | null;
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

// Helper to safely parse the JSON breakdown
function parseBreakdown(jsonString?: string | null) {
  if (!jsonString) return [];
  try {
    return JSON.parse(jsonString) as { category: string; description: string; points: number }[];
  } catch {
    return [];
  }
}

// Known World Cup teams → ISO country code, used for flag lookup.
// Keyed by numeric team id for reference elsewhere, but matches carry team
// *names*, so we also build a name → code index below.
const TEAM_INFO: Record<string, { name: string; code: string }> = {
  "1": { name: "Mexico", code: "mx" },
  "2": { name: "South Africa", code: "za" },
  "3": { name: "South Korea", code: "kr" },
  "4": { name: "Czech Republic", code: "cz" },
  "5": { name: "Canada", code: "ca" },
  "6": { name: "Bosnia and Herzegovina", code: "ba" },
  "7": { name: "Qatar", code: "qa" },
  "8": { name: "Switzerland", code: "ch" },
  "9": { name: "Brazil", code: "br" },
  "10": { name: "Morocco", code: "ma" },
  "11": { name: "Haiti", code: "ht" },
  "12": { name: "Scotland", code: "gb-sct" },
  "13": { name: "United States", code: "us" },
  "14": { name: "Paraguay", code: "py" },
  "15": { name: "Australia", code: "au" },
  "16": { name: "Turkey", code: "tr" },
  "17": { name: "Germany", code: "de" },
  "18": { name: "Curaçao", code: "cw" },
  "19": { name: "Ivory Coast", code: "ci" },
  "20": { name: "Ecuador", code: "ec" },
  "21": { name: "Netherlands", code: "nl" },
  "22": { name: "Japan", code: "jp" },
  "23": { name: "Sweden", code: "se" },
  "24": { name: "Tunisia", code: "tn" },
  "25": { name: "Belgium", code: "be" },
  "26": { name: "Egypt", code: "eg" },
  "27": { name: "Iran", code: "ir" },
  "28": { name: "New Zealand", code: "nz" },
  "29": { name: "Spain", code: "es" },
  "30": { name: "Cape Verde", code: "cv" },
  "31": { name: "Saudi Arabia", code: "sa" },
  "32": { name: "Uruguay", code: "uy" },
  "33": { name: "France", code: "fr" },
  "34": { name: "Senegal", code: "sn" },
  "35": { name: "Iraq", code: "iq" },
  "36": { name: "Norway", code: "no" },
  "37": { name: "Argentina", code: "ar" },
  "38": { name: "Algeria", code: "dz" },
  "39": { name: "Austria", code: "at" },
  "40": { name: "Jordan", code: "jo" },
  "41": { name: "Portugal", code: "pt" },
  "42": { name: "DR Congo", code: "cd" },
  "43": { name: "Uzbekistan", code: "uz" },
  "44": { name: "Colombia", code: "co" },
  "45": { name: "England", code: "gb-eng" },
  "46": { name: "Croatia", code: "hr" },
  "47": { name: "Ghana", code: "gh" },
  "48": { name: "Panama", code: "pa" },
};

function normalizeTeamName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const NAME_TO_CODE: Record<string, string> = Object.values(TEAM_INFO).reduce(
  (acc, t) => {
    acc[normalizeTeamName(t.name)] = t.code;
    return acc;
  },
  {} as Record<string, string>
);

function getTeamCode(name: string): string | undefined {
  return NAME_TO_CODE[normalizeTeamName(name)];
}

function Flag({ name, dim, size = "sm" }: { name: string; dim?: boolean; size?: "sm" | "md" }) {
  const code = getTeamCode(name);
  const dims = size === "md" ? "w-7 h-5" : "w-6 h-[18px]";

  if (!code) {
    return (
      <div
        className={`${dims} shrink-0 rounded-xs border border-[#1B2D21] bg-[#0A1610] flex items-center justify-center transition-opacity ${
          dim ? "opacity-45" : "opacity-100"
        }`}
        aria-hidden
      >
        <span className="text-[8px] font-bold text-[#2D3F33]">{name.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div
      className={`${dims} shrink-0 rounded-xs overflow-hidden border border-[#1B2D21] bg-[#0A1610] transition-opacity ${
        dim ? "opacity-45" : "opacity-100"
      }`}
    >
      {/* plain <img>, not next/image, so this works without remotePatterns config */}
      <Image
             src={`https://flagcdn.com/w40/${code}.png`}
             alt={`${name} flag`}
             width={28}
             height={20}
             loading="lazy"
             decoding="async"
             className="w-full h-full object-cover"
           />
    </div>
  );
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
        (m) => m.homeTeam.toLowerCase().includes(q) || m.awayTeam.toLowerCase().includes(q)
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

  const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2393A696' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

  return (
    <section>
      {/* Local styles: accordion reveal + focus rings, kept out of the JSX for readability */}
      <style>{`
        details.match-card > .match-card-body {
          animation: match-card-reveal 0.18s ease-out;
        }
        @keyframes match-card-reveal {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          details.match-card > .match-card-body { animation: none; }
        }
        .focus-ring:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px #060D09, 0 0 0 4px #2ED47E;
        }
      `}</style>

      <div className="flex items-center justify-between mb-5 gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696]">
          Full-Time Results
        </h2>
        <div className="flex items-center gap-3">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="focus-ring text-[10px] font-bold uppercase tracking-widest text-[#93A696] hover:text-[#2ED47E] transition-colors"
            >
              Clear filters
            </button>
          )}
          <span className="text-xs font-mono text-[#93A696] tabular-nums">
            <span className={filtered.length < matches.length ? "text-[#2ED47E]" : ""}>
              {filtered.length}
            </span>
            {" / "}
            {matches.length}
          </span>
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="space-y-3 mb-5">
        <div className="flex gap-2">
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
              aria-label="Search matches by team"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus-ring w-full bg-[#0A1610] border border-[#1B2D21] text-[#EFF5EE] text-sm pl-8 pr-8 py-2.5 placeholder:text-[#2D3F33] focus:outline-none focus:border-[#2ED47E]/60 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="focus-ring absolute right-3 top-1/2 -translate-y-1/2 text-[#93A696] hover:text-[#EFF5EE] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="hidden sm:block relative">
            <label htmlFor="match-sort" className="sr-only">
              Sort matches
            </label>
            <select
              id="match-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="focus-ring bg-[#0A1610] border border-[#1B2D21] text-[#93A696] text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-2.5 pr-8 focus:outline-none focus:border-[#2ED47E]/60 transition-colors cursor-pointer appearance-none"
              style={{ backgroundImage: chevronBg, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="most-goals">Most goals</option>
              <option value="fewest-goals">Fewest goals</option>
            </select>
          </div>
          <div className="flex border border-[#1B2D21] shrink-0" role="group" aria-label="Choose layout">
            <button
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              className={`focus-ring px-3 py-2.5 transition-colors ${
                view === "grid" ? "bg-[#1B2D21] text-[#2ED47E]" : "bg-[#0A1610] text-[#93A696] hover:text-[#EFF5EE]"
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
              aria-pressed={view === "list"}
              aria-label="List view"
              className={`focus-ring px-3 py-2.5 border-l border-[#1B2D21] transition-colors ${
                view === "list" ? "bg-[#1B2D21] text-[#2ED47E]" : "bg-[#0A1610] text-[#93A696] hover:text-[#EFF5EE]"
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
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
          <button
            onClick={() => setStage("all")}
            aria-pressed={stage === "all"}
            className={`focus-ring shrink-0 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors ${
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
                aria-pressed={active}
                className={`focus-ring shrink-0 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border transition-colors ${
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
      </div>

      {filtered.length === 0 && (
        <div className="border border-[#1B2D21] bg-[#0A1610] py-16 flex flex-col items-center gap-4 text-center px-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-[#2D3F33]" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <p className="text-sm text-[#93A696]">
            {search.trim() ? (
              <>No matches for “{search.trim()}”{stage !== "all" ? ` in ${formatStage(stage)}` : ""}</>
            ) : stage !== "all" ? (
              <>No {formatStage(stage)} matches yet</>
            ) : (
              "No matches found"
            )}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="focus-ring text-[11px] font-bold uppercase tracking-widest text-[#2ED47E] border border-[#2ED47E]/40 px-4 py-2 hover:bg-[#2ED47E]/10 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {filtered.length > 0 && view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((match) => {
            const result = matchResult(match.homeScore, match.awayScore, match.homePenaltyScore, match.awayPenaltyScore);
            const hasPenalties = match.homePenaltyScore != null && match.awayPenaltyScore != null;

            const homePoints = parseBreakdown(match.homePointsBreakdown);
            const awayPoints = parseBreakdown(match.awayPointsBreakdown);
            const homeTotal = homePoints.reduce((sum, p) => sum + p.points, 0);
            const awayTotal = awayPoints.reduce((sum, p) => sum + p.points, 0);

            return (
              <details
                key={match.id}
                className="match-card group border border-[#1B2D21] bg-[#0D1B13] flex flex-col hover:border-[#2ED47E]/30 transition-colors"
              >
                <summary className="focus-ring p-4 list-none cursor-pointer">
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2ED47E] truncate">
                      {formatStage(match.matchType ?? "other")}
                    </span>
                    <span className="text-[10px] font-mono text-[#93A696] shrink-0">{fmtDate(match.matchDate)}</span>
                  </div>

                  {/* Scoreline */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Flag name={match.homeTeam} dim={result === "away"} />
                        <span
                          className={`text-sm font-semibold truncate ${
                            result === "home" ? "text-[#EFF5EE]" : "text-[#93A696]"
                          }`}
                        >
                          {match.homeTeam}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5 shrink-0">
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
                      <div className="flex items-center gap-2 min-w-0">
                        <Flag name={match.awayTeam} dim={result === "home"} />
                        <span
                          className={`text-sm font-semibold truncate ${
                            result === "away" ? "text-[#EFF5EE]" : "text-[#93A696]"
                          }`}
                        >
                          {match.awayTeam}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5 shrink-0">
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

                  {/* Bottom indicator */}
                  <div className="flex justify-between items-center pt-3 mt-1">
                    <span className="text-[9px] text-[#93A696] uppercase tracking-widest flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      View Points{" "}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="w-3 h-3 transition-transform group-open:rotate-180"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-bold tracking-[0.15em] text-[#93A696] border border-[#1B2D21] px-1.5 py-0.5">
                      {hasPenalties ? "FT · PENS" : result === "draw" ? "FT · DRAW" : "FT"}
                    </span>
                  </div>
                </summary>

                {/* Expanded Points Breakdown Receipt */}
                <div className="match-card-body bg-[#060D09] border-t border-[#1B2D21] p-4 text-xs font-mono">
                  {/* Home Points */}
                  <div className="mb-4">
                    <div className="flex justify-between border-b border-[#1B2D21] pb-1 mb-2 text-[#93A696] font-bold font-sans uppercase tracking-widest text-[10px]">
                      <span className="truncate pr-2">{match.homeTeam} Points</span>
                      <span className="text-[#2ED47E] shrink-0">{homeTotal} PTS</span>
                    </div>
                    {homePoints.length > 0 ? (
                      <div className="space-y-1.5">
                        {homePoints.map((pt, i) => (
                          <div key={i} className="flex justify-between text-[#EFF5EE]">
                            <span className="truncate pr-2">{pt.description}</span>
                            <span className="shrink-0 text-[#93A696]">+{pt.points}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#2D3F33]">0 Points Earned</span>
                    )}
                  </div>

                  {/* Away Points */}
                  <div>
                    <div className="flex justify-between border-b border-[#1B2D21] pb-1 mb-2 text-[#93A696] font-bold font-sans uppercase tracking-widest text-[10px]">
                      <span className="truncate pr-2">{match.awayTeam} Points</span>
                      <span className="text-[#2ED47E] shrink-0">{awayTotal} PTS</span>
                    </div>
                    {awayPoints.length > 0 ? (
                      <div className="space-y-1.5">
                        {awayPoints.map((pt, i) => (
                          <div key={i} className="flex justify-between text-[#EFF5EE]">
                            <span className="truncate pr-2">{pt.description}</span>
                            <span className="shrink-0 text-[#93A696]">+{pt.points}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#2D3F33]">0 Points Earned</span>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {filtered.length > 0 && view === "list" && (
        <div className="border border-[#1B2D21] divide-y divide-[#1B2D21]">
          <div className="hidden md:grid grid-cols-[90px_1fr_120px_1fr_120px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] bg-[#060D09]">
            <div>Date</div>
            <div>Home</div>
            <div className="text-center">Score</div>
            <div>Away</div>
            <div className="text-right">Stage</div>
          </div>

          {filtered.map((match) => {
            const result = matchResult(match.homeScore, match.awayScore, match.homePenaltyScore, match.awayPenaltyScore);
            return (
              <div key={match.id} className="hover:bg-[#0D1B13] transition-colors">
                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-[90px_1fr_120px_1fr_120px] items-center px-4 py-3 gap-x-3">
                  <span className="font-mono text-[11px] text-[#93A696] tabular-nums">{fmtDate(match.matchDate)}</span>
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Flag name={match.homeTeam} dim={result === "away"} />
                    <span className={`text-sm font-semibold truncate ${result === "home" ? "text-[#EFF5EE]" : "text-[#93A696]"}`}>
                      {match.homeTeam}
                    </span>
                  </div>
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
                  <div className="flex items-center gap-2 min-w-0 pl-2 justify-end text-right">
                    <span className={`text-sm font-semibold truncate ${result === "away" ? "text-[#EFF5EE]" : "text-[#93A696]"}`}>
                      {match.awayTeam}
                    </span>
                    <Flag name={match.awayTeam} dim={result === "home"} />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#2ED47E]">
                      {formatStage(match.matchType ?? "other")}
                    </span>
                  </div>
                </div>

                {/* Mobile row — previously missing entirely */}
                <div className="md:hidden flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2ED47E]">
                      {formatStage(match.matchType ?? "other")}
                    </span>
                    <span className="text-[10px] font-mono text-[#93A696]">{fmtDate(match.matchDate)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Flag name={match.homeTeam} dim={result === "away"} />
                      <span className={`text-sm font-semibold truncate ${result === "home" ? "text-[#EFF5EE]" : "text-[#93A696]"}`}>
                        {match.homeTeam}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      {match.homePenaltyScore != null && (
                        <span className="text-[10px] text-[#93A696] font-bold">({match.homePenaltyScore})</span>
                      )}
                      <span
                        className={`font-mono font-black text-base tabular-nums ${
                          result === "home" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                        }`}
                      >
                        {match.homeScore ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Flag name={match.awayTeam} dim={result === "home"} />
                      <span className={`text-sm font-semibold truncate ${result === "away" ? "text-[#EFF5EE]" : "text-[#93A696]"}`}>
                        {match.awayTeam}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      {match.awayPenaltyScore != null && (
                        <span className="text-[10px] text-[#93A696] font-bold">({match.awayPenaltyScore})</span>
                      )}
                      <span
                        className={`font-mono font-black text-base tabular-nums ${
                          result === "away" ? "text-[#2ED47E]" : "text-[#EFF5EE]"
                        }`}
                      >
                        {match.awayScore ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}