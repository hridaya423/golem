export type Vec3 = readonly [x: number, y: number, z: number];

export type ProxyEntity = {
  id: string;
  kind: "start" | "checkpoint" | "goal";
  position: Vec3;
  radius: number;
  label: string;
};

export type GlideSpec = {
  kind: "glide";
  lift: number;
  drag: number;
  turnRate: number;
  boost: number;
};

export type GameRules = {
  durationSeconds: number;
  requiredCheckpointIds: readonly [string, string, string];
  goalEntityId: string;
  respawnBehindDistance: number;
};

export type GlideCourse = {
  mechanic: GlideSpec;
  entities: readonly ProxyEntity[];
  rules: GameRules;
};

export type GlideInput = { turn: number; pitch: number; boost: boolean };

export type GlideStatus = "running" | "won" | "failed";

export type GlideState = {
  position: Vec3;
  yaw: number;
  pitch: number;
  speed: number;
  elapsed: number;
  /** Index into the ordered route [cp1, cp2, cp3, goal]. */
  activeGate: number;
  completed: readonly string[];
  respawn: Vec3;
  respawns: number;
  path: readonly Vec3[];
  status: GlideStatus;
  /** Set for exactly one step after a gate pass or respawn so the overlay can react. */
  event: "gate" | "respawn" | null;
};

// Every empirical knob lives here; tune against the live stream, never inline.
export const GLIDE_CALIBRATION = {
  step: 1 / 60,
  baseSpeed: 32,
  boostSpeed: 48,
  dragResponse: 2.5,
  // Measured live (Gate 1): LingBot at rotation_speed_deg 6 yaws ≈45°/s ≈ 0.78 rad/s.
  yawRate: 0.78,
  pitchRate: 0.8,
  maxPitch: 0.6,
  laneHalfWidth: 220,
  minAltitude: -20,
  maxAltitude: 160,
  pathSampleInterval: 0.25,
  verticalFovRad: 1.1,
} as const;

export const IDLE_INPUT: GlideInput = { turn: 0, pitch: 0, boost: false };

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function routeOf(course: GlideCourse): ProxyEntity[] {
  const byId = new Map(course.entities.map((e) => [e.id, e]));
  return [...course.rules.requiredCheckpointIds, course.rules.goalEntityId].map((id) => {
    const entity = byId.get(id);
    if (!entity) throw new Error(`route references missing entity ${id}`);
    return entity;
  });
}

export function startOf(course: GlideCourse): ProxyEntity {
  const start = course.entities.find((e) => e.kind === "start");
  if (!start) throw new Error("course has no start entity");
  return start;
}

export function forwardOf(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
}

export function createGlideState(course: GlideCourse): GlideState {
  const start = startOf(course).position;
  return {
    position: start,
    yaw: 0,
    pitch: 0,
    speed: GLIDE_CALIBRATION.baseSpeed,
    elapsed: 0,
    activeGate: 0,
    completed: [],
    respawn: start,
    respawns: 0,
    path: [start],
    status: "running",
    event: null,
  };
}

/** True when the segment a→b passes within `radius` of `center`. */
export function segmentHitsSphere(a: Vec3, b: Vec3, center: Vec3, radius: number): boolean {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len2 = dx * dx + dy * dy + dz * dz;
  let t = 0;
  if (len2 > 0) {
    t = clamp(((center[0] - a[0]) * dx + (center[1] - a[1]) * dy + (center[2] - a[2]) * dz) / len2, 0, 1);
  }
  const px = a[0] + dx * t - center[0], py = a[1] + dy * t - center[1], pz = a[2] + dz * t - center[2];
  return px * px + py * py + pz * pz <= radius * radius;
}

