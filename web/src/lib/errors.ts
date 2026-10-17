/** Readable message from anything thrown (Error, PostgrestError-like objects, strings). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong.";
}

let lastError: { message: string; at: number } | null = null;

/**
 * Records a failed load. Dev builds log it and show the reason under the next
 * error state (see EmptyState); production keeps the friendly copy only.
 */
export function reportError(error: unknown) {
  if (!import.meta.env.DEV) return;
  console.error(error);
  lastError = { message: errorMessage(error), at: Date.now() };
}

/** The most recent reported error (last 30s), dev builds only. */
export function devErrorDetail(): string | null {
  if (!import.meta.env.DEV || !lastError || Date.now() - lastError.at > 30_000) return null;
  return lastError.message;
}
