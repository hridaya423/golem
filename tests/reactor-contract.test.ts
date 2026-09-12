import test from "node:test";
import assert from "node:assert/strict";
import { IDLE_INPUT } from "../src/game/glide.ts";
import { controlsFromInput } from "../src/world/world.ts";
import { tokenRequestBody } from "../src/world/reactor-contract.ts";

test("token request body scopes a bounded session token", () => {
  assert.deepStrictEqual(tokenRequestBody(), {
    expires_after: 3600,
    authorization_details: [
      {
        type: "session",
        resources: { models: { match: ["reactor/lingbot-world-2"] } },
        constraints: { max_sessions: 3, max_session_duration_seconds: 3600 },
      },
    ],
  });
});

test("idle input still means forward motion for the world", () => {
  assert.deepStrictEqual(controlsFromInput(IDLE_INPUT), {
    longitudinal: "forward",
    lateral: "idle",
    lookHorizontal: "idle",
    lookVertical: "idle",
  });
});
