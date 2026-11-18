"use client";

import type { GameState } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";
import { CowArt } from "./CowArt";
import { CowRoundBanner } from "./CowRoundBanner";
import { ActionBar, Button, Card, Eyebrow, cx } from "./ui";

interface Props {
  state: GameState;
  me: string;
  send: (m: Record<string, unknown>) => void;
}

export function ResultsBoard({ state, me, send }: Props) {
  const isHost = state.host_player_id === me;
  const host = state.players.find((p) => p.id === state.host_player_id);
  const result = state.result;
  const nameOf = (id: string | null) =>
    id === me ? "você" : (state.players.find((p) => p.id === id)?.name ?? "—");

  const herd = state.groups.find((g) => g.key === result?.herd_group_key) ?? null;
  const top = Math.max(0, ...state.groups.map((g) => g.player_ids.length));
  const tied = herd ? [] : state.groups.filter((g) => g.player_ids.length === top);
  const others = state.groups
    .filter((g) => g.key !== herd?.key)
    .sort((a, b) => b.player_ids.length - a.player_ids.length);

  const cowRound = !!result?.cow_round;
  const soloGroups = state.groups.filter((g) => g.player_ids.length === 1);
  const soured = result?.sour_milk_player_id ?? null;
  const scored = (result?.point_deltas[me] ?? 0) > 0;
  const gotCow = !!result?.cow_moved && result.new_cow_holder === me;
  const lostCow = !!result?.cow_moved && result.previous_cow_holder === me;
  const blocked = state.players.find(
    (p) => p.id === state.pink_cow_player_id && p.score >= state.win_target,
  );

  const answered = state.groups.some((g) => g.player_ids.includes(me));

  const iSoured = soured === me && !!result?.sour_milk_lost;

  const base = !answered
    ? {
        tone: "meh",
        title: "Você ficou de fora",
        sub: state.timer_seconds ? "O tempo acabou antes da sua resposta." : "Você não respondeu nesta rodada.",
      }
    : cowRound
    ? scored
      ? { tone: "win", title: "Você foi o único!", sub: "Rodada da Vaca: resposta solitária vale +1." }
      : { tone: "meh", title: "Dessa vez não…", sub: "Na Rodada da Vaca, só pontua quem responde sozinho." }
    : gotCow
    ? { tone: "cow", title: "A Vaca Rosa é sua!", sub: "Você foi a voz solitária desta rodada." }
    : scored
      ? {
          tone: "win",
          title: "Você está na manada!",
          sub: lostCow ? "+1 ponto — e ainda se livrou da Vaca Rosa. 🎉" : "+1 ponto para você.",
        }
      : lostCow
        ? { tone: "meh", title: "Ufa! Adeus, Vaca Rosa.", sub: "Sem ponto, mas a vaca foi pra outro pasto." }
        : herd
          ? { tone: "meh", title: "Dessa vez não…", sub: "Você ficou fora da manada." }
          : { tone: "meh", title: "Ninguém pontua", sub: "A manada se dividiu nesta rodada." };
  const personal = iSoured
    ? { ...base, sub: scored ? `${base.sub.replace(/\.$/, "")} — mas o leite azedou (−1).` : base.sub }
    : base;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {scored && <Confetti />}

      <div
        className={cx(
          "flex animate-pop items-center gap-4 rounded-3xl border-2 p-5 shadow-card",
          personal.tone === "win" && "border-pasture bg-pasture-soft",
          personal.tone === "cow" && "border-cow-deep bg-cow-soft",
          personal.tone === "meh" && "border-border bg-surface",
        )}
      >
        <span className="shrink-0">
          {personal.tone === "cow" ? (
            <CowArt pink className="w-16 animate-wiggle" />
          ) : (
            <span className="text-5xl">{personal.tone === "win" ? "🎉" : "🌾"}</span>
          )}
        </span>
        <div>
          <Eyebrow>Rodada {state.round_number}</Eyebrow>
          <p className="font-display text-2xl font-bold sm:text-3xl">{personal.title}</p>
          <p className="text-sm text-muted">{personal.sub}</p>
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <p className="text-sm text-muted">{state.question}</p>
        {cowRound ? (
          <>
            <CowRoundBanner compact className="mt-2" />
            {soloGroups.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {soloGroups.map((g, i) => (
                  <li
                    key={g.key}
                    className="flex animate-pop items-center gap-2 rounded-full bg-cow-soft py-1 pr-3 pl-1"
                    style={{ animationDelay: `${200 + i * 90}ms` }}
                  >
                    <Avatar players={state.players} id={g.player_ids[0]} size="sm" />
                    <span className="text-sm">
                      <b>{nameOf(g.player_ids[0])}</b>: “{g.label}”
                    </span>
                    <span className="font-display text-sm font-bold text-cow-deep">+1</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 font-display text-xl font-bold">
                Ninguém ficou sozinho — ninguém pontua 🤷
              </p>
            )}
          </>
        ) : herd ? (
          <>
            <p className="mt-1 font-display text-lg font-semibold">A manada disse</p>
            <p className="font-display text-4xl font-bold text-pasture">“{herd.label}”</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {herd.answers.map((a, i) => (
                <li
                  key={a.player_id}
                  className="flex animate-pop items-center gap-2 rounded-full bg-pasture-soft py-1 pr-3 pl-1"
                  style={{ animationDelay: `${200 + i * 90}ms` }}
                >
                  <Avatar players={state.players} id={a.player_id} size="sm" />
                  <span className="text-sm font-semibold">{nameOf(a.player_id)}</span>
                  <span className="font-display text-sm font-bold text-pasture">+1</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mt-1 font-display text-lg font-semibold">Empate na frente 🤷</p>
            <p className="font-display text-3xl font-bold break-words">
              {tied.map((g, i) => (
                <span key={g.key}>
                  {i > 0 && <span className="px-2 text-muted">×</span>}“{g.label}”
                </span>
              ))}
            </p>
            <p className="mt-1 text-sm text-muted">
              Quando os maiores grupos empatam, ninguém pontua.
            </p>
          </>
        )}
      </Card>

      {result?.cow_moved && result.new_cow_holder && (
        <div className="rounded-3xl border-2 border-cow bg-cow-soft p-4 text-center shadow-card">
          <p className="font-display font-semibold">
            A <span className="text-cow-deep">Vaca Rosa</span>{" "}
            {result.previous_cow_holder ? "mudou de dono" : "encontrou seu primeiro dono"}
          </p>
          <p className="text-xs text-muted">
            {nameOf(result.new_cow_holder) === "você" ? "Você foi" : `${nameOf(result.new_cow_holder)} foi`} a única
            resposta diferente de todas.
          </p>
        <div className="mt-3 flex items-center justify-center gap-3 sm:gap-5">
          {result.previous_cow_holder ? (
            <PersonStub state={state} id={result.previous_cow_holder} label={nameOf(result.previous_cow_holder)} />
          ) : (
            <span className="flex flex-col items-center gap-1">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep text-2xl">🏚️</span>
              <span className="text-sm font-semibold text-muted">curral</span>
            </span>
          )}
          <span className="flex flex-col items-center">
            <CowArt pink className="w-12 animate-bob" />
            <span className="font-display text-xl text-cow-deep">→</span>
          </span>
          <PersonStub state={state} id={result.new_cow_holder} label={nameOf(result.new_cow_holder)} />
        </div>
        </div>
      )}

      {soured && (
        <div className="flex animate-pop items-center gap-3 rounded-3xl border-2 border-barn/50 bg-barn-soft p-4 shadow-card">
          <span className="text-4xl" aria-hidden>🥛</span>
          <p className="text-sm">
            <b className="font-display text-base">Leite azedo!</b>{" "}
            {soured === me ? "Você segurou" : `${nameOf(soured)} segurou`} a Vaca Rosa a rodada toda
            {result?.sour_milk_lost
              ? " e perdeu 1 ponto."
              : ", mas não tinha ponto nenhum para perder."}
          </p>
        </div>
      )}

      {blocked && (
        <p className="rounded-2xl bg-hay-soft px-4 py-3 text-center text-sm">
          🏁 <b>{nameOf(blocked.id)}</b> já tem pontos para vencer, mas está com a Vaca
          Rosa — precisa passá-la adiante primeiro!
        </p>
      )}

      {others.length > 0 && (
        <details className="group rounded-3xl border-2 border-border bg-surface/70 p-4" open={others.length <= 4}>
          <summary className="cursor-pointer list-none font-display font-semibold">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>{" "}
            {herd && !cowRound ? "Outras respostas" : "Todas as respostas"}
          </summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {others.map((g) => (
              <li key={g.key} className="flex items-center justify-between gap-2 rounded-2xl bg-cream px-3 py-2">
                <span className="truncate font-semibold">{g.label}</span>
                <span className="flex -space-x-2">
                  {g.player_ids.map((id) => (
                    <Avatar key={id} players={state.players} id={id} size="xs" className="ring-2 ring-cream" />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ActionBar>
        {isHost ? (
          <Button size="lg" onClick={() => send({ type: "next_round" })} className="w-full sm:w-auto sm:min-w-64">
            Próxima rodada →
          </Button>
        ) : (
          <p className="flex items-center gap-2 font-display text-muted">
            <span className="animate-bob" aria-hidden>⏳</span>
            Esperando {host ? <b className="text-ink">{host.name}</b> : "o anfitrião"} seguir…
          </p>
        )}
      </ActionBar>
    </div>
  );
}

function PersonStub({ state, id, label }: { state: GameState; id: string; label: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <Avatar players={state.players} id={id} />
      <span className="max-w-24 truncate text-sm font-semibold">{label}</span>
    </span>
  );
}
