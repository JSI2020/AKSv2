import { Link } from "@/i18n/routing";

/** Hourglass mark from the Atelier prototype. */
export function AksMark({ className }: { className?: string }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 44 44"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M22 5 L30 21 M22 5 L14 21 M17.2 16.5 H26.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="22"
        x2="35"
        y2="22"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      <g opacity="0.4">
        <path
          d="M22 39 L30 23 M22 39 L14 23 M17.2 27.5 H26.8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function AksWordmark({
  name,
  nameUr,
  invert = false,
}: {
  name: string;
  nameUr: string;
  invert?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-3 ${invert ? "text-greige" : "text-ink"}`}
    >
      <AksMark className={invert ? "text-zari" : "text-madder"} />
      <span className="inline-flex items-baseline gap-2.5">
        <span className="font-display text-[26px] font-semibold tracking-[0.12em]">
          {name}
        </span>
        <span
          className={`font-urdu text-[20px] italic ${invert ? "text-zari" : "text-madder"}`}
          lang="ur"
          dir="rtl"
        >
          {nameUr}
        </span>
      </span>
    </Link>
  );
}
