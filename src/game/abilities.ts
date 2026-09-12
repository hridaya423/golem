import {
  GLIDE_CALIBRATION,
  IDLE_INPUT,
  forwardOf,
  routeOf,
  segmentHitsSphere,
  startOf,
  type GlideCourse,
  type GlideInput,
  type GlideState,
  type Vec3,
} from "./glide.ts";

export type AbilityInput = { dash: boolean; grapple: boolean; fire: boolean };
export const IDLE_ABILITIES: AbilityInput = { dash: false, grapple: false, fire: false };

export const ABILITY_CALIBRATION = {
  dashDuration: 0.35,
  dashCooldown: 2.5,
  dashSpeedMultiplier: 2.2,
  grappleRange: 210,
  grappleBreakRange: 220,
  grappleAimRadians: Math.PI / 4,
  grappleTubeRatio: 0.12,
  grappleAssist: 0.7,
  grappleSpeedMultiplier: 1.25,
  fireCooldown: 0.25,
  fireRange: 220,
  targetHp: 2,
  targetRadius: 5,
  targetScore: 100,
  traceDuration: 0.18,
} as const;

export type AbilityTarget = { id: string; position: Vec3; radius: number; hp: number };
export type AbilityState = {
  dashCooldown: number;
  dashRemaining: number;
  fireCooldown: number;
  grappleAnchor: Vec3 | null;
  grappleDistance: number | null;
  grappleReachable: boolean;
  grappleAimed: boolean;
  grappleNeedsRelease: boolean;
  grappleStatus: "ready" | "attached" | "out-of-range" | "aim-at-hoop" | "release-to-rearm" | "no-gate" | "inactive";
  lastActiveGate: number;
  lastRespawns: number;
  held: AbilityInput;
  targets: readonly AbilityTarget[];
  shots: number;
  hits: number;
  score: number;
  shotTrace: { from: Vec3; to: Vec3; remaining: number; hitTargetId: string | null; destroyed: boolean } | null;
};

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const tick = (remaining: number) => remaining <= GLIDE_CALIBRATION.step + 1e-9 ? 0 : remaining - GLIDE_CALIBRATION.step;

export function createAbilityState(course: GlideCourse): AbilityState {
  const route = routeOf(course);
  const targets = route.slice(0, 3).map((gate, index): AbilityTarget => {
    const previous = index === 0 ? startOf(course) : route[index - 1];
    const dx = gate.position[0] - previous.position[0], dz = gate.position[2] - previous.position[2];
    const length = Math.hypot(dx, dz) || 1;
    const offset = Math.min(gate.radius * 0.35, 7) * (index % 2 ? -1 : 1);
    return {
      id: `sentinel-${index + 1}`,
      position: [
        (previous.position[0] + gate.position[0]) / 2 + dz / length * offset,
        (previous.position[1] + gate.position[1]) / 2,
        (previous.position[2] + gate.position[2]) / 2 - dx / length * offset,
      ],
      radius: ABILITY_CALIBRATION.targetRadius,
      hp: ABILITY_CALIBRATION.targetHp,
    };
  });
  return {
    dashCooldown: 0, dashRemaining: 0, fireCooldown: 0,
    grappleAnchor: null, grappleDistance: null, grappleReachable: false, grappleAimed: false,
    grappleNeedsRelease: false, grappleStatus: "inactive", lastActiveGate: 0, lastRespawns: 0,
    held: { ...IDLE_ABILITIES }, targets, shots: 0, hits: 0, score: 0, shotTrace: null,
  };
}

export function releaseAbilities(state: AbilityState): AbilityState {
  return {
    ...state, dashRemaining: 0, grappleAnchor: null, grappleDistance: null,
    grappleReachable: false, grappleAimed: false, grappleNeedsRelease: false,
    grappleStatus: "inactive", shotTrace: null, held: { ...IDLE_ABILITIES },
  };
}

