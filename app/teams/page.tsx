/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { db } from "../../db/index";
import { matchRecords } from "../../db/schema";
import { eq } from "drizzle-orm";
import { Flag } from "../../components/Flag";
import TeamLeaderboardTable, { RankedTeam } from "@/components/TeamLeaderboardTable";
import OptimalSquad from "@/components/OptimalSquad";

// Revalidate this page every 60 seconds
export const revalidate = 60;

export default async function TeamsLeaderboardPage() {
  // 1. Fetch all processed matches
  const matches = await db.select().from(matchRecords).where(eq(matchRecords.processedForPoints, true));

  // 2. Aggregate points, goals, and matches played for each real-world team
  const teamStats: Record<string, { name: string; points: number; played: number; goals: number }> = {};

  for (const match of matches) {
    // --- Process Home Team ---
    const home = match.homeTeam;
    if (!teamStats[home]) teamStats[home] = { name: home, points: 0, played: 0, goals: 0 };

    teamStats[home].played += 1;
    teamStats[home].goals += match.homeScore || 0;

    // Parse the JSON breakdown to get the exact points
    let homePts = 0;
    if (match.homePointsBreakdown) {
      try {
        const parsed = JSON.parse(match.homePointsBreakdown);
        homePts = parsed.reduce((sum: number, pt: any) => sum + pt.points, 0);
      } catch (e) {
        console.error("Failed to parse home breakdown", e);
      }
    }
    teamStats[home].points += homePts;

    // --- Process Away Team ---
    const away = match.awayTeam;
    if (!teamStats[away]) teamStats[away] = { name: away, points: 0, played: 0, goals: 0 };

    teamStats[away].played += 1;
    teamStats[away].goals += match.awayScore || 0;

    // Parse the JSON breakdown to get the exact points
    let awayPts = 0;
    if (match.awayPointsBreakdown) {
      try {
        const parsed = JSON.parse(match.awayPointsBreakdown);
        awayPts = parsed.reduce((sum: number, pt: any) => sum + pt.points, 0);
      } catch (e) {
        console.error("Failed to parse away breakdown", e);
      }
    }
    teamStats[away].points += awayPts;
  }

  // 3. Convert to array and sort (Primary: Points, Secondary: Goals Scored, Tertiary: Least Matches Played)
  const sortedTeams = Object.values(teamStats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.played - b.played;
  });

  // Attach the final rank once, up front, so filtering/searching in the table
  // never has to renumber positions.
  const rankedTeams: RankedTeam[] = sortedTeams.map((team, index) => ({
    ...team,
    rank: index + 1,
  }));

  const highestPoints = sortedTeams[0]?.points || 0;

  return (
    <main className="min-h-screen bg-[#060D09] text-[#EFF5EE] font-sans selection:bg-[#2ED47E]/30">
      {/* Background Glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(46,212,126,0.14),transparent)]"
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16 pb-24 space-y-12">
        {/* HERO HEADER */}
        <header>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.95]">
                Nation Rankings
              </h1>
              <p className="mt-3 text-base md:text-lg text-[#93A696] max-w-xl">
                The most valuable real-world teams in the tournament, ranked by absolute fantasy points generated.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696] border border-[#1B2D21] px-4 py-2.5 hover:border-[#2ED47E]/50 hover:text-[#2ED47E] transition-colors group shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED47E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060D09]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Manager Leaderboard
            </Link>
          </div>

          {/* STAT STRIP */}
          <dl className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1B2D21] border border-[#1B2D21]">
            <div className="bg-[#060D09] px-4 md:px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">
                Teams Tracked
              </p>
              <p className="font-mono font-black text-2xl md:text-3xl tabular-nums">{sortedTeams.length}</p>
            </div>
            <div className="bg-[#060D09] px-4 md:px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">
                Total Matches
              </p>
              <p className="font-mono font-black text-2xl md:text-3xl tabular-nums">{matches.length}</p>
            </div>
            <div className="bg-[#060D09] px-4 md:px-6 py-4 col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">
                Highest Scorer
              </p>
              {sortedTeams[0] ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <Flag name={sortedTeams[0].name} size="md" />
                  <p className="font-mono font-black text-2xl md:text-3xl tabular-nums text-[#2ED47E] truncate">
                    {sortedTeams[0].name}
                    <span className="text-sm ml-2 text-[#93A696] font-sans font-normal normal-case">
                      {highestPoints} pts
                    </span>
                  </p>
                </div>
              ) : (
                <p className="font-mono font-black text-2xl md:text-3xl tabular-nums text-[#2ED47E]">—</p>
              )}
            </div>
          </dl>
        </header>

        {/* OPTIMAL DRAFT */}
        <OptimalSquad statsByName={teamStats} />
        {/* TEAM LEADERBOARD TABLE */}
        <section>
          <TeamLeaderboardTable teams={rankedTeams} />
        </section>

      </div>
    </main>
  );
}