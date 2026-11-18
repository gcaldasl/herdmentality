"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { createRoom, joinRoom } from "@/lib/api";
import { loadName, saveName, saveSession } from "@/lib/session";
import { CowArt } from "@/components/CowArt";
import { CodeInput, TextInput } from "@/components/Field";
import { Hills } from "@/components/Hills";
import { Button, Card, Eyebrow, Spinner, cx } from "@/components/ui";

const noopSubscribe = () => () => {};

export default function Home() {
  const router = useRouter();
  const storedName = useSyncExternalStore(noopSubscribe, loadName, () => "");
  const [nameInput, setNameInput] = useState<string | null>(null);
  const name = nameInput ?? storedName;

  const [mode, setMode] = useState<"create" | "join">("create");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return setError("Digite seu nome primeiro.");
    if (mode === "join" && code.length !== 4)
      return setError("O código da sala tem 4 letras.");
    setBusy(true);
    try {
      const res =
        mode === "create" ? await createRoom(trimmed) : await joinRoom(code, trimmed);
      saveName(trimmed);
      saveSession({ code: res.code, playerId: res.player_id, name: trimmed });
      router.push(`/room/${res.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
      setBusy(false);
    }
  };

  return (
    <main className="relative flex flex-1 flex-col items-center px-4 pt-10 pb-48 sm:pt-16">
      <Hills />

      <header className="flex flex-col items-center text-center">
        <div className="relative">
          <CowArt className="w-28 animate-bob sm:w-32" />
          <span className="absolute -right-10 bottom-1 text-3xl" aria-hidden>🐑</span>
          <span className="absolute -left-9 bottom-0 text-2xl" aria-hidden>🐷</span>
        </div>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-ink sm:text-7xl">
          Efeito <span className="text-pasture">Manada</span>
        </h1>
        <p className="mt-3 max-w-md text-balance text-muted sm:text-lg">
          Todo mundo responde à mesma pergunta. Pense igual à manada para pontuar
          — ou leve a <span className="font-semibold text-cow-deep">Vaca Rosa</span>{" "}
          para casa.
        </p>
      </header>

      <Card className="mt-8 w-full max-w-sm p-5 sm:p-6">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-cream-deep p-1">
          {(
            [
              ["create", "Criar sala"],
              ["join", "Entrar"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cx(
                "rounded-xl py-2 font-display text-sm font-semibold transition-all",
                mode === m ? "bg-surface text-ink shadow-card-sm" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <label className="block">
            <Eyebrow className="mb-1.5">Seu nome</Eyebrow>
            <TextInput
              value={name}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={24}
              placeholder="Como a manada te chama?"
              autoComplete="nickname"
            />
          </label>

          {mode === "join" && (
            <div className="animate-rise">
              <Eyebrow className="mb-1.5">Código da sala</Eyebrow>
              <CodeInput value={code} onChange={setCode} onEnter={go} />
            </div>
          )}

          {error && (
            <p
              key={error}
              role="alert"
              className="animate-shake rounded-xl bg-barn-soft px-3 py-2 text-sm font-medium text-barn"
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy && <Spinner />}
            {mode === "create" ? "Criar sala" : "Entrar na sala"}
          </Button>

          <p className="text-center text-xs text-muted">
            {mode === "create"
              ? "Você será o anfitrião e receberá um código para compartilhar."
              : "Peça o código de 4 letras para quem criou a sala."}
          </p>
        </form>
      </Card>

      <HowToPlay />
    </main>
  );
}

function HowToPlay() {
  const steps = [
    {
      icon: "💬",
      title: "Responda",
      text: "Uma pergunta, uma resposta. Sem pensar demais: qual a resposta mais óbvia?",
    },
    {
      icon: "🐑",
      title: "Siga a manada",
      text: "Quem estiver no maior grupo de respostas iguais ganha 1 ponto. Empate na frente? Ninguém pontua.",
    },
    {
      icon: "🐄",
      title: "Fuja da Vaca Rosa",
      text: "Respondeu sozinho? A Vaca Rosa é sua — e com ela você não pode vencer.",
    },
  ];
  return (
    <section className="mt-14 w-full max-w-3xl">
      <h2 className="text-center font-display text-2xl font-bold text-ink">Como jogar</h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="animate-rise rounded-3xl border-2 border-border bg-surface/80 p-5 backdrop-blur-sm"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-4xl" aria-hidden>{s.icon}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream-deep font-display text-sm font-bold text-muted">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center text-sm text-muted">
        De 2 a 6 jogadores, cada um no seu celular. Primeiro a chegar a{" "}
        <span className="font-semibold text-ink">8 pontos</span> vence (ou 5, ou 12 — o
        anfitrião escolhe).
      </p>
    </section>
  );
}
