"use client";

import type { ReactNode } from "react";
import type { GameState } from "@/lib/types";
import { Card, Eyebrow, cx } from "./ui";

type Send = (m: Record<string, unknown>) => void;

const MODES = [
  {
    mode: "deck",
    icon: "🃏",
    title: "Do baralho",
    text: "Cada rodada sorteia uma pergunta pronta.",
  },
  {
    mode: "players",
    icon: "✍️",
    title: "Dos jogadores",
    text: "Cada um na sua vez escreve a pergunta — ou sorteia do baralho.",
  },
] as const;

export const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  "name-a": { icon: "🏷️", label: "Diga um…" },
  everyday: { icon: "🏠", label: "Dia a dia" },
  opinion: { icon: "💭", label: "Opinião" },
  estimate: { icon: "🔢", label: "Estimativas" },
  dilemma: { icon: "⚖️", label: "Dilemas" },
  herd: { icon: "🐑", label: "Mente de manada" },
};

const TARGETS = [
  { value: 5, hint: "rápido" },
  { value: 8, hint: "clássico" },
  { value: 12, hint: "longo" },
];

const COW_ROUNDS = [
  { value: "off", label: "Desligado" },
  { value: "every4", label: "A cada 4" },
  { value: "random", label: "Surpresa" },
] as const;

const COW_ROUND_HINT: Record<string, string> = {
  off: "Toda rodada é normal: vale estar na manada.",
  every4: "Na 4ª, 8ª, 12ª… rodada, quem responder sozinho ganha o ponto.",
  random: "De vez em quando, sem aviso prévio, vale ser o único.",
};

