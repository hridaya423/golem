import test from "node:test";
import assert from "node:assert/strict";
import { IDLE_INPUT } from "../src/game/glide.ts";
import { controlsFromInput } from "../src/world/world.ts";
import {
  classifyReactorConnectionError,
  REACTOR_MAX_RETRIES,
  reactorRetryDelayMs,
  tokenRequestBody,
} from "../src/world/reactor-contract.ts";

test("token request body scopes a bounded session token", () => {
  assert.deepStrictEqual(tokenRequestBody(), {
    expires_after: 3600,
    authorization_details: [
      {
        type: "session",
        resources: { models: { match: ["reactor/lingbot-world-2"] } },
        constraints: { max_sessions: 3, max_session_duration_seconds: 3600 },
      },
    ],
  });
});

test("idle input still means forward motion for the world", () => {
  assert.deepStrictEqual(controlsFromInput(IDLE_INPUT), {
    longitudinal: "forward",
    lateral: "idle",
    lookHorizontal: "idle",
    lookVertical: "idle",
  });
});

const QUOTA_ERROR = 'unexpected HTTP status 429 from create session: {"current":10,"error":"quota_exceeded","limit":10,"message":"quota exceeded: sessions_per_minute for model ...","quota_type":"sessions_per_minute","retry_after_seconds":2}';

const RATE_LIMIT_MESSAGE = "Reactor session rate limit reached. Please wait before reconnecting.";
const CAPACITY_MESSAGE = "Reactor model capacity is full. Please wait before reconnecting.";
const AUTH_MESSAGE = "Reactor authentication failed. Check the server credentials.";
const NETWORK_MESSAGE = "Reactor connection interrupted. Please retry.";
const OTHER_MESSAGE = "Unable to connect to Reactor.";

function embeddedError(fields: unknown) {
  return new Error(`unexpected HTTP status 429 from create session: ${JSON.stringify(fields)}`);
}

test("the exact upstream sessions-per-minute quota error is not pool capacity", () => {
  assert.deepStrictEqual(classifyReactorConnectionError(new Error(QUOTA_ERROR)), {
    kind: "rate_limit",
    message: RATE_LIMIT_MESSAGE,
    retryAfterMs: 2_000,
    retryable: true,
  });
});

test("explicit capacity errors override generic SDK HTTP 429 classification", () => {
  for (const message of ["no available capacity", "model instances are busy"]) {
    for (const error of [
      { status: 429, code: "RATE_LIMITED", message, retry_after_ms: 12_000 },
      Object.assign(embeddedError({ message }), { retry_after_ms: 12_000 }),
    ]) {
      assert.deepStrictEqual(classifyReactorConnectionError(error), {
        kind: "capacity",
        message: CAPACITY_MESSAGE,
        retryAfterMs: 12_000,
        retryable: true,
      });
    }
  }
});

test("bare 429 statuses and SDK rate-limit codes are rate limits, never capacity", () => {
  for (const error of [
    { status: 429 },
    { status: "429" },
    { code: 429 },
    { code: "429" },
    { code: "RATE_LIMITED" },
    { code: "rate_limit_exceeded" },
    new Error("unexpected HTTP status 429 from create session"),
    new Error("Reactor token request failed (429)"),
  ]) {
    assert.deepStrictEqual(classifyReactorConnectionError(error), {
      kind: "rate_limit",
      message: RATE_LIMIT_MESSAGE,
      retryAfterMs: null,
      retryable: true,
    });
  }
});

test("validated quota_type, error, code, and status fields identify rate limits", () => {
  for (const fields of [
    { quota_type: "sessions_per_minute" },
    { error: "quota_exceeded" },
    { code: "QUOTA_EXCEEDED" },
    { status: 429 },
  ]) {
    for (const error of [fields, new Error(`create session failed: ${JSON.stringify(fields)}`)]) {
      assert.equal(classifyReactorConnectionError(error).kind, "rate_limit");
    }
  }
});

