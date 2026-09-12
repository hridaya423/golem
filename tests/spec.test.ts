import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_CANDIDATE, fallbackSpec } from "../src/game/fallback.ts";
import { gameSpecCandidateJsonSchema, type GameSpecCandidate } from "../src/game/spec.ts";
import { applyGlideTurnPatch, validateGameSpecCandidate, validateGlideTurnPatch } from "../src/game/validate.ts";
import { seedFromImageId } from "../src/seed/image.ts";
import { reactorTurnDeg } from "../src/world/world.ts";

const IMAGE = { id: "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42" };
const clone = (): GameSpecCandidate => structuredClone(FALLBACK_CANDIDATE);
const codesOf = (result: ReturnType<typeof validateGameSpecCandidate>) => (result.ok ? [] : result.issues.map((i) => i.code));

test("fallback candidate validates and receives injected identity", () => {
  const result = validateGameSpecCandidate(FALLBACK_CANDIDATE, IMAGE);
  assert.ok(result.ok, JSON.stringify(result));
  assert.ok(result.checks.every((c) => c.ok));
  assert.equal(result.spec.referenceImageId, IMAGE.id);
  assert.equal(result.spec.world.seed, seedFromImageId(IMAGE.id));
  assert.equal(fallbackSpec(IMAGE).title, "Ink Islands Glide");
});

test("model-supplied identity fields are rejected by the strict schema", () => {
  assert.deepEqual(codesOf(validateGameSpecCandidate({ ...clone(), referenceImageId: "x" }, IMAGE)), ["schema"]);
  const seeded = clone();
  (seeded.world as Record<string, unknown>).seed = 7;
  assert.deepEqual(codesOf(validateGameSpecCandidate(seeded, IMAGE)), ["schema"]);
});

test("route must advance in z and reference real checkpoints/goal", () => {
  const swapped = clone();
  swapped.rules.requiredCheckpointIds = ["cp2", "cp1", "cp3"];
  assert.ok(codesOf(validateGameSpecCandidate(swapped, IMAGE)).includes("route_order"));

  const wrongGoal = clone();
  wrongGoal.rules.goalEntityId = "cp3";
  assert.ok(codesOf(validateGameSpecCandidate(wrongGoal, IMAGE)).includes("missing_reference"));
});

test("the hardest in-envelope course is still reachable at the minimum duration", () => {
  const extreme = clone();
  extreme.rules.durationSeconds = 20;
  extreme.mechanic = { kind: "glide", lift: 0.5, drag: 0.5, turnRate: 0.5, boost: 0.5 };
  const z = [0, 125, 250, 375, 500];
  extreme.entities = extreme.entities.map((e, i) => ({
    ...e,
    position: [i % 2 ? 40 : 0, i % 2 ? 30 : 10, z[i]] as const,
  }));
  const result = validateGameSpecCandidate(extreme, IMAGE);
  assert.ok(result.ok, JSON.stringify(result));
  const pilot = result.checks.find((c) => c.name === "pilot");
  assert.ok(pilot !== undefined && pilot.ok && /wins in \d+\.\d+s/.test(pilot.detail), pilot?.detail ?? "no pilot check");
});

test("turn-rate patch is bounded and transactional", () => {
  const spec = fallbackSpec(IMAGE);
  const double = validateGlideTurnPatch({ version: 1, mechanic: "glide", operation: "multiply_turn_rate", factor: 2, cartridgeLine: "Twice the bite." });
  assert.ok(double.ok);
  const patched = applyGlideTurnPatch(spec, double.patch);
  assert.ok(patched.ok);
  assert.equal(patched.spec.mechanic.turnRate, 2);
  assert.equal(reactorTurnDeg(patched.spec.mechanic.turnRate), 12);
  assert.equal(patched.spec.cartridgeLine, "Twice the bite.");
  assert.equal(patched.spec.referenceImageId, spec.referenceImageId);
  assert.equal(spec.mechanic.turnRate, 1);

  const again = applyGlideTurnPatch(patched.spec, double.patch);
  assert.ok(!again.ok);
  assert.deepEqual(codesOf(again), ["out_of_bounds"]);

  assert.ok(!validateGlideTurnPatch({ version: 1, mechanic: "glide", operation: "multiply_turn_rate", factor: 3, cartridgeLine: "x" }).ok);
});

test("compiler-facing JSON schema is strict and omits technical identity", () => {
  const schema = gameSpecCandidateJsonSchema() as {
    additionalProperties: boolean;
    properties: Record<string, { additionalProperties?: boolean; properties?: Record<string, unknown>; items?: { additionalProperties?: boolean } }>;
  };
  assert.equal(schema.additionalProperties, false);
  for (const key of ["world", "mechanic", "rules"]) assert.equal(schema.properties[key].additionalProperties, false, key);
  assert.equal(schema.properties.entities.items?.additionalProperties, false);
  assert.equal("referenceImageId" in schema.properties, false);
  assert.equal("seed" in (schema.properties.world.properties ?? {}), false);
});
