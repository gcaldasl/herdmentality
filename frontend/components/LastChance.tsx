"use client";

import { useEffect } from "react";
import { play } from "@/lib/sounds";

/** Everyone answered: a few seconds to change your mind before the reveal. */
export function LastChance({ secondsLeft }: { secondsLeft: number }) {
  const whole = Math.ceil(secondsLeft);

  useEffect(() => {
    if (whole > 0) play("tick");
  }, [whole]);

  return (
    <div
      role="status"
      className="flex animate-pop items-center justify-center gap-3 rounded-2xl border-2 border-hay bg-hay-soft px-4 py-2.5"
    >
      <span
        key={whole}
        className="flex h-10 w-10 shrink-0 animate-pop items-center justify-center rounded-full bg-hay font-display text-2xl font-bold text-[#3d2e05] tabular-nums"
      >
        {Math.max(whole, 0)}
      </span>
      <p className="text-left text-sm">
        <b className="font-display text-base">Todo mundo respondeu!</b>
        <br />
        Última chance para mudar a sua resposta.
      </p>
    </div>
  );
}
