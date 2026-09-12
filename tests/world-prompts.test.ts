import test from "node:test";
import assert from "node:assert/strict";
import { CAMERA_CONTRACT, STYLE_CONTRACT, composeWorldPrompt } from "../src/world/prompts.ts";
import { buildGameRequest } from "../src/compiler/request.ts";
import { GLIDE_CALIBRATION } from "../src/game/glide.ts";
import { SPEC_LIMITS } from "../src/game/spec.ts";

test("generic continuity prompt preserves arbitrary source media without prescribing an ink world", () => {
  for (const base of ["A vivid neon city photographed in rain.", "An abstract red and yellow paper collage.", "A hand-drawn black and white sketch."]) {
    const prompt = composeWorldPrompt(base, [{ description: "A form from the reference image" }]);
    assert.ok(prompt.startsWith(base));
    assert.ok(prompt.includes(STYLE_CONTRACT));
    assert.doesNotMatch(CAMERA_CONTRACT + STYLE_CONTRACT, /cinematic lighting|near-black|ink-wash|stone arches|water/i);
  }
  const largest = composeWorldPrompt("x".repeat(SPEC_LIMITS.basePrompt), Array.from({ length: SPEC_LIMITS.landmarks.max }, () => ({ description: "y".repeat(SPEC_LIMITS.landmark) })));
  assert.ok(largest.length < 2000);
});

test("compiler receives the image and current pacing bounds rather than the former short demo", () => {
  const image = "data:image/webp;base64,reference";
  const request = buildGameRequest({ model: "test", imageDataUrl: image, direction: "Keep the paper texture" });
  assert.deepEqual(request.messages[1].content[0], { type: "image_url", image_url: { url: image } });
  const system = request.messages[0].content;
  assert.equal(typeof system, "string");
  assert.match(String(system), new RegExp(`Base speed is ${GLIDE_CALIBRATION.baseSpeed}`));
  assert.match(String(system), new RegExp(`${SPEC_LIMITS.course.minDistance}–${SPEC_LIMITS.course.maxDistance}`));
  assert.doesNotMatch(String(system), /380 units|16 seconds/);
  assert.match(String(system), /actual medium and material treatment/);
});
