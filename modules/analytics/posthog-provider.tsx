"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { PostHogProvider } from "posthog-js/react";

import { initPostHog, getPostHogKey, posthog } from "./posthog";
import { trackPageView } from "./events";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!getPostHogKey()) return;
    initPostHog();
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    trackPageView(path);
  }, [pathname, searchParams]);

  return null;
}

export function PostHogAnalyticsProvider({ children }: { children: ReactNode }) {
  const key = getPostHogKey();

  useEffect(() => {
    if (key) initPostHog();
  }, [key]);

  if (!key) return <>{children}</>;

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
