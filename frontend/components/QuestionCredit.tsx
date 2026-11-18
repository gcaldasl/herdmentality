import type { GameState } from "@/lib/types";
import { Avatar } from "./Avatar";
import { cx } from "./ui";

/** "Pergunta de Ana" / "Sorteada por Ana" - players mode only. */
export function QuestionCredit({
  state,
  me,
  className,
}: {
  state: GameState;
  me: string;
  className?: string;
}) {
  const author = state.players.find((p) => p.id === state.question_author_id);
  if (!author) return null;
  const mine = author.id === me;
  return (
    <p
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full bg-cream-deep py-0.5 pr-3 pl-0.5 text-xs font-semibold text-muted",
        className,
      )}
    >
      <Avatar players={state.players} id={author.id} size="xs" />
      {state.question_is_custom
        ? mine
          ? "✍️ Sua pergunta"
          : `✍️ Pergunta de ${author.name}`
        : mine
          ? "🎲 Você sorteou"
          : `🎲 Sorteada por ${author.name}`}
    </p>
  );
}
