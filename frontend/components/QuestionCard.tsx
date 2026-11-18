"use client";

import { useState } from "react";
import type { GameState } from "@/lib/types";
import { useSecondsLeft } from "@/lib/clock";
import { loadAnswer, saveAnswer } from "@/lib/session";
import { Avatar } from "./Avatar";
import { CowArt } from "./CowArt";
import { CowRoundBanner } from "./CowRoundBanner";
import { LastChance } from "./LastChance";
import { QuestionCredit } from "./QuestionCredit";
import { RoundTimer } from "./RoundTimer";
import { Button, Card, Eyebrow, cx } from "./ui";

interface Props {
  state: GameState;
  me: string;
  send: (m: Record<string, unknown>) => void;
}

export function QuestionCard({ state, me, send }: Props) {
  const answeredOnServer = state.answered_player_ids.includes(me);
  // This component is remounted every round (keyed by the room page).
  const [submitted, setSubmitted] = useState(() =>
    answeredOnServer ? loadAnswer(state.code, state.round_number) : "",
  );
  const [text, setText] = useState(submitted);
  const [editing, setEditing] = useState(false);

  const locked = (answeredOnServer || !!submitted) && !editing;
  const connected = state.players.filter((p) => p.connected);
  const count = connected.filter((p) => state.answered_player_ids.includes(p.id)).length;
  const pending = connected.filter((p) => !state.answered_player_ids.includes(p.id));
  const haveCow = state.pink_cow_player_id === me;
  const secondsLeft = useSecondsLeft(state.deadline);
  const timeUp = secondsLeft !== null && secondsLeft <= 0;

  const submit = () => {
    const value = text.trim();
    if (!value || timeUp) return;
    send({ type: "submit_answer", text: value });
    saveAnswer(state.code, state.round_number, value);
    setSubmitted(value);
    setEditing(false);
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      <Card className="px-6 pt-8 pb-7 text-center sm:px-10 sm:pt-10">
        {secondsLeft !== null && state.closing ? (
          <div className="mb-5">
            <LastChance secondsLeft={secondsLeft} />
          </div>
        ) : secondsLeft !== null && state.timer_seconds > 0 ? (
          <div className="mb-4">
            <RoundTimer secondsLeft={secondsLeft} total={state.timer_seconds} />
          </div>
        ) : null}
        {state.cow_round && <CowRoundBanner className="mb-5" />}
        <Eyebrow>Rodada {state.round_number}</Eyebrow>
        <QuestionCredit state={state} me={me} className="mt-2" />
        <h1 className="mt-3 font-display text-3xl leading-tight font-bold text-balance sm:text-4xl">
          {state.question}
        </h1>

        {locked ? (
          <div className="mt-7 flex animate-pop flex-col items-center gap-3">
            <div className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-pasture bg-pasture-soft px-4 py-3 text-left">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-pasture uppercase">
                  ✓ Sua resposta
                </p>
                <p className="truncate font-display text-2xl font-semibold">
                  {submitted || "Enviada"}
                </p>
              </div>
              <Button
                variant="ghost"
                disabled={timeUp}
                onClick={() => {
                  setText(submitted);
                  setEditing(true);
                }}
              >
                Mudar
              </Button>
            </div>
            <p className="text-sm text-muted">
              {state.closing
                ? "Os outros já responderam — mude agora ou nunca!"
                : state.deadline
                ? "Dá para mudar até o tempo acabar."
                : "Dá para mudar até a última pessoa responder."}
            </p>
          </div>
        ) : (
          <form
            className="mt-7 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
              disabled={timeUp}
              autoFocus
              enterKeyHint="send"
              autoComplete="off"
              placeholder={
                timeUp
                  ? "O tempo acabou!"
                  : state.cow_round
                    ? "Algo que ninguém mais vai dizer…"
                    : "O que a manada vai dizer?"
              }
              aria-label="Sua resposta"
              className="min-w-0 flex-1 rounded-2xl border-2 border-border bg-cream px-5 py-4 text-center font-display text-xl font-medium outline-none transition-colors focus:border-pasture focus:bg-surface disabled:opacity-50 sm:text-left"
            />
            <Button type="submit" size="lg" disabled={!text.trim() || timeUp}>
              {editing ? "Atualizar" : "Enviar"}
            </Button>
          </form>
        )}
      </Card>

      {haveCow && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-cow bg-cow-soft px-4 py-3 text-sm">
          <CowArt pink className="w-10 shrink-0 animate-wiggle" />
          <p>
            <b>Você está com a Vaca Rosa.</b>{" "}
            {state.cow_round
              ? "Nesta Rodada da Vaca ela não muda de dono."
              : "Ela só sai de você quando alguém responder algo que ninguém mais respondeu."}
            {state.sour_milk && (
              <>
                {" "}
                <b>🥛 Leite azedo:</b> se ela ainda for sua no fim da rodada, você perde 1 ponto.
              </>
            )}
          </p>
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="font-display font-semibold">
            {pending.length === 0
              ? "Todo mundo respondeu!"
              : `${count} de ${connected.length} responderam`}
          </p>
          {pending.length > 0 && (
            <p className="truncate text-sm text-muted sm:pl-3">
              esperando {pending.map((p) => (p.id === me ? "você" : p.name)).join(", ")}
            </p>
          )}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-cream-deep">
          <div
            className="h-full rounded-full bg-pasture transition-[width] duration-500"
            style={{ width: `${connected.length ? (count / connected.length) * 100 : 0}%` }}
          />
        </div>
        <ul className="mt-4 flex flex-wrap gap-3">
          {connected.map((p) => {
            const done = state.answered_player_ids.includes(p.id);
            return (
              <li key={p.id} className="flex flex-col items-center gap-1">
                <span className="relative">
                  <Avatar
                    players={state.players}
                    id={p.id}
                    className={cx(!done && "animate-pulse-soft")}
                    ring={done ? "pasture" : null}
                  />
                  {done && (
                    <span className="absolute -right-1 -bottom-1 flex h-5 w-5 animate-pop items-center justify-center rounded-full bg-pasture text-xs font-bold text-white ring-2 ring-surface">
                      ✓
                    </span>
                  )}
                </span>
                <span className="max-w-16 truncate text-xs text-muted">
                  {p.id === me ? "você" : p.name}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
