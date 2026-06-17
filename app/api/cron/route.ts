/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { db } from "../../../db/index";
import { matchRecords, participants, selectedTeams, systemState } from "../../../db/schema";
import { eq, inArray } from "drizzle-orm";
export const maxDuration = 240;
export async function GET(request: Request) {
  // Security: Allow Vercel Cron OR your custom Admin Secret
  const authHeader = request.headers.get("authorization");
  const adminSecret = request.headers.get("x-admin-secret");

  const isVercelCron = process.env.NODE_ENV === "production" && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdminManual = adminSecret === process.env.ADMIN_SECRET;

  if (!isVercelCron && !isAdminManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Authenticating with World Cup API...");

    // 1. FETCH THE AUTH TOKEN
    // 1. FETCH THE AUTH TOKEN
    const authRes = await fetch("https://worldcup26.ir/auth/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://worldcup26.ir",
        "Referer": "https://worldcup26.ir/"
      },
      body: JSON.stringify({
        email: process.env.API_EMAIL,
        password: process.env.API_PASSWORD,
      }),
    });

    if (!authRes.ok) {
      throw new Error(`Auth failed with status: ${authRes.status}`);
    }

    const authData = await authRes.json();
    const token = authData.token;

    if (!token) {
      throw new Error("Authentication succeeded but no token was returned.");
    }

    console.log("Token secured. Fetching games...");

   // 2. FETCH THE GAMES USING THE TOKEN
    const gamesRes = await fetch("https://worldcup26.ir/get/games", {
      headers: {
        "Authorization": `Bearer ${token}`, 
        "accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://worldcup26.ir",
        "Referer": "https://worldcup26.ir/"
      }
    });

    if (!gamesRes.ok) {
      throw new Error(`Games fetch failed with status: ${gamesRes.status}`);
    }

    const data = await gamesRes.json();
    const games = data.games; // Extract the array from inside the "games" object

    if (!games || !Array.isArray(games)) {
      throw new Error("API did not return a valid 'games' array.");
    }

    // 3. FILTER AND PROCESS GAMES
    // Only process games that are completely finished
    const finishedGames = games.filter((g: any) => g.finished === "TRUE");

    // Fetch matches we've already scored from Turso to prevent double counting
    const alreadyProcessed = await db.select({ id: matchRecords.id }).from(matchRecords);
    const processedIds = alreadyProcessed.map((m) => m.id);

    // Filter out games we've already processed
    const gamesToProcess = finishedGames.filter((g: any) => !processedIds.includes(g.id));

    if (gamesToProcess.length === 0) {
      // Still update the sync time even if no new games were found
      await updateSystemSyncTime();
      return NextResponse.json({ message: "No new finished games to process. Sync time updated." });
    }

    for (const match of gamesToProcess) {
      // Safely fallback to the label if the official English name is missing (Knockout stages)
      const homeTeam = match.home_team_name_en || match.home_team_label || "Unknown Team";
      const awayTeam = match.away_team_name_en || match.away_team_label || "Unknown Team";
      const homeScore = parseInt(match.home_score) || 0;
      const awayScore = parseInt(match.away_score) || 0;

      // --- CALCULATE POINTS ---
      const homePoints = calculatePoints(homeScore, awayScore, match.home_scorers, match.type);
      const awayPoints = calculatePoints(awayScore, homeScore, match.away_scorers, match.type);

      // --- DISTRIBUTE POINTS TO PARTICIPANTS ---
      await distributePointsToUsers(homeTeam, homePoints);
      await distributePointsToUsers(awayTeam, awayPoints);

      // --- RECORD THE MATCH AS PROCESSED ---
     await db.insert(matchRecords).values({
        id: match.id,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeScore: homeScore,
        awayScore: awayScore,
        homeScorers: match.home_scorers || "",
        awayScorers: match.away_scorers || "",
        matchType: match.type || "group",
        finished: "TRUE",
        processedForPoints: true,
        matchDate: match.local_date ? new Date(match.local_date).toISOString() : new Date().toISOString(),
      });
    }

    // --- UPDATE SYSTEM STATE FOR UI SYNC TIMER ---
    await updateSystemSyncTime();

    return NextResponse.json({ message: `Successfully processed ${gamesToProcess.length} games!` });
  } catch (error: any) {
    console.error("Cron Job Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// ----------------------------------------------------
// SCORING ENGINE HELPER FUNCTIONS
// ----------------------------------------------------

async function updateSystemSyncTime() {
  await db.insert(systemState)
    .values({ id: 1, lastSyncAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: systemState.id,
      set: { lastSyncAt: new Date().toISOString() }
    });
}

function calculatePoints(teamScore: number, opponentScore: number, scorersString: string, matchType: string) {
  let points = 0;

  // 1. Goals (+10 per goal)
  points += teamScore * 10;

  // 2. Goal Bonuses (does not stack, takes highest)
  if (teamScore >= 5) points += 25;
  else if (teamScore === 3 || teamScore === 4) points += 10;

  // 3. Defensive Bonus (+25 for win with clean sheet)
  if (teamScore > opponentScore && opponentScore === 0) points += 25;

  // 4. Winning Margin (+25 for winning by 3+ goals)
  if (teamScore > opponentScore && (teamScore - opponentScore) >= 3) points += 25;

  // 5. Hat-Trick Bonus (+50)
  if (hasHatTrick(scorersString)) points += 50;

  // 6. Tournament Progression (Awarded if they win the match)
  const isWinner = teamScore > opponentScore;
  if (isWinner) {
    if (matchType.includes("16")) points += 25; 
    if (matchType.includes("qf") || matchType.includes("quarter")) points += 50; 
    if (matchType.includes("sf") || matchType.includes("semi")) points += 75; 
    if (matchType.includes("final") && !matchType.includes("semi")) points += 200; 
  }

  return points;
}

function hasHatTrick(scorersString: string): boolean {
  if (!scorersString || scorersString === "null" || scorersString.length < 5) return false;
  
  // Clean string and split into an array of goal events
  const rawArray = scorersString.replace(/^[{"“]+|[}"”]+$/g, '').split(/","|"”,”“"/);
  
  const playerGoalCounts: Record<string, number> = {};
  
  for (const event of rawArray) {
    if (event.includes("(OG)")) continue; // Ignore own goals
    
    // Extract the player name (Everything before the minute number)
    const match = event.match(/^(.*?)\s\d/);
    if (match && match[1]) {
      const playerName = match[1].trim();
      playerGoalCounts[playerName] = (playerGoalCounts[playerName] || 0) + 1;
      if (playerGoalCounts[playerName] >= 3) return true;
    }
  }
  return false;
}

async function distributePointsToUsers(teamName: string, pointsEarned: number) {
  if (pointsEarned === 0) return;

  // 1. Find all instances of this team being selected
  const teamsToUpdate = await db
    .select()
    .from(selectedTeams)
    .where(eq(selectedTeams.teamName, teamName));

  // 2. Update the points specific to that team pick
  for (const team of teamsToUpdate) {
    await db
      .update(selectedTeams)
      .set({ pointsEarned: team.pointsEarned + pointsEarned })
      .where(eq(selectedTeams.id, team.id));
  }

  // 3. Update the total score for the participants who own those teams
  const participantIds = teamsToUpdate.map((t) => t.participantId);
  if (participantIds.length > 0) {
    const users = await db
      .select({ id: participants.id, totalPoints: participants.totalPoints })
      .from(participants)
      .where(inArray(participants.id, participantIds));

    for (const user of users) {
      await db
        .update(participants)
        .set({ totalPoints: user.totalPoints + pointsEarned })
        .where(eq(participants.id, user.id));
    }
  }
}