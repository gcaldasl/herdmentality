"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { joinRoom } from "@/lib/api";
import { clearSession, loadName, loadSession, saveName, saveSession } from "@/lib/session";
import type { GameState } from "@/lib/types";
import { useGameSocket } from "@/lib/useGameSocket";
import { useGameSounds } from "@/lib/useGameSounds";
import { CowArt } from "@/components/CowArt";
import { TextInput } from "@/components/Field";
import { ChooserCard } from "@/components/ChooserCard";
import { CowHolderContext } from "@/components/CowHolder";
import { GameOver } from "@/components/GameOver";
import { Hills } from "@/components/Hills";
import { Lobby } from "@/components/Lobby";
import { QuestionCard } from "@/components/QuestionCard";
import { ResultsBoard } from "@/components/ResultsBoard";
import { RevealBoard } from "@/components/RevealBoard";
import { RoomHeader } from "@/components/RoomHeader";
import { Scoreboard, ScoreStrip } from "@/components/Scoreboard";
import { Button, Card, Eyebrow, Spinner, buttonClass } from "@/components/ui";

const noopSubscribe = () => () => {};

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const [joinedId, setJoinedId] = useState<string | null>(null);

  // Read the stored session id once and freeze it: the player's identity for
  // this room must not change mid-session (e.g. if another tab writes storage).
  const frozen = useRef<string | null | undefined>(undefined);
  const getStored = useCallback(() => {
    if (frozen.current === undefined) {
      frozen.current = loadSession(code)?.playerId ?? null;
    }
    return frozen.current;
  }, [code]);
  const stored = useSyncExternalStore(noopSubscribe, getStored, () => null);
  const playerId = joinedId ?? stored;

  if (!playerId) return <JoinGate code={code} onJoined={setJoinedId} />;
  return <Room code={code} me={playerId} />;
}

function JoinGate({
  code,
  onJoined,
}: {
  code: string;
  onJoined: (id: string) => void;
}) {
  const storedName = useSyncExternalStore(noopSubscribe, loadName, () => "");
  const [nameInput, setNameInput] = useState<string | null>(null);
  const name = nameInput ?? storedName;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Digite seu nome.");
    setBusy(true);
    setError(null);
    try {
      const res = await joinRoom(code, trimmed);
      saveName(trimmed);
      saveSession({ code: res.code, playerId: res.player_id, name: trimmed });
      onJoined(res.player_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
      setBusy(false);
    }
  };

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 pb-40">
      <Hills />
      <CowArt className="w-20 animate-bob" />
      <Card className="mt-4 w-full max-w-sm p-6 text-center">
        <Eyebrow>Você foi convidado para a sala</Eyebrow>
        <p className="mt-2 font-display text-5xl font-bold tracking-[0.25em] text-ink">
          {code}
        </p>
        <form
          className="mt-6 flex flex-col gap-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
        >
          <label>
            <Eyebrow className="mb-1.5">Seu nome</Eyebrow>
            <TextInput
              value={name}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={24}
              placeholder="Como a manada te chama?"
              autoComplete="nickname"
              autoFocus
            />
          </label>
          {error && (
            <p
              key={error}
              role="alert"
              className="animate-shake rounded-xl bg-barn-soft px-3 py-2 text-sm font-medium text-barn"
            >
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Spinner />}
            Entrar no jogo
          </Button>
          <Link href="/" className="text-center text-sm text-muted hover:text-ink">
            Voltar ao início
          </Link>
        </form>
      </Card>
    </main>
  );
}

