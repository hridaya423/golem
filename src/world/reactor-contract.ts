import { z } from "zod";
import { IDLE_CONTROLS, type WorldControls } from "./world.ts";

export function tokenRequestBody() {
  return {
    expires_after: 3600,
    authorization_details: [
      {
        type: "session",
        resources: { models: { match: ["reactor/lingbot-world-2"] } },
        constraints: { max_sessions: 3, max_session_duration_seconds: 3600 },
      },
    ],
  } as const;
}

export const RELEASE_CONTROLS: WorldControls = IDLE_CONTROLS;

export const EMPTY_CAMERA_POSE: unknown[] = [];

export type ReactorConnectionFailure = {
  kind: "rate_limit" | "capacity" | "auth" | "network" | "other";
  message: string;
  retryAfterMs: number | null;
  retryable: boolean;
};

export const REACTOR_MAX_RETRIES = 5;

const RetryHintSchema = z.number().finite().nonnegative();
const ErrorFieldsSchema = z.object({
  message: z.string().optional().catch(undefined),
  code: z.union([z.string(), z.number().finite()]).optional().catch(undefined),
  status: z.union([z.number().int().min(100).max(599), z.string().regex(/^[1-5]\d{2}$/)])
    .optional().catch(undefined),
  error: z.string().optional().catch(undefined),
  quota_type: z.string().optional().catch(undefined),
  retry_after_ms: RetryHintSchema.optional().catch(undefined),
  retry_after_seconds: RetryHintSchema.refine((seconds) => Number.isFinite(seconds * 1000))
    .optional().catch(undefined),
}).catch({});

const FAILURE_MESSAGES = {
  rate_limit: "Reactor session rate limit reached. Please wait before reconnecting.",
  capacity: "Reactor model capacity is full. Please wait before reconnecting.",
  auth: "Reactor authentication failed. Check the server credentials.",
  network: "Reactor connection interrupted. Please retry.",
  other: "Unable to connect to Reactor.",
};
const MISSING_API_KEY = "REACTOR_API_KEY is not configured on the server (.env.local)";

function embeddedErrorFields(message: string) {
  const start = message.indexOf("{");
  try {
    const payload: unknown = start < 0 ? undefined : JSON.parse(message.slice(start));
    return ErrorFieldsSchema.parse(payload);
  } catch {
    return ErrorFieldsSchema.parse({});
  }
}

export function classifyReactorConnectionError(error: unknown): ReactorConnectionFailure {
  const fields = ErrorFieldsSchema.parse(error);
  const message = fields.message ?? "";
  const embedded = embeddedErrorFields(message);
  const codes = [fields.code, fields.error, embedded.code, embedded.error].join(" ");
  const text = `${message} ${embedded.message ?? ""}`;
  const prefix = message.split("{", 1)[0];
  const httpStatus = prefix.match(/(?:\b(?:HTTP(?: status)?|status)\s*[:=]?\s*|\btoken request failed\s*\()(401|403|429)\b/i)?.[1];
  const statuses = [fields.status, embedded.status, httpStatus].map(String);
  const hints = [
    fields.retry_after_ms,
    embedded.retry_after_ms,
    embedded.retry_after_seconds === undefined ? undefined : embedded.retry_after_seconds * 1000,
  ].filter((hint) => hint !== undefined);
  const retryAfterMs = hints.length ? Math.max(...hints) : null;

  if (message.includes(MISSING_API_KEY)) {
    return { kind: "auth", message: MISSING_API_KEY, retryAfterMs, retryable: false };
  }

  let kind: ReactorConnectionFailure["kind"] = "other";
  if (
    statuses.some((status) => status === "401" || status === "403") ||
    /\b(?:unauthorized|forbidden|401|403)\b/i.test(codes) ||
    /\b(?:unauthorized|forbidden)\b/i.test(text)
  ) {
    kind = "auth";
  } else if (
    fields.quota_type?.trim() || embedded.quota_type?.trim() ||
    /\b(?:quota_exceeded|rate_limit_exceeded)\b/i.test(codes)
  ) {
    kind = "rate_limit";
  } else if (/\b(?:no available capacity|model instances are busy)\b/i.test(text)) {
    kind = "capacity";
  } else if (
    statuses.includes("429") ||
    /\b(?:429|rate_limited|rate_limit|too_many_requests)\b/i.test(codes)
  ) {
    kind = "rate_limit";
  } else if (
    /\b(?:network_error|request_timeout|disconnected|transport_error|econnreset|etimedout)\b/i.test(codes) ||
    /\b(?:network(?:error| error)?|failed to fetch|fetch failed|(?:connection|request) timed out|connection (?:reset|closed))\b/i.test(text)
  ) {
    kind = "network";
  }

  return {
    kind,
    message: FAILURE_MESSAGES[kind],
    retryAfterMs,
    retryable: kind === "rate_limit" || kind === "capacity" || kind === "network",
  };
}

export function reactorRetryDelayMs(failure: ReactorConnectionFailure, attempt: number): number | null {
  if (!failure.retryable || !Number.isInteger(attempt) || attempt < 1 || attempt > REACTOR_MAX_RETRIES) {
    return null;
  }
  return Math.max(failure.retryAfterMs ?? 0, Math.min(60_000, 8_000 * 2 ** (attempt - 1)));
}
