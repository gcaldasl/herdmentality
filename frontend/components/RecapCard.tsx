"use client";

import { useRef, useState } from "react";
import type { GameState, RecapAward } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CowArt } from "./CowArt";
import { Button, Spinner, cx } from "./ui";

const AWARDS: Record<
  RecapAward["id"],
  { icon: string; title: string; unit: (n: number) => string }
> = {
  loyal_sheep: {
    icon: "🐑",
    title: "Ovelha mais fiel",
    unit: (n) => `${n} ${n === 1 ? "rodada" : "rodadas"} na manada`,
  },
  lone_wolf: {
    icon: "🐺",
    title: "Lobo solitário",
    unit: (n) => `${n} ${n === 1 ? "resposta solitária" : "respostas solitárias"}`,
  },
  cow_keeper: {
    icon: "🐄",
    title: "Vaca de estimação",
    unit: (n) => `${n} ${n === 1 ? "rodada" : "rodadas"} seguidas com a Vaca Rosa`,
  },
};

/** Game-over summary: rounds, awards, final scores. Exportable as a PNG. */
export function RecapCard({ state, me }: { state: GameState; me: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const recap = state.recap;
  if (!recap) return null;

  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? "?";
  const names = (ids: string[]) => ids.map(nameOf).join(" e ");
  const winner = state.players.find((p) => p.id === state.winner_player_id);
  const standings = [...state.players].sort((a, b) =>
    a.id === state.winner_player_id ? -1 : b.id === state.winner_player_id ? 1 : b.score - a.score,
  );

  const exportImage = async (mode: "share" | "download") => {
    const node = cardRef.current;
    if (!node) return;
    setBusy(true);
    setNote(null);
    try {
      const { toBlob } = await import("html-to-image");
      const background = getComputedStyle(document.body).backgroundColor;
      const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: background });
      if (!blob) throw new Error("no image");
      const file = new File([blob], `efeito-manada-${state.code}.png`, { type: "image/png" });

      if (mode === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Efeito Manada",
          text: winner ? `${winner.name} venceu no Efeito Manada! 🐄` : "Efeito Manada 🐄",
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setNote("Imagem salva!");
      }
    } catch (e) {
      // The share sheet throws AbortError when the user just closes it.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setNote("Não deu para gerar a imagem. Tente de novo.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex w-full flex-col items-center gap-3">
      {/* Everything inside this node ends up in the image. */}
      <div
        ref={cardRef}
        className="w-full max-w-lg overflow-hidden rounded-3xl border-2 border-border bg-surface text-left"
      >
        <header className="flex items-center gap-3 bg-field px-5 py-4 text-white">
          <CowArt className="w-11" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight font-bold">
              Efeito <span className="text-[#7ee29a]">Manada</span>
            </p>
            <p className="text-xs text-white/70">
              Sala {state.code} · {recap.rounds.length}{" "}
              {recap.rounds.length === 1 ? "rodada" : "rodadas"} ·{" "}
              {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
          <span className="text-3xl" aria-hidden>🏆</span>
        </header>

        <div className="flex flex-col gap-5 p-5">
          {winner && (
            <div className="flex items-center gap-3">
              <Avatar players={state.players} id={winner.id} size="lg" ring="hay" />
              <div>
                <p className="text-xs font-semibold tracking-widest text-muted uppercase">Vencedor</p>
                <p className="font-display text-2xl font-bold">
                  {winner.name}
                  {winner.id === me && <span className="text-base font-medium text-muted"> (você)</span>}
                </p>
                <p className="text-sm text-muted">{winner.score} pontos</p>
              </div>
            </div>
          )}

          <ul className="flex flex-wrap gap-1.5">
            {standings.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-1.5 rounded-full bg-cream py-0.5 pr-2.5 pl-0.5 text-sm"
              >
                <Avatar players={state.players} id={p.id} size="xs" />
                <span className="font-semibold">{p.name}</span>
                <span className="font-display font-bold text-muted tabular-nums">{p.score}</span>
                {state.pink_cow_player_id === p.id && <span aria-label="Vaca Rosa">🐄</span>}
              </li>
            ))}
          </ul>

          {recap.awards.length > 0 && (
            <div className="grid gap-2">
              {recap.awards.map((a) => {
                const meta = AWARDS[a.id];
                return (
                  <div
                    key={a.id}
                    className={cx(
                      "flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5",
                      a.id === "cow_keeper" ? "border-cow bg-cow-soft" : "border-border bg-cream",
                    )}
                  >
                    <span className="text-3xl" aria-hidden>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                        {meta.title}
                      </p>
                      <p className="font-display text-lg leading-tight font-bold">{names(a.player_ids)}</p>
                      <p className="text-xs text-muted">{meta.unit(a.value)}</p>
                    </div>
                    <span className="flex -space-x-2">
                      {a.player_ids.map((id) => (
                        <Avatar key={id} players={state.players} id={id} size="sm" className="ring-2 ring-surface" />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">
              O que a manada disse
            </p>
            <ol className="flex flex-col divide-y-2 divide-border">
              {recap.rounds.map((r) => (
                <li key={r.number} className="flex gap-3 py-2">
                  <span className="w-5 shrink-0 pt-0.5 text-right font-display text-sm font-bold text-muted">
                    {r.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">{r.question}</p>
                    {r.cow_round ? (
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="rounded-full bg-cow px-2 py-0.5 font-display text-xs font-bold text-[#5a1030]">
                          🐄 Rodada da Vaca
                        </span>
                        {r.solo && r.solo.length > 0 ? (
                          r.solo.map((s) => (
                            <span key={s.player_id} className="flex items-center gap-1">
                              <Avatar players={state.players} id={s.player_id} size="xs" />
                              <span className="font-display font-bold text-cow-deep">“{s.label}”</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-muted">ninguém ficou sozinho</span>
                        )}
                      </p>
                    ) : r.herd_label ? (
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-display text-lg font-bold text-pasture">
                          “{r.herd_label}”
                        </span>
                        <span className="flex -space-x-1.5">
                          {r.herd_player_ids.map((id) => (
                            <Avatar key={id} players={state.players} id={id} size="xs" className="ring-2 ring-surface" />
                          ))}
                        </span>
                      </p>
                    ) : (
                      <p className="font-display font-semibold text-muted">
                        🤷 empate
                        {r.tied_labels.length > 0 && `: ${r.tied_labels.map((l) => `“${l}”`).join(" × ")}`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <footer className="border-t-2 border-border px-5 py-2.5 text-center text-xs text-muted">
          Pense como a manada. Fuja da Vaca Rosa. 🐄
        </footer>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={() => exportImage("share")} disabled={busy}>
          {busy ? <Spinner /> : "📤"} Compartilhar resumo
        </Button>
        <Button variant="ghost" onClick={() => exportImage("download")} disabled={busy}>
          ⬇️ Baixar imagem
        </Button>
      </div>
      {note && <p className="text-sm text-muted">{note}</p>}
    </section>
  );
}
