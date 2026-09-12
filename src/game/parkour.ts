import {
  GLIDE_CALIBRATION,
  routeOf,
  startOf,
  type GlideSpec,
  type GlideState,
  type RouteCourse,
  type Vec3,
} from "./glide.ts";

export type ParkourPlatform = { id: string; position: Vec3; size: Vec3; label: string };
export type ParkourSpec = Omit<GlideSpec, "kind"> & { kind: "parkour" };
export type ParkourCourse = RouteCourse & { mechanic: ParkourSpec; platforms: readonly ParkourPlatform[] };
export type ParkourInput = { forward: number; strafe: number; turn: number; pitch: number; jump: boolean; sprint: boolean };
export type ParkourState = GlideState & {
  velocity: Vec3;
  grounded: boolean;
  jumps: number;
  jumpHeld: boolean;
  coyoteRemaining: number;
  jumpBuffer: number;
  landingImpact: number;
  platformIndex: number;
};

export const PARKOUR_CALIBRATION = {
  step: GLIDE_CALIBRATION.step,
  eyeHeight: 1.7,
  playerRadius: 0.35,
  gravity: 24,
  jumpVelocity: 10.5,
  runSpeed: 9,
  sprintSpeed: 13.5,
  groundResponse: 14,
  airResponse: 3.5,
  groundFriction: 12,
  airFriction: 0.8,
  yawRate: GLIDE_CALIBRATION.yawRate,
  pitchRate: GLIDE_CALIBRATION.pitchRate,
  maxPitch: 1.1,
  coyoteSeconds: 0.09,
  jumpBufferSeconds: 0.12,
  fallDepth: 24,
  pathSampleInterval: GLIDE_CALIBRATION.pathSampleInterval,
} as const;

export const PARKOUR_ENVELOPE = {
  minPlatforms: 8,
  maxPlatforms: 16,
  minWidth: 12,
  maxWidth: 24,
  minDepth: 12,
  maxDepth: 24,
  minAdvance: 14,
  maxAdvance: 22,
  minGap: 2,
  maxGap: 6,
  maxLateralShift: 6,
  maxRise: 1.5,
  minRouteLength: 120,
  maxRouteLength: 320,
} as const;

export const IDLE_PARKOUR_INPUT: ParkourInput = { forward: 0, strafe: 0, turn: 0, pitch: 0, jump: false, sprint: false };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const axisInput = (value: number) => Number.isFinite(value) ? clamp(value, -1, 1) : 0;
const jumpSpeed = (course: ParkourCourse) => PARKOUR_CALIBRATION.jumpVelocity * Math.sqrt(course.mechanic.lift);
const sprintSpeed = (course: ParkourCourse) => PARKOUR_CALIBRATION.runSpeed + (PARKOUR_CALIBRATION.sprintSpeed - PARKOUR_CALIBRATION.runSpeed) * course.mechanic.boost;

function supportAt(position: Vec3, course: ParkourCourse): number {
  const C = PARKOUR_CALIBRATION;
  return course.platforms.findIndex((platform) =>
    Math.abs(position[1] - platform.position[1] - C.eyeHeight) < 1e-6 &&
    Math.abs(position[0] - platform.position[0]) <= platform.size[0] / 2 + C.playerRadius &&
    Math.abs(position[2] - platform.position[2]) <= platform.size[2] / 2 + C.playerRadius,
  );
}

export function createParkourState(course: ParkourCourse): ParkourState {
  const position = startOf(course).position;
  const platformIndex = supportAt(position, course);
  return {
    position, yaw: 0, pitch: 0, speed: 0, elapsed: 0, activeGate: 0, completed: [],
    respawn: position, respawns: 0, path: [position], status: "running", event: null,
    velocity: [0, 0, 0], grounded: platformIndex >= 0, jumps: 0, jumpHeld: false,
    coyoteRemaining: platformIndex >= 0 ? PARKOUR_CALIBRATION.coyoteSeconds : 0,
    jumpBuffer: 0, landingImpact: 0, platformIndex,
  };
}

