import test from "node:test";
import assert from "node:assert/strict";
import {
  createParkourState,
  DEFAULT_PARKOUR_COURSE,
  IDLE_PARKOUR_INPUT,
  PARKOUR_CALIBRATION,
  parkourPilotInput,
  simulateParkourCourse,
  stepParkour,
  type ParkourCourse,
  type ParkourInput,
  type ParkourState,
} from "../src/game/parkour.ts";

const course = DEFAULT_PARKOUR_COURSE;
const C = PARKOUR_CALIBRATION;
const idle = IDLE_PARKOUR_INPUT;
const advance = (state: ParkourState, input: ParkourInput, frames: number, track = course) => {
  for (let i = 0; i < frames; i++) state = stepParkour(state, input, track);
  return state;
};

test("parkour pilot lands on every platform, wins in order, and is deterministic", (t) => {
  const visited = new Set<number>([0]);
  const result = simulateParkourCourse(course, (state, track) => {
    if (state.grounded) visited.add(state.platformIndex);
    return parkourPilotInput(state, track);
  });
  visited.add(result.platformIndex);
  assert.equal(result.status, "won", JSON.stringify(result));
  assert.equal(result.respawns, 0);
  assert.equal(result.jumps, course.platforms.length - 1);
  assert.deepEqual([...visited], course.platforms.map((_, i) => i));
  assert.deepEqual(result.completed, [...course.rules.requiredCheckpointIds, course.rules.goalEntityId]);
  assert.ok(result.elapsed < course.rules.durationSeconds);
  assert.deepEqual(simulateParkourCourse(course), result);
  t.diagnostic(`Default: ${result.elapsed.toFixed(2)}s, ${result.jumps} jumps, ${visited.size} physical landings, no respawns`);
});

test("pilot adapts to bounded lift, response, sprint and look multipliers", (t) => {
  for (const lift of [0.5, 1, 2]) {
    for (const boost of [0.5, 2]) {
      for (const drag of [0.5, 2]) {
        const track: ParkourCourse = { ...course, mechanic: { ...course.mechanic, lift, boost, drag, turnRate: 2 } };
        const result = simulateParkourCourse(track);
        assert.equal(result.status, "won", `lift=${lift}, boost=${boost}, drag=${drag}: ${JSON.stringify(result)}`);
        assert.equal(result.respawns, 0);
        assert.equal(result.jumps, track.platforms.length - 1);
      }
    }
  }
  t.diagnostic("12 multiplier combinations complete all 11 jumps without respawning");
});

test("idle is stationary, diagonal movement is normalized, and walking follows yaw", () => {
  const initial = createParkourState(course);
  Object.freeze(initial);
  Object.freeze(initial.position);
  Object.freeze(initial.velocity);
  const still = advance(initial, idle, 120);
  assert.deepEqual(still.position, initial.position);
  assert.deepEqual(still.velocity, [0, 0, 0]);
  assert.equal(still.grounded, true);
  assert.equal(initial.elapsed, 0);
  const forward = stepParkour(initial, { ...idle, forward: 1 }, course);
  const diagonal = stepParkour(initial, { ...idle, forward: 1, strafe: 1 }, course);
  assert.ok(Math.abs(forward.speed - diagonal.speed) < 1e-10);
  assert.ok(diagonal.position[0] > initial.position[0]);
  assert.ok(diagonal.position[2] > initial.position[2]);
  const sideways = stepParkour({ ...initial, yaw: Math.PI / 2 }, { ...idle, forward: 1 }, course);
  assert.ok(sideways.position[0] > initial.position[0]);
  assert.ok(Math.abs(sideways.position[2] - initial.position[2]) < 1e-10);
  const stopped = advance(forward, idle, 60);
  assert.ok(stopped.speed < forward.speed / 100);
});

test("jump is edge-triggered: holding or releasing does not auto-bunnyhop", () => {
  const initial = createParkourState(course);
  const jump = { ...idle, jump: true };
  const airborne = stepParkour(initial, jump, course);
  assert.equal(airborne.grounded, false);
  assert.equal(airborne.jumps, 1);
  assert.ok(airborne.position[1] > initial.position[1]);
  const held = advance(airborne, jump, 120);
  assert.equal(held.jumps, 1);
  assert.equal(held.grounded, true);
  const released = advance(held, idle, 60);
  assert.equal(released.jumps, 1);
  assert.equal(released.grounded, true);
  assert.equal(stepParkour(released, jump, course).jumps, 2);
});

