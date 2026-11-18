"use client";

import Link from "next/link";
import type { GameState } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";
import { PinkCow } from "./PinkCow";
import { RecapCard } from "./RecapCard";
import { Button, Card, Eyebrow, buttonClass, cx } from "./ui";

interface Props {
  state: GameState;
  me: string;
  send: (m: Record<string, unknown>) => void;
}

const PODIUM = [
  { place: 2, height: "h-20", medal: "🥈" },
  { place: 1, height: "h-28", medal: "🥇" },
  { place: 3, height: "h-14", medal: "🥉" },
];

export function GameOver({ state, me, send }: Props) {
  const isHost = state.host_player_id === me;
  const host = state.players.find((p) => p.id === state.host_player_id);
  const winner = state.players.find((p) => p.id === state.winner_player_id);
  const standings = state.players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      // The winner always leads, even if the Pink Cow holder has more points.
      if (a.p.id === state.winner_player_id) return -1;
      if (b.p.id === state.winner_player_id) return 1;
      return b.p.score - a.p.score || a.i - b.i;
    })
    .map(({ p }) => p);
  const iWon = winner?.id === me;

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
      <Confetti count={iWon ? 120 : 70} />

      <div className="animate-pop">
        <Eyebrow>Fim de jogo</Eyebrow>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
          {iWon ? "Você venceu! 🏆" : winner ? `${winner.name} venceu!` : "Fim de jogo"}
        </h1>
        <p className="mt-2 text-muted">
          {iWon ? "Ninguém pensa tão igual à manada quanto você." : "A manada falou."}
        </p>
      </div>

      <div className="flex w-full items-end justify-center gap-2 sm:gap-4">
        {PODIUM.map(({ place, height, medal }) => {
          const p = standings[place - 1];
          if (!p) return <div key={place} className="w-24 sm:w-32" />;
          return (
            <div
              key={p.id}
              className="flex w-24 animate-rise flex-col items-center sm:w-32"
              style={{ animationDelay: `${(3 - place) * 180 + 150}ms` }}
            >
              <Avatar
                players={state.players}
                id={p.id}
                size={place === 1 ? "xl" : "lg"}
                ring={place === 1 ? "hay" : null}
                className={place === 1 ? "animate-bob" : undefined}
              />
              <p className="mt-2 w-full truncate font-semibold">
                {p.id === me ? "Você" : p.name}
              </p>
              <p className="font-display text-sm text-muted">{p.score} pts</p>
              <div
                className={cx(
                  "mt-2 flex w-full items-start justify-center rounded-t-2xl border-2 border-b-0 pt-2 text-2xl",
                  height,
                  place === 1 ? "border-hay bg-hay-soft" : "border-border bg-surface",
                )}
              >
                {medal}
              </div>
            </div>
          );
        })}
      </div>

      {standings.length > 3 && (
        <Card className="w-full p-3">
          <ul>
            {standings.slice(3).map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b-2 border-border px-2 py-2 last:border-0"
              >
                <span className="w-5 font-display font-bold text-muted">{i + 4}</span>
                <Avatar players={state.players} id={p.id} size="sm" />
                <span className="flex-1 truncate text-left font-medium">
                  {p.id === me ? "Você" : p.name}
                </span>
                {state.pink_cow_player_id === p.id && <PinkCow label="" />}
                <span className="font-display font-bold tabular-nums">{p.score}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {state.pink_cow_player_id && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <PinkCow label="" />
          {state.pink_cow_player_id === me
            ? "Você terminou com a Vaca Rosa. Mais sorte na próxima!"
            : `${standings.find((p) => p.id === state.pink_cow_player_id)?.name} terminou com a Vaca Rosa.`}
        </p>
      )}

      <RecapCard state={state} me={me} />

      <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
        {isHost ? (
          <Button size="lg" onClick={() => send({ type: "restart" })} className="w-full sm:w-auto">
            Jogar de novo 🔁
          </Button>
        ) : (
          <p className="font-display text-muted">
            Esperando {host ? <b className="text-ink">{host.name}</b> : "o anfitrião"} começar outra…
          </p>
        )}
        <Link href="/" className={cx(buttonClass("ghost", "lg"), "w-full sm:w-auto")}>
          Sair
        </Link>
      </div>
    </div>
  );
}
