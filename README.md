# ARISE Backend — Express + MongoDB

Plain Node.js/Express backend for the ARISE Flutter app. Same API contract,
same MongoDB models, same route paths as the previous Next.js version — the
Flutter app requires zero changes to point at this instead.

## Setup

npm install
cp .env.example .env      # fill in MONGODB_URI and JWT secrets
npm run seed                # populates Master Library, Asana/Breathwork libraries,
                             # wealth affirmations, quotes, and Challenges
npm run seed:admin          # creates/updates the admin panel login in MongoDB
npm run dev                  # http://localhost:3000, auto-restarts on file change
# or: npm start              # production mode, no auto-restart
```

Generate strong JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Payment environment:

- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are used by the Android Razorpay
  flow.
- `REVENUECAT_ENTITLEMENT_ID` defaults to `premium`.
- `REVENUECAT_SECRET_API_KEY` lets the backend verify iOS purchases against the
  RevenueCat REST API after an in-app purchase.
- `REVENUECAT_WEBHOOK_AUTH` must match the exact Authorization header configured
  in RevenueCat. Point RevenueCat to
  `POST /api/subscription/revenuecat/webhook`.

Admin panel login:

- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are used only by `npm run seed:admin` to
  create/update the MongoDB `Admin` document.
- The admin panel login itself always validates against the database through
  `POST /api/admin/auth/login`.
- Default local admin credentials are `admin` / `12345`.

## Architecture

- **Entry point:** `src/server.js` — Express app, middleware, route mounting, in that order.
- **Auth:** social sign-in creates or reuses an account, then returns a JWT access token
  (15 min) + refresh token (30 days). Protected routes use
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

1. **Push notifications** — `Notification` documents are created but nothing sends
   FCM pushes yet.
2. **Cascade delete** on `DELETE /api/user/settings` (account deletion) — only
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
