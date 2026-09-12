import type { ValidatedGameSpec, ValidatedGameSpecPatch } from "../game/spec.ts";
import { applyGlideTurnPatch, validateGlideTurnPatch } from "../game/validate.ts";

export type PatchOutcome = {
  spec: ValidatedGameSpec;
  patch: ValidatedGameSpecPatch;
  source: "live" | "offline";
  elapsedMs: number;
};

const PATCH_ERROR_MESSAGE =
  "That rule isn't one this game can take yet — try 'double the turn rate'.";

export function offlinePatchCandidate(transcript: string): unknown | null {
  const factor = /(double|twice|faster|sharp|quick|tight)/i.test(transcript)
    ? 2
    : /(half|slow|smooth|gentl|calm|wide)/i.test(transcript)
      ? 0.5
      : null;
  if (factor === null) return null;
  return {
    version: 1,
    mechanic: "glide",
    operation: "multiply_turn_rate",
    factor,
    cartridgeLine: `Turn rate ×${factor}.`,
  };
}

const isAbort = (signal: AbortSignal | undefined, error: unknown): boolean =>
  signal?.aborted === true || (error instanceof Error && error.name === "AbortError");

/** The caller's spec is never mutated; failures throw a user-facing Error. */
export async function requestPatch(
  transcript: string,
  current: ValidatedGameSpec,
  compiler: "on" | "off",
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<PatchOutcome> {
  const started = performance.now();
  let candidate: unknown = null;
  let source: "live" | "offline" = "offline";

  if (compiler === "on") {
    try {
      const response = await fetchImpl("/api/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, spec: current }),
        signal,
      });
      const body: { ok?: boolean; candidate?: unknown } | null = await response
        .json()
        .catch(() => null);
      if (response.ok && body?.ok === true) {
        candidate = body.candidate;
        source = "live";
      }
    } catch (error) {
      if (isAbort(signal, error)) throw error;
    }
    if (candidate === null) candidate = offlinePatchCandidate(transcript);
  } else {
    candidate = offlinePatchCandidate(transcript);
  }

  if (candidate === null) throw new Error(PATCH_ERROR_MESSAGE);
  const parsed = validateGlideTurnPatch(candidate);
  if (!parsed.ok) throw new Error(PATCH_ERROR_MESSAGE);
  const applied = applyGlideTurnPatch(current, parsed.patch);
  if (!applied.ok) {
    throw new Error(applied.issues[0]?.message ?? PATCH_ERROR_MESSAGE);
  }
  return {
    spec: applied.spec,
    patch: parsed.patch,
    source,
    elapsedMs: performance.now() - started,
  };
}
