import test from "node:test";
import assert from "node:assert/strict";
import { drawAbilities } from "../src/game/ability-overlay.ts";
import { buildHoopMesh, type HoopPalette } from "../src/game/hoops.ts";
import {
  ABILITY_CALIBRATION as A,
  IDLE_ABILITIES,
  ENEMY_STATS,
  createAbilityState,
  releaseAbilities,
  stepAbilities,
  type AbilityInput,
  type AbilityTarget,
  type EnemyKind,
} from "../src/game/abilities.ts";
import {
  FIXTURE_COURSE,
  GLIDE_CALIBRATION,
  createGlideState,
  routeOf,
  stepGlide,
  type GlideState,
  type Vec3,
} from "../src/game/glide.ts";

const course = FIXTURE_COURSE;
const press = (input: Partial<AbilityInput>): AbilityInput => ({ ...IDLE_ABILITIES, ...input });
const ticks = (seconds: number) => Math.ceil(seconds / GLIDE_CALIBRATION.step);
const at = (target: AbilityTarget, position: Vec3): AbilityTarget => ({ ...target, origin: position, position, phase: 0 });
const aim = (player: GlideState, target: Vec3): GlideState => {
  const dx = target[0] - player.position[0], dy = target[1] - player.position[1], dz = target[2] - player.position[2];
  return { ...player, yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};
const nearGate = (): GlideState => {
  const gate = routeOf(course)[0];
  return { ...createGlideState(course), position: [gate.position[0] - 5, gate.position[1], gate.position[2] - 100] };
};

test("targets follow the supplied course route and start rather than fixture coordinates or entity order", () => {
  const offset: Vec3 = [47, 18, 63];
  const translated = {
    ...course,
    entities: course.entities.map((entity) => ({
      ...entity,
      position: entity.position.map((value, i) => value + offset[i]) as unknown as Vec3,
    })).reverse(),
  };
  const original = createAbilityState(course);
  const snapshot = structuredClone(translated);
  const abilities = createAbilityState(translated);
  assert.deepEqual(abilities.targets, original.targets.map((target) => ({
    ...target, position: target.position.map((value, i) => value + offset[i]),
    origin: target.origin.map((value, i) => value + offset[i]),
  })));
  assert.deepEqual(translated, snapshot);
});

test("same fixed-step ability input sequence gives the same result without mutating player or prior ability state", () => {
  const run = () => {
    let player = createGlideState(course);
    let abilities = createAbilityState(course);
    for (let i = 0; i < 1800; i++) {
      const originalPlayer = structuredClone(player);
      const originalAbilities = structuredClone(abilities);
      const next = stepAbilities(abilities, { dash: i % 180 < 30, grapple: i % 240 < 120, fire: i % 20 < 18 }, player, course);
      assert.deepEqual(player, originalPlayer);
      assert.deepEqual(abilities, originalAbilities);
      abilities = next.abilities;
      player = stepGlide(player, next.input, course, next.speedMultiplier);
    }
    return { player, abilities };
  };
  assert.deepEqual(run(), run());
});

test("dash lasts 0.35 seconds, requires a rising edge and respects its cooldown", () => {
  const player = nearGate();
  let next = stepAbilities(createAbilityState(course), press({ dash: true }), player, course);
  assert.equal(next.speedMultiplier, A.dashSpeedMultiplier);
  assert.equal(next.abilities.dashCooldown, A.dashCooldown);
  for (let i = 1; i < ticks(A.dashDuration); i++) {
    next = stepAbilities(next.abilities, press({ dash: true }), player, course);
    assert.equal(next.speedMultiplier, A.dashSpeedMultiplier);
  }
  next = stepAbilities(next.abilities, IDLE_ABILITIES, player, course);
  assert.equal(next.speedMultiplier, 1);
  next = stepAbilities(next.abilities, press({ dash: true }), player, course);
  assert.equal(next.abilities.dashRemaining, 0);
  for (let i = 0; i < ticks(A.dashCooldown) + 3; i++) {
    next = stepAbilities(next.abilities, press({ dash: true }), player, course);
  }
  assert.equal(next.abilities.dashCooldown, 0);
  assert.equal(next.abilities.dashRemaining, 0);
  next = stepAbilities(next.abilities, IDLE_ABILITIES, player, course);
  next = stepAbilities(next.abilities, press({ dash: true }), player, course);
  assert.equal(next.speedMultiplier, A.dashSpeedMultiplier);
});

test("grapple attaches only to the upper rim, steers through the center and releases on keyup", () => {
  const player = nearGate();
  const gate = routeOf(course)[0];
  const next = stepAbilities(createAbilityState(course), press({ grapple: true }), player, course);
  assert.deepEqual(next.abilities.grappleAnchor, [gate.position[0], gate.position[1] + gate.radius + gate.radius * 0.12, gate.position[2] - gate.radius * 0.12]);
  assert.equal(next.abilities.grappleStatus, "attached");
  assert.equal(next.abilities.grappleReachable, true);
  assert.equal(next.abilities.grappleAimed, true);
  assert.ok(next.input.turn > 0 && next.input.turn <= A.grappleAssist);
  assert.equal(next.input.pitch, 0);
  assert.equal(next.input.boost, false);
  assert.equal(next.speedMultiplier, A.grappleSpeedMultiplier);
  const released = stepAbilities(next.abilities, IDLE_ABILITIES, player, course);
  assert.equal(released.abilities.grappleAnchor, null);
  assert.equal(released.speedMultiplier, 1);
});

test("grapple anchor sits on the visible upper torus surface for different course radii", () => {
  for (const radius of [8, 22, 40]) {
    const custom = { ...course, entities: course.entities.map((entity) => ({ ...entity, radius })) };
    const gate = routeOf(custom)[0];
    const player: GlideState = { ...createGlideState(custom), position: [gate.position[0], gate.position[1], gate.position[2] - 100] };
    const { grappleAnchor: anchor } = stepAbilities(createAbilityState(custom), press({ grapple: true }), player, custom).abilities;
    assert.ok(anchor);
    assert.ok(anchor[1] > gate.position[1] + radius);
    assert.ok(anchor[2] < gate.position[2]);
    assert.ok(buildHoopMesh(gate.position, radius).some((face) => face.vertices.some((vertex) =>
      Math.hypot(...vertex.map((value, i) => value - anchor[i])) < 1e-8,
    )));
  }
});

test("grapple advertises range/aim failures and never makes empty-air anchors", () => {
  const player = nearGate();
  const far = { ...player, position: [0, 12, -1000] as Vec3 };
  const out = stepAbilities(createAbilityState(course), press({ grapple: true }), far, course);
  assert.equal(out.abilities.grappleAnchor, null);
  assert.equal(out.abilities.grappleReachable, false);
  assert.equal(out.abilities.grappleStatus, "out-of-range");
  const backwards = stepAbilities(createAbilityState(course), press({ grapple: true }), { ...player, yaw: Math.PI }, course);
  assert.equal(backwards.abilities.grappleAnchor, null);
  assert.equal(backwards.abilities.grappleAimed, false);
  assert.equal(backwards.abilities.grappleStatus, "aim-at-hoop");
  const missing = stepAbilities(createAbilityState(course), press({ grapple: true }), { ...player, activeGate: 99 }, course);
  assert.equal(missing.abilities.grappleAnchor, null);
  assert.equal(missing.abilities.grappleStatus, "no-gate");
});

test("gate change, respawn, stale anchor and range break detach until E is released", () => {
  const player = nearGate();
  const attached = stepAbilities(createAbilityState(course), press({ grapple: true }), player, course).abilities;
  for (const changed of [
    { ...player, activeGate: 1 },
    { ...player, respawns: 1, event: "respawn" as const },
    { ...player, position: [0, 12, -1000] as Vec3 },
  ]) {
    const detached = stepAbilities(attached, press({ grapple: true }), changed, course);
    assert.equal(detached.abilities.grappleAnchor, null);
    assert.equal(detached.abilities.grappleNeedsRelease, true);
    const held = stepAbilities(detached.abilities, press({ grapple: true }), changed, course);
    assert.equal(held.abilities.grappleAnchor, null);
  }
  const invalid = stepAbilities({ ...attached, grappleAnchor: [999, 999, 999] }, press({ grapple: true }), player, course);
  assert.equal(invalid.abilities.grappleAnchor, null);
  const released = stepAbilities(invalid.abilities, IDLE_ABILITIES, player, course);
  assert.ok(stepAbilities(released.abilities, press({ grapple: true }), player, course).abilities.grappleAnchor);
});

test("releaseAbilities instantly clears effects and held input without ticking cooldowns or erasing score", () => {
  const player = nearGate();
  const base = createAbilityState(course);
  const target = at({ ...base.targets[0], hp: 1 }, [player.position[0], player.position[1], player.position[2] + 50]);
  const active = stepAbilities({ ...base, targets: [target] }, press({ dash: true, grapple: true, fire: true }), player, course).abilities;
  assert.equal(active.score, A.targetScore);
  assert.ok(active.dashRemaining > 0 && active.grappleAnchor && active.shotTrace);
  const snapshot = structuredClone(active);
  const released = releaseAbilities(active);
  assert.deepEqual(released, {
    ...active, dashRemaining: 0, grappleAnchor: null, grappleDistance: null,
    grappleReachable: false, grappleAimed: false, grappleNeedsRelease: false,
    grappleStatus: "inactive", shotTrace: null, held: { ...IDLE_ABILITIES },
  });
  assert.deepEqual(releaseAbilities(released), released);
  assert.equal(released.targets, active.targets);
  assert.deepEqual(active, snapshot);
  const next = stepAbilities(released, press({ dash: true, fire: true }), player, course);
  assert.equal(next.abilities.shots, active.shots);
  assert.equal(next.abilities.dashRemaining, 0);
  assert.equal(next.speedMultiplier, 1);
});

test("terminal states clear active abilities and cannot fire or accelerate", () => {
  const player = nearGate();
  const active = stepAbilities(createAbilityState(course), { dash: true, grapple: true, fire: true }, player, course).abilities;
  for (const status of ["won", "failed"] as const) {
    const next = stepAbilities(active, { dash: true, grapple: true, fire: true }, { ...player, status }, course);
    assert.equal(next.abilities.grappleAnchor, null);
    assert.equal(next.abilities.dashRemaining, 0);
    assert.equal(next.abilities.shotTrace, null);
    assert.equal(next.abilities.shots, active.shots);
    assert.deepEqual(next.abilities, releaseAbilities(active));
    assert.deepEqual(next.input, { turn: 0, pitch: 0, boost: false });
    assert.equal(next.speedMultiplier, 1);
  }
});

test("dash rearms on the exact cooldown boundary and fire key taps cannot bypass cooldown", () => {
  const player = nearGate();
  let abilities = stepAbilities(createAbilityState(course), press({ dash: true, fire: true }), player, course).abilities;
  for (let frame = 1; frame < ticks(A.dashCooldown); frame++) {
    abilities = stepAbilities(abilities, press({ fire: frame % 2 === 0 }), player, course).abilities;
    assert.ok(abilities.dashCooldown > 0);
    assert.equal(abilities.dashRemaining > 0, frame < ticks(A.dashDuration));
    assert.equal(abilities.shots, 1 + Math.floor(frame / 16));
  }
  const next = stepAbilities(abilities, press({ dash: true }), player, course);
  assert.equal(next.abilities.dashCooldown, A.dashCooldown);
  assert.equal(next.abilities.dashRemaining, A.dashDuration);
  assert.equal(next.speedMultiplier, A.dashSpeedMultiplier);
});

test("respawn clears active effects without bypassing cooldowns or reactivating held dash", () => {
  const player = nearGate();
  const held = press({ dash: true, grapple: true, fire: true });
  const active = stepAbilities(createAbilityState(course), held, player, course).abilities;
  const respawned: GlideState = { ...player, respawns: 1, event: "respawn" };
  let next = stepAbilities(active, held, respawned, course);
  assert.equal(next.abilities.dashRemaining, 0);
  assert.equal(next.abilities.grappleAnchor, null);
  assert.equal(next.abilities.shotTrace, null);
  assert.equal(next.abilities.shots, active.shots);
  assert.equal(next.abilities.dashCooldown, A.dashCooldown - GLIDE_CALIBRATION.step);
  assert.equal(next.abilities.fireCooldown, A.fireCooldown - GLIDE_CALIBRATION.step);
  for (let frame = 0; frame < ticks(A.dashCooldown); frame++) {
    next = stepAbilities(next.abilities, held, { ...respawned, event: null }, course);
    assert.equal(next.abilities.dashRemaining, 0);
    assert.equal(next.abilities.grappleAnchor, null);
  }
  assert.equal(next.abilities.dashCooldown, 0);
  assert.ok(next.abilities.shots > active.shots);
  const released = stepAbilities(next.abilities, IDLE_ABILITIES, { ...respawned, event: null }, course);
  const rearmed = stepAbilities(released.abilities, held, { ...respawned, event: null }, course);
  assert.equal(rearmed.speedMultiplier, A.dashSpeedMultiplier);
  assert.equal(rearmed.abilities.grappleStatus, "attached");
});

test("holding F fires at 4 Hz, two aimed pulses destroy a target and award score only once", () => {
  let abilities = createAbilityState(course);
  const target = abilities.targets[0];
  const player = aim({ ...createGlideState(course), position: [target.position[0], target.position[1], target.position[2] - 60] }, target.position);
  abilities = stepAbilities(abilities, press({ fire: true }), player, course).abilities;
  assert.equal(abilities.shots, 1);
  assert.equal(abilities.hits, 1);
  assert.equal(abilities.targets[0].hp, 1);
  assert.equal(abilities.score, 0);
  assert.equal(abilities.shotTrace?.hitTargetId, target.id);
  for (let i = 1; i < ticks(A.fireCooldown); i++) {
    abilities = stepAbilities(abilities, press({ fire: true }), player, course).abilities;
    assert.equal(abilities.shots, 1);
  }
  abilities = stepAbilities(abilities, press({ fire: true }), player, course).abilities;
  assert.equal(abilities.shots, 2);
  assert.equal(abilities.hits, 2);
  assert.equal(abilities.targets[0].hp, 0);
  assert.equal(abilities.score, A.targetScore);
  assert.equal(abilities.shotTrace?.destroyed, true);
  const isolated = { ...abilities, targets: [abilities.targets[0]] };
  abilities = isolated;
  for (let i = 0; i < ticks(A.fireCooldown) * 4; i++) {
    abilities = stepAbilities(abilities, press({ fire: true }), player, course).abilities;
  }
  assert.equal(abilities.score, A.targetScore);
  assert.equal(abilities.hits, 2);
  for (let i = 0; i <= ticks(A.traceDuration); i++) abilities = stepAbilities(abilities, IDLE_ABILITIES, player, course).abilities;
  assert.equal(abilities.shotTrace, null);
});

test("pulses miss off-axis, behind and out-of-range targets and hit only the nearest target", () => {
  const player = createGlideState(course);
  const [x, y, z] = player.position;
  const base = createAbilityState(course);
  for (const position of [[x + 20, y, z + 60], [x, y, z - 10], [x, y, z + A.fireRange + 1]] as Vec3[]) {
    const next = stepAbilities({ ...base, targets: [{ ...base.targets[0], position }] }, press({ fire: true }), player, course);
    assert.equal(next.abilities.hits, 0);
    assert.equal(next.abilities.targets[0].hp, A.targetHp);
  }
  const targets = [
    { ...base.targets[0], position: [x, y, z + 80] as Vec3 },
    { ...base.targets[1], position: [x, y, z + 40] as Vec3 },
  ];
  const next = stepAbilities({ ...base, targets }, press({ fire: true }), player, course);
  assert.equal(next.abilities.targets[0].hp, A.targetHp);
  assert.equal(next.abilities.targets[1].hp, A.targetHp - 1);
  assert.equal(next.abilities.shotTrace?.hitTargetId, targets[1].id);
});

test("ability storage, counters, cooldowns and assists remain bounded under prolonged held input", () => {
  let abilities = createAbilityState(course);
  const player = nearGate();
  assert.equal(abilities.targets.length, 3);
  const maxShots = Math.ceil(course.rules.durationSeconds / A.fireCooldown);
  for (let i = 0; i < 10000; i++) {
    const next = stepAbilities(abilities, { dash: i % 200 < 150, grapple: true, fire: true }, player, course);
    abilities = next.abilities;
    assert.equal(abilities.targets.length, 3);
    assert.ok(abilities.shots <= maxShots);
    assert.ok(abilities.hits <= A.targetHp * 3);
    assert.ok(abilities.score <= A.targetScore * 3);
    assert.ok(abilities.targets.every((t) => t.hp >= 0 && t.hp <= A.targetHp));
    assert.ok(abilities.dashRemaining >= 0 && abilities.dashRemaining <= A.dashDuration);
    assert.ok(abilities.dashCooldown >= 0 && abilities.dashCooldown <= A.dashCooldown);
    assert.ok(abilities.fireCooldown >= 0 && abilities.fireCooldown <= A.fireCooldown);
    assert.ok(!abilities.shotTrace || (abilities.shotTrace.remaining > 0 && abilities.shotTrace.remaining <= A.traceDuration));
    assert.ok(Math.abs(next.input.turn) <= A.grappleAssist && Math.abs(next.input.pitch) <= A.grappleAssist);
    assert.ok(next.speedMultiplier >= 1 && next.speedMultiplier <= A.dashSpeedMultiplier);
  }
  assert.ok(JSON.stringify(abilities).length < 3000);
});

test("optional idle abilities preserve Glide and dash still crosses the active gate through stepGlide", () => {
  const start = createGlideState(course);
  const idle = stepAbilities(createAbilityState(course), IDLE_ABILITIES, start, course);
  assert.deepEqual(stepGlide(start, idle.input, course, idle.speedMultiplier), stepGlide(start, { turn: 0, pitch: 0, boost: false }, course));
  const gate = routeOf(course)[0];
  const player: GlideState = { ...start, position: [gate.position[0], gate.position[1], gate.position[2] - 0.1] };
  const dash = stepAbilities(createAbilityState(course), press({ dash: true }), player, course);
  const next = stepGlide(player, dash.input, course, dash.speedMultiplier);
  assert.ok(next.speed > stepGlide(player, dash.input, course).speed);
  assert.equal(next.elapsed, GLIDE_CALIBRATION.step);
  assert.equal(next.activeGate, 1);
  assert.equal(next.event, "gate");
});

test("Canvas overlay removes destroyed silhouettes, draws feedback and never clears the shared canvas", () => {
  let faces = 0, lines = 0, rope = 0, saves = 0;
  const noop = () => {};
  const ctx = {
    canvas: { width: 1440, height: 900 },
    save: () => { saves++; }, restore: () => { saves--; },
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, translate: noop,
    fill: () => { faces++; }, stroke: () => { lines++; },
    fillRect: noop, strokeRect: noop, fillText: noop,
    quadraticCurveTo: () => { rope++; },
    clearRect: () => assert.fail("ability overlay cleared the route canvas"),
  } as unknown as CanvasRenderingContext2D;
  const player = nearGate();
  const base = createAbilityState(course);
  const target = { ...base.targets[0], position: [player.position[0], player.position[1], player.position[2] + 50] as Vec3 };
  const attached = stepAbilities({ ...base, targets: [target] }, press({ grapple: true, fire: true }), player, course).abilities;
  const snapshot = structuredClone(attached);
  drawAbilities(ctx, attached, player);
  assert.ok(faces > 0 && lines > 0 && rope > 0);
  assert.deepEqual(attached, snapshot);
  faces = 0;
  drawAbilities(ctx, { ...attached, targets: [{ ...target, hp: 0 }] }, player);
  assert.equal(faces, 0);
  rope = 0;
  drawAbilities(ctx, attached, { ...player, activeGate: player.activeGate + 1 });
  assert.equal(rope, 0);
  assert.equal(saves, 0);
});

test("Canvas target bodies and grapple rope use the supplied image palette with a neutral no-palette fallback", () => {
  const player = nearGate();
  const base = createAbilityState(course);
  const target = { ...base.targets[0], position: [player.position[0], player.position[1], player.position[2] + 50] as Vec3 };
  const attached = stepAbilities({ ...base, targets: [target] }, press({ grapple: true, fire: true }), player, course).abilities;
  const palettes: HoopPalette[] = [
    { shadow: [40, 16, 24], midtone: [160, 70, 90], highlight: [244, 216, 230] },
    { shadow: [12, 38, 28], midtone: [50, 148, 100], highlight: [212, 246, 218] },
  ];
  const noop = () => {};
  const faces: string[] = [], strokes: string[] = [];
  const ctx = {
    canvas: { width: 1440, height: 900 },
    save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, translate: noop,
    fill: () => { faces.push(String(ctx.fillStyle)); },
    stroke: () => { strokes.push(String(ctx.strokeStyle)); },
    fillRect: noop, strokeRect: noop, fillText: noop, quadraticCurveTo: noop,
  } as unknown as CanvasRenderingContext2D;
  for (const palette of palettes) {
    faces.length = 0;
    strokes.length = 0;
    const snapshot = structuredClone(palette);
    drawAbilities(ctx, attached, player, palette);
    const color = (rgb: readonly number[]) => `rgb(${rgb.join(", ")})`;
    assert.ok(faces.includes(color(palette.midtone)));
    assert.ok(faces.includes(color(palette.highlight)));
    assert.ok(faces.every((fill) => [palette.shadow, palette.midtone, palette.highlight].some((rgb) => color(rgb) === fill)));
    assert.deepEqual(strokes.slice(5, 7), [color(palette.shadow), color(palette.highlight)]);
    assert.deepEqual(palette, snapshot);
  }
  faces.length = 0;
  strokes.length = 0;
  drawAbilities(ctx, attached, player);
  for (const color of [...faces, ...strokes]) {
    const channels = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
    assert.ok(channels);
    assert.equal(channels[1], channels[2]);
    assert.equal(channels[2], channels[3]);
  }
});
