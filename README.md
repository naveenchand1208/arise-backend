# ARISE Backend — Express + MongoDB

Plain Node.js/Express backend for the ARISE Flutter app. Same API contract,
same MongoDB models, same route paths as the previous Next.js version — the
Flutter app requires zero changes to point at this instead.

## Setup

```bash
npm install
cp .env.example .env      # fill in MONGODB_URI and JWT secrets
npm run seed                # populates Master Library, Asana/Breathwork libraries,
                             # wealth affirmations, quotes, and Challenges
npm run dev                  # http://localhost:3000, auto-restarts on file change
# or: npm start              # production mode, no auto-restart
```

Generate strong JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Architecture

- **Entry point:** `src/server.js` — Express app, middleware, route mounting, in that order.
- **Auth:** JWT access token (15 min) + refresh token (30 days). Protected routes use
  `requireAuth` middleware (`src/middleware/auth.js`), which checks the token **before**
  any route handler runs — a request with a bad token never touches the database.
- **Error handling:** every route is wrapped in `asyncHandler` (`src/middleware/asyncHandler.js`),
  which forwards thrown errors to a single global `errorHandler` middleware
  (`src/middleware/errorHandler.js`) registered last. This guarantees every response —
  success or failure — is valid JSON in the `{success, data}` / `{success:false, error}`
  shape the Flutter app expects. No route can crash the process or return an empty body.
- **DB:** MongoDB via Mongoose, a simple connection singleton (`src/lib/mongodb.js`) —
  Express is a long-running process, so this doesn't need the hot-reload-safe caching
  pattern a serverless framework requires.
- **Security middleware:** `helmet` (security headers), `cors` (for a future web admin
  panel — mobile doesn't need this but it's harmless to have), `express-rate-limit`
  on auth routes specifically (20 attempts / 15 min / IP).

## Why the route paths are grouped differently than you might expect

Express doesn't require (or benefit from) one-file-per-endpoint the way Next.js's
file-based routing does. Routes are grouped by domain instead — e.g. `belief.routes.js`
exports three small routers (belief, shadow-work, forgiveness) since they're closely
related and small. Check `src/server.js` for the exact mount points; every path matches
the original Next.js version 1:1.

## Not yet wired (same list as the Next.js version — nothing new here)

1. **Email delivery** for password reset — `/api/auth/forgot-password` returns the
   token directly for local testing. Swap for SendGrid/Resend/SES before production.
2. **Push notifications** — `Notification` documents are created but nothing sends
   FCM pushes yet.
3. **Subscription webhooks** — `/api/subscription` PATCH is a stub. Wire it to
   RevenueCat/Stripe webhook verification instead of trusting client input.
4. **Cascade delete** on `DELETE /api/user/settings` (account deletion) — only
   deletes the User document currently; related collections are listed as a TODO
   in that file.

## What's better here than the Next.js version, for the record

- Auth check happens before any DB call on every protected route (Next.js version
  called `connectDB()` first in most routes, wasting a connection attempt on bad tokens).
- Rate limiting and security headers are wired in from the start.
- Error handling is centralized in one middleware instead of requiring every route
  to be individually wrapped.

## API Reference

Identical to the Next.js backend's API reference — see that project's README for the
full endpoint table (all 48 routes: Auth, Onboarding, Dashboard, Rituals, Tasks,
Journal, Belief/Shadow/Forgiveness, Wealth, Energy, Streaks/Challenges, Community,
Library, Search, User, Reports, Subscription). Every path is unchanged.
