"use client";

import Link from "next/link";
import { useState } from "react";
import type { GameState } from "@/lib/types";
import type { SocketStatus } from "@/lib/useGameSocket";
import { play, setMuted, useMuted } from "@/lib/sounds";
import { CowArt } from "./CowArt";
import { cx } from "./ui";

const PHASE_LABEL: Record<GameState["phase"], string> = {
  lobby: "Sala de espera",
  choosing: "Escolhendo a pergunta",
  question: "Respondendo",
  reveal: "Agrupando respostas",
  scoring: "Resultado",
  game_over: "Fim de jogo",
};

export function RoomHeader({
  state,
  me,
  status,
}: {
  state: GameState;
  me: string;
  status: SocketStatus;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - the code is visible anyway */
    }
  };

  const online = status === "open";
  const muted = useMuted();

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2" title="Início">
          <CowArt className="w-8" />
          <span className="hidden font-display text-lg font-bold sm:inline">
            Efeito <span className="text-pasture">Manada</span>
          </span>
        </Link>

        {state.pink_cow_player_id === me && state.phase !== "game_over" && (
          <span
            title="Você está com a Vaca Rosa: não pode vencer até passá-la adiante"
            className="flex animate-pop items-center gap-1 rounded-full bg-cow px-2.5 py-1 font-display text-xs font-bold text-[#5a1030]"
          >
            <span className="animate-wiggle">🐄</span>
            <span className="hidden sm:inline">A Vaca Rosa é sua</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full bg-cream-deep px-3 py-1 font-display text-xs font-semibold text-muted sm:inline">
            {state.phase === "choosing"
              ? `Rodada ${state.round_number + 1} · ${PHASE_LABEL.choosing}`
              : state.round_number > 0 && state.phase !== "lobby"
              ? `Rodada ${state.round_number} · ${PHASE_LABEL[state.phase]}`
              : PHASE_LABEL[state.phase]}
          </span>

          <button
            onClick={copy}
            title="Copiar código da sala"
            className="flex items-center gap-1.5 rounded-full border-2 border-border bg-surface px-3 py-1 font-display text-sm font-bold tracking-[0.2em] transition-colors hover:border-pasture"
          >
            {copied ? <span className="tracking-normal text-pasture">Copiado!</span> : state.code}
          </button>

          <button
            onClick={() => {
              setMuted(!muted);
              if (muted) play("pop");
            }}
            title={muted ? "Ligar sons" : "Silenciar"}
            aria-label={muted ? "Ligar sons" : "Silenciar"}
            aria-pressed={muted}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-surface text-sm transition-colors hover:border-pasture"
          >
            {muted ? "🔇" : "🔊"}
          </button>

          <span
            title={online ? "Conectado" : "Sem conexão — tentando de novo"}
            className={cx(
              "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold",
              online ? "text-pasture" : "bg-hay-soft text-ink",
            )}
          >
            <span
              className={cx(
                "h-2.5 w-2.5 rounded-full",
                online ? "bg-pasture" : "animate-pulse-soft bg-hay",
              )}
            />
            {!online && "reconectando"}
          </span>
        </div>
      </div>
    </header>
  );
}