function moveAndCollide(position: Vec3, velocity: Vec3, course: ParkourCourse) {
  const C = PARKOUR_CALIBRATION;
  const point: [number, number, number] = [...position];
  const speed: [number, number, number] = [...velocity];
  const displacement = velocity.map((value) => value * C.step);
  let impact = 0;
  for (let iteration = 0; iteration < 4; iteration++) {
    let firstTime = Infinity;
    let hitAxis = -1;
    let hitNormal = 0;
    for (const platform of course.platforms) {
      const low = [platform.position[0] - platform.size[0] / 2 - C.playerRadius, platform.position[1] - platform.size[1], platform.position[2] - platform.size[2] / 2 - C.playerRadius];
      const high = [platform.position[0] + platform.size[0] / 2 + C.playerRadius, platform.position[1] + C.eyeHeight, platform.position[2] + platform.size[2] / 2 + C.playerRadius];
      let entry = -Infinity;
      let exit = Infinity;
      let normalAxis = -1;
      let normal = 0;
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(displacement[axis]) < 1e-12) {
          if (point[axis] < low[axis] || point[axis] > high[axis]) { exit = -Infinity; break; }
        } else {
          const near = (low[axis] - point[axis]) / displacement[axis];
          const far = (high[axis] - point[axis]) / displacement[axis];
          if (Math.min(near, far) > entry) {
            entry = Math.min(near, far);
            normalAxis = axis;
            normal = displacement[axis] > 0 ? -1 : 1;
          }
          exit = Math.min(exit, Math.max(near, far));
        }
      }
      if (normalAxis >= 0 && entry >= -1e-9 && entry <= 1 && exit >= Math.max(0, entry) && entry < firstTime) {
        firstTime = Math.max(0, entry);
        hitAxis = normalAxis;
        hitNormal = normal;
      }
    }
    if (hitAxis < 0) {
      for (let axis = 0; axis < 3; axis++) point[axis] += displacement[axis];
      break;
    }
    for (let axis = 0; axis < 3; axis++) {
      point[axis] += displacement[axis] * firstTime;
      displacement[axis] *= 1 - firstTime;
    }
    if (hitAxis === 1 && hitNormal > 0) impact = Math.max(impact, -speed[1]);
    speed[hitAxis] = 0;
    displacement[hitAxis] = 0;
  }
  return { position: point, velocity: speed, impact };
}

