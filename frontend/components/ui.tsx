import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "cow";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-pasture text-white shadow-btn hover:brightness-105 active:translate-y-[3px] active:shadow-none",
  secondary:
    "border-2 border-border bg-surface text-ink shadow-card-sm hover:border-pasture active:translate-y-[2px] active:shadow-none",
  ghost: "text-muted hover:bg-cream-deep hover:text-ink",
  cow: "bg-cow-deep text-white shadow-btn-cow hover:brightness-105 active:translate-y-[3px] active:shadow-none",
};

const SIZES: Record<Size, string> = {
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3.5 text-lg rounded-2xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 font-display font-semibold tracking-wide whitespace-nowrap transition-all duration-100 select-none",
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
    VARIANTS[variant],
    SIZES[size],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClass(variant, size), className)}
      {...rest}
    />
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-3xl border-2 border-border bg-surface shadow-card",
        className,
      )}
      {...rest}
    />
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}

/** Primary actions: pinned to the bottom of the screen on phones (thumb reach,
 *  always visible), inline on desktop. */
export function ActionBar({
  children,
  spacer = true,
}: {
  children: ReactNode;
  /** Reserve room at the end of the page so the pinned bar never covers content. */
  spacer?: boolean;
}) {
  return (
    <>
      {spacer && <ActionBarSpacer />}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-border bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-1.5 text-center">
          {children}
        </div>
      </div>
    </>
  );
}

export function ActionBarSpacer() {
  return <div aria-hidden className="h-24 shrink-0 lg:hidden" />;
}
