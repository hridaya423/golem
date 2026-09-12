import { simulateCourse } from "./glide.ts";
import {
  brandValidated,
  courseOf,
  GameSpecCandidateSchema,
  GlideTurnPatchSchema,
  SPEC_LIMITS,
  type GameSpec,
  type ValidatedGameSpec,
  type ValidatedGameSpecPatch,
  type ValidationCheck,
  type ValidationIssue,
  type ValidationResult,
} from "./spec.ts";
import { seedFromImageId } from "../seed/image.ts";
import { composeWorldPrompt } from "../world/prompts.ts";
import { reactorTurnDeg } from "../world/world.ts";

const MAX_ISSUES = 16;
const clip = (s: string) => Array.from(s).slice(0, 160).join("");

export function validateGameSpecCandidate(candidate: unknown, image: { id: string }): ValidationResult {
  const checks: ValidationCheck[] = [];
  const fail = (issues: ValidationIssue[]): ValidationResult => ({ ok: false, issues: issues.slice(0, MAX_ISSUES), checks });

  const parsed = GameSpecCandidateSchema.safeParse(candidate);
  if (!parsed.success) {
    checks.push({ name: "schema", ok: false, detail: `${parsed.error.issues.length} schema issue(s)` });
    return fail(parsed.error.issues.map((i) => ({ path: i.path.join("."), code: "schema", message: clip(i.message) })));
  }
  checks.push({ name: "schema", ok: true, detail: "strict schema" });

  const spec: GameSpec = {
    ...parsed.data,
    referenceImageId: image.id,
    world: { ...parsed.data.world, seed: seedFromImageId(image.id) },
  };
  return validateTrusted(spec, checks, fail);
}

