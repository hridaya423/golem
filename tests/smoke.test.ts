import test from "node:test";
import assert from "node:assert/strict";

test("Node runs erasable TypeScript", () => {
  const value: number = 1;
  assert.equal(value, 1);
});
