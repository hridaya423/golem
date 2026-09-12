import { fallbackCandidate } from "../game/fallback.ts";
import { validateGameSpecCandidate } from "../game/validate.ts";
import type {
  ValidatedGameSpec,
  ValidationCheck,
  ValidationIssue,
} from "../game/spec.ts";
import type { PreparedImage } from "../seed/image.ts";
import type { CompilerFailure } from "./request.ts";

export type CompileProgress = {
  step: "rules" | "testing";
  status: "active" | "passed" | "repairing" | "fallback" | "failed";
  detail?: string;
};

export type CompileOutcome = {
  spec: ValidatedGameSpec;
  source: "live" | "repaired" | "fallback";
  label: string;
  checks: ValidationCheck[];
  attempts: number;
  elapsedMs: number;
  issues?: readonly ValidationIssue[];
};

type RouteBody =
  | { ok: true; candidate: unknown; elapsedMs: number; label: string }
  | { ok: false; failure: CompilerFailure; elapsedMs: number; label: string };

const isAbort = (signal: AbortSignal | undefined, error: unknown): boolean =>
  signal?.aborted === true || (error instanceof Error && error.name === "AbortError");

export async function compileGame(
  image: PreparedImage,
  direction: string,
  onProgress: (progress: CompileProgress) => void,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<CompileOutcome> {
  const started = performance.now();
  let attempts = 0;
  let label = "compiler";
  let lastIssues: readonly ValidationIssue[] = [];

  const post = async (repair?: {
    priorCandidate: unknown;
    issues: readonly ValidationIssue[];
  }): Promise<Response> => {
    attempts += 1;
    const form = new FormData();
    form.set("image", image.normalized, image.originalName);
    if (direction) form.set("direction", direction);
    if (repair) form.set("repair", JSON.stringify(repair));
    return fetchImpl("/api/compile", { method: "POST", body: form, signal });
  };

  const fallback = (detail: string, step: "rules" | "testing"): CompileOutcome => {
    onProgress({ step, status: "fallback", detail });
    const result = validateGameSpecCandidate(fallbackCandidate(image), image);
    if (!result.ok) {
      throw new Error(`Fallback spec is invalid: ${JSON.stringify(result.issues)}`);
    }
    return {
      spec: result.spec,
      source: "fallback",
      label,
      checks: result.checks,
      attempts,
      elapsedMs: performance.now() - started,
      issues: lastIssues,
    };
  };

  onProgress({ step: "rules", status: "active" });
  let response: Response;
  try {
    response = await post();
  } catch (error) {
    if (isAbort(signal, error)) throw error;
    return fallback("Compiler request could not be sent — using the prepared game", "rules");
  }
  if (response.status === 503) {
    return fallback("Compiler not configured — using the prepared game", "rules");
  }
  const body: RouteBody | null = await response.json().catch(() => null);
  if (body?.label) label = body.label;

  let candidate: unknown;
  let issues: readonly ValidationIssue[];
  if (body?.ok === true) {
    candidate = body.candidate;
    onProgress({ step: "rules", status: "passed" });
    onProgress({ step: "testing", status: "active" });
    const first = validateGameSpecCandidate(candidate, image);
    if (first.ok) {
      onProgress({ step: "testing", status: "passed" });
      return {
        spec: first.spec,
        source: "live",
        label,
        checks: first.checks,
        attempts,
        elapsedMs: performance.now() - started,
      };
    }
    issues = first.issues;
  } else {
    issues = [
      {
        path: "",
        code: "schema",
        message: body?.ok === false ? body.failure.message : `Compile route failed (${response.status})`,
      },
    ];
  }
  lastIssues = issues;

  onProgress({ step: "rules", status: "repairing" });
  try {
    response = await post({ priorCandidate: candidate ?? null, issues });
  } catch (error) {
    if (isAbort(signal, error)) throw error;
    return fallback("Repair request could not be sent — using the prepared game", "testing");
  }
  if (response.status === 503) {
    return fallback("Compiler not configured — using the prepared game", "testing");
  }
  const repaired: RouteBody | null = await response.json().catch(() => null);
  if (repaired?.label) label = repaired.label;
  if (repaired?.ok === true) {
    const second = validateGameSpecCandidate(repaired.candidate, image);
    if (second.ok) {
      onProgress({ step: "testing", status: "passed" });
      return {
        spec: second.spec,
        source: "repaired",
        label,
        checks: second.checks,
        attempts,
        elapsedMs: performance.now() - started,
      };
    }
    lastIssues = second.issues;
  } else {
    lastIssues = [
      {
        path: "",
        code: "schema",
        message: repaired?.ok === false ? repaired.failure.message : `Compile route failed (${response.status})`,
      },
    ];
  }
  return fallback("Using the prepared game", "testing");
}
