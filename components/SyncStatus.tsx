// components/SyncStatus.tsx
"use client";

import { useEffect, useState } from "react";

export default function SyncStatus({
  lastSyncIso,
}: {
  lastSyncIso: string | null;
}) {
  const [timeLeft, setTimeLeft] = useState<string>(() =>
    lastSyncIso ? "Calculating..." : "Pending first sync...",
  );

  useEffect(() => {
    if (!lastSyncIso) {
      return;
    }

    const interval = setInterval(() => {
      // Add exactly 6 hours to the last sync time
      const nextSync = new Date(lastSyncIso).getTime() + 6 * 60 * 60 * 1000;
      const now = new Date().getTime();
      const diff = nextSync - now;

      if (diff <= 0) {
        setTimeLeft("Syncing now...");
      } else {
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        setTimeLeft(`Next update in ${hours}h ${minutes}m`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastSyncIso]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 flex items-center justify-between shadow-md mb-8">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <span className="text-sm font-medium text-neutral-300">
          Live API Link
        </span>
      </div>
      <span className="text-sm font-mono text-emerald-400">
        {lastSyncIso ? timeLeft : "Pending first sync..."}
      </span>
    </div>
  );
}
