// components/groups.ts
// Group membership per the draft rules (2 from A, 2 from B, 1 from C).
// Names are spelled to match TEAM_INFO in Flag.tsx exactly, so flag lookup
// always resolves. A few original list entries were corrected to match:
// "Türkiye" → "Turkey", "Ivory Cost" → "Ivory Coast", "Jordon" → "Jordan",
// "Bosnia & Herzegovina" → "Bosnia and Herzegovina".

export const GROUP_A = ["Argentina", "France", "Spain", "England", "Brazil", "Portugal", "Germany", "Netherlands"];

export const GROUP_B = [
  "Morocco", "Colombia", "Croatia", "Uruguay", "Japan", "United States", "Mexico", "Belgium",
  "Switzerland", "Senegal", "South Korea", "Austria", "Turkey", "Ecuador", "Canada", "Algeria",
  "Sweden", "Norway", "Egypt", "Australia",
];

export const GROUP_C = [
  "Saudi Arabia", "Iran", "Iraq", "Qatar", "Ivory Coast", "South Africa", "Ghana", "Tunisia",
  "Czech Republic", "Scotland", "Panama", "New Zealand", "Bosnia and Herzegovina", "DR Congo",
  "Haiti", "Curaçao", "Cape Verde", "Jordan", "Uzbekistan", "Paraguay",
];

export const GROUPS = [
  { key: "A" as const, label: "Group A · Elite Favourites", teams: GROUP_A, pick: 2 },
  { key: "B" as const, label: "Group B · Strong Contenders", teams: GROUP_B, pick: 2 },
  { key: "C" as const, label: "Group C · Underdogs & Dark Horses", teams: GROUP_C, pick: 1 },
];