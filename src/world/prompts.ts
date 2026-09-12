export const CAMERA_CONTRACT =
  "Continuous first-person flight explores the scene with smooth forward motion and readable depth. The view follows gentle steering and changes in altitude, with a stable roll angle and continuous landmarks.";

export const STYLE_CONTRACT =
  "The reference image defines the medium, palette, lighting, edge quality and material treatment of every frame. Preserve its distribution of dark and light shapes as the view moves. Each surface retains its depicted reflectance, texture density and degree of simplification. Stylized sources remain stylized; photographic sources retain their original photographic treatment. New scenery extends the same visual language, with matching marks, materials and lighting.";

export const FIXTURE_WORLD = {
  basePrompt:
    "Hand-drawn monochrome ink-wash archipelago on pale textured paper. Water is composed of broad near-black matte ink shapes and sparse pale brush marks. Charcoal cliffs, pine silhouettes and three massive stone arches frame a winding open flight corridor. A distant pale moon gate shines through paper-gray mist. Rough ink edges, restrained tonal detail and flat painted surfaces persist throughout the archipelago.",
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
  const prompt = [base, sentences, CAMERA_CONTRACT, STYLE_CONTRACT].filter(Boolean).join(" ");
  if (prompt.length >= 2000) {
    throw new Error(`Composed world prompt exceeds budget (${prompt.length} >= 2000)`);
  }
  return prompt;
}
