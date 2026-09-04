# Burnview Group Farm App

Real build of the Burnview Group farm management app: Next.js (App Router) + Prisma + Postgres, deployed to Vercel.

Covers Farm (map, field activities, edit fields), Food (wedge, pasture walk data entry), and Stocks (feed, land inputs), all backed by a real database with named-user login. Cattle and Feeding are placeholders, same as the prototype — not built yet.

## Local setup

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — a Postgres connection string (see below).
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
2. Install dependencies:
   ```
   npm install
   ```
3. Create the database tables:
   ```
   npm run db:migrate
   ```
4. Seed real farms/paddocks, fertilizer types, feed stock items, and a first login:
   ```
   npm run db:seed
   ```
   This creates a user `craig` / `burnview2026` (override with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` env vars before seeding). Change the password once you're in, via Settings > Users (add yourself a new account and stop using the seed one, or ask to add a password-change flow).
5. Run the dev server:
   ```
   npm run dev
   ```

## Database

Any Postgres works — [Neon](https://neon.tech) (free tier, no card) is the easiest to start with:

1. Sign up, create a project.
2. Copy the connection string from the dashboard into `DATABASE_URL`.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the same two environment variables (`DATABASE_URL`, `NEXTAUTH_SECRET`) in the Vercel project settings, plus `NEXTAUTH_URL` set to your production URL (e.g. `https://burnview.vercel.app`).
4. Deploy. Run `npm run db:deploy` (applies migrations) once against the production database before first use, then `npm run db:seed` once to create farms/paddocks/fertilizer types/first login.

## What's real vs. placeholder

Per the handoff spec, carried into this build:

- Farm/paddock codes are real.
- Every paddock defaults to "Rye grass" classification (per Craig: all paddocks entered so far are irrigated ryegrass camps).
- Feed stock items exist but start at 0 — log a real Restock to set opening balances.
- Fertilizer N/P/K/S percentages are **generic placeholders**, flagged as such in Settings > Fertilizer nutrients — replace with real bag/spec-sheet numbers there.
- Paddock size (ha) is unset for everything — fill in via Farm > Edit fields.
- The wedge screen now computes cover/growth from **real pasture-walk entries** you enter — there's no synthetic per-paddock data. A paddock shows "no data" until its first walk is logged. "DM Produced" and "Avg Residual" from the old mockup were dropped rather than faked — they need real grazing/herd data (Cattle module) to mean anything.
- Herd map markers from the prototype were removed — they were illustrative placeholders with no real data behind them. They'll come back once the Cattle module exists.

## Still needed (from the original handoff)

- Cattle module (herds, movements) — placeholder screen only.
- Feeding module — placeholder screen only.
- Real paddock GPS boundaries (map still uses generated placeholder tile shapes).
- Offline support for pasture walks / field activities logged without signal.
