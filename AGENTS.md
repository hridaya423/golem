# Execution contract

Before edits, read `PLAN.md`, `docs/anything-play-handoff.md`, and `PROGRESS.md`. The approved plan overrides the older handoff where they differ.

- Execute gates in order. Proceed beyond Gate 1 only after recorded live coupling evidence and an explicit pass decision; use its named contingency on failure.
- After each gate, update `PROGRESS.md` with the command, result, evidence path, next step, and evidence-backed deviations. Preserve partial work.
- Invoke `receive-handoff` and `executing-plans` when resuming; `test-driven-development` for behavioral code; `architect` for boundaries; `ponytail` for implementation; `design-engineering` for UI; `browser-ui-qa` for browser checks; `verification-before-completion` before completion claims.
- Keep real-model checks opt-in and distinguish real service evidence from deterministic fake tests. Keep credentials server-only and out of logs, browser debug state, and version control.
- Connection regressions can use the existing port-3000 dev server with `REAL_REACTOR=1 pnpm exec playwright test e2e/reactor-retry.spec.ts`; this spec mocks token/session requests and blocks external services. Do not omit the file filter: other live specs use real services. Offline Playwright uses port 3100 and `GOLEM_TEST_WORLD=fake`; normal app URLs always use live Reactor.
- `docs/anything-play.architecture.draft.json` is archived research, not authoritative implementation architecture.
