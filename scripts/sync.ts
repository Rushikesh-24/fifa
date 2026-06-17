/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../db/index";
import { matchRecords, participants, selectedTeams, systemState } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

async function runEngine() {
  try {
    console.log("Authenticating with World Cup API...");

    // 1. FETCH AUTH TOKEN
    const authRes = await fetch("https://worldcup26.ir/auth/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Origin": "https://worldcup26.ir",
        "Referer": "https://worldcup26.ir/"
      },
      body: JSON.stringify({
        email: process.env.API_EMAIL,
        password: process.env.API_PASSWORD,
      }),
    });

    if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status}`);
    const authData = await authRes.json();
    const token = authData.token;

    console.log("Token secured. Fetching games...");

    // 2. FETCH GAMES
    const gamesRes = await fetch("https://worldcup26.ir/get/games", {
      headers: {
        "Authorization": `Bearer ${token}`, 
        "accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Origin": "https://worldcup26.ir",
        "Referer": "https://worldcup26.ir/"
      }
    });

    if (!gamesRes.ok) throw new Error(`Games fetch failed: ${gamesRes.status}`);
    const data = await gamesRes.json();
    const games = data.games;

    const finishedGames = games.filter((g: any) => g.finished === "TRUE");
    const alreadyProcessed = await db.select({ id: matchRecords.id }).from(matchRecords);
    const processedIds = alreadyProcessed.map((m) => m.id);
    const gamesToProcess = finishedGames.filter((g: any) => !processedIds.includes(g.id));

    if (gamesToProcess.length === 0) {
      await updateSystemSyncTime();
      console.log("✅ No new finished games. Sync time updated.");
      process.exit(0);
    }

    for (const match of gamesToProcess) {
      const homeTeam = match.home_team_name_en || match.home_team_label || "Unknown Team";
      const awayTeam = match.away_team_name_en || match.away_team_label || "Unknown Team";
      const homeScore = parseInt(match.home_score) || 0;
      const awayScore = parseInt(match.away_score) || 0;

      const homePoints = calculatePoints(homeScore, awayScore, match.home_scorers, match.type);
      const awayPoints = calculatePoints(awayScore, homeScore, match.away_scorers, match.type);

      await distributePointsToUsers(homeTeam, homePoints);
      await distributePointsToUsers(awayTeam, awayPoints);

      await db.insert(matchRecords).values({
        id: match.id,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        homeScorers: match.home_scorers || "",
        awayScorers: match.away_scorers || "",
        matchType: match.type || "group",
        finished: "TRUE",
        processedForPoints: true,
        matchDate: match.local_date ? new Date(match.local_date).toISOString() : new Date().toISOString(),
      });
    }

    await updateSystemSyncTime();
    console.log(`✅ Successfully processed ${gamesToProcess.length} games!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Engine Error:", error);
    process.exit(1);
  }
}

// --- HELPER FUNCTIONS ---
async function updateSystemSyncTime() {
  await db.insert(systemState)
    .values({ id: 1, lastSyncAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: systemState.id, set: { lastSyncAt: new Date().toISOString() } });
}

function calculatePoints(teamScore: number, opponentScore: number, scorersString: string, matchType: string) {
  let points = teamScore * 10;
  if (teamScore >= 5) points += 25;
  else if (teamScore === 3 || teamScore === 4) points += 10;
  if (teamScore > opponentScore && opponentScore === 0) points += 25;
  if (teamScore > opponentScore && (teamScore - opponentScore) >= 3) points += 25;
  if (hasHatTrick(scorersString)) points += 50;
  
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
  const rawArray = scorersString.replace(/^[{"“]+|[}"”]+$/g, '').split(/","|"”,”“"/);
  const playerGoalCounts: Record<string, number> = {};
  for (const event of rawArray) {
    if (event.includes("(OG)")) continue;
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
  const teamsToUpdate = await db.select().from(selectedTeams).where(eq(selectedTeams.teamName, teamName));
  for (const team of teamsToUpdate) {
    await db.update(selectedTeams).set({ pointsEarned: team.pointsEarned + pointsEarned }).where(eq(selectedTeams.id, team.id));
  }
  const participantIds = teamsToUpdate.map((t) => t.participantId);
  if (participantIds.length > 0) {
    const users = await db.select({ id: participants.id, totalPoints: participants.totalPoints }).from(participants).where(inArray(participants.id, participantIds));
    for (const user of users) {
      await db.update(participants).set({ totalPoints: user.totalPoints + pointsEarned }).where(eq(participants.id, user.id));
    }
  }
}

runEngine();