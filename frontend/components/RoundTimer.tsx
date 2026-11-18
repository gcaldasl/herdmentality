"use client";

import { useEffect } from "react";
import { play } from "@/lib/sounds";
import { cx } from "./ui";

/** Countdown pill + draining bar for timed rounds. Ticks through the last 5s. */
export function RoundTimer({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const whole = Math.ceil(secondsLeft);
  const low = secondsLeft <= 10;
  const pct = total ? Math.min(100, (secondsLeft / total) * 100) : 0;

  useEffect(() => {
    if (whole > 0 && whole <= 5) play("tick");
  }, [whole]);

  return (
    <div className="flex flex-col items-center gap-2" role="timer" aria-live="off">
      <span
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-lg font-bold tabular-nums transition-colors",
          whole === 0
            ? "bg-barn text-white"
            : low
              ? "animate-pulse-soft bg-barn-soft text-barn"
              : "bg-cream-deep text-ink",
        )}
      >
        ⏱ {whole === 0 ? "Tempo!" : `${whole}s`}
      </span>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-cream-deep">
        <div
          className={cx(
            "h-full rounded-full transition-[width] duration-300 ease-linear",
            low ? "bg-barn" : "bg-hay",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
