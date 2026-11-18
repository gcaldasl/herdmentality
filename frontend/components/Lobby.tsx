"use client";

import { useState } from "react";
import type { GameState } from "@/lib/types";
import { Avatar } from "./Avatar";
import { SettingsCard } from "./SettingsCard";
import { ActionBar, ActionBarSpacer, Button, Card, Eyebrow, cx } from "./ui";

interface Props {
  state: GameState;
  me: string;
  send: (m: Record<string, unknown>) => void;
}

const MAX_PLAYERS = 6;

export function Lobby({ state, me, send }: Props) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const isHost = state.host_player_id === me;
  const host = state.players.find((p) => p.id === state.host_player_id);
  const count = state.players.length;
  const enough = count >= 2;

  const flash = (what: "code" | "link") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      flash("code");
    } catch {
      /* ignore */
    }
  };

  const shareLink = async () => {
    const url = `${window.location.origin}/room/${state.code}`;
    const data = {
      title: "Efeito Manada",
      text: `Entra na minha sala do Efeito Manada! Código: ${state.code}`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(data)) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("link");
    } catch {
      /* user cancelled the share sheet */
    }
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      <Card className="flex flex-col items-center p-6 text-center sm:p-8">
        <Eyebrow>Código da sala</Eyebrow>
        <button
          onClick={copyCode}
          title="Copiar código"
          className="group mt-3 flex gap-2 sm:gap-3"
        >
          {state.code.split("").map((ch, i) => (
            <span
              key={i}
              className="flex h-16 w-14 animate-pop items-center justify-center rounded-2xl border-2 border-border bg-cream font-display text-4xl font-bold shadow-card-sm transition-transform group-hover:-translate-y-0.5 sm:h-20 sm:w-16 sm:text-5xl"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {ch}
            </span>
          ))}
        </button>
        <div className="mt-5 grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-center">
          <Button variant="secondary" onClick={copyCode}>
            {copied === "code" ? "✓ Copiado!" : "📋 Copiar"}
          </Button>
          <Button variant="secondary" onClick={shareLink}>
            {copied === "link" ? "✓ Link copiado!" : "🔗 Convidar"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">A manada</h2>
          <span className="font-display text-sm font-semibold text-muted">
            {count}/{MAX_PLAYERS}
          </span>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => {
            const p = state.players[i];
            if (!p) {
              return (
                <li
                  key={`empty-${i}`}
                  className="flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-border p-2.5 text-sm text-muted"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep text-lg opacity-60">
                    ?
                  </span>
                  vaga livre
                </li>
              );
            }
            return (
              <li
                key={p.id}
                className={cx(
                  "flex animate-pop items-center gap-2.5 rounded-2xl border-2 p-2.5",
                  p.id === me ? "border-pasture bg-pasture-soft" : "border-border bg-surface",
                )}
              >
                <Avatar players={state.players} id={p.id} dim={!p.connected} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.is_host ? "👑 anfitrião" : p.id === me ? "você" : p.connected ? "pronto" : "offline"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

      </Card>

      <SettingsCard state={state} isHost={isHost} send={send} />

      <ActionBar spacer={false}>
        {isHost ? (
          <>
            <Button
              size="lg"
              onClick={() => send({ type: "start_game" })}
              disabled={!enough}
              className="w-full sm:w-auto sm:min-w-64"
            >
              Começar o jogo →
            </Button>
            <p className="text-sm text-muted">
              {enough
                ? "Todo mundo dentro? Então solta a boiada."
                : "Chame pelo menos mais 1 pessoa para começar."}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 font-display text-muted">
            <span className="inline-block animate-bob">⏳</span>
            Esperando {host ? <b className="text-ink">{host.name}</b> : "o anfitrião"} começar…
          </p>
        )}
      </ActionBar>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <Rule icon="🎯" text="Dê a resposta que a maioria daria." />
        <Rule icon="🐑" text="Maior grupo = +1 ponto para cada um." />
        <Rule icon="🐄" text="Sozinho na resposta? Fica com a Vaca Rosa." />
        {state.cow_rounds !== "off" && (
          <Rule icon="🔄" text="Na Rodada da Vaca, quem responde sozinho ganha o ponto." />
        )}
        {state.sour_milk && (
          <Rule icon="🥛" text="Segurar a Vaca Rosa uma rodada inteira custa 1 ponto." />
        )}
      </div>
      <ActionBarSpacer />
    </div>
  );
}

function Rule({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-cream-deep px-3 py-2.5 text-muted">
      <span className="text-xl" aria-hidden>{icon}</span>
      {text}
    </div>
  );
}
