import Link from "next/link";
import { db } from "../db/index";
import { participants, selectedTeams, systemState, matchRecords } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import PlayerAvatar from "../components/PlayerAvatar";
import SyncStatus from "../components/SyncStatus";
import MatchesSection from "../components/MatchesSection";

export const revalidate = 60;

function rankStripe(index: number) {
  if (index === 0) return "border-l-[#E8B23C]"; // gold
  if (index === 1) return "border-l-[#C9D2D8]"; // silver
  if (index === 2) return "border-l-[#C0763F]"; // bronze
  return "border-l-transparent";
}

function rankColor(index: number) {
  if (index === 0) return "text-[#E8B23C]";
  if (index === 1) return "text-[#C9D2D8]";
  if (index === 2) return "text-[#C0763F]";
  return "text-[#93A696]";
}

export default async function LeaderboardPage() {
  // 1. Fetch existing leaderboard data
  const players = await db.select().from(participants).orderBy(desc(participants.totalPoints));
  const allTeams = await db.select().from(selectedTeams);

  // 2. Fetch system state for the countdown timer
  const state = await db.select().from(systemState).where(eq(systemState.id, 1));
  const lastSyncAt = state.length > 0 ? state[0].lastSyncAt : null;

  // 3. Fetch ALL processed matches sorted by the ACTUAL game date (newest first)
  const recentMatches = await db
    .select()
    .from(matchRecords)
    .where(eq(matchRecords.processedForPoints, true))
    .orderBy(desc(matchRecords.matchDate));

  // 4. Map teams to players, including the pointsEarned property
  const leaderboardData = players.map((player) => {
    const playerTeams = allTeams
      .filter((team) => team.participantId === player.id)
      .map((t) => ({ name: t.teamName, points: t.pointsEarned }))
      .sort((a, b) => b.points - a.points); // Sort teams by highest points first
    return { ...player, teams: playerTeams };
  });

  const totalManagers = players.length;
  const leaderPoints = leaderboardData[0]?.totalPoints ?? 0;
  const avgPoints =
    totalManagers > 0
      ? Math.round(players.reduce((sum, p) => sum + (p.totalPoints ?? 0), 0) / totalManagers)
      : 0;

  return (
    <main className="min-h-screen bg-[#060D09] text-[#EFF5EE] font-sans selection:bg-[#2ED47E]/30">
      {/* one restrained atmospheric touch: floodlight glow from above the pitch */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(46,212,126,0.14),transparent)]"
      />

      <style>{`
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .row-enter { animation: rowIn 0.4s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .row-enter { animation: none; }
        }
      `}</style>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16 pb-24 space-y-14">
        {/* TICKER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1B2D21] pb-6">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2ED47E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ED47E]" />
            FIFA World Cup 2026 · Fantasy League
          </span>
          <SyncStatus lastSyncIso={lastSyncAt} />
        </div>

        {/* HERO */}
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight leading-[0.95]">
                Standings
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#93A696] max-w-xl">
                Every manager, ranked by total points. Tap a name to see how each squad is scoring.
              </p>
            </div>

            {/* ACTION LINKS GROUP */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3 shrink-0">
              <Link
                href="/groups"
                className="inline-flex items-center justify-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696] border border-[#1B2D21] px-4 py-2.5 hover:border-[#2ED47E]/50 hover:text-[#2ED47E] transition-colors group"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-3.5 h-3.5"
                  aria-hidden
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Group Stage Standings
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/teams"
                className="inline-flex items-center justify-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696] border border-[#1B2D21] px-4 py-2.5 hover:border-[#2ED47E]/50 hover:text-[#2ED47E] transition-colors group"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  className="w-3.5 h-3.5" 
                  aria-hidden
                >
                  <path d="M12 20v-8M6 20V8m12 12V4" />
                </svg>
                Nation Rankings
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* STAT STRIP */}
          <dl className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1B2D21] border border-[#1B2D21]">
            <div className="bg-[#060D09] px-4 md:px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">
                Managers
              </p>
              <p className="font-mono font-black text-2xl md:text-3xl tabular-nums">{totalManagers}</p>
            </div>
            <div className="bg-[#060D09] px-4 md:px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">
                Matches Scored
              </p>
              <p className="font-mono font-black text-2xl md:text-3xl tabular-nums">{recentMatches.length}</p>
            </div>
            <div className="bg-[#060D09] px-4 md:px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">
                Leader
              </p>
              <p className="font-mono font-black text-2xl md:text-3xl tabular-nums">
                {leaderPoints}
                <span className="text-xs ml-1 text-[#93A696] font-sans font-normal normal-case">pts</span>
              </p>
            </div>
            <div className="bg-[#060D09] px-4 md:px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">
                Average
              </p>
              <p className="font-mono font-black text-2xl md:text-3xl tabular-nums">
                {avgPoints}
                <span className="text-xs ml-1 text-[#93A696] font-sans font-normal normal-case">pts</span>
              </p>
            </div>
          </dl>
        </header>

        {/* LEAGUE TABLE */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696] mb-4">
            League Table
          </h2>

          <div className="border border-[#1B2D21]">
            <div className="grid grid-cols-12 px-4 md:px-6 py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696] border-b border-[#1B2D21]">
              <div className="col-span-2 md:col-span-1">Pos</div>
              <div className="col-span-6 md:col-span-8">Manager</div>
              <div className="col-span-3 md:col-span-2 text-right">Pts</div>
              <div className="col-span-1 md:col-span-1" />
            </div>

            <div className="divide-y divide-[#1B2D21]">
              {leaderboardData.map((player, index) => (
                <details
                  key={player.id}
                  className="group row-enter"
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                >
                  <summary
                    className={`list-none grid grid-cols-12 items-center gap-2 px-4 md:px-6 py-4 cursor-pointer border-l-4 transition-colors hover:bg-[#0D1B13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED47E]/60 ${rankStripe(index)}`}
                  >
                    <div className={`col-span-2 md:col-span-1 font-mono text-lg font-bold tabular-nums ${rankColor(index)}`}>
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="col-span-6 md:col-span-8 flex items-center gap-3 min-w-0">
                      <div className="relative w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full overflow-hidden border border-[#1B2D21] shrink-0">
                        <PlayerAvatar name={player.name} imageUrl={player.imageUrl} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm md:text-base truncate">{player.name}</p>
                        <p className="text-[11px] text-[#93A696] mt-0.5">
                          {player.teams.length} squad{player.teams.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-3 md:col-span-2 text-right font-mono font-black text-xl md:text-2xl tabular-nums">
                      {player.totalPoints}
                    </div>

                    <div className="col-span-1 md:col-span-1 flex justify-end">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="w-4 h-4 text-[#93A696] transition-transform duration-200 group-open:rotate-180"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </summary>

                  <div className="bg-[#0A1610] border-t border-[#1B2D21] px-4 md:px-6 py-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {player.teams.map((team, i) => (
                        <div key={i} className="border border-[#1B2D21] bg-[#060D09] px-3 py-3">
                          <p className="text-[11px] font-semibold text-[#93A696] uppercase tracking-wide truncate mb-1.5">
                            {team.name}
                          </p>
                          <p className="font-mono font-bold text-lg tabular-nums">
                            {team.points}
                            <span className="text-[10px] text-[#93A696] ml-1 font-sans font-normal normal-case">pts</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* RESULTS */}
        {recentMatches.length > 0 && (
          <MatchesSection matches={recentMatches} />
        )}
      </div>
    </main>
  );
}