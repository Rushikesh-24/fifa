/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { db } from "../../db/index";
import { groupStandingsCache } from "../../db/schema";
import { eq } from "drizzle-orm";
import { Flag } from "@/components/Flag";

// Revalidate the Vercel cache every hour (60 seconds)
export const revalidate = 60;

// team_id → display name + ISO 3166-1 alpha-2 code (flagcdn.com convention,
// including the gb-eng / gb-sct subdivision flags it supports for the Home Nations)
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


export default async function GroupsPage() {
  let groups: any[] = [];
  let errorMsg: string | null = null;
  let lastUpdated: Date | null = null;

  try {
    // Read the cached JSON directly from Turso
    const cacheRecord = await db.select().from(groupStandingsCache).where(eq(groupStandingsCache.id, 1));

    if (cacheRecord.length > 0) {
      groups = JSON.parse(cacheRecord[0].data);
      lastUpdated = new Date(cacheRecord[0].updatedAt as string);

      // Sort groups alphabetically (A, B, C...)
      groups.sort((a: any, b: any) => a.name.localeCompare(b.name));
    } else {
      errorMsg = "Standings have not been synced yet. Please run the sync script.";
    }
  } catch (error: any) {
    console.error("Database Read Error:", error);
    errorMsg = "Unable to load group standings from the database.";
  }

  return (
    <main className="min-h-screen bg-[#060D09] text-[#EFF5EE] font-sans selection:bg-[#2ED47E]/30">
      {/* Floodlight glow — consistent with the rest of the app */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(46,212,126,0.14),transparent)]"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16 pb-24 space-y-10">

        {/* TICKER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1B2D21] pb-6">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2ED47E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ED47E]" />
            FIFA World Cup 2026 · Group Stage
          </span>

          {/* Back button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#93A696] border border-[#1B2D21] px-4 py-2 hover:border-[#2ED47E]/50 hover:text-[#2ED47E] transition-colors group"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
              aria-hidden
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Manager Leaderboard
          </Link>
        </div>

        {/* HERO */}
        <header>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight leading-[0.95]">
            Standings
          </h1>
          <p className="mt-3 text-base md:text-lg text-[#93A696] max-w-xl">
            Official group stage tables. Top two in every group advance to the knockout rounds.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#93A696] border border-[#1B2D21] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2ED47E]" />
              Top 2 advance
            </span>
            {groups.length > 0 && (
              <span className="text-[11px] font-mono text-[#93A696] tabular-nums">
                {groups.length} groups
              </span>
            )}
            {lastUpdated && (
              <span className="text-[11px] font-mono text-[#93A696]">
                Synced {lastUpdated.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </header>

        {/* ERROR */}
        {errorMsg && (
          <div className="border border-red-500/30 bg-red-500/6 text-red-400 px-5 py-4 text-sm">
            {errorMsg}
          </div>
        )}

        {/* GROUPS GRID */}
        {groups.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {groups.map((group: any) => {
              const sortedTeams = [...group.teams].sort((a, b) => {
                if (parseInt(b.pts) !== parseInt(a.pts)) return parseInt(b.pts) - parseInt(a.pts);
                if (parseInt(b.gd) !== parseInt(a.gd)) return parseInt(b.gd) - parseInt(a.gd);
                return parseInt(b.gf) - parseInt(a.gf);
              });

              return (
                <div key={group._id} className="border border-[#1B2D21] bg-[#0A1610] flex flex-col">
                  {/* Card header */}
                  <div className="bg-[#060D09] px-5 py-3 border-b border-[#1B2D21] flex justify-between items-center">
                    <h3 className="text-sm font-black uppercase tracking-widest">Group {group.name}</h3>
                    <span className="text-[10px] font-mono text-[#93A696] tabular-nums">
                      {sortedTeams.length} teams
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-widest text-[#93A696] border-b border-[#1B2D21]">
                          <th className="pl-4 pr-2 py-2.5 w-7 text-center font-bold">#</th>
                          <th className="px-2 py-2.5 font-bold">Team</th>
                          <th className="px-2 py-2.5 text-center font-bold" title="Matches Played">MP</th>
                          <th className="px-2 py-2.5 text-center font-bold hidden sm:table-cell" title="Wins">W</th>
                          <th className="px-2 py-2.5 text-center font-bold hidden sm:table-cell" title="Draws">D</th>
                          <th className="px-2 py-2.5 text-center font-bold hidden sm:table-cell" title="Losses">L</th>
                          <th className="px-2 py-2.5 text-center font-bold" title="Goal Difference">GD</th>
                          <th className="pl-2 pr-4 py-2.5 text-center font-bold text-[#2ED47E]" title="Points">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1B2D21]">
                        {sortedTeams.map((team: any, index: number) => {
                          const info = TEAM_INFO[team.team_id];
                          const teamName = info?.name ?? `Team ${team.team_id}`;
                          const isAdvancing = index < 2;

                          return (
                            <tr
                              key={team._id}
                              className={`hover:bg-[#0D1B13] transition-colors border-l-4 ${
                                isAdvancing ? "border-l-[#2ED47E]" : "border-l-transparent"
                              }`}
                            >
                              <td className="pl-4 pr-2 py-2.5 text-center">
                                <span
                                  className={`font-mono font-bold tabular-nums ${
                                    isAdvancing ? "text-[#2ED47E]" : "text-[#93A696]"
                                  }`}
                                >
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Flag name={teamName} />
                                  <span className="font-semibold whitespace-nowrap truncate">{teamName}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono text-[#93A696] tabular-nums">
                                {team.mp}
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono text-[#93A696] tabular-nums hidden sm:table-cell">
                                {team.w}
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono text-[#93A696] tabular-nums hidden sm:table-cell">
                                {team.d}
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono text-[#93A696] tabular-nums hidden sm:table-cell">
                                {team.l}
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono tabular-nums">
                                {team.gd}
                              </td>
                              <td className="pl-2 pr-4 py-2.5 text-center font-mono font-black text-base text-[#2ED47E] tabular-nums">
                                {team.pts}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}