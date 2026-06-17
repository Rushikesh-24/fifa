// app/admin/page.tsx
"use client";

import { useState } from "react";

export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleManualSync = async () => {
    if (!secret) return alert("Enter the admin secret!");
    setIsLoading(true);
    setStatus("Fetching API...");

    try {
      const res = await fetch("/api/cron", {
        headers: { "x-admin-secret": secret },
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setStatus(`✅ Success: ${data.message}`);
    } catch (err: any) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 p-8 rounded-xl shadow-2xl">
        <h1 className="text-2xl font-bold mb-2">Admin Control</h1>
        <p className="text-sm text-neutral-400 mb-6">Manually trigger the points calculation engine.</p>
        
        <input 
          type="password" 
          placeholder="Enter Admin Secret" 
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 text-white px-4 py-3 rounded-lg mb-4 focus:outline-none focus:border-emerald-500 transition-colors"
        />

        <button 
          onClick={handleManualSync}
          disabled={isLoading}
          className={`w-full py-3 rounded-lg font-bold transition-all ${
            isLoading ? "bg-neutral-800 text-neutral-500" : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {isLoading ? "Running Engine..." : "Force Sync API"}
        </button>

        {status && (
          <div className="mt-6 p-4 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-center">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}