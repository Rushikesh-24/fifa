/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { db } from "../../../db/index";
import { matchRecords, participants, selectedTeams, systemState, groupStandingsCache } from "../../../db/schema";
import { eq, inArray } from "drizzle-orm";

export const maxDuration = 240;

// --- ROBUST FETCH WRAPPER WITH RETRY LOGIC ---
async function fetchWithRetry(url: string, options: any, maxRetries = 4) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.warn(`Attempt ${i + 1} failed for ${url} with status: ${res.status}`);
    } catch (error: any) {
      console.warn(`Attempt ${i + 1} network error for ${url}:`, error.message);
      if (i === maxRetries - 1) throw error; // Rethrow if it's our last attempt
    }
    // Exponential backoff: Wait 1s, 2s, then 4s before trying again
    const delay = Math.pow(2, i) * 1000;
    console.log(`Waiting ${delay}ms before retrying...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const adminSecret = request.headers.get("x-admin-secret");

  const isVercelCron = process.env.NODE_ENV === "production" && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdminManual = adminSecret === process.env.ADMIN_SECRET;

  if (!isVercelCron && !isAdminManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Authenticating with World Cup API...");

    // 1. FETCH THE AUTH TOKEN (WITH RETRIES)
    const authRes = await fetchWithRetry("https://worldcup26.ir/auth/authenticate", {
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

    const authData = await authRes.json();
    const token = authData.token;

    if (!token) throw new Error("Authentication succeeded but no token was returned.");
    console.log("Token secured.");

    // 2. FETCH AND CACHE GROUP STANDINGS (WITH RETRIES)
    console.log("Fetching Group Standings...");
    try {
      const groupsRes = await fetchWithRetry("https://worldcup26.ir/get/groups", {
        headers: { 
          "Authorization": `Bearer ${token}`, 
          "accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Origin": "https://worldcup26.ir",
          "Referer": "https://worldcup26.ir/"
        }
      });
      
      const groupsData = await groupsRes.json();
      await db.insert(groupStandingsCache).values({
        id: 1,
        data: JSON.stringify(groupsData.groups || []),
        updatedAt: new Date().toISOString()
      }).onConflictDoUpdate({
        target: groupStandingsCache.id,
        set: {
          data: JSON.stringify(groupsData.groups || []),
          updatedAt: new Date().toISOString()
        }
      });
      console.log("✅ Group Standings cached in Turso.");
    } catch (e) {
      console.error("⚠️ Non-fatal error: Failed to fetch group standings, skipping...");
    }

    // 3. FETCH THE GAMES USING THE TOKEN (WITH RETRIES)
    console.log("Fetching games...");
    const gamesRes = await fetchWithRetry("https://worldcup26.ir/get/games", {
      headers: {
        "Authorization": `Bearer ${token}`, 
        "accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://worldcup26.ir",
        "Referer": "https://worldcup26.ir/"
      }
    });

    const data = await gamesRes.json();
    const games = data.games;

    if (!games || !Array.isArray(games)) {
      throw new Error("API did not return a valid 'games' array.");
    }

    // 4. FILTER AND PROCESS GAMES
    const finishedGames = games.filter((g: any) => g.finished === "TRUE");
    const alreadyProcessed = await db.select({ id: matchRecords.id }).from(matchRecords);
    const processedIds = alreadyProcessed.map((m) => m.id);
    const gamesToProcess = finishedGames.filter((g: any) => !processedIds.includes(g.id));

    if (gamesToProcess.length === 0) {
      await updateSystemSyncTime();
      return NextResponse.json({ message: "No new finished games to process. Group Standings and Sync time updated." });
    }

    for (const match of gamesToProcess) {
      const homeTeam = match.home_team_name_en || match.home_team_label || "Unknown Team";
      const awayTeam = match.away_team_name_en || match.away_team_label || "Unknown Team";
      const homeScore = parseInt(match.home_score) || 0;
      const awayScore = parseInt(match.away_score) || 0;

      // Extract penalty scores if they exist
      const homePenalty = match.home_penalty_score ? parseInt(match.home_penalty_score) : null;
      const awayPenalty = match.away_penalty_score ? parseInt(match.away_penalty_score) : null;

      // Determine the true winner (accounting for penalty shootouts)
      let homeWon = homeScore > awayScore;
      let awayWon = awayScore > homeScore;

      if (homeScore === awayScore && homePenalty !== null && awayPenalty !== null) {
        homeWon = homePenalty > awayPenalty;
        awayWon = awayPenalty > homePenalty;
      }

      const homePoints = calculatePoints(homeScore, awayScore, match.home_scorers, match.type, homeWon);
      const awayPoints = calculatePoints(awayScore, homeScore, match.away_scorers, match.type, awayWon);

      await distributePointsToUsers(homeTeam, homePoints);
      await distributePointsToUsers(awayTeam, awayPoints);

      await db.insert(matchRecords).values({
        id: match.id,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeScore: homeScore,
        awayScore: awayScore,
        homePenaltyScore: match.home_penalty_score ? parseInt(match.home_penalty_score) : null,
        awayPenaltyScore: match.away_penalty_score ? parseInt(match.away_penalty_score) : null,
        homeScorers: match.home_scorers || "",
        awayScorers: match.away_scorers || "",
        matchType: match.type || "group",
        finished: "TRUE",
        processedForPoints: true,
        matchDate: match.local_date ? new Date(match.local_date).toISOString() : new Date().toISOString(),
      });
    }

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

function calculatePoints(teamScore: number, opponentScore: number, scorersString: string, matchType: string, isWinner: boolean) {
  let points = 0;
  points += teamScore * 10;
  if (teamScore >= 5) points += 25;
  else if (teamScore === 3 || teamScore === 4) points += 10;
  
  // Defensive bonus applies if they win and conceded 0 regular goals (even if won on penalties after 0-0)
  if (isWinner && opponentScore === 0) points += 25;
  
  // Winning margin only applies to regular time score differences
  if (isWinner && (teamScore - opponentScore) >= 3) points += 25;
  
  if (hasHatTrick(scorersString)) points += 50;
  
  if (isWinner) {
    // Added "32" to catch the Round of 32 match types (e.g., "type": "r32")
    if (matchType.includes("32") || matchType.includes("16")) points += 25; 
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