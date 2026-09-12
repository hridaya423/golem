import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_CANDIDATE, fallbackCandidate, fallbackSpec } from "../src/game/fallback.ts";
import { gameSpecCandidateJsonSchema, SPEC_LIMITS, type GameSpecCandidate } from "../src/game/spec.ts";
import { courseOf } from "../src/game/spec.ts";
import { routeOf, startOf } from "../src/game/glide.ts";
import { applyGlideTurnPatch, validateGameSpecCandidate, validateGlideTurnPatch } from "../src/game/validate.ts";
import { seedFromImageId } from "../src/seed/image.ts";
import { reactorTurnDeg } from "../src/world/world.ts";

const IMAGE = { id: "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42" };
const clone = (): GameSpecCandidate => structuredClone(FALLBACK_CANDIDATE);
const codesOf = (result: ReturnType<typeof validateGameSpecCandidate>) => (result.ok ? [] : result.issues.map((i) => i.code));

test("fallback candidate validates and receives injected identity", () => {
  assert.equal(fallbackCandidate(IMAGE), FALLBACK_CANDIDATE);
  const result = validateGameSpecCandidate(FALLBACK_CANDIDATE, IMAGE);
  assert.ok(result.ok, JSON.stringify(result));
  assert.ok(result.checks.every((c) => c.ok));
  assert.equal(result.spec.referenceImageId, IMAGE.id);
  assert.equal(result.spec.world.seed, seedFromImageId(IMAGE.id));
  assert.equal(fallbackSpec(IMAGE).title, "Ink Islands Glide");
  assert.equal(result.spec.rules.durationSeconds, 70);
  const course = courseOf(result.spec);
  const route = [startOf(course), ...routeOf(course)];
  assert.equal(route.at(-1)!.position[2] - route[0].position[2], 1500);
  assert.ok(Math.max(...route.map((e) => e.position[0])) - Math.min(...route.map((e) => e.position[0])) >= 140);
  const directions = route.slice(1).map((e, i) => Math.sign(e.position[0] - route[i].position[0]));
  assert.deepEqual(directions, [1, -1, 1, -1]);
});

