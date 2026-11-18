"use client";

import { useState } from "react";

const COLORS = ["#3B9C5A", "#E8B84B", "#7FB3D5", "#D6553B", "#55BD72", "#F0C868"];

// Cheap deterministic PRNG so every piece gets a varied but stable path.
function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One-shot confetti burst over the whole viewport. Remount (via `key`) to replay. */
export function Confetti({
  count = 70,
  colors = COLORS,
}: {
  count?: number;
  colors?: string[];
}) {
  const [pieces] = useState(() => {
    const rand = mulberry(count * 7919);
    return Array.from({ length: count }, (_, i) => ({
      left: rand() * 100,
      delay: rand() * 0.6,
      dur: 2 + rand() * 1.8,
      dx: (rand() - 0.5) * 240,
      rot: 360 + rand() * 720,
      color: colors[i % colors.length],
      round: rand() > 0.7,
    }));
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              borderRadius: p.round ? "999px" : undefined,
              "--delay": `${p.delay}s`,
              "--dur": `${p.dur}s`,
              "--dx": `${p.dx}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
