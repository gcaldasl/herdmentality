"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "./api";
import { syncServerClock } from "./clock";
import type { GameState, ServerMessage } from "./types";

// "rejected": the server refused us (room gone / unknown player) - stop retrying.
export type SocketStatus = "connecting" | "open" | "closed" | "rejected";

interface UseGameSocket {
  state: GameState | null;
  status: SocketStatus;
  error: string | null;
  send: (message: Record<string, unknown>) => void;
}

export function useGameSocket(
  code: string | null,
  playerId: string | null,
): UseGameSocket {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedByUs = useRef(false);

  useEffect(() => {
    if (!code || !playerId) return;
    closedByUs.current = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(wsUrl(code, playerId));
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage;
        if (msg.type === "state") {
          syncServerClock(msg.state.server_now);
          setState(msg.state);
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      };

      ws.onclose = (event) => {
        if (wsRef.current !== ws) return; // superseded by a newer socket
        if (event.code === 4004) {
          setStatus("rejected");
          return;
        }
        setStatus("closed");
        if (closedByUs.current) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 8000);
        retryRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedByUs.current = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [code, playerId]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const send = useCallback((message: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  return { state, status, error, send };
}