function Room({ code, me }: { code: string; me: string }) {
  const { state, status, error, send } = useGameSocket(code, me);
  useGameSounds(state, me);
  const screen = state ? `${state.phase}-${state.round_number}` : null;

  // Holding the Pink Cow tints your whole screen pink.
  const cowIsMine = state?.pink_cow_player_id === me;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-cow-mine", cowIsMine);
    return () => document.documentElement.removeAttribute("data-cow-mine");
  }, [cowIsMine]);

  // Each phase is a new screen: start it from the top, not wherever the last one was scrolled.
  useEffect(() => {
    if (screen) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);

  if (status === "rejected") {
    clearSession(code);
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-40 text-center">
        <Hills />
        <CowArt pink className="w-24 animate-wiggle" />
        <h1 className="font-display text-3xl font-bold">Essa sala sumiu do pasto</h1>
        <p className="max-w-sm text-muted">
          Não encontramos a sala <b className="text-ink">{code}</b> ou o seu lugar nela.
          Confira o código ou crie um jogo novo.
        </p>
        <Link href="/" className={buttonClass("primary", "lg")}>
          Voltar ao início
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center gap-3 pb-40 text-muted">
        <Hills />
        <CowArt className="w-20 animate-bob" />
        <p className="flex items-center gap-2 font-display text-lg">
          <Spinner />
          {status === "closed" ? "Reconectando…" : "Entrando no pasto…"}
        </p>
      </main>
    );
  }

  return (
    <CowHolderContext.Provider value={state.pink_cow_player_id}>
      <RoomHeader state={state} me={me} status={status} />
      <ScoreStrip state={state} me={me} />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pt-6 pb-16 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <section className="flex min-w-0 flex-col items-center gap-4">
          <HostAwayBanner state={state} me={me} />
          <TieBanner state={state} me={me} />
          {/* keyed by phase+round so each screen gets fresh local state + entry animation */}
          <div key={screen} className="flex w-full animate-fade justify-center">
            {state.phase === "lobby" && <Lobby state={state} me={me} send={send} />}
            {state.phase === "choosing" && <ChooserCard state={state} me={me} send={send} />}
            {state.phase === "question" && <QuestionCard state={state} me={me} send={send} />}
            {state.phase === "reveal" && <RevealBoard state={state} me={me} send={send} />}
            {state.phase === "scoring" && <ResultsBoard state={state} me={me} send={send} />}
            {state.phase === "game_over" && <GameOver state={state} me={me} send={send} />}
          </div>
        </section>

        <Scoreboard state={state} me={me} />
      </main>

      {error && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <p
            key={error}
            role="alert"
            className="pointer-events-auto animate-rise rounded-2xl border-2 border-barn bg-surface px-4 py-3 text-sm font-semibold text-barn shadow-card"
          >
            {error}
          </p>
        </div>
      )}
    </CowHolderContext.Provider>
  );
}

function HostAwayBanner({ state, me }: { state: GameState; me: string }) {
  const host = state.players.find((p) => p.id === state.host_player_id);
  if (!host || host.connected || host.id === me) return null;
  return (
    <p className="flex w-full max-w-2xl animate-rise items-center gap-2 rounded-2xl bg-hay-soft px-4 py-2.5 text-sm">
      <span className="animate-pulse-soft" aria-hidden>📡</span>
      <span>
        <b>{host.name}</b> (anfitrião) perdeu a conexão. Se não voltar logo, outra
        pessoa assume o comando.
      </span>
    </p>
  );
}

/** Sudden death: shown from the round that created the tie until it's broken. */
function TieBanner({ state, me }: { state: GameState; me: string }) {
  const tied = state.players.filter((p) => state.tied_player_ids.includes(p.id));
  if (tied.length < 2) return null;
  const names = tied.map((p) => (p.id === me ? "você" : p.name));
  const list = `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  return (
    <div className="flex w-full max-w-2xl animate-pop items-center gap-3 rounded-2xl border-2 border-hay bg-hay-soft px-4 py-3">
      <span className="text-3xl" aria-hidden>⚔️</span>
      <p className="text-sm">
        <b className="font-display text-base">Desempate!</b>{" "}
        {list[0].toUpperCase() + list.slice(1)} estão empatados com{" "}
        <b>{tied[0].score} pontos</b>. Quem ficar na frente sozinho vence.
      </p>
    </div>
  );
}
