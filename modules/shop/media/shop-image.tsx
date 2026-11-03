import Image, { type ImageProps } from "next/image";

import { imageNeedsOptimizerBypass, optimizerImageSrc } from "./image-src";

type Props = Omit<ImageProps, "src"> & {
  src: string;
};

/**
 * Storefront image. Same-origin photos go through the Next optimizer
 * (responsive srcset, AVIF/WebP, lazy unless priority). External or blob
 * URLs still render, without the optimizer.
 */
export function ShopImage({ src, alt, unoptimized, ...rest }: Props) {
  const nextSrc = optimizerImageSrc(src);
  const skip =
    unoptimized === true || imageNeedsOptimizerBypass(nextSrc);
  return <Image src={nextSrc} alt={alt} unoptimized={skip} {...rest} />;
}
