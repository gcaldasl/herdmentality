import type { Session } from "./types";

const key = (code: string) => `herd:session:${code.toUpperCase()}`;

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(key(session.code), JSON.stringify(session));
  } catch {
    /* storage unavailable - reconnect just won't persist */
  }
}

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(key(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed.code && parsed.playerId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearSession(code: string): void {
  try {
    localStorage.removeItem(key(code));
  } catch {
    /* ignore */
  }
}

// ---- small conveniences (per-browser, best-effort) ----

const NAME_KEY = "herd:name";

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

// The server never echoes your answer back during the question phase, so we
// remember it locally to show "você respondeu …" (and survive a refresh).
const answerKey = (code: string, round: number) =>
  `herd:answer:${code.toUpperCase()}:${round}`;

export function loadAnswer(code: string, round: number): string {
  try {
    return sessionStorage.getItem(answerKey(code, round)) ?? "";
  } catch {
    return "";
  }
}

export function saveAnswer(code: string, round: number, text: string): void {
  try {
    sessionStorage.setItem(answerKey(code, round), text);
  } catch {
    /* ignore */
  }
}
