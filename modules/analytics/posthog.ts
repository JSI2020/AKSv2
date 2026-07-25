"use client";

import posthog from "posthog-js";

let initialized = false;

export function getPostHogKey(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || undefined;
}

export function initPostHog(): typeof posthog | null {
  const key = getPostHogKey();
  if (!key || initialized) {
    return key && initialized ? posthog : null;
  }

  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
      "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
  return posthog;
}

export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  const client = initPostHog();
  if (!client) return;
  client.capture(event, properties);
}

export { posthog };
