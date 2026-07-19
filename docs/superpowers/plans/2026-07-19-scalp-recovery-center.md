# Scalp Recovery Center Implementation Plan

> **For agentic workers:** Use the existing scalp-analysis service/repository boundaries and complete each task with its focused test before moving to the next task.

**Goal:** Make incomplete scalp-analysis sessions recoverable and operationally clear after AI or transient provider failures.

**Architecture:** Add a session-level retry service that discovers only retryable image states (`uploaded` and `ai_failed`) and invokes the existing per-image provider adapter sequentially. Extend the existing session-state progress object with retry counts, then expose a protected session retry route and a UI action that refreshes the canonical session state after the batch completes. Confirmed annotations and derived summaries remain untouched unless a user explicitly confirms annotations.

**Tech Stack:** Next.js App Router, TypeScript, Supabase repository with local mock repository for tests, Node test runner, React client component.

## Global Constraints

- Preserve the existing client request shape and `SessionState` fields; only add backward-compatible progress fields.
- Do not retry confirmed images or overwrite confirmed annotations.
- Process retryable images one at a time and persist each result independently.
- Keep Google Drive and AI provider access behind the existing adapters.
- Do not silently fall back to mock data in deployed runtimes.

---

### Task 1: Retryable image discovery and batch service

**Files:**
- Modify: `web/src/lib/scalp-analysis/service.ts`
- Test: `web/src/lib/scalp-analysis/service.test.ts`

**Interface:**
- Add `retryScalpSessionAnalysis(sessionId: string): Promise<{ session_id: string; attempted: number; succeeded: number; failed: number; skipped: number; results: Array<{ image_id: string; status: 'ready' | 'failed'; error?: string }> }>`.
- Retry images whose status is `uploaded` or `ai_failed`; leave `ai_ready` and `confirmed` unchanged.

- [ ] Write a failing service test with one `uploaded`, one `ai_failed`, one `ai_ready`, and one `confirmed` image; assert only the first two are attempted and the result counts are correct.
- [ ] Run the focused test and verify it fails because the batch service is absent.
- [ ] Implement sequential iteration using `listTrackingImagesForSession` and `retryScalpImageAnalysis`; catch each failure, keep processing, and return per-image status.
- [ ] Run the focused test and the full test suite; verify all pass.

### Task 2: Progress contract and protected API route

**Files:**
- Modify: `web/src/lib/scalp-analysis/types.ts`
- Modify: `web/src/lib/scalp-analysis/mock-repository.ts`
- Modify: `web/src/lib/scalp-analysis/repository.ts`
- Create: `web/src/app/api/scalp-analysis/sessions/[sessionId]/retry/route.ts`
- Test: `web/src/lib/scalp-analysis/mock-repository.test.ts`

**Interface:**
- Add backward-compatible progress fields: `ai_retryable_images` and `ai_failed_images`.
- Add `POST /api/scalp-analysis/sessions/[sessionId]/retry`, requiring `admin` or `staff`, returning the batch service result with no-store semantics.

- [ ] Add a failing state test asserting retryable and failed counts are derived from image status.
- [ ] Run the focused test and verify the new fields are missing or incorrect.
- [ ] Implement identical progress calculations in mock and Supabase session-state repositories.
- [ ] Add route-level service wiring with existing error mapping and status handling.
- [ ] Run focused tests and verify they pass.

### Task 3: Recovery controls and completion guidance

**Files:**
- Modify: `web/src/app/scalp-analysis/ui/scalp-analysis-client.tsx`
- Modify: `web/src/lib/scalp-analysis/report.ts`
- Test: `web/src/lib/scalp-analysis/report.test.ts`

**Interface:**
- Add a session-level retry button when `progress.ai_retryable_images > 0`.
- Show retrying state, result summary, and refresh the session state after completion.
- Include retryable/failed recovery warnings in report output without treating them as official metrics.

- [ ] Add a failing report test asserting a session with failed AI images includes a recovery warning.
- [ ] Run the focused report test and verify it fails.
- [ ] Implement UI action using `POST /api/scalp-analysis/sessions/{id}/retry`, preserving existing per-image retry.
- [ ] Implement report warning plumbing and render the warning in the existing report view.
- [ ] Run tests, lint, mojibake check, and a production build.

### Task 4: Verification and delivery

**Files:**
- Verify: `web/README.md`
- Verify: `web/package.json`

- [ ] Run `npm.cmd test` and confirm all tests pass.
- [ ] Run `npm.cmd run lint`, `npm.cmd run check:mojibake`, and `git diff --check`.
- [ ] Run one isolated `npm.cmd run build`.
- [ ] Test the live health endpoint after deployment and report any external Supabase/Drive/Auth/AI blockers separately from code status.
- [ ] Commit and push the implementation to `main`.

## Self-review

- Retry behavior is scoped to incomplete AI states and cannot modify confirmed annotations.
- Batch failures are isolated per image, so one provider failure does not hide successful retries.
- Progress fields are additive, so older clients can still consume the existing state shape.
- Report warnings explain recovery work without publishing unconfirmed metrics.
