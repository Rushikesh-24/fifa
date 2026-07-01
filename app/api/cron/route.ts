/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { db } from "../../../db/index";
import {
  matchRecords,
  participants,
  selectedTeams,
  systemState,
  groupStandingsCache,
} from "../../../db/schema";
import { eq, inArray } from "drizzle-orm";

export const maxDuration = 240;

// --- ROBUST FETCH WRAPPER WITH RETRY LOGIC ---
async function fetchWithRetry(url: string, options: any, maxRetries = 4) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.warn(
        `Attempt ${i + 1} failed for ${url} with status: ${res.status}`,
      );
    } catch (error: any) {
      console.warn(`Attempt ${i + 1} network error for ${url}:`, error.message);
      if (i === maxRetries - 1) throw error;
    }
    const delay = Math.pow(2, i) * 1000;
    console.log(`Waiting ${delay}ms before retrying...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

// Safely parse penalty scores (Catches literal "null" strings from the API)
const parsePenalty = (val: any) => {
  if (val === undefined || val === null || val === "null" || val === "")
    return null;
  const parsed = parseInt(val);
  return isNaN(parsed) ? null : parsed;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const adminSecret = request.headers.get("x-admin-secret");

  const isVercelCron =
    process.env.NODE_ENV === "production" &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdminManual = adminSecret === process.env.ADMIN_SECRET;

  if (!isVercelCron && !isAdminManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Authenticating with World Cup API...");

    // 1. FETCH THE AUTH TOKEN
    const authRes = await fetchWithRetry(
      "https://worldcup26.ir/auth/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Origin: "https://worldcup26.ir",
          Referer: "https://worldcup26.ir/",
        },
        body: JSON.stringify({
          email: process.env.API_EMAIL,
          password: process.env.API_PASSWORD,
        }),
      },
    );

    const authData = await authRes.json();
    const token = authData.token;

    if (!token)
      throw new Error("Authentication succeeded but no token was returned.");
    console.log("Token secured.");

    // 2. FETCH AND CACHE GROUP STANDINGS
    console.log("Fetching Group Standings...");
    try {
      const groupsRes = await fetchWithRetry(
        "https://worldcup26.ir/get/groups",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      );

      const groupsData = await groupsRes.json();
      await db
        .insert(groupStandingsCache)
        .values({
          id: 1,
          data: JSON.stringify(groupsData.groups || []),
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: groupStandingsCache.id,
          set: {
            data: JSON.stringify(groupsData.groups || []),
            updatedAt: new Date().toISOString(),
          },
        });
      console.log("✅ Group Standings cached.");
    } catch (e) {
      console.error("⚠️ Failed to fetch group standings, skipping...");
    }

    // 3. FETCH THE GAMES
    console.log("Fetching games...");
    const gamesRes = await fetchWithRetry("https://worldcup26.ir/get/games", {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const data = await gamesRes.json();
    const games = data.games;

    if (!games || !Array.isArray(games)) {
      throw new Error("API did not return a valid 'games' array.");
    }

    // 4. FILTER AND PROCESS GAMES
    const finishedGames = games.filter((g: any) => g.finished === "TRUE");
    const alreadyProcessed = await db
      .select({ id: matchRecords.id })
      .from(matchRecords);
    const processedIds = alreadyProcessed.map((m) => m.id);
    const gamesToProcess = finishedGames.filter(
      (g: any) => !processedIds.includes(g.id),
    );

    if (gamesToProcess.length === 0) {
      await updateSystemSyncTime();
      return NextResponse.json({
        message: "No new finished games to process. Sync time updated.",
      });
    }

    for (const match of gamesToProcess) {
      const homeTeam =
        match.home_team_name_en || match.home_team_label || "Unknown Team";
      const awayTeam =
        match.away_team_name_en || match.away_team_label || "Unknown Team";
      const homeScore = parseInt(match.home_score) || 0;
      const awayScore = parseInt(match.away_score) || 0;

      // Safely extract penalty scores
      const homePenaltyScore = parsePenalty(match.home_penalty_score);
      const awayPenaltyScore = parsePenalty(match.away_penalty_score);

      // Determine regular match outcomes
      let homeWon = homeScore > awayScore;
      let awayWon = awayScore > homeScore;

      // Tiebreaker check
      if (
        homeScore === awayScore &&
        homePenaltyScore !== null &&
        awayPenaltyScore !== null
      ) {
        if (homePenaltyScore > awayPenaltyScore) homeWon = true;
        else if (awayPenaltyScore > homePenaltyScore) awayWon = true;
      }

      // Calculate points (now returns { total, breakdown })
      const homePointsInfo = calculatePoints(
        homeScore,
        awayScore,
        match.home_scorers,
        match.type || "group",
        homeWon,
      );
      const awayPointsInfo = calculatePoints(
        awayScore,
        homeScore,
        match.away_scorers,
        match.type || "group",
        awayWon,
      );
      // Distribute only the total points
      await distributePointsToUsers(homeTeam, homePointsInfo.total);
      await distributePointsToUsers(awayTeam, awayPointsInfo.total);

      // Insert everything into the database, stringifying the breakdown!
      await db.insert(matchRecords).values({
        id: match.id,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        homePenaltyScore,
        awayPenaltyScore,
        homeScorers: match.home_scorers || "",
        awayScorers: match.away_scorers || "",
        homePointsBreakdown: JSON.stringify(homePointsInfo.breakdown), // NEW
        awayPointsBreakdown: JSON.stringify(awayPointsInfo.breakdown), // NEW
        matchType: match.type || "group",
        finished: "TRUE",
        processedForPoints: true,
        matchDate: match.local_date
          ? new Date(match.local_date).toISOString()
          : new Date().toISOString(),
      });
    }

    await updateSystemSyncTime();
    return NextResponse.json({
      message: `Successfully processed ${gamesToProcess.length} games!`,
    });
  } catch (error: any) {
    console.error("Cron Job Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ----------------------------------------------------
// SCORING ENGINE HELPER FUNCTIONS
// ----------------------------------------------------

async function updateSystemSyncTime() {
  await db
    .insert(systemState)
    .values({ id: 1, lastSyncAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: systemState.id,
      set: { lastSyncAt: new Date().toISOString() },
    });
}

function getHatTrickScorers(scorersString: string): string[] {
  if (!scorersString || scorersString === "null" || scorersString.length < 5)
    return [];
  const rawArray = scorersString
    .replace(/^[{"“]+|[}"”]+$/g, "")
    .split(/","|"”,”“"/);
  const playerGoalCounts: Record<string, number> = {};
  const hatTrickPlayers: string[] = [];

  for (const event of rawArray) {
    if (event.includes("(OG)")) continue;
    const match = event.match(/^(.*?)\s\d/);
    if (match && match[1]) {
      const playerName = match[1].trim();
      playerGoalCounts[playerName] = (playerGoalCounts[playerName] || 0) + 1;
      // When they hit exactly 3, add them to the array
      if (playerGoalCounts[playerName] === 3) {
        hatTrickPlayers.push(playerName);
      }
    }
  }
  return hatTrickPlayers;
}

function calculatePoints(
  teamScore: number,
  opponentScore: number,
  scorersString: string,
  matchType: string,
  isWinner: boolean,
) {
  let total = 0;
  const breakdown: { category: string; description: string; points: number }[] =
    [];

  // 1. Goals
  if (teamScore > 0) {
    const pts = teamScore * 10;
    total += pts;
    breakdown.push({
      category: "Goals",
      description: `${teamScore} Goal${teamScore > 1 ? "s" : ""}`,
      points: pts,
    });
  }

  // 2. Goal Volume Bonus
  if (teamScore >= 5) {
    total += 25;
    breakdown.push({
      category: "Offense Bonus",
      description: "5+ Goals Scored",
      points: 25,
    });
  } else if (teamScore === 3 || teamScore === 4) {
    total += 10;
    breakdown.push({
      category: "Offense Bonus",
      description: "3-4 Goals Scored",
      points: 10,
    });
  }

  // 3. Defensive & Margin Bonuses
  if (teamScore > opponentScore && opponentScore === 0) {
    total += 25;
    breakdown.push({
      category: "Defense Bonus",
      description: "Clean Sheet Win",
      points: 25,
    });
  }
  if (teamScore > opponentScore && teamScore - opponentScore >= 3) {
    total += 25;
    breakdown.push({
      category: "Margin Bonus",
      description: "Win by 3+ Goals",
      points: 25,
    });
  }

  // 4. Hat-Tricks (Dynamic Names)
  const hatTricks = getHatTrickScorers(scorersString);
  for (const player of hatTricks) {
    total += 50;
    breakdown.push({
      category: "Hat-Trick",
      description: `Scored by ${player}`,
      points: 50,
    });
  }

  // 5. Tournament Progression
  if (isWinner) {
    const typeLower = matchType.toLowerCase();
    if (typeLower.includes("32") || typeLower.includes("r32")) {
      total += 25;
      breakdown.push({
        category: "Progression",
        description: "Advanced to R16",
        points: 25,
      });
    } else if (typeLower.includes("16")) {
      total += 25;
      breakdown.push({
        category: "Progression",
        description: "Advanced to QF",
        points: 25,
      });
    } else if (typeLower.includes("qf") || typeLower.includes("quarter")) {
      total += 50;
      breakdown.push({
        category: "Progression",
        description: "Advanced to SF",
        points: 50,
      });
    } else if (typeLower.includes("sf") || typeLower.includes("semi")) {
      total += 75;
      breakdown.push({
        category: "Progression",
        description: "Advanced to Final",
        points: 75,
      });
    } else if (typeLower.includes("final") && !typeLower.includes("semi")) {
      total += 200;
      breakdown.push({
        category: "Progression",
        description: "Tournament Winner",
        points: 200,
      });
    }
  }

  return { total, breakdown };
}

async function distributePointsToUsers(teamName: string, pointsEarned: number) {
  if (pointsEarned === 0) return;
  const teamsToUpdate = await db
    .select()
    .from(selectedTeams)
    .where(eq(selectedTeams.teamName, teamName));
  for (const team of teamsToUpdate) {
    await db
      .update(selectedTeams)
      .set({ pointsEarned: team.pointsEarned + pointsEarned })
      .where(eq(selectedTeams.id, team.id));
  }
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
