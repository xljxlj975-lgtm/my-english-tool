# System Context

## Project Overview
- Web app that helps users log English mistakes or improved expressions, then review them with a spaced-repetition workflow.
- Users can add single or batch entries, run daily review sessions, browse a library, see a calendar of scheduled reviews, and configure a daily review target.
- Supabase (Postgres) stores mistakes, review metadata, and user settings; Next.js App Router handles UI and API routes.

## Tech Stack
- Runtime: Node.js, Next.js 15 (App Router, client-heavy pages), React 19.
- Language/tooling: TypeScript, Tailwind CSS v4 (via `@import "tailwindcss"`), ESLint 9.
- Backend/data: Supabase JS client talking to Supabase Postgres.
- Utilities: date-fns for scheduling/formatting; Next API routes for server logic.

## Core Features
- Dashboard (`/`): shows today’s review load (bounded by daily target), backlog count, completion progress, streak, and recent additions via `/api/dashboard`.
- Add entries (`/add`): single or batch creation of mistakes/expressions with content type, optional explanation; posts to `/api/mistakes` or `/api/mistakes/batch`.
- Review session (`/review`): fetches today’s queue from `/api/mistakes?todayReview=true`, flashcard flow with spaced-repetition updates via `/api/mistakes/[id]`.
- Library (`/library`): search/filter mistakes, view details, and delete entries via `/api/mistakes`.
- Calendar (`/calendar`): monthly view of scheduled reviews with per-day counts and detail modal fed by `/api/calendar`.
- Settings (`/settings`): configure daily review target persisted through `/api/settings`.
- Review queue API (`/api/review-queue`): supports today/backlog/continue modes, applying daily target caps.

## File Structure
- `src/app/layout.tsx` – Root layout and navigation.
- `src/app/page.tsx` – Dashboard UI.
- `src/app/add/page.tsx` – Single/batch add flows with content-type selection.
- `src/app/review/page.tsx` – Review session UI and progression logic.
- `src/app/library/page.tsx` – List/search/filter/delete mistakes.
- `src/app/calendar/page.tsx` – Calendar view and per-day review details.
- `src/app/settings/page.tsx` – Daily target configuration.
- `src/app/api/` – API routes:
  - `mistakes/route.ts` (list/create with filters), `mistakes/[id]/route.ts` (update review/delete), `mistakes/batch/route.ts` (bulk insert)
  - `dashboard/route.ts` (aggregated stats), `calendar/route.ts` (per-day counts and details)
  - `review-queue/route.ts` (review queue modes), `settings/route.ts` (read/update daily target)
- `src/components/Navigation.tsx` – Top navigation bar.
- `src/lib/` – Shared logic: Supabase client (`database.ts`), spaced repetition (`spaced-repetition.ts`), calendar helpers (`calendar.ts`), user settings fetcher (`settings.ts`), content-type config/guards (`content-type.ts`).
- `migrations/` – SQL for schema changes (content type + last_reviewed_at, user_settings, removal of legacy type).
- `data/` – Local SQLite DB files (likely for testing/offline).
- `scripts/test-*.js` – Node scripts for hitting APIs.

## Data Structure
- `mistakes` table (Supabase):
  - `id` (uuid), `created_at` (timestamptz), `error_sentence` (text), `correct_sentence` (text), `explanation` (text, nullable),
  - `content_type` enum `('mistake','expression')` (default `mistake`),
  - `status` (`unlearned|learned`), `next_review_at` (timestamptz), `review_stage` (int, 0–4), `review_count` (int),
  - `last_reviewed_at` (timestamptz, null when never reviewed).
- `user_settings` table: `id` (uuid), timestamps, `daily_target` int constrained to {30,50,70,100}.
- Spaced repetition: `REVIEW_STAGES = [0,3,7,14,30]` days; `calculateNextReviewDate` advances/resets stage based on correctness using `last_reviewed_at` (or `created_at` fallback) and schedules `next_review_at`.
- Content types: `content-type.ts` defines labels/icons/prompts/placeholders for `mistake` vs `expression` entries and validation helper `isValidContentType`.