export function stepGlide(state: GlideState, rawInput: GlideInput, course: GlideCourse, speedMultiplier = 1): GlideState {
  if (state.status !== "running") return state;
  const C = GLIDE_CALIBRATION;
  const m = course.mechanic;
  const turn = clamp(rawInput.turn, -1, 1);
  const pitchIn = clamp(rawInput.pitch, -1, 1);

  const yaw = state.yaw + turn * C.yawRate * m.turnRate * C.step;
  const pitch = clamp(state.pitch + pitchIn * C.pitchRate * m.lift * C.step, -C.maxPitch, C.maxPitch);
  const multiplier = Number.isFinite(speedMultiplier) ? clamp(speedMultiplier, 1, 2.5) : 1;
  const target = (rawInput.boost ? C.baseSpeed + (C.boostSpeed - C.baseSpeed) * m.boost : C.baseSpeed) * multiplier;
  const speed = target + (state.speed - target) * Math.exp(-C.dragResponse * m.drag * C.step);

  const dir = forwardOf(yaw, pitch);
  const prev = state.position;
  const next: Vec3 = [prev[0] + dir[0] * speed * C.step, prev[1] + dir[1] * speed * C.step, prev[2] + dir[2] * speed * C.step];
  const elapsed = state.elapsed + C.step;

  const route = routeOf(course);
  const gate = route[state.activeGate];
  let activeGate = state.activeGate;
  let completed = state.completed;
  let respawn = state.respawn;
  let respawns = state.respawns;
  let status: GlideStatus = "running";
  let event: GlideState["event"] = null;
  let position = next;
  let outYaw = yaw, outPitch = pitch, outSpeed = speed;

  const crossesPlane = next[2] > prev[2] && prev[2] <= gate.position[2] && next[2] >= gate.position[2];
  const crossing = crossesPlane ? (gate.position[2] - prev[2]) / (next[2] - prev[2]) : 0;
  const openingDistance = Math.hypot(
    prev[0] + (next[0] - prev[0]) * crossing - gate.position[0],
    prev[1] + (next[1] - prev[1]) * crossing - gate.position[1],
  );
  if (crossesPlane && openingDistance <= gate.radius && segmentHitsSphere(prev, next, gate.position, gate.radius)) {
    activeGate += 1;
    completed = [...completed, gate.id];
    respawn = gate.position;
    event = "gate";
    if (activeGate === route.length) status = "won";
  } else {
    const behind = next[2] - gate.position[2] > course.rules.respawnBehindDistance;
    const outside = Math.abs(next[0]) > C.laneHalfWidth || next[1] < C.minAltitude || next[1] > C.maxAltitude;
    if (behind || outside) {
      position = respawn;
      outYaw = 0;
      outPitch = 0;
      outSpeed = C.baseSpeed;
      respawns += 1;
      event = "respawn";
    }
  }

  if (status === "running" && elapsed >= course.rules.durationSeconds) status = "failed";

  const sampleDue = Math.floor(elapsed / C.pathSampleInterval) > Math.floor(state.elapsed / C.pathSampleInterval);
  const path = sampleDue || status !== "running" || event ? [...state.path, position] : state.path;

  return { position, yaw: outYaw, pitch: outPitch, speed: outSpeed, elapsed, activeGate, completed, respawn, respawns, path, status, event };
}

/** Headless pilot: steer toward the active gate using the same normalized input a player produces. */
export function pilotInput(state: GlideState, course: GlideCourse): GlideInput {
  if (state.status !== "running") return IDLE_INPUT;
  const gate = routeOf(course)[state.activeGate];
  const dx = gate.position[0] - state.position[0];
  const dy = gate.position[1] - state.position[1];
  const dz = gate.position[2] - state.position[2];
  const wantYaw = Math.atan2(dx, dz);
  const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
  const yawErr = Math.atan2(Math.sin(wantYaw - state.yaw), Math.cos(wantYaw - state.yaw));
  const pitchErr = wantPitch - state.pitch;
  return { turn: clamp(yawErr / 0.15, -1, 1), pitch: clamp(pitchErr / 0.15, -1, 1), boost: Math.abs(yawErr) < 0.2 };
}

export function simulateCourse(course: GlideCourse, pilot = pilotInput): GlideState {
  let state = createGlideState(course);
  const maxSteps = Math.ceil(course.rules.durationSeconds / GLIDE_CALIBRATION.step) + 1;
  for (let i = 0; i < maxSteps && state.status === "running"; i++) {
    state = stepGlide(state, pilot(state, course), course);
  }
  return state;
}

/** Project a world point into normalized screen space for the overlay. Returns null when behind the camera. */
export function projectPoint(
  point: Vec3,
  state: Pick<GlideState, "position" | "yaw" | "pitch">,
  width: number,
  height: number,
): { x: number; y: number; depth: number; scale: number } | null {
  const rx = point[0] - state.position[0], ry = point[1] - state.position[1], rz = point[2] - state.position[2];
  const cy = Math.cos(-state.yaw), sy = Math.sin(-state.yaw);
  const x1 = rx * cy + rz * sy;
  const z1 = -rx * sy + rz * cy;
  const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
  const y2 = ry * cp - z1 * sp;
  const z2 = ry * sp + z1 * cp;
  if (z2 <= 0.5) return null;
  const focal = height / 2 / Math.tan(GLIDE_CALIBRATION.verticalFovRad / 2);
  return { x: width / 2 + (x1 / z2) * focal, y: height / 2 - (y2 / z2) * focal, depth: z2, scale: focal / z2 };
}

/** Frozen Gate 1 course for the ink-islands fixture; later gates replace it with a validated GameSpec. */
export const FIXTURE_COURSE: GlideCourse = {
  mechanic: { kind: "glide", lift: 1, drag: 1, turnRate: 1, boost: 1 },
  entities: [
    { id: "start", kind: "start", position: [0, 24, 0], radius: 4, label: "Launch" },
    { id: "cp1", kind: "checkpoint", position: [75, 36, 260], radius: 22, label: "First arch" },
    { id: "cp2", kind: "checkpoint", position: [-110, 58, 680], radius: 24, label: "Second arch" },
    { id: "cp3", kind: "checkpoint", position: [125, 28, 1080], radius: 24, label: "Third arch" },
    { id: "goal", kind: "goal", position: [-40, 44, 1500], radius: 28, label: "Moon gate" },
  ],
  rules: { durationSeconds: 70, requiredCheckpointIds: ["cp1", "cp2", "cp3"], goalEntityId: "goal", respawnBehindDistance: 20 },
};
