# Evolution — MVP Product and Technical Specification

Version: 1.1 | Language: Russian (i18n-ready) | Platform: Responsive web + installable PWA; future Capacitor apps

## 1. Product mission
A personal daily coach for sustainable lifestyle changes through small achievable steps. Users choose nutrition style (balanced healthy eating, vegetarian, or raw-food exploration), home workouts, stretching, walking, sleep-related habits and optional gentle cold-exposure education. The app adapts the next day's plan based on adherence, perceived difficulty, energy, available time and safety flags. Avoid all-or-nothing challenges.

## 2. MVP user journeys
1. Visitor sees a concise landing page, registers/signs in with Supabase Auth, completes onboarding and gets a personalized 30-day starter program.
2. User opens **Today** and sees 3–6 realistic tasks, grouped by nutrition, activity, stretching, recovery. Can open task details and mark completed/skipped; updates persist.
3. User views a recipe with ingredients, instructions, estimated preparation time and dietary tags, and marks a related food habit complete.
4. User opens a home workout or stretching routine with clear exercise instructions, alternatives, duration/repetitions and timer.
5. At evening check-in, user rates energy, perceived difficulty and optionally pain/illness. Tomorrow's plan adapts conservatively.
6. User sees weekly completion, consistency, total active minutes, self-reported well-being and achievements without shame for missed days.
7. User edits preferences, time budget, goals, timezone and exclusions; future plans reflect them.
8. Content administrator can create/update/deactivate recipes, exercises and program templates through protected admin screens.

## 3. Navigation and screens
- `/` public landing with product explanation and CTA
- `/login`, `/signup`, `/auth/callback`, `/forgot-password`
- `/onboarding` multi-step wizard with progress, back/skip where safe
- `/today` dashboard with daily tasks, progress, quick check-in
- `/program` current 30-day roadmap, week/day overview
- `/nutrition` nutrition plan, recipe list and details
- `/movement` workout and stretching library and routine player
- `/progress` calendar, charts and habit history
- `/coach` deterministic contextual tips and FAQ (no external AI requirement)
- `/settings` profile, preferences, notifications, privacy, data export/delete
- `/admin` protected catalog and template management
- Friendly empty, loading, offline and error states.

Mobile-first bottom navigation, desktop sidebar, WCAG-conscious contrast, keyboard focus, reduced-motion support. Warm calm visual language, avoid medicalized aesthetics and overwhelming gamification. Use custom reusable React UI components styled exclusively with CSS Modules and Lucide React icons. No Tailwind CSS or shadcn/ui. All strings in `src/i18n/ru.ts` (architecture ready for `en.ts`).

## 3.1 Styling and component structure
- All page and component styles use co-located `*.module.css` files, e.g. `src/components/ui/Button/Button.tsx` and `Button.module.css`.
- Keep `src/app/globals.css` minimal: reset, fonts, design tokens and base elements only.
- Use CSS custom properties for consistent light/dark-ready colors, spacing, border radii and typography.
- Mobile-first responsive CSS with accessible hover/focus/disabled states; honor `prefers-reduced-motion`.
- Do not use Tailwind, shadcn/ui, styled-components, emotion or other CSS-in-JS frameworks.
- Example: `import styles from "./Button.module.css";` then `<button className={styles.button}>...</button>`.

## 4. Onboarding data
- Display name (optional), age range (optional), timezone (default detected), time budget (5/10/15/20/30/45 min), preferred task time
- Main goals: eat better, flexibility, strength, energy, consistent routine, walking
- Current diet and desired track: healthy / vegetarian / raw-food exploration
- Food preferences/allergies (optional); no unsafe ingredient recommendations
- Activity level: beginner/intermediate; equipment available: none/mat/chair/bands
- Relevant limitations and exercise exclusions (optional, minimal collection); simple safety acknowledgement
- Optional cold-exposure track must be opt-in and gated behind safety information
- Explicitly state this is general wellness guidance, not individualized medical care.

## 5. Nutrition
- Tracks: balanced healthy eating; gradual vegetarian transition; raw-food exploration (not mandatory exclusively raw).
- 30-day task templates with achievable steps (add vegetables, try legumes, swap one meal, plan shopping, diversify protein sources, etc.).
- Recipe catalog: name, description, servings, prep time, ingredients with quantities, steps, nutrition notes, tags, allergens, image URL (optional), track compatibility.
- Simple daily meal suggestions and shopping list derived from chosen recipes; no calorie counting required for MVP.
- Nutrient cautions: vegetarian B12/iron/protein; raw diets B12, iodine, calcium, iron, vitamin D, protein and energy sufficiency. Food safety: avoid unsafe raw animal products and unsafe sprouts; do not imply all raw foods are safe.
- Do not make clinical claims or recommend supplements/doses automatically.

