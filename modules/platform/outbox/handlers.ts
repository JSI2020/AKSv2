export type OutboxHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, OutboxHandler>();

export function registerHandler(topic: string, handler: OutboxHandler): void {
  handlers.set(topic, handler);
}

export function getHandler(topic: string): OutboxHandler | undefined {
  return handlers.get(topic);
}

export function listHandlers(): string[] {
  return [...handlers.keys()];
}

/** No-op proof handler for the worker loop. */
export function registerTestPingHandler(): void {
  registerHandler("test.ping", async () => {
    // intentional no-op
  });
}
