import Link from "next/link";
import { Flag } from "../../components/Flag";
import { GROUPS } from "../../components/groups";

// Keep this in sync with calculatePoints() in the sync/cron route — this
// page documents what that function actually does, not just the original
// rules writeup.
const SUBMISSION_DEADLINE = new Date("2026-06-12T00:00:00Z");

const GOAL_RULES = [
  { label: "Per Goal Scored", points: "+10", note: "Every goal your selected team scores, every match." },
];

const GOAL_BONUS_RULES = [
  { label: "3–4 Goals in a Match", points: "+10", note: "Flat bonus once a team hits 3 or 4 goals in one game." },
  { label: "5+ Goals in a Match", points: "+25", note: "Replaces the 3–4 goal bonus once a team reaches 5." },
];

const MATCH_BONUS_RULES = [
  { label: "Clean Sheet Win", points: "+25", note: "Team wins 1–0, 2–0, etc. — no goals conceded." },
  { label: "Win by 3+ Goals", points: "+25", note: "Margin of victory is 3 goals or more." },
  { label: "Hat-Trick", points: "+50", note: "Per player who scores 3+ goals in a match. Stacks if more than one player does it." },
];

const PROGRESSION_RULES = [
  { label: "Win Round of 32", points: "+25", note: "Advances your team to the Round of 16." },
  { label: "Win Round of 16", points: "+25", note: "Advances your team to the Quarter-Final." },
  { label: "Win Quarter-Final", points: "+50", note: "Advances your team to the Semi-Final." },
  { label: "Win Semi-Final", points: "+75", note: "Advances your team to the Final." },
  { label: "Win the Final", points: "+200", note: "Your team is crowned World Cup Champion." },
];

function formatDeadline(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function RuleTable({
  rows,
}: {
  rows: { label: string; points: string; note: string }[];
}) {
  return (
    <div className="border border-[#1B2D21] divide-y divide-[#1B2D21]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-4 px-4 md:px-6 py-3.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#EFF5EE]">{row.label}</p>
            <p className="text-[11px] text-[#93A696] mt-0.5">{row.note}</p>
          </div>
          <span className="font-mono font-black text-lg text-[#2ED47E] tabular-nums shrink-0">{row.points}</span>
        </div>
      ))}
    </div>
  );
}

export default function RulesPage() {
  const now = new Date();
  const isClosed = now >= SUBMISSION_DEADLINE;
  const daysLeft = Math.ceil((SUBMISSION_DEADLINE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <main className="min-h-screen bg-[#060D09] text-[#EFF5EE] font-sans selection:bg-[#2ED47E]/30">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,rgba(46,212,126,0.14),transparent)]"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16 pb-24 space-y-12">
        {/* HERO */}
        <header>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2ED47E] mb-3">
                FIFA World Cup 2026 Fantasy League
              </p>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-[0.95]">
                League Rules
              </h1>
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

          {/* Deadline status */}
          <div
            className={`mt-6 border px-4 md:px-6 py-3.5 flex items-center gap-3 ${
              isClosed ? "border-[#1B2D21] bg-[#0A1610]" : "border-[#2ED47E]/30 bg-[#0A1610]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${isClosed ? "bg-[#93A696]" : "bg-[#2ED47E] animate-pulse"}`} aria-hidden />
            <p className="text-sm text-[#93A696]">
              {isClosed ? (
                <>
                  Team selection <span className="text-[#EFF5EE] font-semibold">closed</span> on{" "}
                  {formatDeadline(SUBMISSION_DEADLINE)}. Squads are locked for the rest of the tournament.
                </>
              ) : (
                <>
                  Team selection closes <span className="text-[#EFF5EE] font-semibold">{formatDeadline(SUBMISSION_DEADLINE)}</span>{" "}
                  — {daysLeft} day{daysLeft === 1 ? "" : "s"} left to submit.
                </>
              )}
            </p>
          </div>
        </header>

        {/* TEAM SELECTION */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696] mb-2">Team Selection</h2>
          <p className="text-sm text-[#93A696] mb-5">
            Each participant selects 5 national teams: 2 from Group A, 2 from Group B, 1 from Group C. Once
            submitted, teams cannot be changed.
          </p>

          <div className="space-y-3">
            {GROUPS.map((g) => (
              <details key={g.key} className="group border border-[#1B2D21] bg-[#0D1B13]" open={false}>
                <summary className="p-4 list-none cursor-pointer flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2ED47E]">
                    {g.label} <span className="text-[#93A696] normal-case font-normal">— select {g.pick}</span>
                  </p>
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
                <div className="border-t border-[#1B2D21] p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {g.teams.map((name) => (
                    <div key={name} className="flex items-center gap-2 min-w-0">
                      <Flag name={name} />
                      <span className="text-sm text-[#EFF5EE] truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* SCORING: GOALS */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696] mb-4">Goal Scoring</h2>
          <RuleTable rows={GOAL_RULES} />
        </section>

        {/* SCORING: GOAL BONUSES */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696] mb-4">Goal Bonuses</h2>
          <RuleTable rows={GOAL_BONUS_RULES} />
        </section>

        {/* SCORING: MATCH BONUSES */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696] mb-4">Match Bonuses</h2>
          <RuleTable rows={MATCH_BONUS_RULES} />
        </section>

        {/* SCORING: PROGRESSION */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#93A696] mb-2">
            Tournament Progression
          </h2>
          <p className="text-sm text-[#93A696] mb-5">
            Awarded when your team wins the match that sends them to the next round. Group-stage wins don&apos;t carry a
            progression bonus on their own — only knockout-round wins do.
          </p>
          <RuleTable rows={PROGRESSION_RULES} />
        </section>

        <p className="text-[11px] text-[#2D3F33] text-center pt-4">
          The winner is the participant with the highest total points when the tournament ends.
        </p>
      </div>
    </main>
  );
}