function validateTrusted(
  spec: GameSpec,
  checks: ValidationCheck[],
  fail: (issues: ValidationIssue[]) => ValidationResult,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, GameSpec["entities"][number]>();
  spec.entities.forEach((e, i) => {
    if (byId.has(e.id)) issues.push({ path: `entities.${i}.id`, code: "duplicate_id", message: `duplicate entity id ${e.id}` });
    byId.set(e.id, e);
  });
  const kinds = { start: 0, checkpoint: 0, goal: 0 };
  for (const e of spec.entities) kinds[e.kind] += 1;
  if (kinds.start !== 1 || kinds.checkpoint !== 3 || kinds.goal !== 1) {
    issues.push({ path: "entities", code: "out_of_bounds", message: `need 1 start, 3 checkpoints, 1 goal; got ${kinds.start}/${kinds.checkpoint}/${kinds.goal}` });
  }
  spec.rules.requiredCheckpointIds.forEach((id, i) => {
    const e = byId.get(id);
    if (!e || e.kind !== "checkpoint") issues.push({ path: `rules.requiredCheckpointIds.${i}`, code: "missing_reference", message: `${id} is not a checkpoint entity` });
  });
  if (new Set(spec.rules.requiredCheckpointIds).size !== 3) {
    issues.push({ path: "rules.requiredCheckpointIds", code: "route_order", message: "checkpoint ids must be distinct" });
  }
  const goal = byId.get(spec.rules.goalEntityId);
  if (!goal || goal.kind !== "goal") issues.push({ path: "rules.goalEntityId", code: "missing_reference", message: `${spec.rules.goalEntityId} is not a goal entity` });
  checks.push({ name: "references", ok: issues.length === 0, detail: `${spec.entities.length} entities, route ids resolved` });
  if (issues.length) return fail(issues);

  const R = SPEC_LIMITS.radius;
  spec.entities.forEach((e, i) => {
    const range = R[e.kind];
    if (e.radius < range.min || e.radius > range.max) {
      issues.push({ path: `entities.${i}.radius`, code: "out_of_bounds", message: `${e.kind} radius ${e.radius} outside ${range.min}–${range.max}` });
    }
  });
  checks.push({ name: "bounds", ok: issues.length === 0, detail: "radii inside supported forgiveness" });
  if (issues.length) return fail(issues);

  const start = spec.entities.find((e) => e.kind === "start")!;
  const route = [start, ...spec.rules.requiredCheckpointIds.map((id) => byId.get(id)!), goal!];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1].position, b = route[i].position;
    const dz = b[2] - a[2];
    if (dz <= 0) issues.push({ path: `entities.${route[i].id}`, code: "route_order", message: `${route[i].id} must be ahead (+z) of ${route[i - 1].id}` });
    else if (dz < SPEC_LIMITS.spacing.min || dz > SPEC_LIMITS.spacing.max) {
      issues.push({ path: `entities.${route[i].id}`, code: "out_of_bounds", message: `segment to ${route[i].id} advances z by ${dz}; allowed ${SPEC_LIMITS.spacing.min}–${SPEC_LIMITS.spacing.max}` });
    }
    if (Math.abs(b[0] - a[0]) > SPEC_LIMITS.segment.maxLateral) issues.push({ path: `entities.${route[i].id}`, code: "out_of_bounds", message: `segment to ${route[i].id} moves x by ${Math.abs(b[0] - a[0])}; max ${SPEC_LIMITS.segment.maxLateral}` });
    if (Math.abs(b[1] - a[1]) > SPEC_LIMITS.segment.maxVertical) issues.push({ path: `entities.${route[i].id}`, code: "out_of_bounds", message: `segment to ${route[i].id} moves y by ${Math.abs(b[1] - a[1])}; max ${SPEC_LIMITS.segment.maxVertical}` });
  }
  const distance = goal!.position[2] - start.position[2];
  const xs = route.map((e) => e.position[0]);
  const lateralSpan = Math.max(...xs) - Math.min(...xs);
  const directions = xs.slice(1).map((x, i) => Math.sign(x - xs[i])).filter((direction) => direction !== 0);
  const directionChanges = directions.filter((direction, i) => i > 0 && direction !== directions[i - 1]).length;
  const C = SPEC_LIMITS.course;
  if (distance < C.minDistance || distance > C.maxDistance) issues.push({ path: "entities", code: "out_of_bounds", message: `course z distance ${distance}; allowed ${C.minDistance}–${C.maxDistance}` });
  if (lateralSpan < C.minLateralSpan) issues.push({ path: "entities", code: "out_of_bounds", message: `course x span ${lateralSpan}; min ${C.minLateralSpan}` });
  if (directionChanges < C.minDirectionChanges) issues.push({ path: "entities", code: "out_of_bounds", message: `course horizontal direction changes ${directionChanges}; min ${C.minDirectionChanges}` });
  checks.push({ name: "route", ok: issues.length === 0, detail: `z ${route.map((e) => e.position[2]).join(" → ")}; x span ${lateralSpan}; ${directionChanges} direction changes` });
  if (issues.length) return fail(issues);

  const pilot = simulateCourse(courseOf(spec));
  if (pilot.status !== "won") {
    issues.push({ path: "rules.durationSeconds", code: "unreachable", message: `pilot ${pilot.status} after ${pilot.elapsed.toFixed(1)}s with ${pilot.completed.length}/4 gates` });
  }
  checks.push({ name: "pilot", ok: pilot.status === "won", detail: pilot.status === "won" ? `pilot wins in ${pilot.elapsed.toFixed(1)}s of ${spec.rules.durationSeconds}s` : "pilot cannot finish" });
  if (issues.length) return fail(issues);

  try {
    const prompt = composeWorldPrompt(spec.world.basePrompt, spec.world.landmarks);
    checks.push({ name: "prompt", ok: true, detail: `${prompt.length} chars` });
  } catch (error) {
    issues.push({ path: "world.basePrompt", code: "out_of_bounds", message: clip(error instanceof Error ? error.message : "prompt budget exceeded") });
    checks.push({ name: "prompt", ok: false, detail: "over budget" });
    return fail(issues);
  }

  return { ok: true, spec: brandValidated(spec), checks };
}

export function validateGlideTurnPatch(candidate: unknown): { ok: true; patch: ValidatedGameSpecPatch } | { ok: false; issues: readonly ValidationIssue[] } {
  const parsed = GlideTurnPatchSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, MAX_ISSUES).map((i) => ({ path: i.path.join("."), code: "schema", message: clip(i.message) })) };
  }
  return { ok: true, patch: brandValidated(parsed.data) };
}

/** Transactional: returns a new validated spec or leaves the caller's spec untouched. */
export function applyGlideTurnPatch(spec: ValidatedGameSpec, patch: ValidatedGameSpecPatch): ValidationResult {
  const checks: ValidationCheck[] = [];
  const turnRate = spec.mechanic.turnRate * patch.factor;
  const M = SPEC_LIMITS.mechanic;
  if (turnRate < M.min || turnRate > M.max || reactorTurnDeg(turnRate) > 30) {
    checks.push({ name: "patch-bounds", ok: false, detail: `turnRate ${turnRate}` });
    return { ok: false, issues: [{ path: "mechanic.turnRate", code: "out_of_bounds", message: `turn rate ${turnRate} outside ${M.min}–${M.max}` }], checks };
  }
  checks.push({ name: "patch-bounds", ok: true, detail: `turnRate ${spec.mechanic.turnRate} → ${turnRate}, reactor ${reactorTurnDeg(turnRate)} deg` });
  const next: GameSpec = { ...spec, mechanic: { ...spec.mechanic, turnRate }, cartridgeLine: patch.cartridgeLine };
  return validateTrusted(next, checks, (issues) => ({ ok: false, issues, checks }));
}
