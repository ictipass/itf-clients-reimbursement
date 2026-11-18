"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type TrainingArea = "management" | "supervisory" | "occupational";
type Rank = "" | "1" | "2" | "3";
type RankContextValue = {
  ranks: Record<TrainingArea, Rank>;
  setRank: (area: TrainingArea, rank: Rank) => void;
};

const RankContext = createContext<RankContextValue | null>(null);

export function ClaimEmphasisRankGroup({ children }: { children: ReactNode }) {
  const [ranks, setRanks] = useState<Record<TrainingArea, Rank>>({
    management: "",
    supervisory: "",
    occupational: "",
  });
  return (
    <RankContext.Provider value={{ ranks, setRank: (area, rank) => setRanks((current) => ({ ...current, [area]: rank })) }}>
      {children}
    </RankContext.Provider>
  );
}

export function ClaimEmphasisRankSelect({ area }: { area: TrainingArea }) {
  const context = useContext(RankContext);
  if (!context) throw new Error("Emphasis rank selector needs a rank group.");
  const { ranks, setRank } = context;
  return (
    <label className="grid gap-1 text-sm">
      Emphasis rank
      <select
        name={`${area}EmphasisRank`}
        value={ranks[area]}
        onChange={(event) => setRank(area, event.target.value as Rank)}
        required
        className="min-h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
      >
        <option value="">Select emphasis rank</option>
        {(["1", "2", "3"] as const).map((rank) => (
          <option key={rank} value={rank} disabled={Object.entries(ranks).some(([other, selected]) => other !== area && selected === rank)}>
            {rank === "1" ? "1st" : rank === "2" ? "2nd" : "3rd"} emphasis
          </option>
        ))}
      </select>
    </label>
  );
}
