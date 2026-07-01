// components/TeamLeaderboardTable.tsx
"use client";

import { useMemo, useState } from "react";
import { Flag } from "./Flag";

export type RankedTeam = {
  rank: number;
  name: string;
  points: number;
  played: number;
  goals: number;
};

function rankStripe(rank: number) {
  if (rank === 1) return "border-l-[#E8B23C]"; // gold
  if (rank === 2) return "border-l-[#C9D2D8]"; // silver
  if (rank === 3) return "border-l-[#C0763F]"; // bronze
  return "border-l-transparent";
}

function rankColor(rank: number) {
  if (rank === 1) return "text-[#E8B23C]";
  if (rank === 2) return "text-[#C9D2D8]";
  if (rank === 3) return "text-[#C0763F]";
  return "text-[#93A696]";
}

function Medal({ rank }: { rank: number }) {
  if (rank > 3) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`w-3 h-3 ${rankColor(rank)}`}
      aria-hidden
    >
      <path d="M12 2 9 8H4l4 4-2 8 6-4 6 4-2-8 4-4h-5z" />
    </svg>
  );
}

function ptsPerMatch(points: number, played: number) {
  if (played <= 0) return "0.0";
  return (points / played).toFixed(1);
}

export default function TeamLeaderboardTable({ teams }: { teams: RankedTeam[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, search]);

  if (teams.length === 0) {
    return (
      <div className="border border-[#1B2D21] bg-[#0A1610] py-16 flex flex-col items-center gap-4 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-[#2D3F33]" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <p className="text-sm text-[#93A696]">No match data available yet.</p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .row-enter { animation: rowIn 0.35s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .row-enter { animation: none; }
        }
      `}</style>

      {/* Search */}
      <div className="relative mb-3">
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
          placeholder="Search nation…"
          aria-label="Search nations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0A1610] border border-[#1B2D21] text-[#EFF5EE] text-sm pl-8 pr-8 py-2.5 placeholder:text-[#2D3F33] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED47E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060D09] focus:border-[#2ED47E]/60 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#93A696] hover:text-[#EFF5EE] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED47E] rounded-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="border border-[#1B2D21]">
        <div className="sticky top-0 z-10 grid grid-cols-12 px-4 md:px-6 py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696] border-b border-[#1B2D21] bg-[#0A1610]/95 backdrop-blur">
          <div className="col-span-2 md:col-span-1 text-center md:text-left">Pos</div>
          <div className="col-span-5 md:col-span-5">Nation</div>
          <div className="col-span-2 md:col-span-2 text-center" title="Matches Played">
            MP
          </div>
          <div className="col-span-3 md:col-span-4 text-right">Points</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center px-4">
            <p className="text-sm text-[#93A696]">No nations match “{search.trim()}”</p>
            <button
              onClick={() => setSearch("")}
              className="text-[11px] font-bold uppercase tracking-widest text-[#2ED47E] border border-[#2ED47E]/40 px-4 py-2 hover:bg-[#2ED47E]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED47E]"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1B2D21]">
            {filtered.map((team) => (
              <div
                key={team.name}
                className={`grid grid-cols-12 items-center gap-2 px-4 md:px-6 py-4 transition-colors hover:bg-[#0D1B13] border-l-4 row-enter ${rankStripe(
                  team.rank
                )}`}
                style={{ animationDelay: `${Math.min(team.rank - 1, 15) * 30}ms` }}
              >
                {/* Rank */}
                <div
                  className={`col-span-2 md:col-span-1 flex items-center justify-center md:justify-start gap-1.5 font-mono text-lg font-bold tabular-nums ${rankColor(
                    team.rank
                  )}`}
                >
                  <Medal rank={team.rank} />
                  {String(team.rank).padStart(2, "0")}
                </div>

                {/* Team Name */}
                <div className="col-span-5 md:col-span-5 flex items-center gap-2.5 min-w-0">
                  <Flag name={team.name} />
                  <div className="flex flex-col justify-center min-w-0">
                    <span className="font-bold text-sm md:text-base truncate text-[#EFF5EE]">{team.name}</span>
                    <span className="text-[10px] text-[#93A696] font-mono mt-0.5">{team.goals} Goals</span>
                  </div>
                </div>

                {/* Matches Played */}
                <div className="col-span-2 md:col-span-2 text-center font-mono text-sm text-[#93A696]">
                  {team.played}
                </div>

                {/* Total Points */}
                <div className="col-span-3 md:col-span-4 flex flex-col items-end">
                  <span className="font-mono font-black text-xl md:text-2xl tabular-nums text-[#2ED47E]">
                    {team.points}
                  </span>
                  <span className="text-[10px] text-[#93A696] font-mono mt-0.5">
                    {ptsPerMatch(team.points, team.played)} pts/match
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}