import { CowArt } from "./CowArt";
import { cx } from "./ui";

/** Announces a Cow Round: the goal flips, being alone scores. */
export function CowRoundBanner({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div
      className={cx(
        "flex animate-pop items-center gap-3 rounded-2xl border-2 border-cow-deep bg-cow-soft text-left",
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
    >
      <CowArt pink className={cx("shrink-0 animate-wiggle", compact ? "w-8" : "w-12")} />
      <p className="text-sm">
        <b className="font-display text-base text-cow-deep">Rodada da Vaca!</b>
        {!compact && <br />}{" "}
        Hoje vale ser diferente: <b>quem responder sozinho ganha 1 ponto</b>. A manada não pontua.
      </p>
    </div>
  );
}
