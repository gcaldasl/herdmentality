import type { GameState, PlayerView } from "@/lib/types";
import { Avatar } from "./Avatar";
import { PinkCow } from "./PinkCow";
import { cx } from "./ui";

function ranked(state: GameState): PlayerView[] {
  // Stable within equal scores: keep join order.
  return state.players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.score - a.p.score || a.i - b.i)
    .map(({ p }) => p);
}

function deltaFor(state: GameState, id: string): number {
  if (state.phase !== "scoring" && state.phase !== "game_over") return 0;
  const result = state.result;
  if (!result) return 0;
  const sour = result.sour_milk_player_id === id ? (result.sour_milk_lost ?? 0) : 0;
  return (result.point_deltas[id] ?? 0) - sour;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (!delta) return null;
  return (
    <span
      className={cx(
        "animate-pop rounded-full px-1.5 font-display text-xs font-bold",
        delta > 0 ? "bg-hay text-[#3d2e05]" : "bg-barn text-white",
      )}
      title={delta < 0 ? "Leite azedo" : undefined}
    >
      {delta > 0 ? `+${delta}` : `${delta} 🥛`}
    </span>
  );
}

/** Desktop sidebar. */
export function Scoreboard({ state, me }: { state: GameState; me: string }) {
  const players = ranked(state);
  const inGame = state.phase !== "lobby";

  return (
    <aside className="sticky top-20 hidden flex-col rounded-3xl border-2 border-border bg-surface p-4 shadow-card lg:flex">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-lg font-bold">Placar</h2>
        <span className="text-xs font-medium text-muted">
          primeiro a {state.win_target} 🏁
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {players.map((p) => {
          const hasCow = state.pink_cow_player_id === p.id;
          const delta = deltaFor(state, p.id);
          const pct = Math.min(100, (p.score / state.win_target) * 100);
          const waiting = state.phase === "question" && p.connected && !p.has_answered;
          return (
            <li
              key={p.id}
              className={cx(
                "rounded-2xl px-2.5 py-2 transition-colors",
                p.id === me ? "bg-pasture-soft" : "hover:bg-cream",
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Avatar players={state.players} id={p.id} size="sm" dim={!p.connected} />
                  {state.phase === "question" && p.has_answered && (
                    <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-pasture text-[10px] font-bold text-white ring-2 ring-surface">
                      ✓
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold">
                    <span className="truncate">{p.name}</span>
                    {p.is_host && <span title="anfitrião" className="text-xs">👑</span>}
                    {p.id === me && <span className="text-xs font-normal text-muted">(você)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {!p.connected
                      ? "desconectado"
                      : state.phase === "choosing" && state.chooser_player_id === p.id
                        ? <span className="animate-pulse-soft">✍️ escolhendo a pergunta…</span>
                      : waiting
                        ? <span className="animate-pulse-soft">pensando…</span>
                        : state.phase === "question"
                          ? "respondeu"
                          : null}
                  </p>
                </div>
                {hasCow && <PinkCow label="" className="animate-wiggle" />}
                <DeltaBadge delta={delta} />
                <span className="w-6 text-right font-display text-xl font-bold tabular-nums">
                  {p.score}
                </span>
              </div>
              {inGame && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-deep">
                  <div
                    className={cx(
                      "h-full rounded-full transition-[width] duration-700",
                      hasCow ? "bg-cow" : "bg-hay",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/** Mobile: a compact, horizontally scrolling strip under the header. */
export function ScoreStrip({ state, me }: { state: GameState; me: string }) {
  if (state.phase === "lobby") return null;
  const players = ranked(state);
  return (
    <div className="border-b-2 border-border bg-surface/70 backdrop-blur-sm lg:hidden">
      <ul className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        {players.map((p) => {
          const hasCow = state.pink_cow_player_id === p.id;
          const delta = deltaFor(state, p.id);
          return (
            <li
              key={p.id}
              className={cx(
                "flex shrink-0 items-center gap-1.5 rounded-full border-2 py-0.5 pr-3 pl-0.5",
                p.id === me ? "border-pasture bg-pasture-soft" : "border-border bg-surface",
                !p.connected && "opacity-50",
              )}
            >
              <span className="relative">
                <Avatar players={state.players} id={p.id} size="xs" />
                {state.phase === "question" && p.has_answered && (
                  <span className="absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-pasture text-[8px] font-bold text-white">
                    ✓
                  </span>
                )}
              </span>
              <span className="max-w-20 truncate text-xs font-semibold">{p.name}</span>
              {state.phase === "choosing" && state.chooser_player_id === p.id && (
                <span className="animate-wiggle text-xs" title="escolhendo a pergunta">✍️</span>
              )}
              {hasCow && <PinkCow label="" />}
              <span className="font-display text-sm font-bold tabular-nums">{p.score}</span>
              <DeltaBadge delta={delta} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
