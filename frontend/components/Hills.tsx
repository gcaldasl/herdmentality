/** Decorative rolling pasture along the bottom of the viewport. */
export function Hills() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-40 sm:h-56">
      <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="h-full w-full">
        <path
          d="M0 120 C 220 60 420 70 640 110 C 860 150 1080 60 1440 90 L1440 220 L0 220Z"
          fill="var(--c-hill-1)"
        />
        <path
          d="M0 160 C 260 110 520 130 760 160 C 1000 190 1200 120 1440 140 L1440 220 L0 220Z"
          fill="var(--c-hill-2)"
        />
        <path
          d="M0 195 C 300 170 600 185 900 200 C 1150 212 1300 190 1440 185 L1440 220 L0 220Z"
          fill="var(--c-hill-3)"
        />
      </svg>
    </div>
  );
}