export function stepAbilities(
  abilities: AbilityState,
  input: AbilityInput,
  player: GlideState,
  course: GlideCourse,
): { abilities: AbilityState; input: GlideInput; speedMultiplier: number } {
  if (player.status !== "running") {
    return {
      abilities: releaseAbilities(abilities),
      input: { ...IDLE_INPUT }, speedMultiplier: 1,
    };
  }

  const C = ABILITY_CALIBRATION;
  const respawned = player.respawns !== abilities.lastRespawns || player.event === "respawn";
  const gateChanged = player.activeGate !== abilities.lastActiveGate;
  const next: AbilityState = {
    ...abilities,
    dashCooldown: tick(abilities.dashCooldown),
    dashRemaining: respawned ? 0 : tick(abilities.dashRemaining),
    fireCooldown: tick(abilities.fireCooldown),
    held: { ...input }, lastActiveGate: player.activeGate, lastRespawns: player.respawns,
    shotTrace: abilities.shotTrace && tick(abilities.shotTrace.remaining) > 0 && !respawned
      ? { ...abilities.shotTrace, remaining: tick(abilities.shotTrace.remaining) } : null,
  };
  if (input.dash && !abilities.held.dash && next.dashCooldown === 0 && !respawned) {
    next.dashRemaining = C.dashDuration;
    next.dashCooldown = C.dashCooldown;
  }

  const gate = routeOf(course)[player.activeGate];
  const tube = gate ? gate.radius * C.grappleTubeRatio : 0;
  const anchor: Vec3 | null = gate ? [gate.position[0], gate.position[1] + gate.radius + tube, gate.position[2] - tube] : null;
  const forward = forwardOf(player.yaw, player.pitch);
  const delta = anchor ? anchor.map((value, i) => value - player.position[i]) : null;
  const distance = delta ? Math.hypot(...delta) : null;
  next.grappleDistance = distance;
  next.grappleReachable = distance !== null && distance <= C.grappleRange;
  next.grappleAimed = !!delta && distance !== null && distance > 0 &&
    delta.reduce((dot, value, i) => dot + value * forward[i], 0) / distance >= Math.cos(C.grappleAimRadians);
  const staleAnchor = abilities.grappleAnchor !== null &&
    (!anchor || anchor.some((value, i) => value !== abilities.grappleAnchor![i]) || distance === null || distance > C.grappleBreakRange);
  next.grappleNeedsRelease = input.grapple && (abilities.grappleNeedsRelease || respawned || gateChanged || staleAnchor);
  next.grappleAnchor = input.grapple && !next.grappleNeedsRelease && anchor &&
    (abilities.grappleAnchor || (next.grappleReachable && next.grappleAimed)) ? anchor : null;
  next.grappleStatus = !gate ? "no-gate" : next.grappleAnchor ? "attached" : next.grappleNeedsRelease ? "release-to-rearm" :
    !next.grappleReachable ? "out-of-range" : !next.grappleAimed ? "aim-at-hoop" : "ready";

  const steering = { ...IDLE_INPUT };
  if (next.grappleAnchor && gate) {
    const dx = gate.position[0] - player.position[0], dy = gate.position[1] - player.position[1], dz = gate.position[2] - player.position[2];
    const yawError = Math.atan2(dx, dz) - player.yaw;
    steering.turn = clamp(Math.atan2(Math.sin(yawError), Math.cos(yawError)) / 0.35, C.grappleAssist);
    steering.pitch = clamp((Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch) / 0.35, C.grappleAssist);
  }

  const maxShots = Math.ceil(course.rules.durationSeconds / C.fireCooldown);
  if (input.fire && next.fireCooldown === 0 && !respawned && next.shots < maxShots) {
    const end: Vec3 = [
      player.position[0] + forward[0] * C.fireRange,
      player.position[1] + forward[1] * C.fireRange,
      player.position[2] + forward[2] * C.fireRange,
    ];
    let hit: AbilityTarget | null = null;
    let hitDistance: number = C.fireRange;
    for (const target of next.targets) {
      if (target.hp <= 0) continue;
      const dx = target.position[0] - player.position[0], dy = target.position[1] - player.position[1], dz = target.position[2] - player.position[2];
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      const along = dx * forward[0] + dy * forward[1] + dz * forward[2];
      if (along <= 0 || distanceSquared > C.fireRange * C.fireRange || !segmentHitsSphere(player.position, end, target.position, target.radius)) continue;
      const entry = Math.max(0, along - Math.sqrt(Math.max(0, target.radius * target.radius - (distanceSquared - along * along))));
      if (entry < hitDistance) { hit = target; hitDistance = entry; }
    }
    next.shots += 1;
    next.fireCooldown = C.fireCooldown;
    next.shotTrace = {
      from: player.position,
      to: hit ? [player.position[0] + forward[0] * hitDistance, player.position[1] + forward[1] * hitDistance, player.position[2] + forward[2] * hitDistance] : end,
      remaining: C.traceDuration, hitTargetId: hit?.id ?? null, destroyed: hit?.hp === 1,
    };
    if (hit) {
      next.targets = next.targets.map((target) => target.id === hit.id ? { ...target, hp: target.hp - 1 } : target);
      next.hits += 1;
      if (hit.hp === 1) next.score += C.targetScore;
    }
  }

  return {
    abilities: next,
    input: steering,
    speedMultiplier: next.dashRemaining > 0 ? C.dashSpeedMultiplier : next.grappleAnchor ? C.grappleSpeedMultiplier : 1,
  };
}
