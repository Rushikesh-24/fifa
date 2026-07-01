// components/Flag.tsx
// Shared team → flag lookup. Pure component, no client-only APIs, so it can
// be imported from Server Components and Client Components alike.

import Image from "next/image";

// Known World Cup teams → ISO country code, used for flag lookup.
// Keyed by numeric team id for reference elsewhere, but callers usually only
// have the team *name*, so we also build a name → code index below.
export const TEAM_INFO: Record<string, { name: string; code: string }> = {
  "1": { name: "Mexico", code: "mx" },
  "2": { name: "South Africa", code: "za" },
  "3": { name: "South Korea", code: "kr" },
  "4": { name: "Czech Republic", code: "cz" },
  "5": { name: "Canada", code: "ca" },
  "6": { name: "Bosnia and Herzegovina", code: "ba" },
  "7": { name: "Qatar", code: "qa" },
  "8": { name: "Switzerland", code: "ch" },
  "9": { name: "Brazil", code: "br" },
  "10": { name: "Morocco", code: "ma" },
  "11": { name: "Haiti", code: "ht" },
  "12": { name: "Scotland", code: "gb-sct" },
  "13": { name: "United States", code: "us" },
  "14": { name: "Paraguay", code: "py" },
  "15": { name: "Australia", code: "au" },
  "16": { name: "Turkey", code: "tr" },
  "17": { name: "Germany", code: "de" },
  "18": { name: "Curaçao", code: "cw" },
  "19": { name: "Ivory Coast", code: "ci" },
  "20": { name: "Ecuador", code: "ec" },
  "21": { name: "Netherlands", code: "nl" },
  "22": { name: "Japan", code: "jp" },
  "23": { name: "Sweden", code: "se" },
  "24": { name: "Tunisia", code: "tn" },
  "25": { name: "Belgium", code: "be" },
  "26": { name: "Egypt", code: "eg" },
  "27": { name: "Iran", code: "ir" },
  "28": { name: "New Zealand", code: "nz" },
  "29": { name: "Spain", code: "es" },
  "30": { name: "Cape Verde", code: "cv" },
  "31": { name: "Saudi Arabia", code: "sa" },
  "32": { name: "Uruguay", code: "uy" },
  "33": { name: "France", code: "fr" },
  "34": { name: "Senegal", code: "sn" },
  "35": { name: "Iraq", code: "iq" },
  "36": { name: "Norway", code: "no" },
  "37": { name: "Argentina", code: "ar" },
  "38": { name: "Algeria", code: "dz" },
  "39": { name: "Austria", code: "at" },
  "40": { name: "Jordan", code: "jo" },
  "41": { name: "Portugal", code: "pt" },
  "42": { name: "DR Congo", code: "cd" },
  "43": { name: "Uzbekistan", code: "uz" },
  "44": { name: "Colombia", code: "co" },
  "45": { name: "England", code: "gb-eng" },
  "46": { name: "Croatia", code: "hr" },
  "47": { name: "Ghana", code: "gh" },
  "48": { name: "Panama", code: "pa" },
};

export function normalizeTeamName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const NAME_TO_CODE: Record<string, string> = Object.values(TEAM_INFO).reduce(
  (acc, t) => {
    acc[normalizeTeamName(t.name)] = t.code;
    return acc;
  },
  {} as Record<string, string>
);

export function getTeamCode(name: string): string | undefined {
  return NAME_TO_CODE[normalizeTeamName(name)];
}

export function Flag({ name, dim, size = "sm" }: { name: string; dim?: boolean; size?: "sm" | "md" }) {
  const code = getTeamCode(name);
  const dims = size === "md" ? "w-7 h-5" : "w-6 h-[18px]";

  if (!code) {
    return (
      <div
        className={`${dims} shrink-0 rounded-xs border border-[#1B2D21] bg-[#0A1610] flex items-center justify-center transition-opacity ${
          dim ? "opacity-45" : "opacity-100"
        }`}
        aria-hidden
      >
        <span className="text-[8px] font-bold text-[#2D3F33]">{name.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div
      className={`${dims} shrink-0 rounded-xs overflow-hidden border border-[#1B2D21] bg-[#0A1610] transition-opacity ${
        dim ? "opacity-45" : "opacity-100"
      }`}
    >
      {/* plain <img>, not next/image, so this works without remotePatterns config */}
      <Image
              src={`https://flagcdn.com/w40/${code}.png`}
              alt={`${name} flag`}
              width={28}
              height={20}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
    </div>
  );
}