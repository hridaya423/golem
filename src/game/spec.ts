import { z } from "zod";
import type { GlideCourse } from "./glide.ts";
import type { ParkourCourse } from "./parkour.ts";

// Trust-boundary budgets (PLAN.md "Fixed trust-boundary budgets"). Course envelope numbers come
// from the Gate 1 calibration recorded in PROGRESS.md.
export const SPEC_LIMITS = {
  title: 64,
  tagline: 120,
  label: 48,
  basePrompt: 600,
  landmark: 120,
  cartridgeLine: 120,
  landmarks: { min: 2, max: 4 },
  duration: { min: 55, max: 90 },
  mechanic: { min: 0.5, max: 2 },
  lane: { x: 180, yMin: 0, yMax: 120, zMax: 1800 },
  radius: { checkpoint: { min: 18, max: 32 }, goal: { min: 22, max: 38 }, start: { min: 2, max: 6 } },
  spacing: { min: 200, max: 480 },
  segment: { maxLateral: 260, maxVertical: 60 },
  course: { minDistance: 1250, maxDistance: 1700, minLateralSpan: 140, minDirectionChanges: 2 },
  respawnBehind: { min: 8, max: 50 },
} as const;

export const GameModeSchema = z.enum(["glide", "parkour"]);
export const GameModePreferenceSchema = z.enum(["auto", "glide", "parkour"]);
export type GameMode = z.infer<typeof GameModeSchema>;
export type GameModePreference = z.infer<typeof GameModePreferenceSchema>;

export const PARKOUR_LIMITS = {
  platforms: { min: 8, max: 16 },
  x: 45, top: { min: 2, max: 40 }, z: 340,
  width: { min: 12, max: 24 }, height: { min: 2, max: 30 }, depth: { min: 12, max: 24 },
  step: { min: 14, max: 24 }, gap: { min: 2, max: 6 }, lateral: 6, rise: 1.5, drop: 3,
  distance: { min: 120, max: 330 }, radius: { min: 2, max: 4 },
} as const;

const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/);

export const Vec3Schema = z.tuple([
  finite(-SPEC_LIMITS.lane.x, SPEC_LIMITS.lane.x),
  finite(SPEC_LIMITS.lane.yMin, SPEC_LIMITS.lane.yMax),
  finite(0, SPEC_LIMITS.lane.zMax),
]).readonly();

export const ProxyEntitySchema = z.strictObject({
  id,
  kind: z.enum(["start", "checkpoint", "goal"]),
  position: Vec3Schema,
  radius: finite(SPEC_LIMITS.radius.start.min, SPEC_LIMITS.radius.goal.max),
  label: text(SPEC_LIMITS.label),
});

export const GlideSpecSchema = z.strictObject({
  kind: z.literal("glide"),
  lift: finite(SPEC_LIMITS.mechanic.min, SPEC_LIMITS.mechanic.max),
  drag: finite(SPEC_LIMITS.mechanic.min, SPEC_LIMITS.mechanic.max),
  turnRate: finite(SPEC_LIMITS.mechanic.min, SPEC_LIMITS.mechanic.max),
  boost: finite(SPEC_LIMITS.mechanic.min, SPEC_LIMITS.mechanic.max),
});

export const ParkourSpecSchema = GlideSpecSchema.extend({ kind: z.literal("parkour") });

export const ParkourPlatformSchema = z.strictObject({
  id,
  position: z.tuple([
    finite(-PARKOUR_LIMITS.x, PARKOUR_LIMITS.x),
    finite(PARKOUR_LIMITS.top.min, PARKOUR_LIMITS.top.max),
    finite(0, PARKOUR_LIMITS.z),
  ]).readonly(),
  size: z.tuple([
    finite(PARKOUR_LIMITS.width.min, PARKOUR_LIMITS.width.max),
    finite(PARKOUR_LIMITS.height.min, PARKOUR_LIMITS.height.max),
    finite(PARKOUR_LIMITS.depth.min, PARKOUR_LIMITS.depth.max),
  ]).readonly(),
  label: text(SPEC_LIMITS.label),
});

export const GameRulesSchema = z.strictObject({
  durationSeconds: finite(SPEC_LIMITS.duration.min, SPEC_LIMITS.duration.max),
  requiredCheckpointIds: z.tuple([id, id, id]).readonly(),
  goalEntityId: id,
  respawnBehindDistance: finite(SPEC_LIMITS.respawnBehind.min, SPEC_LIMITS.respawnBehind.max),
});

