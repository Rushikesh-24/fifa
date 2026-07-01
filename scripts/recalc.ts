/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../db/index";
import {
  matchRecords,
  participants,
  selectedTeams,
  systemState,
  groupStandingsCache,
} from "../db/schema";
import { eq, inArray } from "drizzle-orm";

// Safely parse penalty scores (Catches literal "null" strings from the API)
const parsePenalty = (val: any) => {
  if (val === undefined || val === null || val === "null" || val === "")
    return null;
  const parsed = parseInt(val);
  return isNaN(parsed) ? null : parsed;
};

async function runRecalculation() {
  try {
    console.log("⚠️ WARNING: Starting full league point recalculation...");

    console.log("Resetting all manager total points to 0...");
    await db.update(participants).set({ totalPoints: 0 });

    console.log("Resetting all selected team points to 0...");
    await db.update(selectedTeams).set({ pointsEarned: 0 });

    console.log("Clearing old match records cache...");
    await db.delete(matchRecords);

    console.log(
      "Database points wiped cleanly. Authenticating with World Cup API...",
    );

    // 2. FETCH AUTH TOKEN
    const authRes = await fetch("https://worldcup26.ir/auth/authenticate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Origin: "https://worldcup26.ir",
        Referer: "https://worldcup26.ir/",
      },
      body: JSON.stringify({
        email: process.env.API_EMAIL,
        password: process.env.API_PASSWORD,
      }),
    });

    if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status}`);
    const authData = await authRes.json();
    const token = authData.token;

    console.log("Token secured. Refreshing Group Standings...");

    // 3. FETCH AND CACHE GROUP STANDINGS
    const groupsRes = await fetch("https://worldcup26.ir/get/groups", {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (groupsRes.ok) {
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
    }

    // 4. FETCH ALL GAMES
    console.log("Fetching games list for full re-score...");
    const gamesRes = await fetch("https://worldcup26.ir/get/games", {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
        "User-Agent": "Mozilla/5.0",
        Origin: "https://worldcup26.ir",
        Referer: "https://worldcup26.ir/",
      },
    });

    if (!gamesRes.ok) throw new Error(`Games fetch failed: ${gamesRes.status}`);
    const data = await gamesRes.json();
    const games = data.games;

    const finishedGames = games.filter((g: any) => g.finished === "TRUE");

    console.log(`Found ${finishedGames.length} finished games to rebuild.`);

    // 5. RE-PROCESS EVERY COMPLETED MATCH
    for (const match of finishedGames) {
      const homeTeam =
        match.home_team_name_en || match.home_team_label || "Unknown Team";
      const awayTeam =
        match.away_team_name_en || match.away_team_label || "Unknown Team";
      const homeScore = parseInt(match.home_score) || 0;
      const awayScore = parseInt(match.away_score) || 0;

      const homePenaltyScore = parsePenalty(match.home_penalty_score);
      const awayPenaltyScore = parsePenalty(match.away_penalty_score);

      let homeWon = homeScore > awayScore;
      let awayWon = awayScore > homeScore;

      // Handle penalty shootouts for draws
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
    console.log(
      `\n🎉 SUCCESS! All ${finishedGames.length} matches completely re-scored with penalty and R32 metrics.`,
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Recalculation Engine Error:", error);
    process.exit(1);
  }
}

// --- CORE MATCH LOGIC UTILITIES ---
async function updateSystemSyncTime() {
  await db
    .insert(systemState)
    .values({ id: 1, lastSyncAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: systemState.id,
      set: { lastSyncAt: new Date().toISOString() },
    });
}

// --- UPGRADED HELPER FUNCTIONS ---

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

runRecalculation();
