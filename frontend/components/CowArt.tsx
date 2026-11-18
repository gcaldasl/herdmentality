import { cx } from "./ui";

/** A friendly cartoon cow head. `pink` renders the dreaded Pink Cow. */
export function CowArt({
  pink = false,
  className,
}: {
  pink?: boolean;
  className?: string;
}) {
  const body = pink ? "#F49CBB" : "#FFFFFF";
  const spot = pink ? "#E85D8A" : "#22271F";
  const muzzle = pink ? "#FBD3E1" : "#F7C6D6";
  const line = "#22271F";

  return (
    <svg
      viewBox="0 0 120 110"
      className={cx("h-auto", className ?? "w-20")}
      aria-hidden
    >
      {/* horns */}
      <path d="M34 26 C26 12 30 6 36 8 C38 14 40 20 42 24Z" fill="#F3E3B5" stroke={line} strokeWidth="3" strokeLinejoin="round" />
      <path d="M86 26 C94 12 90 6 84 8 C82 14 80 20 78 24Z" fill="#F3E3B5" stroke={line} strokeWidth="3" strokeLinejoin="round" />
      {/* ears */}
      <ellipse cx="18" cy="42" rx="16" ry="9" transform="rotate(-20 18 42)" fill={body} stroke={line} strokeWidth="3" />
      <ellipse cx="102" cy="42" rx="16" ry="9" transform="rotate(20 102 42)" fill={body} stroke={line} strokeWidth="3" />
      <ellipse cx="18" cy="42" rx="8" ry="4" transform="rotate(-20 18 42)" fill={muzzle} />
      <ellipse cx="102" cy="42" rx="8" ry="4" transform="rotate(20 102 42)" fill={muzzle} />
      {/* head */}
      <path d="M30 34 C30 18 90 18 90 34 L92 70 C92 80 28 80 28 70Z" fill={body} stroke={line} strokeWidth="3" strokeLinejoin="round" />
      {/* spots */}
      <path d="M36 30 C44 24 54 30 50 38 C46 46 34 42 36 30Z" fill={spot} />
      <path d="M74 44 C82 40 90 46 88 54 C84 58 74 56 74 44Z" fill={spot} />
      {/* eyes */}
      <circle cx="46" cy="52" r="5" fill={line} />
      <circle cx="74" cy="52" r="5" fill={line} />
      <circle cx="47.5" cy="50.5" r="1.6" fill="#fff" />
      <circle cx="75.5" cy="50.5" r="1.6" fill="#fff" />
      {/* cheeks */}
      <ellipse cx="38" cy="62" rx="5" ry="3" fill="#E85D8A" opacity={pink ? 0.6 : 0.35} />
      <ellipse cx="82" cy="62" rx="5" ry="3" fill="#E85D8A" opacity={pink ? 0.6 : 0.35} />
      {/* muzzle */}
      <ellipse cx="60" cy="82" rx="30" ry="20" fill={muzzle} stroke={line} strokeWidth="3" />
      <ellipse cx="50" cy="80" rx="4" ry="5.5" fill={line} />
      <ellipse cx="70" cy="80" rx="4" ry="5.5" fill={line} />
      <path d="M52 92 Q60 97 68 92" fill="none" stroke={line} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
