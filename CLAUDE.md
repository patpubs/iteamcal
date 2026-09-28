@AGENTS.md

## iTeamCal project notes

- Read `README.md` for the stack, commands, and product rules.
- Permissions live in the database. Any new table needs RLS policies and a case
  in `supabase/tests/permissions.sql`; run `npm run test:db` before pushing.
- New migrations go in `supabase/migrations/<timestamp>_<name>.sql`. Supabase
  grants EXECUTE on new functions to signed-in users, so revoke it from
  trigger and internal helper functions explicitly.
- Regenerate `src/lib/database.types.ts` after schema changes.
- Calendar days are `date` strings (`YYYY-MM-DD`); never convert them through
  JavaScript `Date` in a way that can shift the day.
- Packages: `npx expo install` can't reach Expo's API from some sandboxes. If it
  fails, read the SDK-compatible version from `expo/bundledNativeModules.json`
  and install that exact version with npm.
