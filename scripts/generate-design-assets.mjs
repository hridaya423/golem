import { randomUUID, createHash } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import sharp from "sharp";

const model = "openai:gpt-image@2.5-sunburst";
const identity = `Create one polished horizontal desktop web application design reference, not a landing page, not a collage of screens, not a device mockup. The product is ANYTHING//PLAY, an image-to-playable-gliding-world experience for a live demo. Experience-mode, high causality, low chrome, generous breathing room. Use EXACT palette: page #070909, raised surface #111514, primary text #f4f7f5, secondary #97a39d, single acid-lime interaction accent #c7ff4a with dark #071000 text. Rational system grotesk typography, medium weight, disciplined negative tracking on display text, readable 16px-equivalent body and monospace utility labels. Medium editorial scale, design variance 6, visual density 3. Four signature motifs: preserved original seed label, three precise route rings, subtly notched cartridge silhouette, concise monospaced information rail. Crisp 6px controls, 12px media corners, 24/32px spacing. One filled primary action only. No gradients, mesh, purple glow, floating blobs, dashboard furniture, sidebar, fake charts, stats, badges, marketing sections, or piles of cards. Render purposeful real UI typography, accessible high contrast, controls at least 44px tall. Only the single requested surface fills the image; no browser chrome. Keep one coherent matte-black and ink-paper brand world.`;
const assets = [
  {
    name: "glide-ink-islands",
    path: "public/fixtures/glide-ink-islands.webp",
    width: 1664,
    height: 960,
    prompt: `A landscape 1664 by 960 reference frame for first-person forward gliding through a monochrome ink archipelago. This is a world illustration, not a website or interface. Elegant ink-wash drawings on luminous pale rice paper: floating dark basalt-paper islands flank a broad open corridor through the center. Strong clear level horizon at 45 percent of image height, soft atmospheric depth, three and only three large ancient circular stone arch landmarks standing along the forward corridor, visibly separated by distance: one large near arch centered slightly left, a medium arch farther slightly right, a small third arch near center. A distant crescent-moon gate beyond them forms the destination. Open air under and around each arch, forgiving spacious flight path. Camera floating steadily above the paper sea, eye level, no visible person or vehicle. Charcoal, warm white paper, delicate gray mist, highly legible silhouette design, hand-drawn ink edges and detailed rocky island textures concentrated at the sides. Quiet wonder and immense scale. The center remains navigable and uncluttered. Exactly three large route arches plus one distant moon-shaped destination. No text, labels, logos, UI, borders, HUD, humans, crowds, weapons, tiny doors or precision platforms. Fill the entire frame with the illustrated world.`,
  },
  {
    name: "01-input",
    path: "docs/evidence/design/01-input.webp",
    width: 1536,
    height: 960,
    prompt: `${identity} Surface 1: INPUT. Top-left small ANYTHING//PLAY wordmark. The seed is the focal point, not a giant headline: centered large 16:9 image well displaying a beautiful monochrome ink drawing of floating islands with three circular stone arches in a clear corridor and a distant moon. Compact headline above reads “An image. A world. Your rules.” The preserved seed image occupies most of the middle area, like the label face of a game cartridge. Below the well a precise narrow action rail: understated outlined “Upload image” and “Use camera” controls left; a labeled single-line “Direction · optional” input with placeholder “Give it a little more altitude” across the middle; one lime rectangular “Make playable” button on the right. Beneath, quiet concise text “PNG, JPEG or WebP · up to 10 MB”. All main content comfortably visible at laptop height. No previews of later screens, no steps, no nav links, no fake metrics. Composition is centered image-as-canvas with tiny peripheral typography, not text-left/image-right.`,
  },
  {
    name: "02-compilation",
    path: "docs/evidence/design/02-compilation.webp",
    width: 1536,
    height: 960,
    prompt: `${identity} Surface 2: COMPILATION. This is a calm working state after an image was submitted. Small ANYTHING//PLAY wordmark top-left. Large preserved monochrome floating-island seed image in the left two thirds, matte simple crop; right third a generously spaced unboxed typographic sequence headed “Making it playable”. Exactly four progress rows: “Reading the seed” marked complete, “Writing the rules” marked complete, “Testing the game” active with subtext “Checking the route”, “Warming the world” pending. Use check glyphs, simple numbered circles, and textual state, no spinners or fake percentage bar. Beneath these rows a four-line monospaced decision: “WORLD  Ink islands”, “GAME  Glide”, “RULE  Steer through three rings”, “GOAL  Reach the moon gate”. No primary button needed while work is active. A thin lime motif connects a small ring silhouette in the seed to the active validation row. Emphasize seed continuity, real progress, generous space, crisp readable hierarchy; no fake code wall.`,
  },
  {
    name: "03-play",
    path: "docs/evidence/design/03-play.webp",
    width: 1536,
    height: 960,
    prompt: `${identity} Surface 3: PLAY. The entire viewport is a first-person flight through a vast ink-painted island world, bright paper-gray sky and charcoal floating rocks, cinematic yet materially paper-like. Three circular stone landmarks recede into a clear forward corridor, distant crescent-moon destination. Thin precise acid-lime gameplay rings are overlaid near these large landmarks, the active nearest ring labeled “02”, already-passed ring indicated with a small check, later ring pale. These are exact gameplay overlays, not a cyberpunk cockpit. Restrained dark translucent top safe-area rail: left objective “Pass three rings. Reach the moon gate.”; center “1 / 3”; right large tabular “00:18”. Small preserved seed label thumbnail in one top corner, small ANYTHING//PLAY wordmark. Bottom edge minimal controls hint “A / D turn    W / S pitch    SPACE boost” and a small outlined BOOST held-state control; subtle corner pointer arrows with touch-size targets. Live world image is the sole focal point. No central dialog, surrounding cards, sidebar, graph or dashboard.`,
  },
  {
    name: "04-spoken-patch",
    path: "docs/evidence/design/04-spoken-patch.webp",
    width: 1536,
    height: 960,
    prompt: `${identity} Surface 4: SPOKEN RULE PATCH, immediately after original win. Keep the same ink-island world as a frozen full-bleed background, intentionally darkened with a clean matte overlay. A large quietly celebratory “Course complete.” heading sits lower-left, followed by readable “Same world. A new rule.” Beneath it a small completion line “3 / 3 gates”. Right-of-center an unboxed listening surface displays a simple microphone glyph and the actual transcript in large restrained mixed-case text: “Double the turn rate.” Below it a concise status “Listening — your final words apply automatically”. One subtle “Type instead” underlined control remains visible. A small original seed thumbnail in the same corner as play maintains identity. No confirm button, no decorative waveform, no chat window, no multiple bright actions. This reference is the listening state after Speak a new rule was pressed. Use asymmetric typographic balance and generous dark negative space, with one thin lime active listening indicator.`,
  },
  {
    name: "05-cartridge",
    path: "docs/evidence/design/05-cartridge.webp",
    width: 1536,
    height: 960,
    prompt: `${identity} Surface 5: RESULT. Center the earned downloadable Game Cartridge as a beautiful large flat artifact, no 3D perspective and no device mockup. The cartridge is a broad 1600:1000 proportion with subtly clipped/notched bottom corners. Its top is a pair of equally meaningful images: original monochrome ink drawing of floating islands on the left, detailed generated first-person world frame after flight on the right, a natural evolution rather than two identical crops. A matte charcoal information rail below contains “INK ISLANDS” as the dominant title, “GLIDE”, a compact white path trace through three ring markers, tabular “00:22.4”, and clear lime “TURN RATE ×2”. Small tagline “A sharper turn through a world you drew.” Fine short labels distinguish “ORIGINAL SEED” and “YOUR WORLD”. In the surrounding app below the artifact one unmistakable lime “Download cartridge” button and secondary text “Make another”. Top-left small ANYTHING//PLAY wordmark. Artifacts and essential text readable at projector distance. Dark spacious page, finished collectible feeling, no confetti, gradients, share links, terminal or marketing content.`,
  },
];

