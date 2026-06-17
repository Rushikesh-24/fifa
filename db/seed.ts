import { db } from "./index";
import { participants, selectedTeams } from "./schema";

const fantasyData = {
  "Sanish Pagui": ["Argentina", "Germany", "Japan", "Belgium", "New Zealand"],
  "Justin Dsouza": ["Argentina", "Spain", "Uruguay", "Belgium", "Côte d'Ivoire"],
  "Chirag Mahajan": ["France", "Spain", "Colombia", "Morocco", "Scotland"],
  "Harsh Telang": ["Spain", "France", "Croatia", "Uruguay", "Paraguay"],
  "Gladson Dias": ["France", "Portugal", "Morocco", "Japan", "Ghana"],
  "Rushikesh Gaonkar": ["Portugal", "France", "Switzerland", "Japan", "South Africa"]
};

async function seedDatabase() {
  console.log("⏳ Seeding database...");

  for (const [name, teams] of Object.entries(fantasyData)) {
    // Creates a clean ID (e.g., "sanish-pagui")
    const participantId = name.toLowerCase().replace(/\s+/g, '-');
    
    // Formats the image URL to point to your public folder exactly as requested
    const imageUrl = `/${name}.png`;

    console.log(`Adding ${name}...`);

    // 1. Insert the Participant
    await db.insert(participants).values({
      id: participantId,
      name: name,
      imageUrl: imageUrl,
      totalPoints: 0,
    });

    // 2. Insert their 5 Selected Teams
    for (const team of teams) {
      await db.insert(selectedTeams).values({
        participantId: participantId,
        teamName: team,
        groupCategory: "Drafted", // A placeholder since we rely on the team name for points
      });
    }
  }

  console.log("✅ Seeding complete! All players and teams are in Turso.");
}

seedDatabase().catch(console.error);