"use client";

import type { PlayerView } from "@/lib/types";
import { useCowHolder } from "./CowHolder";
import { cx } from "./ui";

// Every player gets a farm animal + colour by join order, so identities stay
// stable across rounds. The cow is deliberately absent: it belongs to the Pink Cow.
const ANIMALS = ["🐑", "🐷", "🐔", "🐴", "🐐", "🦆", "🐰", "🐶"];
const TINTS = [
  "bg-[#dff0d8] dark:bg-[#2a4a33]",
  "bg-[#fde2d4] dark:bg-[#4d3226]",
  "bg-[#fdf0c4] dark:bg-[#4a4020]",
  "bg-[#dbeaf6] dark:bg-[#233c4d]",
  "bg-[#ece2f6] dark:bg-[#3a2d4a]",
  "bg-[#d8f1ec] dark:bg-[#1f4540]",
  "bg-[#f6e1e1] dark:bg-[#4a2a2a]",
  "bg-[#e8e4d8] dark:bg-[#3d3a30]",
];

export function playerLook(players: PlayerView[], id: string) {
  const i = Math.max(0, players.findIndex((p) => p.id === id));
  return { animal: ANIMALS[i % ANIMALS.length], tint: TINTS[i % TINTS.length] };
}

const SIZES = {
  xs: "h-6 w-6 text-sm",
  sm: "h-8 w-8 text-lg",
  md: "h-11 w-11 text-2xl",
  lg: "h-16 w-16 text-4xl",
  xl: "h-24 w-24 text-6xl",
} as const;

interface Props {
  players: PlayerView[];
  id: string;
  size?: keyof typeof SIZES;
  dim?: boolean;
  ring?: "pasture" | "cow" | "hay" | null;
  className?: string;
}

export function Avatar({ players, id, size = "md", dim, ring, className }: Props) {
  const { animal, tint } = playerLook(players, id);
  const name = players.find((p) => p.id === id)?.name;
  // The Pink Cow holder is marked everywhere (unless a caller picked a ring).
  const hasCow = useCowHolder() === id;
  if (hasCow && ring === undefined) ring = "cow";
  return (
    <span
      title={hasCow ? `${name} · Vaca Rosa` : name}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center rounded-full leading-none select-none",
        SIZES[size],
        tint,
        dim && "opacity-40 grayscale",
        ring === "pasture" && "ring-3 ring-pasture",
        ring === "cow" && "ring-3 ring-cow-deep",
        ring === "hay" && "ring-3 ring-hay",
        className,
      )}
    >
      <span aria-hidden>{animal}</span>
      {hasCow && size !== "xs" && (
        <span
          aria-hidden
          className={cx(
            "absolute -top-1 -left-1 flex items-center justify-center rounded-full bg-cow ring-2 ring-surface",
            size === "sm" ? "h-4 w-4 text-[9px]" : size === "md" ? "h-5 w-5 text-[11px]" : "h-7 w-7 text-base",
          )}
        >
          🐄
        </span>
      )}
    </span>
  );
}
