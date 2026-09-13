type CaptureContext = Record<string, unknown>;

function serializeError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { name: "Error", message: String(error) };
}

function logStructured(
  level: "error" | "warn" | "info",
  event: string,
  payload: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

async function postAlertWebhook(body: Record<string, unknown>): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Never throw from observability.
  }
}

/** Record an exception for logs and optional webhook alerting. */
export function captureException(
  error: unknown,
  context?: CaptureContext,
): void {
  logStructured("error", "exception", {
    error: serializeError(error),
    ...context,
  });
}

/** Non-fatal operational signal (e.g. outbox DEAD). */
export function captureMessage(
  message: string,
  level: "warning" | "info" = "warning",
  context?: CaptureContext,
): void {
  logStructured(level === "warning" ? "warn" : "info", "message", {
    message,
    ...context,
  });
}

/** Alert when an outbox job reaches DEAD — customer notifications may be lost. */
export async function alertOutboxDead(input: {
  id: string;
  topic: string;
  attempts: number;
  lastError?: string | null;
}): Promise<void> {
  captureMessage(`Outbox job DEAD: ${input.topic}`, "warning", input);
  await postAlertWebhook({
    type: "outbox.dead",
    ...input,
    ts: new Date().toISOString(),
  });
}