export function stepParkour(state: ParkourState, input: ParkourInput, course: ParkourCourse): ParkourState {
  if (state.status !== "running") return state;
  const C = PARKOUR_CALIBRATION;
  const dt = C.step;
  const wasGrounded = state.grounded && supportAt(state.position, course) >= 0;
  let coyoteRemaining = wasGrounded ? C.coyoteSeconds : Math.max(0, state.coyoteRemaining - dt);
  let jumpBuffer = input.jump && !state.jumpHeld ? C.jumpBufferSeconds : Math.max(0, state.jumpBuffer - dt);
  let jumps = state.jumps;
  let vertical = state.velocity[1];
  if (jumpBuffer > 0 && coyoteRemaining > 0) {
    vertical = jumpSpeed(course);
    coyoteRemaining = 0;
    jumpBuffer = 0;
    jumps++;
  }
  let yaw = state.yaw + axisInput(input.turn) * C.yawRate * course.mechanic.turnRate * dt;
  let pitch = clamp(state.pitch + axisInput(input.pitch) * C.pitchRate * course.mechanic.turnRate * dt, -C.maxPitch, C.maxPitch);
  const forward = axisInput(input.forward);
  const strafe = axisInput(input.strafe);
  const magnitude = Math.max(1, Math.hypot(forward, strafe));
  const targetSpeed = input.sprint ? sprintSpeed(course) : C.runSpeed;
  const targetX = (Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / magnitude * targetSpeed;
  const targetZ = (Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / magnitude * targetSpeed;
  const moving = Math.abs(forward) + Math.abs(strafe) > 0;
  const response = (moving ? (wasGrounded ? C.groundResponse : C.airResponse) : (wasGrounded ? C.groundFriction : C.airFriction)) * course.mechanic.drag;
  const blend = 1 - Math.exp(-response * dt);
  const movement = moveAndCollide(state.position, [
    state.velocity[0] + (targetX - state.velocity[0]) * blend,
    vertical - C.gravity * dt,
    state.velocity[2] + (targetZ - state.velocity[2]) * blend,
  ], course);
  let position: Vec3 = movement.position;
  let velocity: Vec3 = movement.velocity;
  const support = supportAt(position, course);
  let grounded = support >= 0 && velocity[1] <= 0;
  let platformIndex = grounded ? support : state.platformIndex;
  let landingImpact = !wasGrounded && movement.impact > 0 ? movement.impact : state.landingImpact * Math.exp(-10 * dt);
  if (grounded) coyoteRemaining = C.coyoteSeconds;
  const elapsed = state.elapsed + dt;
  const route = routeOf(course);
  const gate = route[state.activeGate];
  let activeGate = state.activeGate;
  let completed = state.completed;
  let respawn = state.respawn;
  let respawns = state.respawns;
  let status: ParkourState["status"] = "running";
  let event: ParkourState["event"] = null;
  if (grounded && gate && Math.hypot(position[0] - gate.position[0], position[1] - gate.position[1], position[2] - gate.position[2]) <= gate.radius) {
    activeGate++;
    completed = [...completed, gate.id];
    respawn = gate.position;
    event = "gate";
    if (activeGate === route.length) status = "won";
  }
  const fallLimit = Math.min(...course.platforms.map((platform) => platform.position[1])) - C.fallDepth;
  if (position[1] - C.eyeHeight < fallLimit) {
    position = respawn;
    velocity = [0, 0, 0];
    platformIndex = supportAt(position, course);
    grounded = platformIndex >= 0;
    coyoteRemaining = grounded ? C.coyoteSeconds : 0;
    jumpBuffer = 0;
    landingImpact = 0;
    yaw = 0;
    pitch = 0;
    respawns++;
    event = "respawn";
  }
  if (status === "running" && elapsed >= course.rules.durationSeconds) status = "failed";
  const sampleDue = Math.floor(elapsed / C.pathSampleInterval) > Math.floor(state.elapsed / C.pathSampleInterval);
  const path = sampleDue || status !== "running" || event ? [...state.path, position] : state.path;
  return {
    position, velocity, yaw, pitch, speed: Math.hypot(velocity[0], velocity[2]), elapsed,
    activeGate, completed, respawn, respawns, path, status, event, grounded, jumps,
    jumpHeld: input.jump, coyoteRemaining, jumpBuffer, landingImpact, platformIndex,
  };
}

export function parkourPilotInput(state: ParkourState, course: ParkourCourse): ParkourInput {
  if (state.status !== "running") return IDLE_PARKOUR_INPUT;
  const C = PARKOUR_CALIBRATION;
  const current = course.platforms[Math.max(0, state.platformIndex)];
  const next = course.platforms[Math.max(0, state.platformIndex) + 1];
  const gate = routeOf(course)[state.activeGate];
  const pendingLanding = state.grounded && supportAt(gate.position, course) === state.platformIndex;
  const target = pendingLanding || !next ? gate.position : next.position;
  const maxSpeed = sprintSpeed(course);
  let vx: number;
  let vz: number;
  let jump = false;
  if (pendingLanding || !next) {
    vx = (target[0] - state.position[0]) * 2.5;
    vz = (target[2] - state.position[2]) * 2.5;
  } else if (state.grounded) {
    const takeoffZ = current.position[2] + current.size[2] / 2 - 0.8;
    const launch = jumpSpeed(course);
    const rise = next.position[1] - current.position[1];
    const flight = (launch + Math.sqrt(Math.max(0, launch * launch - 2 * C.gravity * rise))) / C.gravity;
    vz = Math.min(maxSpeed, (next.position[2] - takeoffZ) / Math.max(flight, C.step));
    vx = (next.position[0] - state.position[0]) * 2.5;
    jump = state.position[2] >= takeoffZ && state.velocity[2] > Math.min(4, maxSpeed / 2);
  } else {
    const height = state.position[1] - C.eyeHeight - target[1];
    const remaining = Math.max(0.12, (state.velocity[1] + Math.sqrt(Math.max(0, state.velocity[1] ** 2 + 2 * C.gravity * height))) / C.gravity);
    vx = (target[0] - state.position[0]) / remaining;
    vz = (target[2] - state.position[2]) / remaining;
  }
  const scale = Math.max(1, Math.hypot(vx, vz) / maxSpeed);
  vx /= scale;
  vz /= scale;
  const desiredYaw = clamp(Math.atan2(vx, Math.max(0.1, vz)), -0.6, 0.6);
  const yawError = Math.atan2(Math.sin(desiredYaw - state.yaw), Math.cos(desiredYaw - state.yaw));
  return {
    forward: (vx * Math.sin(state.yaw) + vz * Math.cos(state.yaw)) / maxSpeed,
    strafe: (vx * Math.cos(state.yaw) - vz * Math.sin(state.yaw)) / maxSpeed,
    turn: clamp(yawError / 0.2, -1, 1), pitch: clamp(-state.pitch / 0.2, -1, 1),
    jump, sprint: true,
  };
}

export function simulateParkourCourse(course: ParkourCourse, pilot = parkourPilotInput): ParkourState {
  let state = createParkourState(course);
  const maxSteps = Math.ceil(course.rules.durationSeconds / PARKOUR_CALIBRATION.step) + 1;
  for (let i = 0; i < maxSteps && state.status === "running"; i++) state = stepParkour(state, pilot(state, course), course);
  return state;
}

const platforms: ParkourPlatform[] = Array.from({ length: 12 }, (_, i) => ({
  id: `landing-${i + 1}`,
  position: [Math.sin(i * 0.5) * 6, 8 + i * 0.5, i * 18],
  size: [16, 12, 14],
  label: `Landing ${i + 1}`,
}));

export const DEFAULT_PARKOUR_COURSE: ParkourCourse = {
  mechanic: { kind: "parkour", lift: 1, drag: 1, turnRate: 1, boost: 1 },
  platforms,
  entities: [0, 3, 6, 9, 11].map((index, routeIndex) => ({
    id: routeIndex === 0 ? "start" : routeIndex === 4 ? "goal" : `cp${routeIndex}`,
    kind: routeIndex === 0 ? "start" : routeIndex === 4 ? "goal" : "checkpoint",
    position: [platforms[index].position[0], platforms[index].position[1] + PARKOUR_CALIBRATION.eyeHeight, platforms[index].position[2]],
    radius: routeIndex === 0 ? 3 : 2.5,
    label: platforms[index].label,
  })),
  rules: { durationSeconds: 75, requiredCheckpointIds: ["cp1", "cp2", "cp3"], goalEntityId: "goal", respawnBehindDistance: 20 },
};
