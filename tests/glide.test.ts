import test from "node:test";
import assert from "node:assert/strict";
import {
  createGlideState,
  FIXTURE_COURSE,
  GLIDE_CALIBRATION,
  IDLE_INPUT,
  routeOf,
  segmentHitsSphere,
  simulateCourse,
  stepGlide,
  type GlideInput,
  type GlideState,
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
  assert.equal(segmentHitsSphere([0, 12, 80], [0, 12, 110], cp1.position, cp1.radius), true);
  assert.equal(segmentHitsSphere([30, 12, 80], [30, 12, 110], cp1.position, cp1.radius), false);
});

test("a gate ahead of the active checkpoint does not advance the route", () => {
  const state: GlideState = {
    ...createGlideState(FIXTURE_COURSE),
    position: [20, 16, 170],
    activeGate: 0,
  };
  const next = stepGlide(state, IDLE_INPUT, FIXTURE_COURSE);
  assert.deepStrictEqual([...next.completed], []);
  assert.equal(next.activeGate, 0);
});

test("the pilot wins the fixture course in order within the duration", () => {
  const final = simulateCourse(FIXTURE_COURSE);
  assert.equal(final.status, "won");
  assert.deepStrictEqual([...final.completed], ["cp1", "cp2", "cp3", "goal"]);
  assert.ok(final.elapsed < 30, `elapsed ${final.elapsed}`);
});

test("missing the active ring respawns at the last checkpoint", () => {
  const cp1 = routeOf(FIXTURE_COURSE)[0];
  const state: GlideState = {
    ...createGlideState(FIXTURE_COURSE),
    position: [0, 12, 215],
    activeGate: 1,
    completed: ["cp1"],
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
