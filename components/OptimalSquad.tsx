// components/OptimalSquad.tsx
import { Flag } from "./Flag";

export type TeamStat = { name: string; points: number; played: number; goals: number };

// Group membership per the draft rules (2 from A, 2 from B, 1 from C).
// Names are spelled to match TEAM_INFO in Flag.tsx exactly, so flag lookup
// always resolves.
const GROUP_A = ["Argentina", "France", "Spain", "England", "Brazil", "Portugal", "Germany", "Netherlands"];

const GROUP_B = [
  "Morocco", "Colombia", "Croatia", "Uruguay", "Japan", "United States", "Mexico", "Belgium",
  "Switzerland", "Senegal", "South Korea", "Austria", "Turkey", "Ecuador", "Canada", "Algeria",
  "Sweden", "Norway", "Egypt", "Australia",
];

const GROUP_C = [
  "Saudi Arabia", "Iran", "Iraq", "Qatar", "Ivory Coast", "South Africa", "Ghana", "Tunisia",
  "Czech Republic", "Scotland", "Panama", "New Zealand", "Bosnia and Herzegovina", "DR Congo",
  "Haiti", "Curaçao", "Cape Verde", "Jordan", "Uzbekistan", "Paraguay",
];

const GROUPS = [
  { key: "A", label: "Group A · Elite Favourites", teams: GROUP_A, pick: 2 },
  { key: "B", label: "Group B · Strong Contenders", teams: GROUP_B, pick: 2 },
  { key: "C", label: "Group C · Underdogs & Dark Horses", teams: GROUP_C, pick: 1 },
] as const;

// Same tie-break rule used on the main leaderboard: points, then goals, then
// fewest matches played, so a team's rank here is always consistent with
// its rank on the leaderboard.
function compareTeams(a: TeamStat, b: TeamStat) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goals !== a.goals) return b.goals - a.goals;
  return a.played - b.played;
}

function resolveTeam(name: string, statsByName: Record<string, TeamStat>): TeamStat {
  return statsByName[name] ?? { name, points: 0, played: 0, goals: 0 };
}

export default function OptimalSquad({ statsByName }: { statsByName: Record<string, TeamStat> }) {
  const groupResults = GROUPS.map((g) => {
    const ranked = g.teams.map((name) => resolveTeam(name, statsByName)).sort(compareTeams);
    const picks = ranked.slice(0, g.pick);
    const subtotal = picks.reduce((sum, t) => sum + t.points, 0);
    return { ...g, ranked, picks, subtotal };
  });

  const maxPossible = groupResults.reduce((sum, g) => sum + g.subtotal, 0);
  const allPicks = groupResults.flatMap((g) => g.picks);

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696]">
          Optimal Draft <span className="text-[#2D3F33]">·</span> 2 / 2 / 1
        </h2>
        <p className="mt-1.5 text-[11px] text-[#93A696]">
          The highest-scoring squad possible under the draft rules, picked with hindsight. Ties broken by goals, then
          fewest matches played.
        </p>
      </div>

      {/* Hero: the best possible squad */}
      <div className="border border-[#2ED47E]/30 bg-[#0A1610] p-5 md:p-6 mb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_0%,rgba(46,212,126,0.10),transparent)]"
        />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-2">
              Best Possible 5-Team Squad
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {allPicks.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center gap-2 bg-[#0D1B13] border border-[#1B2D21] pl-2 pr-3 py-1.5"
                >
                  <Flag name={t.name} />
                  <span className="text-sm font-semibold text-[#EFF5EE] whitespace-nowrap">{t.name}</span>
                  <span className="text-xs font-mono text-[#2ED47E] font-bold">{t.points}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-left md:text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#93A696] mb-1">Max Possible Score</p>
            <p className="font-mono font-black text-4xl md:text-5xl tabular-nums text-[#2ED47E]">{maxPossible}</p>
          </div>
        </div>
      </div>

      {/* Per-group breakdown, expandable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {groupResults.map((g) => (
          <details key={g.key} className="group border border-[#1B2D21] bg-[#0D1B13]" open={true}>
            <summary className="p-4 list-none cursor-pointer flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2ED47E] mb-1 truncate">
                  {g.label}
                </p>
                <p className="text-[10px] text-[#93A696]">
                  Best {g.pick} of {g.teams.length} · {g.subtotal} pts
                </p>
              </div>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-3.5 h-3.5 text-[#93A696] transition-transform group-open:rotate-180 shrink-0"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-[#1B2D21] px-4 py-3 space-y-1 max-h-80 overflow-y-auto">
              {g.ranked.map((t, i) => {
                const isPick = i < g.pick;
                return (
                  <div
                    key={t.name}
                    className={`flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-xs ${isPick ? "bg-[#2ED47E]/10" : ""}`}
                  >
                    <span
                      className={`font-mono text-[11px] w-4 shrink-0 ${isPick ? "text-[#2ED47E] font-bold" : "text-[#2D3F33]"}`}
                    >
                      {i + 1}
                    </span>
                    <Flag name={t.name} dim={!isPick} />
                    <span
                      className={`text-sm truncate flex-1 min-w-0 ${isPick ? "text-[#EFF5EE] font-semibold" : "text-[#93A696]"}`}
                    >
                      {t.name}
                    </span>
                    <span
                      className={`font-mono text-xs tabular-nums shrink-0 ${isPick ? "text-[#2ED47E] font-bold" : "text-[#93A696]"}`}
                    >
                      {t.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}