export const HoopAppearanceSchema = z.strictObject({
  material: z.enum(["reference", "metal", "stone", "wood", "fabric"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  roughness: finite(0.08, 1),
  metalness: finite(0, 1),
  textureScale: finite(0.5, 6),
  emissive: finite(0, 0.6),
});

export type HoopAppearance = z.infer<typeof HoopAppearanceSchema>;

export const DEFAULT_HOOP_APPEARANCE: HoopAppearance = {
  material: "reference", color: null, accentColor: null,
  roughness: 0.82, metalness: 0.08, textureScale: 2, emissive: 0.04,
};

const LandmarkSchema = z.strictObject({ id, description: text(SPEC_LIMITS.landmark) });

/** World identity as the model may author it: no seed, no technical identity. */
export const WorldCandidateSchema = z.strictObject({
  basePrompt: text(SPEC_LIMITS.basePrompt),
  landmarks: z.array(LandmarkSchema).min(SPEC_LIMITS.landmarks.min).max(SPEC_LIMITS.landmarks.max).readonly(),
  perspective: z.literal("first_person"),
});

/** Exactly what the compiler is asked to produce. `referenceImageId` and `world.seed` are injected later. */
export const GameSpecCandidateSchema = z.strictObject({
  version: z.literal(1),
  title: text(SPEC_LIMITS.title),
  tagline: text(SPEC_LIMITS.tagline),
  world: WorldCandidateSchema,
  mechanic: z.discriminatedUnion("kind", [GlideSpecSchema, ParkourSpecSchema]),
  hoops: HoopAppearanceSchema,
  enemies: z.array(z.enum(["scout", "striker", "bulwark"])).length(3).readonly(),
  platforms: z.array(ParkourPlatformSchema).max(PARKOUR_LIMITS.platforms.max).readonly(),
  entities: z.array(ProxyEntitySchema).length(5).readonly(),
  rules: GameRulesSchema,
  cartridgeLine: text(SPEC_LIMITS.cartridgeLine),
});

export const GameSpecSchema = GameSpecCandidateSchema.extend({
  referenceImageId: z.string().regex(/^[0-9a-f]{64}$/),
  world: WorldCandidateSchema.extend({ seed: z.number().int().min(0) }),
});

export const GlideTurnPatchSchema = z.strictObject({
  version: z.literal(1),
  mechanic: GameModeSchema,
  operation: z.literal("multiply_turn_rate"),
  factor: z.union([z.literal(0.5), z.literal(2)]),
  cartridgeLine: text(SPEC_LIMITS.cartridgeLine),
});

export type GameSpecCandidate = z.infer<typeof GameSpecCandidateSchema>;
export type GameSpec = z.infer<typeof GameSpecSchema>;
export type GlideTurnPatch = z.infer<typeof GlideTurnPatchSchema>;

declare const validated: unique symbol;
/** Only `validateGameSpecCandidate` / `applyGlideTurnPatch` may construct this. */
export type ValidatedGameSpec = GameSpec & { readonly [validated]: true };
export type ValidatedGameSpecPatch = GlideTurnPatch & { readonly [validated]: true };

export const brandValidated = <T extends GameSpec | GlideTurnPatch>(value: T) =>
  value as T & { readonly [validated]: true };

export function courseOf(spec: GameSpec): GlideCourse | ParkourCourse {
  return spec.mechanic.kind === "parkour"
    ? { mechanic: spec.mechanic, entities: spec.entities, rules: spec.rules, platforms: spec.platforms }
    : { mechanic: spec.mechanic, entities: spec.entities, rules: spec.rules };
}

export type ValidationIssue = {
  path: string;
  code: "schema" | "duplicate_id" | "missing_reference" | "out_of_bounds" | "route_order" | "unreachable";
  message: string;
};

export type ValidationCheck = { name: string; ok: boolean; detail: string };

export type ValidationResult =
  | { ok: true; spec: ValidatedGameSpec; checks: ValidationCheck[] }
  | { ok: false; issues: readonly ValidationIssue[]; checks: ValidationCheck[] };

/** Strict JSON schema handed to the compiler; derived from the same Zod definition. */
export const gameSpecCandidateJsonSchema = (mode: GameModePreference = "auto") => z.toJSONSchema(
  mode === "auto" ? GameSpecCandidateSchema : GameSpecCandidateSchema.extend({ mechanic: mode === "parkour" ? ParkourSpecSchema : GlideSpecSchema }),
);
export const glideTurnPatchJsonSchema = (mode: GameMode = "glide") => z.toJSONSchema(GlideTurnPatchSchema.extend({ mechanic: z.literal(mode) }));
