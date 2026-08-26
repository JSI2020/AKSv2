import Image from "next/image";

import { Link } from "@/i18n/routing";

import { AksBrandLogo } from "./aks-brand-logo";

/** Exact brand lockup — do not redraw or restyle the artwork. */
export const AKS_LOGO = {
  src: "/brand/aks-logo.png",
  width: 1024,
  height: 559,
  alt: "AKS — Minimalist Luxury",
} as const;

const SIZE_HEIGHT_PX = {
  header: 52,
  footer: 96,
  admin: 40,
  lockup: 120,
  compact: 36,
} as const;

export type AksLogoSize = keyof typeof SIZE_HEIGHT_PX;

type AksLogoImageProps = {
  size?: AksLogoSize;
  className?: string;
  priority?: boolean;
};

/** Renders the official AKS logo PNG at the given height (width scales). */
export function AksLogoImage({
  size = "header",
  className,
  priority = false,
}: AksLogoImageProps) {
  return (
    <Image
      src={AKS_LOGO.src}
      alt={AKS_LOGO.alt}
      width={AKS_LOGO.width}
      height={AKS_LOGO.height}
      priority={priority}
      unoptimized
      className={["aks-logo", `aks-logo--${size}`, className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

type AksLogoLinkProps = AksLogoImageProps & {
  href?: "/" | string;
};

/** Logo as home link — used in storefront header/footer. */
export function AksLogoLink({
  href = "/",
  size = "header",
  className,
  priority = false,
}: AksLogoLinkProps) {
  return (
    <Link
      href={href as "/"}
      className={["brand aks-logo-link", className].filter(Boolean).join(" ")}
      aria-label="AKS home"
    >
      <AksLogoImage size={size} priority={priority} />
    </Link>
  );
}

export function AksStoreBrandLink({
  href = "/",
  className,
}: {
  href?: "/" | string;
  className?: string;
}) {
  return (
    <Link
      href={href as "/"}
      className={["brand", className].filter(Boolean).join(" ")}
      aria-label="AKS — Minimalist Luxury, home"
    >
      <AksBrandLogo className="brand-logo" />
    </Link>
  );
}

/** @deprecated Prefer AksLogoImage — kept for any leftover imports. */
export function AksMark({ className }: { className?: string }) {
  return <AksLogoImage size="compact" className={className} />;
}

/** @deprecated Prefer AksLogoLink — wordmark text replaced by official logo. */
export function AksWordmark({
  invert: _invert = false,
}: {
  name?: string;
  nameUr?: string;
  invert?: boolean;
}) {
  return <AksLogoLink size="header" priority />;
}
