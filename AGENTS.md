# Evolution — Codex development instructions

Read `SPEC.md` before implementing anything. Treat it as the product and acceptance specification.
Read `PROJECT_STATE.md` at the start of a new session for the implemented state, deployment, verified checks, and outstanding work. It is a handoff, not a reason to repeat completed implementation. Update it after meaningful changes; never put credentials in it.

## Objective
Build a functional, production-minded MVP of Evolution: a Russian-first PWA for gradually building healthy eating, home fitness, stretching and optional cold-exposure habits. Do not build a mockup-only prototype. Prioritize usable end-to-end flows.

## Stack
- Next.js App Router, TypeScript strict, React, CSS Modules (*.module.css), Lucide React icons
- Supabase Postgres, Auth, Storage; @supabase/ssr
- TanStack Query for server-state; Zustand for limited UI state
- React Hook Form + Zod for forms and validation
- Vitest + Testing Library for unit/component tests; Playwright for E2E
- npm, ESLint, Prettier; deploy to Vercel
- PWA manifest and service worker, without implying full offline support

## Styling requirements (mandatory)
- Use CSS Modules (`*.module.css`) for all component/page styling. Import styles as `styles` and apply via `className={styles.className}`.
- Use a small global `src/app/globals.css` only for resets, base typography, CSS custom properties/design tokens, and universal defaults.
- Do not install or configure Tailwind CSS, shadcn/ui, CSS-in-JS, styled-components, or utility-first styling libraries.
- Build reusable UI primitives (Button, Input, Card, Modal, Tabs, etc.) as React components with adjacent CSS Modules.
- Use CSS variables for colors, spacing, typography, radii and responsive breakpoints; support mobile-first layouts and accessible focus states.
- Prefer semantic CSS class names, avoid inline styles except for genuinely dynamic values, and use `clsx` only when class composition is needed.
- When scaffolding with create-next-app, choose No for Tailwind and ensure generated Tailwind dependencies/configs are absent.

## Architectural constraints
1. API-first: all mobile-relevant functionality must be exposed through versioned `/api/v1/*` Route Handlers, with shared Zod schemas and typed API client. Server Actions are optional for web-only UX, never the sole implementation of core functionality.
2. Separate presentation, domain services, data access, and validation. Keep domain logic framework-independent where practical to support later Capacitor packaging.
3. Use Supabase Auth, server-side authorization and PostgreSQL RLS for all user-owned data. Never expose service-role credentials to client bundles. Check ownership on every write and read.
4. Do not rely on persistent server processes, local filesystem storage, or long-running jobs in Vercel functions. Generate/adapt daily plans idempotently on demand; scheduled reminders can be added later.
5. Use migrations in `supabase/migrations` and seed data for catalog content. Do not require external paid AI APIs for MVP.
6. Respect timezones and local dates for daily plans. Ensure repeat calls do not create duplicate daily tasks.
7. Protect health-related profile fields. Collect only necessary data, keep optional, allow account/data deletion and export path, avoid logging sensitive data.
8. No medical claims, diagnosis, prescriptive calorie restriction, mandatory cold exposure, punitive streaks, or automated escalation after pain, illness or fatigue. Raw-food eating is educational/optional and must include nutrient and food-safety warnings; never auto-push to 100% raw diet.
9. Use accessible, responsive, touch-friendly UI. Russian default, all copy through a localization dictionary designed for future English support.
10. Build with zero-cost development services where feasible; note Vercel Hobby is for non-commercial personal use and pricing/limits must be rechecked before commercial launch.

## Execution protocol
- Inspect repository first; if empty, scaffold app.
- Implement in vertical slices, with working routes and DB migrations, not isolated placeholders.
- After each milestone run lint, typecheck, tests and build; fix errors before proceeding.
- If Supabase credentials are absent, provide `.env.example`, migrations, seed instructions, and a clear setup guide. Build a useful deterministic local demo mode using fixtures without exposing it as real persisted functionality.
- Never claim a feature works without testing it. Report what was verified, what requires credentials, and known limitations.
- Do not add paid dependencies or unnecessary infrastructure.
- Document local setup, Supabase setup, Vercel deployment, PWA behavior and future Capacitor packaging in README.

## Implementation order
1. Scaffold, UI design system, navigation, auth and Supabase integration.
2. Onboarding/profile and migrations/RLS.
3. Content catalogs and 30-day program templates.
4. Daily plan generation, completion, check-in, adaptation.
5. Nutrition, workouts, stretching, progress and history.
6. Admin content CRUD (role restricted), PWA, testing and deployment docs.

When ambiguity is minor, choose a sensible safe default, document it, and continue. Ask only for credentials or decisions that truly block progress.
