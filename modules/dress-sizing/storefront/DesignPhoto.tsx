"use client";
import { useState } from "react";
export function DesignPhoto({ src, className = "" }: { src: string; className?: string }) {
  const [visible, setVisible] = useState(true);
  return visible ? (
    // Uploaded admin previews have unknown dimensions until image decode.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} onError={() => setVisible(false)} />
  ) : null;
}
