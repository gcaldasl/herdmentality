"use client";

import { useState, type InputHTMLAttributes } from "react";
import { cx } from "./ui";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-xl border-2 border-border bg-cream px-4 py-3 text-base font-medium text-ink transition-colors outline-none",
        "focus:border-pasture focus:bg-surface",
        className,
      )}
      {...rest}
    />
  );
}

/** Four letter tiles backed by one real <input> so paste/IME/autofill all work. */
export function CodeInput({
  value,
  onChange,
  onEnter,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="relative block cursor-text">
      <span className="sr-only">Código da sala</span>
      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))
        }
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <span className="grid grid-cols-4 gap-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => {
          const ch = value[i];
          const active = focused && (i === value.length || (i === 3 && value.length === 4));
          return (
            <span
              key={i}
              className={cx(
                "flex aspect-square items-center justify-center rounded-2xl border-2 font-display text-3xl font-bold transition-all sm:text-4xl",
                ch ? "border-pasture bg-surface text-ink shadow-card-sm" : "border-border bg-cream text-muted/40",
                active && "border-hay ring-3 ring-hay/40",
              )}
            >
              {ch ? <span className="animate-pop">{ch}</span> : "·"}
            </span>
          );
        })}
      </span>
    </label>
  );
}
