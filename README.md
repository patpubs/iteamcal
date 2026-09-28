# iTeamCal

Schedules, time off, and timecards for the team. One Expo codebase runs as a
web app (hosted on Vercel) and, later, as iOS and Android apps. Data, sign-in,
and permissions live in Supabase.

## Stack

- **App:** Expo + Expo Router (React Native, TypeScript), `src/app` holds the screens
- **Data:** `@supabase/supabase-js` with TanStack Query
- **Database:** Supabase Postgres. Every permission rule is enforced with
  row-level security and database functions in `supabase/migrations`
- **Hosting:** Vercel for the web build (`vercel.json`), EAS for app stores

## Getting started

```bash
npm install
npm run web        # start the web app
npm run typecheck
npm run lint
npm test           # unit tests
npm run test:db    # schema + permission tests against a local Postgres
```

`npm run test:db` rebuilds a scratch database from the migrations using a
small stand-in for Supabase's auth schema (`supabase/tests/supabase_stub.sql`),
then runs `supabase/tests/permissions.sql`. Point it at Postgres with the usual
`PGHOST`, `PGPORT`, `PGUSER` variables.

## Configuration

`.env` holds the Supabase project URL and publishable key. Both are public by
design; the database's security rules protect the data.

## Product rules

The functional spec is the "Command Board — Functional PRD" from the old app.
Decisions that differ from the old app:

- Times and "today" use the workspace timezone (America/Chicago)
- One sign-in account per crew member
- Staff see that a coworker is off, not the type or reason
- Crew are archived rather than deleted; archiving unlinks their account
- Timecards: same-day shifts, one lunch, no future dates; accounts whose crew
  member is marked "no timecards" can't add them
- Manager edits to someone else's timecard are audited and notify the owner
