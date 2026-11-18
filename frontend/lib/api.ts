// Deployment modes:
//  - NEXT_PUBLIC_PROXY_MODE=1 (Docker / ngrok): everything is same-origin behind
//    the reverse proxy — REST under /api, the WebSocket under /ws.
//  - otherwise: talk straight to the FastAPI origin (NEXT_PUBLIC_API_URL, or
//    http://localhost:8000 for zero-config local dev).
const PROXY_MODE = process.env.NEXT_PUBLIC_PROXY_MODE === "1";
const API_ORIGIN = PROXY_MODE
  ? ""
  : process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000";

function httpBase(): string {
  return API_ORIGIN || "/api";
}

export function wsUrl(code: string, playerId: string): string {
  const query = `?player_id=${encodeURIComponent(playerId)}`;

  if (API_ORIGIN) {
    const scheme = API_ORIGIN.startsWith("https") ? "wss" : "ws";
    const host = API_ORIGIN.replace(/^https?:\/\//, "");
    return `${scheme}://${host}/ws/${code}${query}`;
  }

  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws/${code}${query}`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${httpBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail ?? "Algo deu errado.");
  }
  return data as T;
}

export function createRoom(hostName: string) {
  return post<{ code: string; player_id: string }>("/rooms", {
    host_name: hostName,
  });
}

export function joinRoom(code: string, name: string) {
  return post<{ code: string; player_id: string }>(
    `/rooms/${code.toUpperCase()}/join`,
    { name },
  );
}