## 6. Home fitness and stretching
- Catalog with at least 30 initial exercises/routines using authored seed content and optional externally hosted video links (no unlicensed assets).
- Exercise fields: title, category, difficulty, description, step-by-step technique, common mistakes, contraindication notes, reps/duration, rest, easier/harder variants, equipment, optional media.
- Starter programs: gentle beginner, standard beginner, flexibility/mobility, desk break.
- Include rest days and recovery. Progression only when completion and perceived effort permit; pain/illness triggers rest or recommendation to seek professional guidance.
- Routines: exercise list, timers, pause/finish, completion tracking.

## 7. Cold-exposure optional module
- Educational and opt-in only, not part of default daily tasks.
- Never prescribe ice baths, breath-holding, submersion or temperature/time escalation.
- Safety screening and caution for cardiovascular disease, blood pressure issues, pregnancy or other concerns; advise clinician consultation when relevant.
- User can disable it any time. Avoid gamified endurance competitions.

## 8. Plan engine: deterministic MVP
- Program contains 30 ordered days of template tasks; selected track, goals, activity level and time budget determine task selection.
- Generate a day only once for `(user_id, local_date)`; transaction/upsert and unique constraints prevent duplicates.
- Daily task fields: category, title, description, estimated minutes, reference to recipe/exercise/routine, status (pending/completed/skipped), completed_at, source template id.
- Total assigned time should not exceed user budget by more than a small documented tolerance; nutrition behavior tasks may be integrated into existing meals and labelled accordingly.
- Adaptation rules (initial):
  * Low energy, excessive difficulty, pain or illness -> easier/rest/recovery plan; do not escalate.
  * Normal feedback -> maintain load.
  * Repeated easy completion with no warning flags -> small gradual increase in challenge or one new habit; include recovery.
  * Missed days -> resume without punishment; never stack missed tasks.
- Record why adaptation happened in a machine-readable `adaptation_reason` for transparency.
- Check-ins: date, energy 1–5, difficulty 1–5, mood optional, pain/illness flags, notes optional.
- Unit test plan generation, timezone boundaries, idempotency, budget and safety gating.

## 9. Database design (Supabase PostgreSQL)
Use UUID PKs, timestamps with timezone, `user_id` ownership and appropriate unique constraints/indexes. Implement SQL migrations and RLS policies.

Suggested tables:
- `profiles` (id references auth.users, display_name, timezone, role, created_at)
- `user_preferences` (user_id, nutrition_track, goals jsonb, time_budget_minutes, activity_level, equipment jsonb, excluded_exercises jsonb, food_allergies jsonb, cold_opt_in, updated_at)
- `program_templates` (id, slug, title, category, difficulty, duration_days, published)
- `program_template_tasks` (id, program_template_id, day_number, task_type, payload jsonb, estimated_minutes, sort_order)
- `user_programs` (id, user_id, template_id, start_date, status, created_at)
- `daily_plans` (id, user_id, local_date, timezone, adaptation_reason, created_at; unique user_id+local_date)
- `daily_tasks` (id, daily_plan_id, user_id, template_task_id nullable, category, title, description, estimated_minutes, reference_type, reference_id, status, completed_at, sort_order)
- `daily_checkins` (id, user_id, local_date, energy, difficulty, mood, pain_flag, illness_flag, notes; unique user_id+local_date)
- `exercises` (id, slug, title, category, difficulty, instructions jsonb, warnings, media_url, equipment jsonb, active)
- `routines` (id, slug, title, category, difficulty, estimated_minutes, active)
- `routine_exercises` (routine_id, exercise_id, sort_order, reps, seconds, rest_seconds)
- `recipes` (id, slug, title, track_tags jsonb, allergens jsonb, ingredients jsonb, instructions jsonb, servings, prep_minutes, nutrition_notes, image_url, active)
- `user_recipe_favorites` (user_id, recipe_id, created_at)
- `habit_events` (id, user_id, local_date, category, event_type, metadata jsonb)
- `notification_preferences` (user_id, reminders_enabled, preferred_local_time)

