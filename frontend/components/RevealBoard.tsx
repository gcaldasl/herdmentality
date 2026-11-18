"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState, GroupAnswer, GroupView } from "@/lib/types";
import { useSecondsSince } from "@/lib/clock";
import { revealSchedule } from "@/lib/revealSchedule";
import { previewRound } from "@/lib/rules";
import { play } from "@/lib/sounds";
import { Avatar } from "./Avatar";
import { CowRoundBanner } from "./CowRoundBanner";
import { PinkCow } from "./PinkCow";
import { QuestionCredit } from "./QuestionCredit";
import { Button, Eyebrow, cx } from "./ui";

interface Props {
  state: GameState;
  me: string;
  send: (m: Record<string, unknown>) => void;
}

type WireGroup = { key: string; label: string; player_ids: string[] };

function findAnswerText(groups: GroupView[], playerId: string): string {
  for (const g of groups) {
    const a = g.answers.find((x) => x.player_id === playerId);
    if (a) return a.text;
  }
  return "resposta";
}

function movePlayer(
  groups: GroupView[],
  playerId: string,
  targetKey: string | null,
): WireGroup[] {
  const stripped: WireGroup[] = groups.map((g) => ({
    key: g.key,
    label: g.label,
    player_ids: g.player_ids.filter((id) => id !== playerId),
  }));

  if (targetKey) {
    const target = stripped.find((g) => g.key === targetKey);
    if (target) target.player_ids.push(playerId);
  } else {
    stripped.push({
      key: `new-${Date.now()}`,
      label: findAnswerText(groups, playerId),
      player_ids: [playerId],
    });
  }
  return stripped.filter((g) => g.player_ids.length > 0);
}

