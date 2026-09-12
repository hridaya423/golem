import assert from "node:assert/strict";
import test from "node:test";
import { cartridgeFilename, deriveCartridge } from "../src/game/cartridge.ts";
import { fallbackSpec } from "../src/game/fallback.ts";
import { courseOf } from "../src/game/spec.ts";
import { createGlideState, simulateCourse } from "../src/game/glide.ts";
import { applyGlideTurnPatch, validateGlideTurnPatch } from "../src/game/validate.ts";

const image = { id: "a".repeat(64) };

function patchedSpec() {
  const original = fallbackSpec(image);
  const parsed = validateGlideTurnPatch({
    version: 1,
    mechanic: "glide",
    operation: "multiply_turn_rate",
    factor: 2,
    cartridgeLine: "Turn rate doubled.",
  });
  assert.ok(parsed.ok);
  const applied = applyGlideTurnPatch(original, parsed.patch);
  assert.ok(applied.ok);
  return { original, patched: applied.spec };
}

test("cartridge derives only from a won patched run", () => {
  const { original, patched } = patchedSpec();
  const won = simulateCourse(courseOf(original));
  assert.equal(won.status, "won");

  assert.throws(() =>
    deriveCartridge({ spec: original, originalSpec: original, run: won, runKind: "original" }),
  );
  const running = createGlideState(courseOf(patched));
  assert.throws(() =>
    deriveCartridge({ spec: patched, originalSpec: original, run: running, runKind: "patched" }),
  );

  const cartridge = deriveCartridge({
    spec: patched,
    originalSpec: original,
    run: won,
    runKind: "patched",
  });
  assert.equal(cartridge.ruleLabel, "TURN RATE ×2");
  assert.equal(cartridge.mechanic, "GLIDE");
  assert.equal(cartridge.seedId, image.id);
  assert.equal(cartridge.originalTurnRate, 1);
  assert.equal(cartridge.patchedTurnRate, 2);
  assert.deepEqual([...cartridge.path], [...won.path]);
  assert.equal(cartridge.gates.length, 4);
  assert.equal(cartridge.completionSeconds, won.elapsed);
});

test("cartridgeFilename slugifies the title", () => {
  assert.equal(
    cartridgeFilename("Ink Sea of Stone Moons!!"),
    "golem-ink-sea-of-stone-moons.png",
  );
  assert.equal(cartridgeFilename("!!!"), "golem-game.png");
});