Avoid unnecessary duplicate sensitive fields. Keep admin authorization enforced in server handlers and DB policies; do not trust a user-editable role field. User data RLS: user can only select/insert/update/delete own rows, with privileged content management via securely validated server/admin role. Catalog content read-only for authenticated users, admin writes only.

## 10. REST API v1
Implement consistent JSON envelopes and Zod validation, auth, ownership, pagination and error codes.
- `GET /api/v1/me`, `PATCH /api/v1/me`
- `GET /api/v1/preferences`, `PUT /api/v1/preferences`
- `POST /api/v1/onboarding/complete`
- `GET /api/v1/program`, `POST /api/v1/program/start`
- `GET /api/v1/daily-plan?date=YYYY-MM-DD` (idempotent on-demand generation for current day; history read-only)
- `PATCH /api/v1/daily-tasks/:id` (complete/skip/reset)
- `GET /api/v1/checkins?from=&to=`, `PUT /api/v1/checkins/:date`
- `GET /api/v1/recipes`, `GET /api/v1/recipes/:slug`
- `GET /api/v1/exercises`, `GET /api/v1/routines`, `GET /api/v1/routines/:slug`
- `GET /api/v1/progress?from=&to=`
- `GET /api/v1/shopping-list?recipe_ids=...`
- Admin CRUD endpoints for templates, recipes and exercises, properly protected.

Use secure cookie-based Supabase sessions for web; document how mobile clients can later authenticate to the same API with bearer tokens, and implement a server-side token verification strategy before enabling mobile clients. Avoid exposing elevated keys.

## 11. PWA and future mobile
- Valid manifest, installable icons (generate simple original SVG icons), responsive layout, HTTPS on Vercel.
- Service worker for safe static-asset caching and offline fallback. Never cache authenticated API responses or private health data indiscriminately.
- Core features through REST APIs, no reliance on server-rendered HTML or Server Actions from the eventual Capacitor app.
- Document future approach: separate static/mobile web bundle with Capacitor and remote hosted API; Next.js SSR features cannot run inside Capacitor WebView.
- Native push, Health Connect, Apple Health, camera analysis and app-store submission are out of MVP scope.

## 12. Seed content
Provide original Russian copy and realistic starter content:
- 3 nutrition tracks, at least 14 unique nutrition habits/tasks each
- at least 30 exercises and 8 routines, with easier/harder alternatives
- at least 24 balanced/vegetarian/raw-friendly recipes, with clear ingredients and steps
- 30-day starter program template per track, with activity variants and recovery days
- basic educational articles and contextual tips
Avoid scraped/copyrighted text and images; use placeholders or licensed assets only.

## 13. Analytics and progress
- Completion count and completion percentage per week
- Activity minutes based on completed sessions (not unverified exercise claims)
- Days active in a week, personal consistency trends
- Self-reported energy/difficulty trend
- No punitive streak reset; show supportive restart prompts
- Minimal telemetry and privacy-conscious defaults.

## 14. Quality and acceptance criteria
- Registration, login, logout, password reset and authenticated navigation work.
- Onboarding persists preferences and starts a program.
- Today page generates correct personalized tasks and persists completion across refreshes.
- Check-in influences the next generated plan and never increases intensity after pain/illness.
- Recipe and exercise catalog filters work; routine timer can be paused and resumed.
- Progress derives from persisted records, not fabricated mock values.
- A user cannot access or modify another user's records (RLS and API tests).
- Admin-only writes are protected; non-admin cannot modify content.
- Responsive at 375px and desktop; basic keyboard accessibility.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass; Playwright critical journey tests exist.
- `.env.example`, migration/seed instructions and Vercel deployment steps exist.
- If external credentials are unavailable, app starts in an explicitly labelled demo/fixture mode for UI review, with no false claims of persistence.

## 15. Delivery phases
Phase 1: scaffold, visual shell, auth, DB schema, RLS, onboarding.
Phase 2: seed catalogs, program engine, daily tasks and check-ins.
Phase 3: nutrition, routines, stretching, progress.
Phase 4: admin, PWA, tests, documentation, deployment readiness.

Codex should implement the phases sequentially, keeping the application buildable at each phase. At completion provide a concise summary of implemented features, file tree, exact setup commands, tests run, missing credentials, and deferred features.
