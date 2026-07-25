"use client";

import {
  Component,
  type ReactNode,
  Suspense,
  useEffect,
  useState,
} from "react";

import { cn } from "@/lib/utils";

import { EmptyState } from "./empty-state";

type AsyncBoundaryProps = {
  children: ReactNode;
  className?: string;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
};

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse space-y-3", className)}
      aria-busy
      aria-live="polite"
    >
      <div className="block-size-4 w-1/3 bg-greige-deep" />
      <div className="block-size-24 w-full bg-greige-deep" />
      <div className="block-size-4 w-2/3 bg-greige-deep" />
    </div>
  );
}

type ErrorBoundaryState = { error: Error | null };

class ErrorCatcher extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <EmptyState
          title="Something went wrong"
          description={this.state.error.message || "Please try again."}
        />
      );
    }
    return this.props.children;
  }
}

export function AsyncBoundary({
  children,
  className,
  fallback,
  errorFallback,
}: AsyncBoundaryProps) {
  // Ensure client-only remount key after hydration for Suspense demos.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className={className}>
      <ErrorCatcher fallback={errorFallback}>
        <Suspense fallback={fallback ?? <Skeleton />}>
          {ready ? children : (fallback ?? <Skeleton />)}
        </Suspense>
      </ErrorCatcher>
    </div>
  );
}

export { Skeleton as AsyncSkeleton };
