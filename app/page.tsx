import { db } from "../db/index";
import { participants, selectedTeams, systemState, matchRecords } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import PlayerAvatar from "../components/PlayerAvatar";
import SyncStatus from "../components/SyncStatus";

export const revalidate = 60;

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

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4 md:p-12 font-sans pb-24">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="text-center md:text-left pt-8">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-cyan-400">
            FIFA World Cup 2026
          </h1>
          <h2 className="text-xl md:text-2xl text-neutral-400 font-medium">
            Fantasy League Leaderboard
          </h2>
        </header>

        <SyncStatus lastSyncIso={lastSyncAt} />

        {/* LEADERBOARD SECTION */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-neutral-950 border-b border-neutral-800 p-4 md:p-6 grid grid-cols-12 text-neutral-400 text-sm uppercase tracking-wider font-semibold">
            <div className="col-span-2 md:col-span-1 text-center">Rank</div>
            <div className="col-span-7 md:col-span-8">Manager (Click to view teams)</div>
            <div className="col-span-3 text-right">Points</div>
          </div>

          <div className="divide-y divide-neutral-800/50">
            {leaderboardData.map((player, index) => (
              <details key={player.id} className="group cursor-pointer">
                <summary className="list-none grid grid-cols-12 items-center p-4 md:p-6 hover:bg-neutral-800/30 transition-colors duration-200">
                  <div className="col-span-2 md:col-span-1 text-center font-bold text-xl">
                    <span className={
                      index === 0 ? "text-amber-400" : 
                      index === 1 ? "text-zinc-300" : 
                      index === 2 ? "text-amber-700" : "text-neutral-500"
                    }>
                      {index + 1}
                    </span>
                  </div>
                  
                  <div className="col-span-7 md:col-span-8 flex items-center gap-4">
                    <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-neutral-800 group-hover:border-neutral-600 transition-colors hidden sm:block">
                      <PlayerAvatar name={player.name} imageUrl={player.imageUrl} />
                    </div>
                    <div>
                      <p className="font-bold text-base md:text-lg">{player.name}</p>
                      <p className="text-xs text-emerald-500/70 group-open:hidden mt-0.5 font-medium">View point breakdown ↓</p>
                    </div>
                  </div>

                  <div className="col-span-3 text-right font-black font-mono text-xl md:text-2xl text-emerald-400">
                    {player.totalPoints}
                  </div>
                </summary>

                {/* THE EXPANDED TEAM BREAKDOWN */}
                <div className="bg-neutral-950/50 border-t border-neutral-800/50 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {player.teams.map((team, i) => (
                      <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col justify-between">
                        <span className="font-semibold text-neutral-300 text-sm mb-2">{team.name}</span>
                        <span className="text-2xl font-mono font-bold text-white">
                          {team.points} <span className="text-xs text-neutral-500 font-sans font-normal">pts</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* RECENT MATCHES SECTION */}
        {recentMatches.length > 0 && (
          <section className="pt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-neutral-200">All Processed Results</h3>
              <span className="text-sm font-medium text-emerald-500/80 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                {recentMatches.length} Matches Scored
              </span>
            </div>
            
            {/* Scrollable Container */}
            <div className="max-h-150 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentMatches.map((match) => (
                  <div key={match.id} className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl shadow-md flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold px-2 py-1 bg-neutral-800 rounded text-neutral-400 uppercase tracking-wider w-fit">
                          {match.matchType === "group" ? "Group Stage" : match.matchType}
                        </span>
                        {/* Displaying the newly added matchDate */}
                        <span className="text-xs text-neutral-500 font-medium pl-1">
                          {match.matchDate ? new Date(match.matchDate as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                        </span>
                      </div>
                      <span className="flex h-2 w-2 relative mt-1">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                    
                    <div className="space-y-3 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-lg truncate pr-2">{match.homeTeam}</span>
                        <span className="font-mono text-xl font-bold">{match.homeScore}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-lg truncate pr-2">{match.awayTeam}</span>
                        <span className="font-mono text-xl font-bold">{match.awayScore}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </div>
    </main>
  );
}