const TIMERS = [
  { value: 0, label: "Sem limite" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
];

/** Lobby settings. Everyone sees them; only the host can change them. */
export function SettingsCard({
  state,
  isHost,
  send,
}: {
  state: GameState;
  isHost: boolean;
  send: Send;
}) {
  const update = (settings: Record<string, unknown>) =>
    send({ type: "update_settings", settings });

  const all = state.categories_available.map((c) => c.id);
  const selected = state.categories.length ? state.categories : all;
  const toggleCategory = (id: string) => {
    const on = selected.includes(id);
    if (on && selected.length === 1) return; // keep at least one
    update({ categories: on ? selected.filter((c) => c !== id) : [...selected, id] });
  };
  const deckSize = state.categories_available
    .filter((c) => selected.includes(c.id))
    .reduce((n, c) => n + c.count, 0);

  return (
    <Card className="flex flex-col gap-6 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Regras da partida</h2>
        {!isHost && <span className="text-xs text-muted">o anfitrião escolhe</span>}
      </div>

      <Section title="Perguntas">
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => {
            const active = state.question_mode === m.mode;
            return (
              <button
                key={m.mode}
                role="radio"
                aria-checked={active}
                disabled={!isHost}
                onClick={() => !active && update({ question_mode: m.mode })}
                className={cx(
                  "flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-all",
                  active ? "border-pasture bg-pasture-soft" : "border-border bg-surface",
                  isHost && !active && "hover:-translate-y-0.5 hover:border-pasture/60",
                  !isHost && !active && "opacity-50",
                )}
              >
                <span className="text-2xl" aria-hidden>{m.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 font-display font-semibold">
                    {m.title}
                    <Check on={active} />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{m.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Categorias do baralho"
        aside={`${deckSize} perguntas`}
      >
        <div className="flex flex-wrap gap-2">
          {state.categories_available.map((c) => {
            const on = selected.includes(c.id);
            const meta = CATEGORY_LABELS[c.id] ?? { icon: "❓", label: c.id };
            const last = on && selected.length === 1;
            return (
              <button
                key={c.id}
                role="checkbox"
                aria-checked={on}
                disabled={!isHost || last}
                title={last ? "Deixe pelo menos uma categoria" : undefined}
                onClick={() => toggleCategory(c.id)}
                className={cx(
                  "flex items-center gap-1.5 rounded-full border-2 py-1 pr-3 pl-2 text-sm font-semibold transition-all",
                  on ? "border-pasture bg-pasture-soft text-ink" : "border-border bg-surface text-muted line-through decoration-2",
                  isHost && !last && "hover:border-pasture/60",
                  !isHost && !on && "opacity-50",
                )}
              >
                <span aria-hidden>{meta.icon}</span>
                {meta.label}
                <span className="text-xs font-normal text-muted no-underline">{c.count}</span>
              </button>
            );
          })}
        </div>
        {state.question_mode === "players" && (
          <p className="mt-2 text-xs text-muted">Usadas quando alguém escolhe “Sortear”.</p>
        )}
      </Section>

      <Section title="Vaca Rosa">
        <div className="grid gap-4 rounded-2xl border-2 border-cow/60 bg-cow-soft/50 p-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 font-display text-sm font-semibold">
              🐄 Rodadas da Vaca
            </p>
            <Segmented
              options={COW_ROUNDS.map((o) => ({
                value: o.value,
                label: <span className="font-display text-sm font-semibold">{o.label}</span>,
              }))}
              value={state.cow_rounds}
              disabled={!isHost}
              onChange={(v) => update({ cow_rounds: v })}
            />
            <p className="mt-1.5 text-xs text-muted">{COW_ROUND_HINT[state.cow_rounds]}</p>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 font-display text-sm font-semibold">
              🥛 Leite azedo
            </p>
            <button
              role="switch"
              aria-checked={state.sour_milk}
              disabled={!isHost}
              onClick={() => update({ sour_milk: !state.sour_milk })}
              className={cx(
                "flex min-h-11 w-full items-center gap-3 rounded-2xl bg-cream-deep p-1.5 pr-3 text-left transition-colors",
                isHost && "hover:bg-cream",
              )}
            >
              <span
                className={cx(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  state.sour_milk ? "bg-cow-deep" : "bg-border",
                )}
              >
                <span
                  className={cx(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                    state.sour_milk ? "left-6" : "left-1",
                  )}
                />
              </span>
              <span className="font-display text-sm font-semibold">
                {state.sour_milk ? "Ligado" : "Desligado"}
              </span>
            </button>
            <p className="mt-1.5 text-xs text-muted">
              Quem passar uma rodada inteira com a Vaca Rosa perde 1 ponto.
            </p>
          </div>
        </div>
      </Section>

      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Pontos para vencer">
          <Segmented
            options={TARGETS.map((t) => ({
              value: t.value,
              label: (
                <>
                  <span className="font-display text-lg leading-none font-bold">{t.value}</span>
                  <span className="text-[11px] font-medium text-muted">{t.hint}</span>
                </>
              ),
            }))}
            value={state.win_target}
            disabled={!isHost}
            onChange={(v) => update({ win_target: v })}
          />
        </Section>

        <Section title="Tempo para responder">
          <Segmented
            options={TIMERS.map((t) => ({
              value: t.value,
              label: <span className="font-display text-sm font-semibold">{t.label}</span>,
            }))}
            value={state.timer_seconds}
            disabled={!isHost}
            onChange={(v) => update({ timer_seconds: v })}
          />
          <p className="mt-2 text-xs text-muted">
            {state.timer_seconds
              ? "Quem não responder a tempo fica de fora da rodada."
              : "A rodada espera todo mundo responder."}
          </p>
        </Section>
      </div>
    </Card>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <Eyebrow>{title}</Eyebrow>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  disabled,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  disabled: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="grid gap-1 rounded-2xl bg-cream-deep p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(o.value)}
            className={cx(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-all",
              active ? "bg-surface text-ink shadow-card-sm" : "text-muted",
              !disabled && !active && "hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={cx(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] text-white",
        on ? "border-pasture bg-pasture" : "border-border",
      )}
    >
      {on && "✓"}
    </span>
  );
}