test("quota metadata is more specific than incidental capacity text", () => {
  assert.equal(classifyReactorConnectionError({
    code: "RATE_LIMITED",
    message: 'create session failed: {"error":"quota_exceeded","message":"no available capacity"}',
  }).kind, "rate_limit");
});

test("SDK milliseconds and embedded seconds use the greater validated server hint", () => {
  for (const [sdkMs, seconds, expectedMs] of [
    [12_000, 2, 12_000],
    [500, 2, 2_000],
    [0, 0, 0],
    [1_000, 2.5, 2_500],
    [90_000, 2, 90_000],
    [20_000, 120, 120_000],
  ]) {
    const error = Object.assign(embeddedError({ retry_after_seconds: seconds }), {
      retry_after_ms: sdkMs,
    });
    assert.equal(classifyReactorConnectionError(error).retryAfterMs, expectedMs);
  }
  assert.equal(classifyReactorConnectionError({ status: 429, retry_after_ms: 3_500 }).retryAfterMs, 3_500);
});

test("invalid SDK hints cannot erase valid embedded hints or error classification", () => {
  for (const retry_after_ms of [-1, NaN, Infinity, -Infinity, "12000", null, {}, true]) {
    assert.equal(classifyReactorConnectionError({
      message: QUOTA_ERROR,
      retry_after_ms,
    }).retryAfterMs, 2_000);
    const failure = classifyReactorConnectionError({ status: 429, retry_after_ms });
    assert.equal(failure.kind, "rate_limit");
    assert.equal(failure.retryAfterMs, null);
  }
});

test("invalid embedded hints are rejected, including nonfinite seconds conversion", () => {
  for (const retry_after_seconds of [-2, "2", null, {}, true, Number.MAX_VALUE]) {
    const error = embeddedError({ retry_after_seconds });
    assert.equal(classifyReactorConnectionError(error).retryAfterMs, null);
    assert.equal(classifyReactorConnectionError(Object.assign(error, {
      retry_after_ms: 15_000,
    })).retryAfterMs, 15_000);
  }
  for (const seconds of ["1e999", "-1e999"]) {
    assert.equal(classifyReactorConnectionError(new Error(
      `unexpected HTTP status 429 from create session: {"retry_after_seconds":${seconds}}`,
    )).retryAfterMs, null);
  }
});

test("malformed embedded JSON and mistyped fields fail safely without hiding a valid status", () => {
  for (const suffix of ["{broken", '{"retry_after_seconds":2', "null", "[]"]) {
    const failure = classifyReactorConnectionError(new Error(
      `unexpected HTTP status 429 from create session: ${suffix}`,
    ));
    assert.equal(failure.kind, "rate_limit");
    assert.equal(failure.retryAfterMs, null);
  }
  assert.equal(classifyReactorConnectionError({
    status: 429,
    message: { secret: "synthetic-secret" },
    code: [],
    error: false,
    quota_type: 12,
  }).kind, "rate_limit");
  for (const error of [undefined, null, "arbitrary upstream text", 429, [], {
    message: 429,
    status: {},
    code: {},
    error: {},
    quota_type: {},
  }]) {
    assert.deepStrictEqual(classifyReactorConnectionError(error), {
      kind: "other",
      message: OTHER_MESSAGE,
      retryAfterMs: null,
      retryable: false,
    });
  }
});

test("authentication errors are sanitized and never automatically retried", () => {
  for (const error of [
    { status: 401 },
    { status: 403 },
    { code: "UNAUTHORIZED" },
    { code: "FORBIDDEN" },
    new Error("unexpected HTTP status 401 from create session"),
    new Error("Reactor token request failed (403)"),
    { status: 401, message: QUOTA_ERROR },
    { status: 403, message: "model instances are busy" },
  ]) {
    const failure = classifyReactorConnectionError(error);
    assert.equal(failure.kind, "auth");
    assert.equal(failure.message, AUTH_MESSAGE);
    assert.equal(failure.retryable, false);
    assert.equal(reactorRetryDelayMs(failure, 1), null);
  }
});

