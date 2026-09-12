import test from "node:test";
import assert from "node:assert/strict";
import {
  createGlideState,
  FIXTURE_COURSE,
  forwardOf,
  GLIDE_CALIBRATION,
  IDLE_INPUT,
  pilotInput,
  projectPoint,
  routeOf,
  segmentHitsSphere,
  simulateCourse,
  stepGlide,
  type GlideInput,
  type GlideState,
  type Vec3,
} from "../src/game/glide.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function scriptedInput(rand: () => number): GlideInput {
  return {
    turn: rand() * 2 - 1,
    pitch: rand() * 2 - 1,
    boost: rand() > 0.5,
  };
}

test("same initial state + same 1800-input sequence is deeply equal twice", () => {
  const run = () => {
    const rand = lcg(0xdecaf);
    let state = createGlideState(FIXTURE_COURSE);
    for (let i = 0; i < 1800; i += 1) {
      state = stepGlide(state, scriptedInput(rand), FIXTURE_COURSE);
    }
    return state;
  };
  assert.deepStrictEqual(run(), run());
});

test("segmentHitsSphere catches a fast pass through the active ring", () => {
  const cp1 = routeOf(FIXTURE_COURSE)[0];
  const [x, y, z] = cp1.position;
  const offset = cp1.radius + 1;
  assert.equal(segmentHitsSphere([x, y, z - offset], [x, y, z + offset], cp1.position, cp1.radius), true);
  assert.equal(segmentHitsSphere([x + offset, y, z - offset], [x + offset, y, z + offset], cp1.position, cp1.radius), false);
});

test("a hoop passes at its actual opening, not at the front of an invisible sphere", () => {
  const gate = routeOf(FIXTURE_COURSE)[0];
  const approach = { ...createGlideState(FIXTURE_COURSE), position: [gate.position[0], gate.position[1], gate.position[2] - gate.radius / 2] as Vec3 };
  assert.equal(stepGlide(approach, IDLE_INPUT, FIXTURE_COURSE).activeGate, 0);
  const crossing = { ...approach, position: [gate.position[0], gate.position[1], gate.position[2] - 0.1] as Vec3 };
  assert.equal(stepGlide(crossing, IDLE_INPUT, FIXTURE_COURSE).activeGate, 1);
  const outside = { ...crossing, position: [gate.position[0] + gate.radius + 1, gate.position[1], gate.position[2] - 0.1] as Vec3 };
  assert.equal(stepGlide(outside, IDLE_INPUT, FIXTURE_COURSE).activeGate, 0);
});

test("a gate ahead of the active checkpoint does not advance the route", () => {
  const cp2 = routeOf(FIXTURE_COURSE)[1];
  const state: GlideState = {
    ...createGlideState(FIXTURE_COURSE),
    position: cp2.position,
    activeGate: 0,
  };
  const next = stepGlide(state, IDLE_INPUT, FIXTURE_COURSE);
  assert.deepStrictEqual([...next.completed], []);
  assert.equal(next.activeGate, 0);
});

test("the pilot wins the longer fixture in order with and without boost", (t) => {
  const boosted = simulateCourse(FIXTURE_COURSE);
  const base = simulateCourse(FIXTURE_COURSE, (state, course) => ({ ...pilotInput(state, course), boost: false }));
  for (const final of [boosted, base]) {
    assert.equal(final.status, "won");
    assert.deepStrictEqual([...final.completed], [...FIXTURE_COURSE.rules.requiredCheckpointIds, FIXTURE_COURSE.rules.goalEntityId]);
    assert.equal(final.respawns, 0);
    assert.ok(final.elapsed < FIXTURE_COURSE.rules.durationSeconds, `elapsed ${final.elapsed}`);
  }
  assert.ok(boosted.elapsed >= 30 && boosted.elapsed <= 40, `boosted ${boosted.elapsed}`);
  assert.ok(base.elapsed >= 45 && base.elapsed <= 55, `base ${base.elapsed}`);
  t.diagnostic(`headless fixture: default pilot ${boosted.elapsed.toFixed(2)}s; boost=false ${base.elapsed.toFixed(2)}s`);
});

