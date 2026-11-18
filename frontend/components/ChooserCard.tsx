"use client";

import { useRef, useState } from "react";
import type { GameState } from "@/lib/types";
import { Avatar } from "./Avatar";
import { ActionBar, ActionBarSpacer, Button, Card, Eyebrow, cx } from "./ui";

interface Props {
  state: GameState;
  me: string;
  send: (m: Record<string, unknown>) => void;
}

const MIN_LEN = 5;
const MAX_LEN = 140;
const STARTERS = ["Diga um…", "Diga uma…", "Qual o melhor…", "Quantos…", "Onde…"];

/** "choosing" phase (players mode): the chooser writes or draws the question. */
export function ChooserCard({ state, me, send }: Props) {
  const chooser = state.players.find((p) => p.id === state.chooser_player_id);
  const isChooser = chooser?.id === me;
  const nextRound = state.round_number + 1;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      {isChooser ? (
        <WriteQuestion state={state} send={send} round={nextRound} />
      ) : (
        <WaitForChooser state={state} me={me} send={send} round={nextRound} />
      )}
      <TurnOrder state={state} me={me} />
      {isChooser && <ActionBarSpacer />}
    </div>
  );
}

function WriteQuestion({
  send,
  round,
}: {
  state: GameState;
  send: Props["send"];
  round: number;
}) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clean = text.replace(/…$/, "").trim();
  const valid = clean.length >= MIN_LEN && clean.length <= MAX_LEN;

  const submit = () => {
    if (!valid || sent) return;
    setSent(true);
    send({ type: "write_question", text: clean });
    // If the server rejects it we stay on this screen; let them try again.
    setTimeout(() => setSent(false), 1500);
  };

  const applyStarter = (starter: string) => {
    const prefix = starter.replace("…", " ");
    setText(prefix);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(prefix.length, prefix.length);
    });
  };

  return (
    <>
      <Card className="px-5 pt-7 pb-6 text-center sm:px-10">
        <Eyebrow>Rodada {round}</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-4xl">
          Sua vez de perguntar!{" "}
          <span className="inline-block animate-wiggle">✍️</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Boas perguntas têm uma resposta “óbvia” — é ela que faz a manada se juntar.
        </p>

        <form
          className="mt-6 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="-mx-5 mb-2 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => applyStarter(s)}
                className="shrink-0 rounded-full border-2 border-border bg-cream px-3 py-1 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:border-pasture hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              maxLength={MAX_LEN}
              rows={3}
              autoFocus
              enterKeyHint="send"
              placeholder="Ex.: Diga uma coisa que todo mundo esquece em casa."
              aria-label="Sua pergunta"
              className="w-full resize-none rounded-2xl border-2 border-border bg-cream px-4 py-3 pb-7 font-display text-xl font-medium outline-none transition-colors focus:border-pasture focus:bg-surface"
            />
            <span
              className={cx(
                "pointer-events-none absolute right-3 bottom-3 text-xs tabular-nums",
                text.length > MAX_LEN - 15 ? "text-barn" : "text-muted",
              )}
            >
              {text.length}/{MAX_LEN}
            </span>
          </div>
        </form>
      </Card>

      <ActionBar spacer={false}>
        <div className="flex w-full gap-2 sm:justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => send({ type: "draw_question" })}
            className="shrink-0"
          >
            🎲 <span className="hidden sm:inline">Sortear do baralho</span>
            <span className="sm:hidden">Sortear</span>
          </Button>
          <Button size="lg" onClick={submit} disabled={!valid || sent} className="flex-1 sm:flex-none">
            <span className="hidden sm:inline">Usar minha pergunta →</span>
            <span className="sm:hidden">Perguntar →</span>
          </Button>
        </div>
      </ActionBar>
    </>
  );
}

function WaitForChooser({
  state,
  me,
  send,
  round,
}: {
  state: GameState;
  me: string;
  send: Props["send"];
  round: number;
}) {
  const chooser = state.players.find((p) => p.id === state.chooser_player_id);
  const isHost = state.host_player_id === me;

  return (
    <Card className="flex flex-col items-center px-6 py-8 text-center">
      <Eyebrow>Rodada {round}</Eyebrow>
      {chooser && (
        <div className="relative mt-5">
          <Avatar players={state.players} id={chooser.id} size="xl" ring="hay" className="animate-bob" />
          <span className="absolute -right-2 -bottom-1 animate-wiggle text-3xl" aria-hidden>
            ✍️
          </span>
        </div>
      )}
      <h1 className="mt-4 font-display text-2xl font-bold sm:text-3xl">
        {chooser?.name ?? "Alguém"} está escolhendo a pergunta
        <span className="inline-flex w-8 justify-start">
          <Dots />
        </span>
      </h1>
      <p className="mt-1 text-sm text-muted">
        {chooser && !chooser.connected
          ? `${chooser.name} caiu — se não voltar logo, a vez passa para o próximo.`
          : "Vai escrever uma pergunta própria ou sortear do baralho."}
      </p>

      {isHost && chooser && (
        <div className="mt-6 flex flex-col items-center gap-1">
          <Button variant="ghost" onClick={() => send({ type: "draw_question" })}>
            🎲 Sortear no lugar de {chooser.name}
          </Button>
          <p className="text-xs text-muted">Se estiver demorando demais.</p>
        </div>
      )}
    </Card>
  );
}

function Dots() {
  return (
    <span aria-hidden className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="animate-pulse-soft" style={{ animationDelay: `${i * 200}ms` }}>
          .
        </span>
      ))}
    </span>
  );
}

/** Who asks next: the rotation, starting from the current chooser. */
function TurnOrder({ state, me }: { state: GameState; me: string }) {
  const order = state.players.filter((p) => p.connected);
  const start = Math.max(0, order.findIndex((p) => p.id === state.chooser_player_id));
  const rotated = [...order.slice(start), ...order.slice(0, start)];

  return (
    <div className="flex flex-col items-center gap-2">
      <Eyebrow>Ordem das perguntas</Eyebrow>
      <ol className="flex flex-wrap items-center justify-center gap-1.5">
        {rotated.map((p, i) => (
          <li key={p.id} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted" aria-hidden>›</span>}
            <span
              className={cx(
                "flex items-center gap-1.5 rounded-full border-2 py-0.5 pr-3 pl-0.5 text-sm",
                i === 0 ? "border-hay bg-hay-soft font-semibold" : "border-border bg-surface text-muted",
              )}
            >
              <Avatar players={state.players} id={p.id} size="xs" />
              {p.id === me ? "você" : p.name}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
