"use client";

import { useSyncExternalStore } from "react";

// Server clock minus client clock, refreshed from every state snapshot, so a
// phone with a wrong clock still counts down to the server's deadline.
let offsetMs = 0;

export function syncServerClock(serverNowIso: string): void {
  const server = Date.parse(serverNowIso);
  if (!Number.isNaN(server)) offsetMs = server - Date.now();
}

// A shared 250ms ticker, only running while someone is subscribed.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 250);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Seconds since `sinceIso` on the server's clock (null without one). */
export function useSecondsSince(sinceIso: string | null): number | null {
  const tick = useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
  if (!sinceIso) return null;
  return Math.max(0, (tick + offsetMs - Date.parse(sinceIso)) / 1000);
}

/** Seconds left until `deadlineIso` on the server's clock (null without one). */
export function useSecondsLeft(deadlineIso: string | null): number | null {
  const tick = useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
  if (!deadlineIso) return null;
  return Math.max(0, (Date.parse(deadlineIso) - (tick + offsetMs)) / 1000);
}
