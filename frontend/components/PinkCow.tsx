import { CowArt } from "./CowArt";
import { cx } from "./ui";

/** Pink Cow badge. With no label it collapses to an icon-only token. */
export function PinkCow({
  label = "Vaca Rosa",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      title="Vaca Rosa"
      className={cx(
        "inline-flex items-center gap-1 rounded-full bg-cow font-display text-xs font-semibold text-[#5a1030]",
        label ? "py-0.5 pr-2.5 pl-1" : "p-0.5",
        className,
      )}
    >
      <CowArt pink className="w-5" />
      {label}
    </span>
  );
}
