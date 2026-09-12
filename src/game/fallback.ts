import { FIXTURE_COURSE } from "./glide.ts";
import { DEFAULT_HOOP_APPEARANCE, type GameSpecCandidate, type ValidatedGameSpec } from "./spec.ts";
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
  entities: [...FIXTURE_COURSE.entities],
  rules: { ...FIXTURE_COURSE.rules },
  cartridgeLine: "Three arches, one moon gate, no second chances.",
};

export function fallbackCandidate(image: { id: string }): GameSpecCandidate {
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

export function fallbackSpec(image: { id: string }): ValidatedGameSpec {
  const result = validateGameSpecCandidate(fallbackCandidate(image), image);
  if (!result.ok) throw new Error(`Fallback spec is invalid: ${JSON.stringify(result.issues)}`);
  return result.spec;
}
