type PgCause = {
  code?: string;
  constraint_name?: string;
  detail?: string;
};

function pgCause(error: unknown): PgCause | null {
  if (!error || typeof error !== "object") return null;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return null;
  return cause as PgCause;
}

/** Map raw server/DB errors to short admin-facing copy. */
export function formatActionError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Something went wrong. Try again.";
  }

  const cause = pgCause(error);
  const message = error.message;

  if (message.startsWith("Failed query:")) {
    if (cause?.code === "23505") {
      return "This angle is already queued. Wait a moment, refresh, then try Regenerate.";
    }
    if (cause?.code === "23503") {
      return "Design data changed — refresh the page, save colour sets again, then generate.";
    }
    return "Could not queue the generation job. Refresh and try again.";
  }

  if (
    message === "Unprocessable Entity" ||
    message.includes("422") ||
    message.toLowerCase().includes("unprocessable")
  ) {
    return "fal.ai could not download the reference image. Start MinIO (docker compose up -d minio minio-init), set R2_ENDPOINT=http://127.0.0.1:9010 in .env.local, re-upload the reference photo, then generate again.";
  }

  if (message.includes("Object storage (R2/MinIO) is not reachable")) {
    return message;
  }

  if (message.includes("FAL_KEY is not set")) {
    return "Live AI is enabled but FAL_KEY is missing. Add it to .env.local or set AI_GENERATION_MOCK=1 for local dev without fal.";
  }

  if (message.includes("No fal model configured")) {
    return "No fal.ai model configured. Run npm run db:ensure:studio-ai and refresh.";
  }

  return message;
}

export function isIdempotencyKeyViolation(error: unknown): boolean {
  const cause = pgCause(error);
  return (
    cause?.code === "23505" &&
    (cause.constraint_name === "design_generations_idempotency_key_unique" ||
      String(cause.detail ?? "").includes("idempotency_key"))
  );
}