test("swept landing catches a high-speed fall without tunnelling and exposes visual impact", () => {
  const initial = createParkourState(course);
  const falling: ParkourState = { ...initial, grounded: false, position: [0, 40, 0], velocity: [0, -2400, 0] };
  const landed = stepParkour(falling, idle, course);
  assert.equal(landed.grounded, true);
  assert.equal(landed.position[1], course.platforms[0].position[1] + C.eyeHeight);
  assert.equal(landed.velocity[1], 0);
  assert.ok(landed.landingImpact > 0);
  assert.equal(falling.position[1], 40);
  const miss = stepParkour({ ...falling, position: [50, 15, 0], velocity: [0, -20, 0] }, idle, course);
  assert.equal(miss.grounded, false);
  assert.ok(miss.position[1] < 15);
});

test("platform sides and undersides block the player's solid body", () => {
  const initial = createParkourState(course);
  const platform = course.platforms[0];
  const left = platform.position[0] - platform.size[0] / 2 - C.playerRadius;
  const side: ParkourState = { ...initial, grounded: false, position: [left - 2, 7, 0], velocity: [600, 0, 0] };
  const blocked = stepParkour(side, { ...idle, strafe: 1 }, course);
  assert.ok(blocked.position[0] <= left + 1e-8);
  assert.equal(blocked.velocity[0], 0);
  const bottom = platform.position[1] - platform.size[1];
  const underside = stepParkour({ ...initial, grounded: false, position: [0, bottom - 1, 0], velocity: [0, 240, 0] }, idle, course);
  assert.ok(underside.position[1] <= bottom + 1e-8);
  assert.equal(underside.velocity[1], 0);
});

test("coyote and buffered jumps work only within their short windows", () => {
  const initial = createParkourState(course);
  const beyondEdge: ParkourState = { ...initial, grounded: false, position: [0, initial.position[1], 7.5], coyoteRemaining: C.coyoteSeconds };
  assert.equal(stepParkour(beyondEdge, { ...idle, jump: true }, course).jumps, 1);
  assert.equal(stepParkour({ ...beyondEdge, coyoteRemaining: 0 }, { ...idle, jump: true }, course).jumps, 0);
  const falling: ParkourState = { ...initial, grounded: false, position: [0, initial.position[1] + 0.05, 0], velocity: [0, -4, 0], coyoteRemaining: 0 };
  const buffered = stepParkour(falling, { ...idle, jump: true }, course);
  assert.equal(buffered.grounded, true);
  assert.equal(buffered.jumps, 0);
  const bounced = stepParkour(buffered, idle, course);
  assert.equal(bounced.jumps, 1);
  assert.equal(bounced.grounded, false);
  const stale = stepParkour({ ...falling, jumpBuffer: C.step / 2, jumpHeld: true }, idle, course);
  assert.equal(stepParkour(stale, idle, course).jumps, 0);
});

test("checkpoints require grounded 3D proximity in order and fall respawns at the last one", () => {
  const initial = createParkourState(course);
  const cp1 = course.entities.find((e) => e.id === "cp1")!;
  const cp2 = course.entities.find((e) => e.id === "cp2")!;
  const flying: ParkourState = { ...initial, position: [cp1.position[0], cp1.position[1] + 1, cp1.position[2]], grounded: false, coyoteRemaining: 0 };
  assert.equal(stepParkour(flying, idle, course).activeGate, 0);
  assert.equal(stepParkour({ ...initial, position: cp2.position }, idle, course).activeGate, 0);
  const passed = stepParkour({ ...initial, position: cp1.position }, idle, course);
  assert.equal(passed.activeGate, 1);
  assert.equal(passed.event, "gate");
  const respawned = stepParkour({ ...passed, grounded: false, position: [100, -100, 100] }, idle, course);
  assert.deepEqual(respawned.position, cp1.position);
  assert.equal(respawned.platformIndex, 3);
  assert.equal(respawned.activeGate, 1);
  assert.equal(respawned.respawns, 1);
  assert.equal(respawned.event, "respawn");
  assert.deepEqual(respawned.velocity, [0, 0, 0]);
  assert.equal(stepParkour(respawned, idle, course).event, null);
});

test("timer expires with no input and terminal states cannot move", () => {
  const track = { ...course, rules: { ...course.rules, durationSeconds: 0.05 } };
  const final = simulateParkourCourse(track, () => idle);
  assert.equal(final.status, "failed");
  assert.equal(final.jumps, 0);
  assert.equal(stepParkour(final, { ...idle, forward: 1, jump: true }, track), final);
});
