# ARISE Production Seed Package

This package contains original system/admin content for the ARISE app. It is safe to load into a fresh production database because it only targets content collections used by the app and admin console.

## Included Collections

- `masters`
- `asanas`
- `breathwork`
- `affirmations`
- `quotes`
- `challenges`

## Excluded Collections

The seed system intentionally does not create users, journal entries, tasks, priorities, belief scores, ritual logs, energy logs, wealth goals, streaks, challenge progress, community posts, payments, subscriptions, deletion records, audit logs, admin accounts, or security records.

## Commands

From `arise-backend`:

```bash
npm run seed:validate
npm run seed:export
npm run seed
```

The DB runner is idempotent by `slug`. Existing records are skipped by default so admin-edited content is not overwritten. To refresh existing system seed records from this package, run with `SEED_UPDATE_EXISTING=true`.

## Production Checklist

1. Back up the MongoDB database.
2. Confirm `MONGODB_URI` points to the intended environment.
3. Run `npm run seed:validate`.
4. Run `npm run seed`.
5. Verify app endpoints such as `/api/challenges`, `/api/library/quotes/daily`, `/api/library/masters`, and `/api/library/affirmations`.
