const LOGO_VARIANTS = {
  full: { symbol: "logo-full", viewBox: "0 0 372 324" },
  mono: { symbol: "logo-mono", viewBox: "0 -6 372 194" },
  word: { symbol: "logo-word", viewBox: "0 198 372 92" },
  flourish: { symbol: "logo-flourish", viewBox: "0 46 372 126" },
} as const;

export function AksBrandLogo({
  className,
  variant = "full",
}: {
  className?: string;
  variant?: keyof typeof LOGO_VARIANTS;
}) {
  const logo = LOGO_VARIANTS[variant];

  return (
    <svg className={className} viewBox={logo.viewBox} aria-hidden="true">
      <use href={`#${logo.symbol}`} />
    </svg>
  );
}
