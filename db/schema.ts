import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 1. Participants Table
// Tracks who is playing and their total accumulated points.
export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(), 
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(), // <-- NEW FIELD FOR PUBLIC FOLDER IMAGES
  totalPoints: integer("total_points").notNull().default(0),
  createdAt: text("created_at").default(new Date().toISOString()),
});

// 2. Selected Teams Table
// Maps the 5 teams selected by each participant.
export const selectedTeams = sqliteTable("selected_teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantId: text("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  teamName: text("team_name").notNull(),
  groupCategory: text("group_category").notNull(),
  // NEW: Track exactly how many points this specific team has generated
  pointsEarned: integer("points_earned").notNull().default(0), 
});

// 3. Match Records Table
// Matches the exact API structure so we can calculate bonuses and prevent double-counting.
export const matchRecords = sqliteTable("match_records", {
  id: text("id").primaryKey(), // We will use the standard 'id' (e.g., "4") from the API
  homeTeam: text("home_team").notNull(), // from home_team_name_en
  awayTeam: text("away_team").notNull(), // from away_team_name_en
  homeScore: integer("home_score"), 
  awayScore: integer("away_score"),
  homeScorers: text("home_scorers"), // Storing the raw string: "{\"F. Balogun 31'\", ...}"
  awayScorers: text("away_scorers"),
  matchType: text("match_type"), // from "type" (e.g., "group", "quarter-final" - needed for progression bonus)
  finished: text("finished"), // from "finished" (e.g., "TRUE" or "FALSE")
  processedForPoints: integer("processed_for_points", { mode: "boolean" }).notNull().default(false),
  matchDate: text("match_date").default(new Date().toISOString()),
  updatedAt: text("updated_at").default(new Date().toISOString()),
});

// 4. System State Table
// Tracks the last time the cron job successfully ran so we can display a countdown.
export const systemState = sqliteTable("system_state", {
  id: integer("id").primaryKey(), // We will hardcode this to ID 1
  lastSyncAt: text("last_sync_at").notNull(),
});

// 5. Group Standings Cache
// Stores the latest group standings JSON directly from the API.
export const groupStandingsCache = sqliteTable("group_standings_cache", {
  id: integer("id").primaryKey(), // Hardcoded to 1
  data: text("data").notNull(), // The stringified JSON array
  updatedAt: text("updated_at").default(new Date().toISOString()),
});