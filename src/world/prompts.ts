export const CAMERA_CONTRACT =
  "The first-person camera glides steadily forward at a constant height above the scene with smooth continuous motion and a level horizon. The scene stays consistent with the reference image under calm cinematic lighting.";

export const FIXTURE_WORLD = {
  basePrompt:
    "Monochrome ink-wash archipelago: three tall stone arches rise from still water along a straight open corridor, and a distant moon gate rests on the horizon.",
  landmarks: [
    { id: "arch-first", description: "The first tall stone arch, centered over the water corridor" },
    { id: "arch-second", description: "The second tall stone arch, standing to the right" },
    { id: "moon-gate", description: "A distant pale moon gate on the horizon" },
  ],
} as const;

export function composeWorldPrompt(
  base: string,
  landmarks: readonly { description: string }[],
): string {
  if (base.length > 600) {
    throw new Error(`World base prompt exceeds 600 characters (${base.length})`);
  }
  const sentences = landmarks.map((l) => `Landmark: ${l.description}.`).join(" ");
  const prompt = [base, sentences, CAMERA_CONTRACT].filter(Boolean).join(" ");
  if (prompt.length >= 2000) {
    throw new Error(`Composed world prompt exceeds budget (${prompt.length} >= 2000)`);
  }
  return prompt;
}
