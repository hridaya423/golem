import { IDLE_CONTROLS, type WorldControls } from "./world.ts";

export function tokenRequestBody() {
  return {
    expires_after: 3600,
    authorization_details: [
      {
        type: "session",
        resources: { models: { match: ["reactor/lingbot-world-2"] } },
        constraints: { max_sessions: 3, max_session_duration_seconds: 3600 },
      },
    ],
  } as const;
}

export const RELEASE_CONTROLS: WorldControls = IDLE_CONTROLS;

export const EMPTY_CAMERA_POSE: unknown[] = [];
