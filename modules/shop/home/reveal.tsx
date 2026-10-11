"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Reveal({
  children,
  className = "",
  as: Tag = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  id?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => el.classList.add("in");

    // No observer support or a zero-size viewport (e.g. the tab mounts
    // hidden): show content immediately — never leave it parked at
    // opacity:0 waiting on an event that may not come. Reduced motion still
    // reveals on scroll; its CSS turns the entrance into a plain fade.
    if (
      typeof IntersectionObserver === "undefined" ||
      window.innerHeight === 0
    ) {
      reveal();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            io.disconnect();
            return;
          }
        }
      },
      // Fire the instant the section starts entering (or 240px before), so a
      // section taller than the viewport is never seen as a blank band while a
      // 10%-of-height threshold waits to trip.
      { threshold: 0, rootMargin: "0px 0px 240px 0px" },
    );

    io.observe(el);

    // Failsafe: if the observer somehow never fires for a section that is
    // already on screen (or scrolled past), reveal it after a beat so the page
    // can't get stuck blank. Sections still below the fold are left to the
    // observer — revealing them on a timer would play the entrance unseen.
    const t = window.setTimeout(() => {
      if (el.getBoundingClientRect().top < window.innerHeight) reveal();
    }, 1800);

    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      id={id}
      className={`reveal ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
