import { FIXTURE_COURSE } from "./glide.ts";
import type { GameSpecCandidate, ValidatedGameSpec } from "./spec.ts";
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
  entities: [...FIXTURE_COURSE.entities],
  rules: { ...FIXTURE_COURSE.rules },
  cartridgeLine: "Three arches, one moon gate, no second chances.",
};

export function fallbackSpec(image: { id: string }): ValidatedGameSpec {
  const result = validateGameSpecCandidate(FALLBACK_CANDIDATE, image);
  if (!result.ok) throw new Error(`Fallback spec is invalid: ${JSON.stringify(result.issues)}`);
  return result.spec;
}
