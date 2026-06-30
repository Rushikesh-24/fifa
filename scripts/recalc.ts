/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "../db/index";
import { matchRecords, participants, selectedTeams, systemState, groupStandingsCache } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

async function runRecalculation() {
  try {
    console.log("⚠️ WARNING: Starting full league point recalculation...");
    
    // 1. RESET ALL POINTS TO ZERO TO PREVENT DOUBLE-STACKING MULTIPLIERS
    console.log("Resetting all manager total points to 0...");
    await db.update(participants).set({ totalPoints: 0 });

    console.log("Resetting all selected team points to 0...");
    await db.update(selectedTeams).set({ pointsEarned: 0 });

    console.log("Clearing old match records cache...");
    await db.delete(matchRecords);

    console.log("Database points wiped cleanly. Authenticating with World Cup API...");

    // 2. FETCH AUTH TOKEN
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

    console.log("Token secured. Refreshing Group Standings...");

    // 3. FETCH AND CACHE GROUP STANDINGS
    const groupsRes = await fetch("https://worldcup26.ir/get/groups", {
      headers: { "Authorization": `Bearer ${token}`, "accept": "application/json", "User-Agent": "Mozilla/5.0" }
    });
    if (groupsRes.ok) {
      const groupsData = await groupsRes.json();
      await db.insert(groupStandingsCache).values({
        id: 1, data: JSON.stringify(groupsData.groups || []), updatedAt: new Date().toISOString()
      }).onConflictDoUpdate({
        target: groupStandingsCache.id,
        set: { data: JSON.stringify(groupsData.groups || []), updatedAt: new Date().toISOString() }
      });
    }

    // 4. FETCH ALL GAMES
    console.log("Fetching games list for full re-score...");
    const gamesRes = await fetch("https://worldcup26.ir/get/games", {
      headers: {
        "Authorization": `Bearer ${token}`, 
        "accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://worldcup26.ir",
        "Referer": "https://worldcup26.ir/"
      }
    });

    if (!gamesRes.ok) throw new Error(`Games fetch failed: ${gamesRes.status}`);
    const data = await gamesRes.json();
    const games = data.games;

    const finishedGames = games.filter((g: any) => g.finished === "TRUE");

    console.log(`Found ${finishedGames.length} finished games to rebuild.`);

    // 5. RE-PROCESS EVERY COMPLETED MATCH WITH NEW KNOCKOUT SCORING RULES
    for (const match of finishedGames) {
      const homeTeam = match.home_team_name_en || match.home_team_label || "Unknown Team";
      const awayTeam = match.away_team_name_en || match.away_team_label || "Unknown Team";
      const homeScore = parseInt(match.home_score) || 0;
      const awayScore = parseInt(match.away_score) || 0;

      let homeWon = homeScore > awayScore;
      let awayWon = awayScore > homeScore;

      // Handle penalty shootouts for draws
      if (homeScore === awayScore) {
        const homePenaltyScore = parseInt(match.home_penalty_score) || 0;
        const awayPenaltyScore = parseInt(match.away_penalty_score) || 0;
        if (homePenaltyScore > awayPenaltyScore) homeWon = true;
        else if (awayPenaltyScore > homePenaltyScore) awayWon = true;
      }

      const homePoints = calculatePoints(homeScore, awayScore, match.home_scorers, match.type || "group", homeWon);
      const awayPoints = calculatePoints(awayScore, homeScore, match.away_scorers, match.type || "group", awayWon);

      await distributePointsToUsers(homeTeam, homePoints);
      await distributePointsToUsers(awayTeam, awayPoints);

     await db.insert(matchRecords).values({
        id: match.id,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        homePenaltyScore: match.home_penalty_score ? parseInt(match.home_penalty_score) : null,
        awayPenaltyScore: match.away_penalty_score ? parseInt(match.away_penalty_score) : null,
        homeScorers: match.home_scorers || "",
        awayScorers: match.away_scorers || "",
        matchType: match.type || "group",
        finished: "TRUE",
        processedForPoints: true,
        matchDate: match.local_date ? new Date(match.local_date).toISOString() : new Date().toISOString(),
      });
      console.log(`Scored: ${homeTeam} vs ${awayTeam} (Home Pts: ${homePoints}, Away Pts: ${awayPoints})`);
    }

    await updateSystemSyncTime();
    console.log(`\n🎉 SUCCESS! All ${finishedGames.length} matches completely re-scored with penalty and R32 metrics.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Recalculation Engine Error:", error);
    process.exit(1);
  }
}

// --- CORE MATCH LOGIC UTILITIES ---
async function updateSystemSyncTime() {
  await db.insert(systemState).values({ id: 1, lastSyncAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: systemState.id, set: { lastSyncAt: new Date().toISOString() } });
}

function calculatePoints(teamScore: number, opponentScore: number, scorersString: string, matchType: string, isWinner: boolean) {
  let points = teamScore * 10;
  if (teamScore >= 5) points += 25;
  else if (teamScore === 3 || teamScore === 4) points += 10;
  
  if (teamScore > opponentScore && opponentScore === 0) points += 25;
  if (teamScore > opponentScore && (teamScore - opponentScore) >= 3) points += 25;
  if (hasHatTrick(scorersString)) points += 50;
  
  if (isWinner) {
    const typeLower = matchType.toLowerCase();
    if (typeLower.includes("32") || typeLower.includes("r32")) points += 25; 
    if (typeLower.includes("16")) points += 25; 
    if (typeLower.includes("qf") || typeLower.includes("quarter")) points += 50; 
    if (typeLower.includes("sf") || typeLower.includes("semi")) points += 75; 
    if (typeLower.includes("final") && !typeLower.includes("semi")) points += 200; 
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

runRecalculation();