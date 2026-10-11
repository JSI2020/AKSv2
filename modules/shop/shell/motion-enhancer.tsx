"use client";

import { useEffect } from "react";

/**
 * Motion that works without a mouse.
 *
 * - Touch screens can't hover, so product cards, category doors and lookbook
 *   cards get an `in-view` class while they sit on screen; CSS turns that
 *   into the same reveals desktop shows on hover.
 * - Browsers without scroll-driven CSS animations (older iOS Safari) get the
 *   page/hero scroll progress as CSS variables instead.
 *
 * Purely additive: with JS off, nothing is hidden and nothing breaks.
 */
const IN_VIEW_SELECTOR = ".shop-proto .card, .shop-proto .cat, .shop-proto .lookbook-card";

export function MotionEnhancer() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js-motion");
    const cleanups: Array<() => void> = [];

    const touch = window.matchMedia("(hover: none)").matches;
    if (touch && typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            entry.target.classList.toggle("in-view", entry.isIntersecting);
          }
        },
        { threshold: 0.55 },
      );
      const watched = new WeakSet<Element>();
      const observeAll = () => {
        document.querySelectorAll(IN_VIEW_SELECTOR).forEach((el) => {
          if (watched.has(el)) return;
          watched.add(el);
          io.observe(el);
        });
      };
      observeAll();
      // Client navigation and filters render new cards — pick them up.
      const mo = new MutationObserver(observeAll);
      mo.observe(document.body, { childList: true, subtree: true });
      cleanups.push(() => {
        io.disconnect();
        mo.disconnect();
      });
    }

    const supportsScrollTimeline =
      typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()");
    if (!supportsScrollTimeline) {
      root.classList.add("no-scroll-timeline");
      let frame = 0;
      const update = () => {
        frame = 0;
        const max = root.scrollHeight - window.innerHeight;
        const y = window.scrollY;
        root.style.setProperty("--scroll-progress", String(max > 0 ? Math.min(1, y / max) : 0));
        root.style.setProperty(
          "--hero-progress",
          String(Math.min(1, y / Math.max(1, window.innerHeight * 0.92))),
        );
      };
      const onScroll = () => {
        if (!frame) frame = window.requestAnimationFrame(update);
      };
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (frame) window.cancelAnimationFrame(frame);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
