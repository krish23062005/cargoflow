# CargoFlow

Fleet tracking, shipment management and route planning for African logistics — built as an 18-episode video series. Multi-tenant (organizations → members → drivers/vehicles), with a live tracking dashboard, driver PWA (works offline), customer portal, and reports.

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language / Styling | TypeScript · Tailwind CSS 4 · shadcn/ui |
| API | tRPC 11 (server + React Query client) |
| ORM / DB | Prisma 7 · PostgreSQL (Neon) |
| Auth | Better Auth (email/password + organization plugin) |
| Maps / Real-time | Leaflet + OpenStreetMap · Server-Sent Events |
| Offline | Hand-rolled service worker + IndexedDB mutation queue |

## Prerequisites

- Node.js 20+
- A PostgreSQL database (this repo targets Neon, but any Postgres works via the Prisma adapter)

## Environment Variables

Create a `.env` in the project root:

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/cargoflow

# Better Auth (used as fallback POD-verify secret when POD_VERIFY_SECRET is unset)
BETTER_AUTH_SECRET=generate-a-long-random-string
BETTER_AUTH_URL=http://localhost:3000

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
OSRM_BASE_URL=https://router.project-osrm.org
POD_VERIFY_SECRET=some-secret
```

## Setup

```bash
npm install
npx prisma generate          # generate the typed client into src/generated/prisma
npx prisma migrate deploy    # apply the SQL migrations (or `db push` on a throwaway DB)
node prisma/seed.js          # optional demo data
npm run dev                  # http://localhost:3000
```

Production build: `npm run build && npm start`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` | Generate SQL for additive schema changes (then apply via `prisma db execute`) |

## Key Flows

- **Organizations & members** — Better Auth organization plugin; roles `owner > admin > dispatcher > viewer`; permission matrix in `src/lib/constants/permissions.ts`; every tenant-scoped query goes through the `orgProcedure` middleware.
- **Shipments & routes** — forward-only status transitions (`PENDING_PICKUP → PICKED_UP → IN_TRANSIT → AT_CHECKPOINT → DELIVERED`), every mutation audit-logged.
- **Live tracking** — driver PWA posts GPS points to `/api/tracking/ingest`; the dashboard subscribes to `/api/sse/tracking`; ETA is computed from route waypoints.
- **Driver PWA** — separate lightweight driver session (phone + PIN). Offline-capable: status actions, issue reports and POD captures are queued in IndexedDB (`src/lib/offline`) and replayed FIFO on reconnect (last-write-wins; 409s are treated as already-applied). App shell + driver GET APIs are cached by `public/driver-sw.js`.
- **Customer portal** — public tracking by tracking number with IP-based anti-scrape rate limiting.
- **Reports** — six aggregation queries behind `report.view` (fleet utilization, delivery performance, driver scorecard, cost analysis, shipment summary).

## Health & Security

- `GET /api/health` — liveness/readiness probe (pings Postgres, returns 200/503).
- Security headers (CSP, `X-Frame-Options: DENY`, etc.) are applied globally in `next.config.ts`; CORS is intentionally same-origin.
- Rate limiting: Better Auth sign-in attempts, tRPC per-IP ceiling, portal per-(IP, tracking) window.

## Deferred Integrations

Email/SMS delivery (Resend, Africa's Talking), object storage (Cloudflare R2), PDF export (Trigger.dev), product analytics (PostHog), error tracking (Sentry), distributed rate limiting (Upstash Redis) — all deferred; code paths exist and log/fall back safely.

## Docs

The full build plan and decision log lives in [`PLAN.md`](./PLAN.md).