test("missing the active ring respawns at the last checkpoint", () => {
  const [cp1, cp2] = routeOf(FIXTURE_COURSE);
  const state: GlideState = {
    ...createGlideState(FIXTURE_COURSE),
    position: [cp2.position[0] + cp2.radius + 1, cp2.position[1], cp2.position[2] + FIXTURE_COURSE.rules.respawnBehindDistance + 1],
    activeGate: 1,
    completed: [cp1.id],
    respawn: cp1.position,
  };
  const next = stepGlide(state, IDLE_INPUT, FIXTURE_COURSE);
  assert.equal(next.event, "respawn");
  assert.deepStrictEqual(next.position, cp1.position);
  assert.equal(next.respawns, 1);
  assert.equal(next.activeGate, 1);
});

test("duration expiry fails the run", () => {
  const course = {
    ...FIXTURE_COURSE,
    rules: { ...FIXTURE_COURSE.rules, durationSeconds: 0.05 },
  };
  let state = createGlideState(course);
  const maxSteps = Math.ceil(0.05 / GLIDE_CALIBRATION.step) + 2;
  for (let i = 0; i < maxSteps && state.status === "running"; i += 1) {
    state = stepGlide(state, IDLE_INPUT, course);
  }
  assert.equal(state.status, "failed");
});

test("a point along positive-pitch forward projects to the screen centre", () => {
  const state = { position: [17, 35, 81] as Vec3, yaw: 0.7, pitch: 0.4 };
  const forward = forwardOf(state.yaw, state.pitch);
  const point: Vec3 = [state.position[0] + forward[0] * 100, state.position[1] + forward[1] * 100, state.position[2] + forward[2] * 100];
  const projected = projectPoint(point, state, 1280, 720);
  assert.ok(projected);
  assert.ok(Math.abs(projected.x - 640) < 1e-9, `x ${projected.x}`);
  assert.ok(Math.abs(projected.y - 360) < 1e-9, `y ${projected.y}`);
  assert.ok(Math.abs(projected.depth - 100) < 1e-9, `depth ${projected.depth}`);
});

test("pilot chooses the short turn across the yaw wrap", () => {
  const cp1 = routeOf(FIXTURE_COURSE)[0];
  const state: GlideState = {
    ...createGlideState(FIXTURE_COURSE),
    position: [cp1.position[0] + 1, cp1.position[1], cp1.position[2] + 100],
    yaw: Math.PI - 0.05,
  };
  const input = pilotInput(state, FIXTURE_COURSE);
  assert.ok(input.turn > 0 && input.turn < 1, `turn ${input.turn}`);
  assert.equal(input.boost, true);
});

test("bounded bonus speed uses the same acceleration and gate collision step", () => {
  const initial = createGlideState(FIXTURE_COURSE);
  const base = stepGlide(initial, IDLE_INPUT, FIXTURE_COURSE);
  for (const multiplier of [undefined, 0, -1, NaN, Infinity, -Infinity]) {
    assert.deepStrictEqual(stepGlide(initial, IDLE_INPUT, FIXTURE_COURSE, multiplier), base);
  }
  const boostedInput = { ...IDLE_INPUT, boost: true };
  const bounded = stepGlide(initial, boostedInput, FIXTURE_COURSE, 2.5);
  assert.deepStrictEqual(stepGlide(initial, boostedInput, FIXTURE_COURSE, 100), bounded);
  const target = GLIDE_CALIBRATION.boostSpeed * 2.5;
  const expectedSpeed = target + (initial.speed - target) * Math.exp(-GLIDE_CALIBRATION.dragResponse * FIXTURE_COURSE.mechanic.drag * GLIDE_CALIBRATION.step);
  assert.ok(Math.abs(bounded.speed - expectedSpeed) < 1e-9);
  assert.ok(bounded.speed > base.speed && bounded.speed < target);
  const cp1 = routeOf(FIXTURE_COURSE)[0];
  const state: GlideState = {
    ...initial,
    position: [cp1.position[0], cp1.position[1], cp1.position[2] - bounded.speed * GLIDE_CALIBRATION.step / 2],
  };
  const next = stepGlide(state, boostedInput, FIXTURE_COURSE, 2.5);
  assert.equal(next.event, "gate");
  assert.equal(next.activeGate, 1);
  assert.deepStrictEqual(next.completed, [cp1.id]);
  assert.deepStrictEqual(next.path.at(-1), next.position);
  assert.equal(next.elapsed, GLIDE_CALIBRATION.step);
  assert.equal(next.respawns, 0);
});