test("fresh image fallback preserves identity and geometry without fixture scenery", () => {
  for (const id of ["a".repeat(64), `${IMAGE.id.slice(0, -1)}3`]) {
    const result = validateGameSpecCandidate(fallbackCandidate({ id }), { id });
    assert.ok(result.ok, JSON.stringify(result));
    assert.ok(result.checks.every((check) => check.ok));
    const spec = fallbackSpec({ id });
    assert.deepEqual(spec, result.spec);
    assert.equal(spec.title, "Your World, In Motion");
    assert.equal(spec.referenceImageId, id);
    assert.equal(spec.world.seed, seedFromImageId(id));
    assert.doesNotMatch(JSON.stringify(spec), /stone|ink|water|neon|canyon|arch|moon/i);
    assert.match(spec.world.basePrompt, /reference image/i);
    assert.match(spec.world.basePrompt, /colors.*materials.*forms/i);
    assert.deepEqual(spec.mechanic, FALLBACK_CANDIDATE.mechanic);
    assert.deepEqual(spec.rules, FALLBACK_CANDIDATE.rules);
    assert.deepEqual(spec.entities.map((e) => e.position), FALLBACK_CANDIDATE.entities.map((e) => e.position));
    assert.deepEqual(spec.entities.map((e) => e.label), ["Launch", "Waypoint 1", "Waypoint 2", "Waypoint 3", "Finish"]);
  }
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

test("a long alternating course is reachable at minimum duration and mechanic multipliers", () => {
  const extreme = clone();
  extreme.rules.durationSeconds = SPEC_LIMITS.duration.min;
  extreme.mechanic = { kind: "glide", lift: 0.5, drag: 0.5, turnRate: 0.5, boost: 0.5 };
  extreme.entities = extreme.entities.map((e, i) => ({
    ...e,
    position: [i % 2 ? 130 : -130, i % 2 ? 90 : 30, i * 425] as const,
  }));
  const result = validateGameSpecCandidate(extreme, IMAGE);
  assert.ok(result.ok, JSON.stringify(result));
  const pilot = result.checks.find((c) => c.name === "pilot");
  assert.ok(pilot !== undefined && pilot.ok && /wins in \d+\.\d+s/.test(pilot.detail), pilot?.detail ?? "no pilot check");
});

test("numeric schema rejects values outside the longer-flight bounds", () => {
  const cases: [string, (candidate: GameSpecCandidate) => void][] = [
    ["duration below minimum", (c) => { c.rules.durationSeconds = 54; }],
    ["duration above maximum", (c) => { c.rules.durationSeconds = 91; }],
    ["respawn below minimum", (c) => { c.rules.respawnBehindDistance = 7; }],
    ["respawn above maximum", (c) => { c.rules.respawnBehindDistance = 51; }],
    ["non-finite mechanic", (c) => { c.mechanic.lift = NaN; }],
    ...([[181, 24, 0], [-181, 24, 0], [0, -1, 0], [0, 121, 0], [0, 24, 1801]] as const).map((position): [string, (candidate: GameSpecCandidate) => void] => [
      `position ${position}`, (c) => { c.entities[0].position = position; },
    ]),
  ];
  for (const [name, mutate] of cases) {
    const candidate = clone();
    mutate(candidate);
    assert.ok(codesOf(validateGameSpecCandidate(candidate, IMAGE)).includes("schema"), name);
  }
});

test("per-kind radii and segment limits reject unsafe courses", () => {
  for (const [index, radii] of [[0, [1, 7]], [1, [17, 33]], [4, [21, 39]]] as const) {
    for (const radius of radii) {
      const candidate = clone();
      candidate.entities[index].radius = radius;
      const result = validateGameSpecCandidate(candidate, IMAGE);
      assert.ok(!result.ok && result.issues.some((issue) => issue.path === `entities.${index}.radius`), JSON.stringify(result));
    }
  }
  const cases: [string, (candidate: GameSpecCandidate) => void, RegExp][] = [
    ["short segment", (c) => { c.entities[1].position = [75, 36, 199]; }, /advances z by 199/],
    ["long segment", (c) => { c.entities[1].position = [75, 36, 481]; }, /advances z by 481/],
    ["lateral jump", (c) => { c.entities[2].position = [-180, 58, 680]; }, /moves x by 305/],
    ["vertical jump", (c) => { c.entities[1].position = [75, 85, 260]; }, /moves y by 61/],
  ];
  for (const [name, mutate, message] of cases) {
    const candidate = clone();
    mutate(candidate);
    const result = validateGameSpecCandidate(candidate, IMAGE);
    assert.ok(!result.ok && result.issues.some((issue) => issue.code === "out_of_bounds" && message.test(issue.message)), `${name}: ${JSON.stringify(result)}`);
  }
});

test("route requires sustained distance, lateral span and two horizontal reversals", () => {
  for (const [name, x, z, message] of [
    ["short course", [0, 75, -110, 125, -40], [0, 300, 600, 900, 1200], /distance/],
    ["long course", [0, 75, -110, 125, -40], [0, 450, 900, 1350, 1800], /distance/],
    ["straight course", [0, 0, 0, 0, 0], [0, 300, 700, 1100, 1500], /span/],
    ["narrow zigzag", [0, 60, -60, 60, -60], [0, 300, 700, 1100, 1500], /span/],
    ["one reversal", [0, 80, 160, 80, 0], [0, 300, 700, 1100, 1500], /direction changes/],
    ["zero is not a reversal", [0, 160, 160, 0, -20], [0, 300, 700, 1100, 1500], /direction changes/],
    ["offset short course", [0, 75, -110, 125, -40], [300, 600, 900, 1200, 1500], /distance/],
  ] as const) {
    const candidate = clone();
    candidate.entities = candidate.entities.map((e, i) => ({ ...e, position: [x[i], e.position[1], z[i]] as const }));
    const result = validateGameSpecCandidate(candidate, IMAGE);
    assert.ok(!result.ok && result.issues.some((issue) => issue.code === "out_of_bounds" && message.test(issue.message)), `${name}: ${JSON.stringify(result)}`);
  }
  const candidate = clone();
  const x = [0, 140, 140, 0, 140];
  candidate.entities = candidate.entities.map((e, i) => ({ ...e, position: [x[i], e.position[1], e.position[2]] as const }));
  const result = validateGameSpecCandidate(candidate, IMAGE);
  assert.ok(result.ok, JSON.stringify(result));
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
