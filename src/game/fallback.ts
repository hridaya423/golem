import { FIXTURE_COURSE } from "./glide.ts";
import { DEFAULT_HOOP_APPEARANCE, type GameMode, type GameSpecCandidate, type ValidatedGameSpec } from "./spec.ts";
import { DEFAULT_PARKOUR_COURSE } from "./parkour.ts";
import { validateGameSpecCandidate } from "./validate.ts";
import { FIXTURE_WORLD } from "../world/prompts.ts";

/** The ink-islands game in exactly the shape the compiler would return it. */
export const FALLBACK_CANDIDATE: GameSpecCandidate = {
  version: 1,
  title: "Ink Islands Glide",
  tagline: "Thread three stone arches over still water, then take the moon gate.",
  world: {
    basePrompt: FIXTURE_WORLD.basePrompt,
    landmarks: [...FIXTURE_WORLD.landmarks],
    perspective: "first_person",
  },
  mechanic: { ...FIXTURE_COURSE.mechanic },
  hoops: { ...DEFAULT_HOOP_APPEARANCE },
  enemies: ["scout", "striker", "bulwark"],
  platforms: [],
  entities: [...FIXTURE_COURSE.entities],
  rules: { ...FIXTURE_COURSE.rules },
  cartridgeLine: "Three arches, one moon gate, no second chances.",
};

export function fallbackCandidate(image: { id: string }, mode: GameMode = "glide"): GameSpecCandidate {
  if (mode === "parkour") {
    return {
      ...fallbackCandidate(image),
      title: "Your World, On Foot",
      tagline: "Find your footing. Jump the gaps. Reach the final landing.",
      world: {
        basePrompt: "An expanded environment continuing the reference image's colors, materials, forms, lighting and visual style, with broad elevated landing surfaces separated by short gaps and clear distant depth.",
        landmarks: [
          { id: "near-landing", description: "A nearby broad elevated surface using the reference image's materials and shapes." },
          { id: "far-landing", description: "A distant elevated destination continuing the reference image's visual style." },
        ],
        perspective: "first_person",
      },
      mechanic: { ...DEFAULT_PARKOUR_COURSE.mechanic },
      entities: DEFAULT_PARKOUR_COURSE.entities,
      platforms: DEFAULT_PARKOUR_COURSE.platforms,
      rules: DEFAULT_PARKOUR_COURSE.rules,
      cartridgeLine: "Your image, a path of landings, one clean run.",
    };
  }
  if (image.id === "73b41252fdf6f99f1af442b967ef61c480213c528fc8ebc22b284c6023c76f42") return FALLBACK_CANDIDATE;
  return {
    ...FALLBACK_CANDIDATE,
    title: "Your World, In Motion",
    tagline: "Follow three waypoints through your world, then reach the finish.",
    world: {
      basePrompt: "A continuous first-person journey through an expanded version of the reference image. Carry its colors, materials, forms, lighting and visual style naturally into the surrounding scene, with open space for a smooth forward flight.",
      landmarks: [
        { id: "near-form", description: "A nearby focal form continuing the reference image's shapes and materials." },
        { id: "far-form", description: "A distant grouping of forms continuing the reference image's colors and visual style." },
      ],
      perspective: "first_person",
    },
    entities: FIXTURE_COURSE.entities.map((entity, i) => ({
      ...entity,
      label: entity.kind === "start" ? "Launch" : entity.kind === "goal" ? "Finish" : `Waypoint ${i}`,
    })),
    cartridgeLine: "Your image, three waypoints, one flight.",
  };
}

export function fallbackSpec(image: { id: string }, mode: GameMode = "glide"): ValidatedGameSpec {
  const result = validateGameSpecCandidate(fallbackCandidate(image, mode), image);
  if (!result.ok) throw new Error(`Fallback spec is invalid: ${JSON.stringify(result.issues)}`);
  return result.spec;
}