const apiKey = process.env.RUNWARE_API_KEY;
if (!apiKey) throw new Error("RUNWARE_API_KEY is not configured");
const selected = process.argv[2] ? assets.filter((asset) => asset.name === process.argv[2]) : assets;
if (!selected.length) throw new Error("Unknown asset name");
for (const asset of selected) {
  if (await access(asset.path).then(() => true, () => false)) {
    console.log(`Reusing ${asset.path}`);
    continue;
  }
  const taskUUID = randomUUID();
  const started = performance.now();
  const request = {
    taskType: "imageInference", taskUUID, model, positivePrompt: asset.prompt,
    width: asset.width, height: asset.height, numberResults: 1,
    outputType: "URL", outputFormat: "WEBP", deliveryMethod: "sync",
    settings: { quality: "high", background: "opaque" }, includeCost: true,
  };
  await writeFile(`docs/evidence/design/${asset.name}.request.json`, JSON.stringify(request, null, 2), { flag: "wx" });
  console.log(`Generating ${asset.name} with ${model}`);
  const response = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify([request]), signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok) throw new Error(`Runware HTTP ${response.status} for ${asset.name}; request is retained for recovery`);
  const body = await response.json();
  const result = body.data?.find((item) => item.taskUUID === taskUUID && typeof item.imageURL === "string");
  if (!result) throw new Error(`Runware returned no completed image for ${asset.name}; request is retained for recovery`);
  const imageUrl = new URL(result.imageURL);
  if (imageUrl.protocol !== "https:" || !imageUrl.hostname.endsWith(".runware.ai")) throw new Error("Unexpected image download host");
  const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imageResponse.ok) throw new Error(`Image download HTTP ${imageResponse.status}`);
  const bytes = await sharp(Buffer.from(await imageResponse.arrayBuffer()))
    .resize(asset.width, asset.height, { fit: "cover" }).webp({ quality: 92 }).toBuffer();
  await writeFile(asset.path, bytes, { flag: "wx" });
  await writeFile(`docs/evidence/design/${asset.name}.result.json`, JSON.stringify({
    taskUUID, model, imageUUID: result.imageUUID, path: asset.path,
    width: asset.width, height: asset.height, bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    elapsedMilliseconds: Math.round(performance.now() - started), cost: result.cost ?? null,
  }, null, 2), { flag: "wx" });
  console.log(`Saved ${asset.path} (${bytes.length} bytes)`);
}