test("missing server key keeps the exact operator setup message without leaking suffixes", () => {
  const setupMessage = "REACTOR_API_KEY is not configured on the server (.env.local)";
  for (const message of [setupMessage, `token resolver failed: ${setupMessage}; synthetic-secret`]) {
    assert.deepStrictEqual(classifyReactorConnectionError({ status: 503, message }), {
      kind: "auth",
      message: setupMessage,
      retryAfterMs: null,
      retryable: false,
    });
  }
});

test("known transient network failures are retryable but unknown failures are not", () => {
  for (const error of [
    { code: "NETWORK_ERROR" },
    { code: "REQUEST_TIMEOUT" },
    { code: "DISCONNECTED" },
    { code: "TRANSPORT_ERROR" },
    new TypeError("Failed to fetch"),
    new Error("NetworkError when attempting to fetch resource."),
    new Error("connection timed out"),
  ]) {
    const failure = classifyReactorConnectionError(error);
    assert.equal(failure.kind, "network");
    assert.equal(failure.message, NETWORK_MESSAGE);
    assert.equal(failure.retryable, true);
  }
  const unknown = classifyReactorConnectionError({ code: "UNKNOWN", recoverable: true });
  assert.equal(unknown.kind, "other");
  assert.equal(unknown.retryable, false);
  assert.equal(reactorRetryDelayMs(unknown, 1), null);
});

test("all returned messages exclude arbitrary upstream secrets and identifiers", () => {
  const secret = "synthetic-secret-token-abcdef";
  for (const error of [
    new Error(`${secret} internal tenant details`),
    { status: 401, message: `Authorization: Bearer ${secret}` },
    { status: 429, message: `model instances are busy; ${secret}` },
    { code: "NETWORK_ERROR", message: `https://private.example/${secret}` },
    embeddedError({ error: "quota_exceeded", message: secret, quota_type: secret }),
  ]) {
    const failure = classifyReactorConnectionError(error);
    assert.ok([RATE_LIMIT_MESSAGE, CAPACITY_MESSAGE, AUTH_MESSAGE, NETWORK_MESSAGE, OTHER_MESSAGE]
      .includes(failure.message));
    assert.equal(JSON.stringify(failure).includes(secret), false);
  }
});

test("retry delay is deterministic 8/16/32/60/60 seconds with a five-attempt stop", () => {
  assert.equal(REACTOR_MAX_RETRIES, 5);
  for (const error of [new Error(QUOTA_ERROR), { message: "no available capacity" }, { code: "NETWORK_ERROR" }]) {
    const failure = classifyReactorConnectionError(error);
    assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7].map((attempt) => reactorRetryDelayMs(failure, attempt)), [
      8_000, 16_000, 32_000, 60_000, 60_000, null, null,
    ]);
  }
});

test("retry delays never shorten valid server hints above the 60-second backoff cap", () => {
  for (const hint of [90_000, 120_000, Number.MAX_VALUE]) {
    const failure = classifyReactorConnectionError({ status: 429, retry_after_ms: hint });
    assert.deepStrictEqual([1, 2, 3, 4, 5].map((attempt) => reactorRetryDelayMs(failure, attempt)), Array(5).fill(hint));
    assert.equal(reactorRetryDelayMs(failure, 6), null);
  }
  const failure = classifyReactorConnectionError({ status: 429, retry_after_ms: 20_000 });
  assert.deepStrictEqual([1, 2, 3].map((attempt) => reactorRetryDelayMs(failure, attempt)), [20_000, 20_000, 32_000]);
});

test("retry attempts must be finite positive integers", () => {
  const failure = classifyReactorConnectionError({ status: 429 });
  for (const attempt of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal(reactorRetryDelayMs(failure, attempt), null);
  }
});