export function RevealBoard({ state, me, send }: Props) {
  const isHost = state.host_player_id === me;
  const host = state.players.find((p) => p.id === state.host_player_id);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // ---- staged reveal: flip answers one by one, then show the groups ----
  const [skipped, setSkipped] = useState(false);
  const elapsed = useSecondsSince(state.revealed_at);
  const schedule = revealSchedule(state.groups, `${state.code}-${state.round_number}`);
  const t = skipped || elapsed === null ? Infinity : elapsed;
  const flipped = schedule.flipAt.filter((at) => t >= at).length;
  const showGroups = t >= schedule.groupAt;
  const staging = t < schedule.doneAt && state.groups.length > 0;
  const canEdit = isHost && !staging;

  const lastFlipped = useRef<number | null>(null);
  useEffect(() => {
    if (lastFlipped.current !== null && flipped > lastFlipped.current) play("flip");
    lastFlipped.current = flipped;
  }, [flipped]);

  // Biggest groups first; ties keep server order.
  const groups = state.groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.player_ids.length - a.g.player_ids.length || a.i - b.i)
    .map(({ g }) => g);

  const preview = previewRound(state.groups, state.pink_cow_player_id, {
    cowRound: state.cow_round,
    sourMilk: state.sour_milk,
  });
  const wasGrouped = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasGrouped.current === false && showGroups) play(preview.scorers.length ? "tada" : "blip");
    wasGrouped.current = showGroups;
  }, [showGroups, preview.scorers.length]);
  const nameOf = (id: string | null) =>
    id === me ? "você" : (state.players.find((p) => p.id === id)?.name ?? "—");
  const selectedGroup = groups.find((g) => selected && g.player_ids.includes(selected));
  const grouped = new Set(state.groups.flatMap((g) => g.player_ids));
  const leftOut = state.players.filter((p) => !grouped.has(p.id));

  const move = (targetKey: string | null) => {
    if (!selected) return;
    // Moving a lone answer into "a new group" is a no-op.
    if (targetKey === null && selectedGroup?.player_ids.length === 1) return setSelected(null);
    if (targetKey !== null && selectedGroup?.key === targetKey) return setSelected(null);
    send({ type: "regroup", groups: movePlayer(state.groups, selected, targetKey) });
    setSelected(null);
  };

  const dropProps = (key: string | null) =>
    canEdit
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(key ?? "__new");
          },
          onDragLeave: () => setDragOver(null),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(null);
            move(key);
          },
        }
      : {};

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5 pb-28">
      <div className="text-center">
        <Eyebrow>Rodada {state.round_number} · Revelação</Eyebrow>
        <QuestionCredit state={state} me={me} className="mt-1.5" />
        <h1 className="mt-2 font-display text-2xl font-bold text-balance sm:text-3xl">
          {state.question}
        </h1>
        {state.cow_round && <CowRoundBanner compact className="mx-auto mt-3 max-w-xl" />}
      </div>

      {staging ? (
        <div className="flex items-center justify-center gap-3">
          <p className="flex items-center gap-2 font-display text-lg text-muted">
            <span className="animate-bob" aria-hidden>🥁</span>
            {showGroups ? "E a manada disse…" : "Revelando as respostas…"}
          </p>
          <Button variant="ghost" onClick={() => setSkipped(true)}>
            Pular ⏭
          </Button>
        </div>
      ) : isHost ? (
        <div className="flex animate-rise items-start gap-3 rounded-2xl border-2 border-hay bg-hay-soft px-4 py-3 text-sm">
          <span className="text-2xl" aria-hidden>🧑‍🌾</span>
          <p>
            {selected ? (
              <>
                Movendo <b>“{findAnswerText(state.groups, selected)}”</b>. Toque no grupo de
                destino
                {selectedGroup && selectedGroup.player_ids.length > 1 && (
                  <> — ou em <b>Novo grupo</b> para separá-la</>
                )}
                .{" "}
                <button onClick={() => setSelected(null)} className="font-semibold underline">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <b>Você é o juiz.</b> Juntamos as respostas parecidas automaticamente;
                se duas respostas querem dizer a mesma coisa, toque (ou arraste) uma
                delas até o grupo certo.
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 text-center text-muted">
          <span className="animate-bob" aria-hidden>👀</span>
          <span>
            <b className="text-ink">{host?.name ?? "O anfitrião"}</b> está conferindo as
            respostas…
          </span>
        </p>
      )}

      {!showGroups && (
        <StagedAnswers state={state} me={me} order={schedule.order} flipped={flipped} />
      )}

      {showGroups && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g, gi) => {
            const isHerd = preview.herdKey === g.key;
            const isTied = preview.tiedKeys.includes(g.key);
            const isLoner = g.player_ids.length === 1 && !isHerd;
            // With 2+ lone answers the cow stays put, so only flag the one that takes it.
            const takesCow = isLoner && !state.cow_round && preview.loners.length === 1;
            const scoresSolo = isLoner && state.cow_round;
            const target = canEdit && selected && !g.player_ids.includes(selected);
            return (
              <div
                key={g.key}
                {...dropProps(g.key)}
                onClick={target ? () => move(g.key) : undefined}
                style={{ animationDelay: `${gi * 60}ms` }}
                className={cx(
                  "flex animate-rise flex-col gap-2 rounded-3xl border-2 bg-surface p-3.5 shadow-card transition-all",
                  isHerd
                    ? "border-pasture"
                    : isTied
                      ? "border-hay"
                      : takesCow || scoresSolo
                        ? "border-cow"
                        : "border-border",
                  target && "cursor-pointer border-dashed hover:-translate-y-0.5 hover:bg-pasture-soft",
                  dragOver === g.key && "scale-[1.02] bg-pasture-soft",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-lg font-bold">{g.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {isHerd && (
                      <span className="animate-pop rounded-full bg-pasture px-2 py-0.5 font-display text-xs font-semibold text-white">
                        🐑 manada
                      </span>
                    )}
                    {isTied && (
                      <span className="rounded-full bg-hay px-2 py-0.5 font-display text-xs font-semibold text-[#3d2e05]">
                        empate
                      </span>
                    )}
                    {isLoner && (
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 font-display text-xs font-semibold",
                          takesCow || scoresSolo ? "bg-cow-soft text-cow-deep" : "bg-cream-deep text-muted",
                        )}
                      >
                        {scoresSolo ? "🐄 +1" : takesCow ? "🐄 sozinho" : "sozinho"}
                      </span>
                    )}
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-cream-deep px-2 font-display text-sm font-bold">
                      {g.player_ids.length}
                    </span>
                  </span>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {g.answers.map((a) => {
                    const isSel = selected === a.player_id;
                    return (
                      <li key={a.player_id}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          draggable={canEdit}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", a.player_id);
                            setSelected(a.player_id);
                          }}
                          onDragEnd={() => setDragOver(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected((s) => (s === a.player_id ? null : a.player_id));
                          }}
                          className={cx(
                            "flex w-full items-center gap-2.5 rounded-2xl border-2 px-2 py-1.5 text-left transition-all",
                            isSel
                              ? "border-hay bg-hay-soft ring-3 ring-hay/40"
                              : a.player_id === me
                                ? "border-pasture/40 bg-pasture-soft"
                                : "border-transparent bg-cream",
                            canEdit ? "cursor-grab hover:border-pasture active:cursor-grabbing" : "cursor-default",
                          )}
                        >
                          <Avatar players={state.players} id={a.player_id} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{a.text}</span>
                            <span className="block truncate text-xs text-muted">
                              {a.player_id === me ? "você" : a.name}
                            </span>
                          </span>
                          {canEdit && (
                            <span className="text-muted" aria-hidden>
                              {isSel ? "✋" : "⋮⋮"}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {target && (
                  <p className="rounded-xl border-2 border-dashed border-pasture py-1.5 text-center font-display text-sm font-semibold text-pasture">
                    ↓ Mover para cá
                  </p>
                )}
              </div>
            );
          })}

          {canEdit && selected && selectedGroup && selectedGroup.player_ids.length > 1 && (
            <button
              type="button"
              {...dropProps(null)}
              onClick={() => move(null)}
              className={cx(
                "flex min-h-28 animate-pop flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-pasture font-display font-semibold text-pasture transition-all hover:bg-pasture-soft",
                dragOver === "__new" && "scale-[1.02] bg-pasture-soft",
              )}
            >
              <span className="text-2xl">＋</span>
              Novo grupo
            </button>
          )}
        </div>
      )}

      {groups.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center font-display text-lg text-muted">
          ⏱ Ninguém respondeu a tempo. Sem manada nesta rodada.
        </p>
      )}

      {leftOut.length > 0 && groups.length > 0 && !staging && (
        <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
          <span>{state.timer_seconds ? "⏱ Sem resposta a tempo:" : "Fora desta rodada:"}</span>
          {leftOut.map((p) => (
            <span key={p.id} className="flex items-center gap-1 rounded-full bg-cream-deep py-0.5 pr-2.5 pl-0.5">
              <Avatar players={state.players} id={p.id} size="xs" dim />
              {nameOf(p.id)}
            </span>
          ))}
        </p>
      )}

      {/* outcome preview + confirm, pinned to the bottom of the screen */}
      {!staging && (
        <div className="fixed inset-x-0 bottom-0 z-20 animate-fade border-t-2 border-border bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:flex-row sm:gap-3 lg:pr-[calc(19rem+2.5rem)]">
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
              <span className="text-muted">Prévia:</span>
              <span className="font-semibold">
                {state.cow_round
                  ? preview.scorers.length
                    ? `🐄 ${preview.scorers.length} ${preview.scorers.length === 1 ? "solitário ganha" : "solitários ganham"} +1`
                    : "🐄 ninguém ficou sozinho — ninguém pontua"
                  : preview.herdKey
                    ? `🐑 ${preview.scorers.length} ganham +1`
                    : "🤷 empate — ninguém pontua"}
              </span>
              {preview.cowMoves && (
                <span className="flex items-center gap-1.5 font-semibold">
                  <PinkCow label="" /> vai para {nameOf(preview.newCowHolder)}
                </span>
              )}
              {preview.soured && (
                <span className="font-semibold text-barn">🥛 {nameOf(preview.soured)} perde 1</span>
              )}
            </div>
            {isHost ? (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => send({ type: "confirm_groups" })}
              >
                Confirmar e pontuar ✓
              </Button>
            ) : (
              <span className="text-xs text-muted">Aguardando confirmação do anfitrião</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Every answer as a face-down card; they flip one by one on the shared timeline. */
function StagedAnswers({
  state,
  me,
  order,
  flipped,
}: {
  state: GameState;
  me: string;
  order: GroupAnswer[];
  flipped: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {order.map((a, i) => {
        const shown = i < flipped;
        const mine = a.player_id === me;
        return (
          <li key={a.player_id} className="min-h-32">
            {shown ? (
              <div
                className={cx(
                  "flex h-full animate-pop flex-col items-center justify-center gap-1.5 rounded-3xl border-2 p-3 text-center shadow-card",
                  mine ? "border-pasture bg-pasture-soft" : "border-border bg-surface",
                )}
              >
                <Avatar players={state.players} id={a.player_id} size="sm" />
                <span className="text-xs text-muted">{mine ? "você" : a.name}</span>
                <span className="font-display text-xl leading-tight font-bold break-words">
                  {a.text}
                </span>
              </div>
            ) : (
              <div
                className={cx(
                  "flex h-full items-center justify-center rounded-3xl border-2 border-dashed border-border bg-cream-deep font-display text-4xl font-bold text-muted/40",
                  i === flipped && "animate-pulse-soft",
                )}
                aria-label="resposta escondida"
              >
                ?
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
