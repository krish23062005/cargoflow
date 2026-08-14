# CargoFlow — Master Implementation Plan

> **Single source of truth** for the entire CargoFlow build.
> Every episode, every task, every decision — documented here.
> Updated as we progress. Check boxes as we go.

---

## Architectural Decisions (Locked In)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Org onboarding | **Separate step** — signup → "Create or Join Org" screen | Mirrors real B2B flow; fleet owner creates, invites team |
| 2 | Driver identity | **Hybrid** — lightweight records that upgrade to full users | African drivers may lack email; phone + PIN first, upgrade later |
| 3 | Tracking intervals | **Smart/adaptive** — 10s moving, 60s stopped, 5s near waypoints | Saves bandwidth + battery (data is expensive in Africa) |
| 4 | Tenant URL structure | **Session-based** — org stored in session, switchable via dropdown | Simplest with Vercel; subdomains can be a premium feature later |
| 5 | Landing page | **Marketing + app** — `/` is marketing, `/dashboard` is the app | Showcases the product; great for the YouTube series |
| 6 | Offline strategy | **Workbox** — but deferred to Phase 5 (build online-first first) | Production-grade offline; no point building before the PWA exists |
| 7 | Build order | **Foundation → Assets → Operations → Engagement → Intelligence** | Dependency-ordered; each phase unlocks the next |

---

## Tech Stack Reference

| Concern | Technology | Version |
|---------|------------|---------|
| Framework | Next.js (App Router) | 16.2.6 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui | 4.x |
| API | tRPC | 11.17 |
| Data Fetching | TanStack Query | 5.x |
| Forms | React Hook Form + Zod | 7.x / 4.x |
| ORM | Prisma | 7.8 |
| Database | PostgreSQL (Neon) | — |
| Auth | Better Auth | 1.6.x |
| Maps | Leaflet + OpenStreetMap | — |
| Real-time | Server-Sent Events | — |
| Storage | Cloudflare R2 | — |
| Email | Resend | 6.x |
| Background Jobs | Trigger.dev | — |
| Analytics | PostHog | — |
| Deployment | Vercel | — |

---

## Phase 1: Foundation (Episodes 1–3)

### Episode 1 — Multi-Tenant Organizations

**Business Problem:** Every piece of data in CargoFlow belongs to an organization. Without multi-tenancy, there's no data isolation, no team collaboration, no billing boundary.

**Tasks:**
- [x] Rebrand "Codewave" → "CargoFlow" (metadata, env vars, email templates, layout)
- [x] Install & configure Better Auth `organization` plugin
- [x] Update Prisma schema with Organization, Member, Invitation models
- [x] Run `db:push` to apply schema changes
- [x] Create org-scoped tRPC middleware (`orgProcedure`) that injects `organizationId` into context
- [x] Build "Create Organization" page (`/onboarding/create-org`)
  - Form fields: name, slug, country, currency, timezone, industry
  - Country/currency/timezone dropdowns populated with African countries
- [x] Build "Join Organization" flow (accept invitation via link)
- [x] Build organization settings page (`/settings/organization`)
  - Edit name, logo, country, currency
  - Danger zone: delete organization
- [x] Build org switcher component (dropdown in sidebar/topbar)
- [x] Add `activeOrganizationId` to session context
- [x] Write Zod validators: `createOrgSchema`, `updateOrgSchema`
- [x] Add African countries constant file (`src/lib/constants/countries.ts`)
  - Countries, currencies (NGN, KES, GHS, ZAR, etc.), timezones

**Key Files:**
```
src/lib/auth.ts                          — add organization plugin
src/lib/constants/countries.ts           — NEW
src/lib/validators/organization.ts       — NEW
src/server/organization.ts               — NEW
src/trpc/routers/organization.router.ts  — NEW
src/trpc/init.ts                         — add orgProcedure
src/app/(dashboard)/layout.tsx           — NEW (placeholder shell)
src/app/(dashboard)/settings/organization/page.tsx — NEW
src/app/onboarding/create-org/page.tsx   — NEW
src/components/shared/org-switcher.tsx   — NEW
prisma/schema.prisma                     — add org models
```

---

### Episode 2 — RBAC + Audit Logs

**Business Problem:** A dispatcher shouldn't delete vehicles. A viewer shouldn't invite members. A driver should only see their own assignments. Without RBAC, everyone can do everything — that's a security nightmare for logistics companies handling valuable cargo.

**Tasks:**
- [x] Define role hierarchy: `owner` > `admin` > `dispatcher` > `viewer` > `driver`
- [x] Define permission matrix (mirrored in `src/lib/constants/permissions.ts`)

| Permission | Owner | Admin | Dispatcher | Viewer | Driver |
|------------|-------|-------|------------|--------|--------|
| Manage org settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage fleet | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage drivers | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create shipments | ✅ | ✅ | ✅ | ❌ | ❌ |
| View shipments | ✅ | ✅ | ✅ | ✅ | Own only |
| Update shipment status | ✅ | ✅ | ✅ | ❌ | Own only |
| View tracking | ✅ | ✅ | ✅ | ✅ | Own only |
| View reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |

- [x] Create RBAC middleware for tRPC (`requireRole`, `requirePermission`)
- [x] Create `AuditLog` Prisma model
- [x] Create audit logging service (`src/server/audit.ts`)
- [x] Create audited tRPC middleware that auto-logs mutations (`auditedProcedure`)
- [x] Build member management page (`/settings/members`)
  - List members with roles
  - Invite new members (email invitation)
  - Change member roles
  - Remove members
- [x] Build audit log viewer (`/settings/audit-log`)
  - Filterable table: who, what, when
  - Pagination
- [x] Write Zod validators: `inviteMemberSchema`, `updateRoleSchema`
- [x] `db:push` for `AuditLog` table

**Key Files:**
```
src/lib/constants/permissions.ts             — NEW
src/lib/validators/member.ts                 — NEW
src/server/audit.ts                          — NEW
src/server/member.ts                         — NEW
src/trpc/routers/member.router.ts            — NEW
src/trpc/routers/audit.router.ts             — NEW
src/trpc/init.ts                             — add requireRole middleware
src/app/(dashboard)/settings/members/page.tsx     — NEW
src/app/(dashboard)/settings/audit-log/page.tsx   — NEW
src/components/shared/data-table.tsx          — NEW (reusable)
prisma/schema.prisma                         — add AuditLog model
```

---

### Episode 3 — Dashboard Shell + Landing Page

**Business Problem:** Users need a professional, intuitive interface to navigate the platform. The landing page sells the product; the dashboard shell is where they live every day.

**Tasks:**
- [x] Build marketing landing page at `/`
  - Hero section with value proposition
  - Features grid (fleet tracking, shipments, driver management, etc.)
  - Testimonial/social proof section
  - CTA → sign up
  - Responsive, animated, dark-themed
- [x] Build dashboard layout (`/dashboard`)
  - Collapsible sidebar with navigation
  - Top bar with: org switcher, search, notifications bell, user avatar menu
  - Breadcrumbs
  - Mobile-responsive (sidebar becomes sheet on mobile)
- [x] Build dashboard home page
  - KPI stat cards (total vehicles, active shipments, drivers online, deliveries today)
  - Empty states with onboarding checklist ("Add your first vehicle", "Invite your team", etc.)
  - Recent activity feed (from audit logs)
- [x] Implement dark/light mode with `next-themes`
- [x] Add page metadata (title, description) for all existing pages

**Key Files:**
```
src/app/(marketing)/layout.tsx               — NEW
src/app/(marketing)/page.tsx                 — NEW (landing page)
src/app/(dashboard)/layout.tsx               — UPDATE (full shell)
src/app/(dashboard)/dashboard/page.tsx       — NEW
src/components/layout/sidebar.tsx            — NEW
src/components/layout/topbar.tsx             — NEW
src/components/layout/mobile-nav.tsx         — NEW
src/components/shared/stat-card.tsx          — NEW
src/components/shared/empty-state.tsx        — NEW
src/components/shared/onboarding-checklist.tsx — NEW
```

---

## Phase 2: Core Assets (Episodes 4–6)

### Episode 4 — Fleet Management (Vehicles)

**Business Problem:** A logistics company's vehicles are its primary revenue-generating assets. You need to know what you have, what condition it's in, and where it is before you can assign it to haul cargo.

**Tasks:**
- [x] Create `Vehicle` Prisma model (plate number, make, model, year, type, status, fuel capacity, service dates, insurance info)
- [x] Define vehicle types enum: `TRUCK`, `VAN`, `PICKUP`, `MOTORCYCLE`, `TRAILER`, `TANKER`
- [x] Define vehicle statuses: `AVAILABLE`, `IN_TRANSIT`, `MAINTENANCE`, `DECOMMISSIONED`
- [x] Build fleet CRUD tRPC procedures (create, list, get, update, archive) — all writes require `fleet.manage`, all audited
- [x] Build vehicle list page (`/fleet`)
  - Data table with search, filter by status/type, sort, pagination
  - Quick status indicators (green = available, blue = in transit, amber = maintenance)
- [x] Build add vehicle form (`/fleet/new`)
  - Single form with sections (details, fuel & maintenance, notes)
  - Plate number uniqueness validation (within org) → friendly CONFLICT error
  - ~~Upload vehicle photo~~ deferred to R2 storage episode
- [x] Build vehicle detail page (`/fleet/[vehicleId]`)
  - Vehicle info, fuel, maintenance, insurance cards
  - Quick status change + edit dialog + archive (decommission)
  - Service history = service-date fields (assignment/tracking history placeholder)
- [x] Write Zod validators: `createVehicleSchema`, `updateVehicleSchema`
- [x] Add fleet stats to dashboard KPIs (total vehicles via `fleet.summary`)

**Key Files:**
```
prisma/schema.prisma                         — add Vehicle model
src/lib/validators/vehicle.ts                — NEW
src/lib/constants/vehicles.ts                — NEW (types, statuses, fuel — supersedes vehicle-types.ts)
src/trpc/routers/fleet.router.ts             — NEW (+ `fleet.view` permission added to matrix)
src/app/(dashboard)/fleet/page.tsx           — NEW
src/app/(dashboard)/fleet/new/page.tsx       — NEW
src/app/(dashboard)/fleet/[vehicleId]/page.tsx — NEW
src/components/fleet/fleet-list.tsx          — NEW
src/components/fleet/vehicle-form.tsx        — NEW
src/components/fleet/vehicle-detail.tsx      — NEW
src/components/fleet/vehicle-edit-dialog.tsx — NEW
src/components/shared/vehicle-status-badge.tsx — NEW
```

**Note:** `auditedProcedure` now accepts a `permission` option and enforces it — every fleet/member mutation requires its permission at the middleware layer (viewer → FORBIDDEN).

---

### Episode 5 — Driver Management

**Business Problem:** Drivers are the human layer of logistics. You need to track their license status, availability, assignment history, and — in the African context — their phone number (primary contact) and next of kin (safety compliance).

**Tasks:**
- [x] Create `Driver` Prisma model (name, phone, license number, license expiry, status, emergency contact, blood type, next of kin)
- [x] Define driver statuses: `AVAILABLE`, `ASSIGNED`, `ON_TRIP`, `OFF_DUTY`, `SUSPENDED`
- [x] Build driver CRUD tRPC procedures
- [x] Build driver list page (`/drivers`)
  - Data table with search, filter by status, sort
  - License expiry warnings (yellow < 30 days, red = expired)
- [x] Build add driver form (`/drivers/new`)
  - Phone number validation (African formats: +234, +254, +233, +27, etc.)
  - License expiry date picker
  - ~~Upload driver photo + license photo (R2)~~ deferred to R2 storage episode
- [x] Build driver detail page (`/drivers/[driverId]`)
  - Driver profile card
  - Trip history (placeholder)
  - Performance metrics (placeholder)
- [x] Write Zod validators: `createDriverSchema`, `updateDriverSchema`
- [x] Add driver stats to dashboard KPIs

**Key Files:**
```
prisma/schema.prisma                           — add Driver model
src/lib/validators/driver.ts                   — NEW
src/trpc/routers/driver.router.ts              — NEW
src/app/(dashboard)/drivers/page.tsx           — NEW
src/app/(dashboard)/drivers/new/page.tsx       — NEW
src/app/(dashboard)/drivers/[driverId]/page.tsx — NEW
src/components/drivers/driver-form.tsx         — NEW
src/components/drivers/driver-detail.tsx       — NEW
src/components/shared/driver-status-badge.tsx  — NEW
```

---

### Episode 6 — Vehicle–Driver Assignment

**Business Problem:** A vehicle without a driver doesn't move. A driver without a vehicle can't deliver. Assignment management tracks who's driving what, prevents double-booking, and creates accountability.

**Tasks:**
- [x] Create `VehicleAssignment` Prisma model (vehicleId, driverId, startDate, endDate, status)
- [x] Build assignment logic:
  - Cannot assign a driver who's already assigned to another active vehicle
  - Cannot assign a vehicle that already has an active driver
  - End previous assignment before starting a new one
- [x] Build assignment tRPC procedures (assign, unassign, list history)
- [x] Add assignment UI to vehicle detail page (assign/unassign driver)
- [x] Add assignment UI to driver detail page (assign/unassign vehicle)
- [x] Build "Assign Driver" dialog with searchable driver dropdown
- [x] Update vehicle status automatically on assignment (AVAILABLE → IN_USE)
- [x] Update driver status automatically on assignment (AVAILABLE → ASSIGNED)
- [x] Write Zod validators: `assignDriverSchema`

**Key Files:**
```
prisma/schema.prisma                            — add VehicleAssignment model
src/lib/validators/assignment.ts                — NEW
src/trpc/routers/assignment.router.ts           — NEW (assign/unassign/list + active queries, all audited)
src/components/assignment/assignment-panel.tsx  — NEW (reusable active-assignment card)
src/components/assignment/assign-candidates.tsx — NEW (searchable assign dialog)
```
Note: applied via a hand-applied additive `migrate diff` (no data loss); `db push`/`migrate dev` are blocked by Prisma's AI-agent guard on the demo DB.

---

## Phase 3: Operations (Episodes 7–10)

### Episode 7 — Shipment Management

**Business Problem:** Shipments are the core business object — cargo moving from point A to point B. Every logistics company needs to create, track, and manage shipments with full audit trails.

**Tasks:**
- [x] Create `Shipment` Prisma model (tracking number, origin, destination, cargo details, weight, value, customer info, status, assigned assignment link, timestamps)
- [x] Create `ShipmentEvent` Prisma model (shipmentId, event type, description, location, lat/lng, userId)
- [x] Auto-generate unique tracking numbers (`CF-NG-YYYYMMDD-XXXX`)
- [x] Shipment statuses: `PENDING_PICKUP` → `PICKED_UP` → `IN_TRANSIT` → `AT_CHECKPOINT` → `DELIVERED`, plus `CANCELLED`/`RETURNED` (forward-only moves enforced; delivery stamps `actualDeliveredAt`)
- [x] Build shipment tRPC procedures (create, update, list, get, summary, updateStatus, assign, addEvent) — all writes audited
- [x] Build shipment list page (`/shipments`)
  - Data table with search + status filter
  - Shows tracking number, customer, route, assigned driver/vehicle, status
- [x] Build create shipment form (`/shipments/new`)
  - Cargo details (type, weight, dimensions, value, description)
  - Customer info (name, phone, email)
  - ~~Map picker (Leaflet)~~ → deferred: lat/lng fields exist on the model, Leaflet map lands with Episode 8 route planning
  - Assign vehicle + driver (via a dialog linking an active assignment)
- [x] Build shipment detail page (`/shipments/[shipmentId]`)
  - Status timeline (event log), status-transition control, "log event" dialog
  - Cargo, route, schedule, customer, assignment cards + edit dialog
- [x] Write Zod validators: `createShipmentSchema`, `updateShipmentSchema`, `updateShipmentStatusSchema`, `assignShipmentSchema`, `addShipmentEventSchema`

**Key Files:**
```
prisma/schema.prisma                               — add Shipment, ShipmentEvent
src/lib/validators/shipment.ts                     — NEW
src/lib/utils/tracking-number.ts                   — NEW
src/lib/constants/shipments.ts                     — NEW (statuses, cargo types, event types, transition map)
src/trpc/routers/shipment.router.ts                — NEW
src/app/(dashboard)/shipments/page.tsx             — NEW
src/app/(dashboard)/shipments/new/page.tsx         — NEW
src/app/(dashboard)/shipments/[shipmentId]/page.tsx — NEW
src/components/shipments/shipment-form.tsx          — NEW (create + edit)
src/components/shipments/shipment-list.tsx          — NEW
src/components/shipments/shipment-detail.tsx        — NEW
src/components/shipments/status-timeline.tsx        — NEW
src/components/shared/shipment-status-badge.tsx     — NEW
```
Note: applied via a hand-applied additive `migrate diff` (no data loss). Schema now has **no DRAFT** status — first status after create is `PENDING_PICKUP`. Map picker deferred to Episode 8.

---

### Episode 8 — Route Planning

**Business Problem:** Africa's road networks are complex — a Lagos to Douala route might have 4 border crossings, multiple fuel stops, and known danger zones. Route planning helps set realistic ETAs and plan waypoints.

**Tasks:**
- [x] Create `Route` Prisma model (name, waypoints as JSON, total distance, estimated duration, notes)
- [x] Create `Waypoint` structure (lat, lng, name, type: `PICKUP`, `DROPOFF`, `FUEL_STOP`, `REST_STOP`, `BORDER_CROSSING`, `CHECKPOINT`)
- [x] Build route planning page (`/routes`)
  - Interactive Leaflet map for drawing routes
  - Add/remove/reorder waypoints
  - Save routes as templates (reuse for recurring routes)
- [x] Integrate OSRM (Open Source Routing Machine) for route calculation
  - Distance calculation
  - Estimated travel time
  - Turn-by-turn directions (basic)
- [x] Link routes to shipments (optional: auto-suggest route based on origin/destination)
- [x] Build route detail page with map view
- [x] Write Zod validators: `createRouteSchema`, `waypointSchema`
- [x] Add Leaflet map picker + route-template select to the shipment form (the deferred Episode 7 piece)

**Key Files:**
```
prisma/schema.prisma                            — add Route model
src/lib/validators/route.ts                     — NEW
src/server/route.ts                             — NEW
src/trpc/routers/route.router.ts                — NEW
src/app/(dashboard)/routes/page.tsx             — NEW
src/app/(dashboard)/routes/new/page.tsx         — NEW
src/app/(dashboard)/routes/[routeId]/page.tsx   — NEW
src/components/tracking/route-map.tsx           — NEW
src/components/tracking/waypoint-list.tsx       — NEW
src/components/shipments/shipment-map-picker.tsx — NEW (map picker)
```
Note: applied via a hand-applied additive `migrate diff` (no data loss), matching the Episode 6/7 workflow. Shipment `create`/`update` now accept `routeId` and keep `Shipment.routeId` ↔ `Route.shipmentId` bidirectional link in sync (unlink clears both); `route.linkShipment` does the same. Link enforcement: a route serves one shipment only (CONFLICT on double link).

---

### Episode 9 — Live GPS Tracking + SSE

**Business Problem:** "Where is my truck?" is the #1 question every fleet owner asks. Real-time tracking replaces phone calls with a live dashboard, reduces theft, and provides evidence for insurance claims.

**Tasks:**
- [x] Create `TrackingPoint` Prisma model (vehicleId, lat, lng, speed, heading, accuracy, timestamp, source)
- [x] Build SSE endpoint (`/api/sse/tracking`)
  - Streams vehicle position updates for an organization
  - Heartbeat every 30 seconds
  - Auto-reconnect on client
- [x] Build tracking ingestion endpoint (POST from driver PWA)
  - Accept batch location updates
  - Validate + store in DB
  - Broadcast via SSE to dashboard viewers
- [x] Build live tracking page (`/tracking`)
  - Full-screen Leaflet map
  - Vehicle markers with direction arrows
  - Click marker → vehicle info popup (speed, driver, last update)
  - Filter by vehicle status
  - Auto-center on fleet
- [x] Build `useSSE` hook for real-time updates
- [x] Smart interval logic:
  - Moving (speed > 5 km/h): report every 10 seconds
  - Stopped: report every 60 seconds
  - Near waypoint (< 500m): report every 5 seconds
- [x] Write Zod validators: `trackingPointSchema`, `batchTrackingSchema`

**Key Files:**
```
prisma/schema.prisma                             — add TrackingPoint
src/lib/validators/tracking.ts                   — NEW
src/server/tracking.ts                           — NEW
src/trpc/routers/tracking.router.ts              — NEW
src/app/api/sse/tracking/route.ts                — NEW
src/app/api/tracking/ingest/route.ts             — NEW
src/app/(dashboard)/tracking/page.tsx            — NEW
src/components/tracking/live-map.tsx              — NEW
src/components/tracking/vehicle-marker.tsx        — NEW
src/hooks/use-sse.ts                             — NEW
```
Note: applied via the hand-applied `migrate diff` workflow (TrackingPoint table + 3 indexes + 2 FKs applied to Neon with a raw-SQL helper; `prisma generate` regenerated the client, which required an npm dev-server restart since module-level PrismaClient delegates don't hot-reload). Runtime-verified: ingest POST stores batches & returns the org snapshot; SSE `/api/sse/tracking` sends `retry` + initial `positions` burst + live pushes on ingest (heartbeat every 30s); `tracking.live`/`tracking.history` return 200. `useSSE` reconnection fixed so `reconnect()` actually tears down and re-creates the EventSource (`tick` wired into the effect deps).

---

---

### Episode 10 — ETA Prediction

**Business Problem:** "When will it arrive?" is the #2 question. Accurate ETAs build customer trust, enable warehouse planning, and reduce "where is my cargo" support calls.

**Tasks:**
- [x] Build ETA calculation service
  - Simple: distance remaining ÷ average speed
  - Better: factor in time of day, historical trip data, remaining waypoints
  - Account for known delay zones (border crossings, checkpoints)
- [x] Create ETA update logic (recalculate on every tracking point)
- [x] Display ETA on:
  - Shipment detail page
  - Live tracking map popups
  - Customer portal (Episode 12 — built with the portal)
- [x] Build ETA history (track predicted vs. actual for accuracy improvement)
- [x] Add "delayed" notifications when ETA exceeds threshold

**Key Files:**
```
src/server/eta.ts                                — NEW
src/lib/utils/eta-calculator.ts                  — NEW
```

---

## Phase 4: Engagement (Episodes 11–14)

### Episode 11 — Notifications

**Business Problem:** Stakeholders need proactive alerts — shipment picked up, vehicle enters geofence, delivery completed, driver's license expiring. Without notifications, users must constantly check the dashboard.

**Tasks:**
- [x] Create `Notification` Prisma model (userId, organizationId, type, title, body, read, link, channel, createdAt)
- [x] Define notification types:
  - `SHIPMENT_STATUS_CHANGE`
  - `VEHICLE_ALERT` (geofence, speeding, idle)
  - `DRIVER_ALERT` (license expiry, assignment)
  - `SYSTEM` (invitation, role change)
- [x] Build notification service with multi-channel delivery:
  - In-app (always)
  - Email via Resend (configurable per type — opt-in toggle; delivery is a logged placeholder until Resend is configured)
  - SMS via Africa's Talking or Twilio (future — placeholder)
- [x] Build notification bell + dropdown in topbar
  - Unread count badge
  - Mark as read
  - "Mark all as read"
  - Link to relevant page
- [x] Build notification preferences page (`/settings/notifications`)
- [ ] Integrate with Trigger.dev for async notification delivery (deferred — in-app delivery is synchronous; Trigger.dev lands with background jobs in a later phase)
- [x] Write Zod validators: `notificationPreferencesSchema`

**Key Files:**
```
prisma/schema.prisma                                — add Notification, NotificationPreference
src/lib/constants/notifications.ts                  — NEW (types → preference categories + meta)
src/lib/validators/notification.ts                  — NEW
src/server/notification.ts                          — NEW (notify, notifyByPermission, prefs upsert)
src/trpc/routers/notification.router.ts             — NEW
src/app/(dashboard)/settings/notifications/page.tsx — NEW
src/components/layout/notification-bell.tsx          — NEW
src/components/notifications/notification-preferences-form.tsx — NEW
```
Note: applied via the hand-applied additive `migrate diff` workflow (Notification + NotificationPreference tables + indexes + FKs applied to Neon; `prisma generate` regenerated the client). Business events are wired: shipment `updateStatus` → `SHIPMENT_STATUS_CHANGE` to every member with `shipment.view` (actor excluded), ETA delay in `recomputeEtasForVehicles` → `VEHICLE_ALERT` (deduped 30 min per alert title so ingest pings don't flood the bell), driver create/update with expiring/expired licence → `DRIVER_ALERT`, member invite → `SYSTEM`. Runtime-verified: unread count/list/markAllRead/markRead/preferences all 200; status change created a notification for viewer ngozi; ingest delay broadcast "running late" alerts; repeated ingest added no duplicates.

---

### Episode 12 — Customer Portal

**Business Problem:** Customers want to track their shipments without calling the logistics company. A public tracking page reduces support calls, builds trust, and is a competitive differentiator.

**Tasks:**
- [x] Build public tracking page (`/portal/[trackingNumber]`)
  - No authentication required
  - Shows: shipment status, origin/destination, current location on map, ETA, event timeline
  - Branded with the organization's logo/colors
- [x] Build tracking number search page (`/portal`)
  - Enter tracking number → redirect to tracking page
- [x] Generate shareable tracking link + QR code
- [x] Rate-limit the portal endpoints (prevent scraping)
- [x] Send tracking link to customer via email/SMS on shipment creation

**Key Files:**
```
src/app/portal/page.tsx                          — NEW (search page)
src/app/portal/[trackingNumber]/page.tsx         — NEW (tracking page)
src/app/api/portal/[trackingNumber]/route.ts     — NEW (rate-limited public API)
src/server/portal.ts                             — NEW (aggregation + portal URL)
src/server/rate-limit.ts                         — NEW (in-memory fixed-window limiter)
src/components/portal/tracking-view.tsx          — NEW
src/components/portal/tracking-map.tsx           — NEW
src/components/portal/tracking-timeline.tsx      — NEW
src/components/portal/portal-search.tsx          — NEW
```
Note: the portal is fully public — no auth. `/portal/[trackingNumber]` renders a server-side snapshot (`getPortalData`: org branding, shipment + route waypoints/geometry, latest position + vehicle/driver, ETA reusing `getShipmentEta`, event trail) then a client view polls `/api/portal/[trackingNumber]` every 30s to stay live. The API is rate-limited per (IP, tracking number) at 60 req / 10 min with `Retry-After` (429) — verified by hammering it. Share card shows a server-generated QR (via the `qrcode` package) + copyable link; `shipment.create` fires an email/SMS placeholder with the tracking link (Resend/Africa's Talking still deferred, mirrors the notification service pattern). Runtime-verified: search page 200, tracking page 200 (branding/status/map/ETA/timeline/QR in HTML), API 200 with full payload, unknown tracking number → 404 (page falls back to search), creation logged `[tracking-link:email|sms]`.

---

### Episode 13 — Driver PWA

**Business Problem:** Drivers are the eyes and hands in the field. They need a mobile-first app to update shipment status, navigate routes, and capture proof of delivery — even with spotty internet.

**Tasks:**
- [x] Build driver-specific layout (`/driver/layout.tsx`)
  - Simplified mobile-first UI
  - Bottom navigation bar
  - Large touch targets (drivers may have gloves or rough hands)
- [x] Build driver login (phone + PIN, or link sent via SMS)
- [x] Build driver home screen
  - Current assignment (vehicle + shipment)
  - Active route with map
  - Quick action buttons: "Start Trip", "Arrived", "Departed", "Issue"
- [x] Build driver navigation view
  - Leaflet map with route overlay
  - Next waypoint info
  - ETA display
- [x] Set up PWA manifest + service worker (basic)
- [x] Background location reporting (using Geolocation API)
- [x] Register as installable PWA (manifest.json, icons)

**Key Files:**
```
prisma/schema.prisma                             — add pin to Driver
src/lib/pin.ts                                   — NEW (scrypt PIN hash + verify)
src/server/driver.ts                             — NEW (driver session, context, login verify, status advance, events, trips)
src/app/driver/layout.tsx                        — NEW (mobile shell + PWA metadata/SW)
src/app/driver/page.tsx                          — NEW (home)
src/app/driver/navigate/page.tsx                 — NEW (route nav view)
src/app/driver/history/page.tsx                  — NEW (trip history)
src/app/driver/login/page.tsx                    — NEW
src/app/api/driver/login|logout|context|actions|pin|trips/route.ts — NEW
public/driver-manifest.json                      — NEW
public/driver-sw.js                              — NEW (basic service worker)
public/driver-icons/icon-{192,512}.png           — NEW (generated)
src/components/driver/bottom-nav.tsx             — NEW
src/components/driver/login-form.tsx             — NEW
src/components/driver/driver-app.tsx             — NEW (home)
src/components/driver/navigate-view.tsx          — NEW
src/components/driver/driver-map.tsx             — NEW
src/components/driver/trip-history.tsx           — NEW
src/components/driver/eta.tsx                    — NEW
src/components/driver/use-driver-tracking.ts     — NEW (GPS reporting hook)
src/components/driver/register-sw.tsx            — NEW
```
Note: drivers authenticate with phone + PIN (hybrid identity, per Decision #2); the PIN is stored scrypt-hashed on `Driver.pin` and never returned by tRPC or the driver API. A separate httpOnly `cf_driver_session` cookie (path `/`) powers the `/driver` route group AND `/api/driver/*` + `/api/tracking/ingest` (drivers may only report positions for their assigned vehicle). Driver quick actions reuse the dashboard's forward-only `NEXT_SHIPMENT_STATUSES` transitions inside a transaction (status + `STATUS_CHANGED` event + ETA stamp on delivery + `SHIPMENT_STATUS_CHANGE` notification). The driver app reports GPS via `watchPosition` every 10s through the shared `useDriverTracking` hook (home + navigate views), shows a live Leaflet map with route polyline, next-waypoint distance (`haversineKm`), ETA card, "report issue" and change-PIN dialogs, and a bottom nav (Home / Navigate / My trips). Installable: `driver-manifest.json` + `driver-sw.js` (network-first navigations, offline shell, never caches `/api`) + generated icons + `beforeinstallprompt` install button.

---

### Episode 14 — Proof of Delivery + QR Scanning

**Business Problem:** Paper-based proof of delivery is easily lost, forged, or delayed. Digital POD with photos, signatures, and QR codes provides instant, tamper-proof confirmation that cargo was delivered.

**Tasks:**
- [x] Create `ProofOfDelivery` Prisma model (shipmentId, photos, signature, recipientName, recipientPhone, notes, qrCode, timestamp, location)
- [x] Build POD capture screen in Driver PWA
  - Camera capture (delivery photo)
  - Digital signature pad (touch-based)
  - Recipient name + phone
  - Notes field
  - GPS location stamp
- [x] Build QR code generation for each shipment
  - QR encodes: tracking number + verification hash
  - Printed on cargo label / delivery slip
- [x] Build QR scanner in Driver PWA
  - Scan QR → confirms active shipment → prompts POD capture
- [ ] ~~Upload POD photos to Cloudflare R2~~ deferred — photos stored as compressed data URLs in Postgres (matches the Resend/Africa's Talking pattern; R2 lands with storage config)
- [x] Display POD on shipment detail page
- [x] Send POD confirmation email to customer (logged placeholder — Resend deferred)

**Key Files:**
```
prisma/schema.prisma                              — add ProofOfDelivery (+ Shipment.proofs, Organization.proofs)
src/lib/validators/pod.ts                         — NEW (createPodSchema, podPhotoSchema)
src/lib/utils/qr.ts                               — NEW (HMAC delivery QR payload gen/verify + PNG)
src/server/pod.ts                                 — NEW (createProofOfDelivery tx, getProofByShipment, getShipmentQr, assertDriverCanPod)
src/trpc/routers/pod.router.ts                    — NEW (getForShipment, qr — both shipment.view)
src/app/api/driver/pod/route.ts                   — NEW (GET current POD+QR, POST capture — driver session, assignment-scoped)
src/app/driver/pod/page.tsx                       — NEW (capture screen)
src/components/driver/pod-capture.tsx             — NEW (capture flow: photos, signature, recipient, GPS, verify)
src/components/driver/camera-capture.tsx          — NEW (native capture + compression to data URLs)
src/components/driver/signature-pad.tsx           — NEW (canvas pointer signature → PNG data URL)
src/components/driver/qr-scanner.tsx              — NEW (BarcodeDetector w/ manual-entry fallback)
src/components/shipments/pod-card.tsx             — NEW (dashboard POD + QR display)
scripts/runtime-pod-check.cjs                     — NEW (repeatable runtime check: login → GET pod+QR → capture → negatives → DB assertions → cleanup)
```
Note: `ProofOfDelivery` + the `Driver.pin` column were applied to Neon during Episode 14's runtime verification via `prisma migrate diff --from-config-datasource --to-schema --script` (table + 2 indexes + 2 FKs), executed with a raw-SQL helper. Caught a real gap: the earlier hand-applied migration had **never run** — `@neondatabase/serverless` `sql.unsafe()` builds a query *fragment* (a `{ sql }` descriptor) to embed inside the tagged template and does NOT execute on its own; executing needs the tagged template or `sql.query()`. Runtime-verified end-to-end (24/24 checks in `scripts/runtime-pod-check.cjs`): login 200 + session cookie, unauth POST 401, GET returns active shipment + `CFV1:<tracking>|<HMAC(16 hex)>` QR (PNG data URL, signature recomputed to match), POD for an unassigned shipment → 403, capture writes `ProofOfDelivery` (photos/signature/recipient/notes/GPS/`capturedByName`) + `POD_CAPTURED` event + `SHIPMENT_STATUS_CHANGE` notifications to `shipment.view` members, all rows verified in the DB then the fixture cleaned up. POD capture: photos (max 4) + signature are compressed to data URLs client-side; a `[pod-confirmation:email]` placeholder logs to the customer's address (Resend deferred). Delivery QR is printed on the dashboard shipment detail card; the driver scans it (native `BarcodeDetector`, manual fallback) to confirm the label matches the active shipment.

---

## Phase 5: Intelligence (Episodes 15–17)

### Episode 15 — Reports & Analytics

**Business Problem:** Data without insights is just noise. Fleet owners need to understand utilization rates, delivery performance, cost per km, and driver efficiency to make profitable decisions.

**Tasks:**
- [x] Build report types:
  - **Fleet Utilization** — % of time each vehicle is active vs. idle
  - **Delivery Performance** — on-time %, average delay, by route/driver
  - **Driver Scorecard** — trips completed, on-time %, distance covered
  - **Cost Analysis** — fuel costs, maintenance costs per vehicle (placeholder data)
  - **Shipment Summary** — volume by status, by customer, by time period
- [x] Build reports page (`/reports`)
  - Date range picker (with 7d/30d/90d presets)
  - Report type selector
  - Charts (recharts — installed this episode; the plan note was stale)
  - CSV export client-side; PDF via Trigger.dev background job (**deferred** placeholder — button disabled with tooltip)
- [x] Build analytics dashboard widgets on home page (on-time %, delivered, active vehicles/drivers snapshot + link to `/reports`)
- [ ] Integrate PostHog for product analytics (**deferred** — matches Resend/Africa's Talking/R2 deferral pattern)

**Key Files:**
```
src/server/report.ts                             — NEW (aggregations: overview, fleetUtilization, deliveryPerformance, driverScorecard, costAnalysis, shipmentSummary)
src/trpc/routers/report.router.ts                — NEW (6 queries behind report.view, optional { from, to } range)
src/app/(dashboard)/reports/page.tsx              — NEW (server page, permission-gated)
src/components/reports/reports-page.tsx           — NEW (client shell: type selector + date range + export)
src/components/reports/{fleet-utilization,delivery-performance,driver-scorecard,cost-analysis,shipment-summary}-chart.tsx — NEW
src/components/reports/chart-colors.ts           — NEW (reusable palette)
src/lib/utils/csv-export.ts                      — NEW (toCsv/downloadCsv)
src/components/dashboard/dashboard-home.tsx      — UPDATE (analytics snapshot row)
src/components/layout/nav-items.ts               — UPDATE (enabled /reports)
```
Note: all report queries are read-only and route through `requirePermission("report.view")` (owner/admin/dispatcher/viewer). The date range defaults to the last 30 days (per-type queries accept `{ from, to }`, SuperJSON-transported). Fleet utilization measures active-assignment overlap against the window (clamped 0–100%); delivery performance scores only DELIVERED shipments with an `actualDeliveredAt` in range (on-time = actual ≤ estimated, avg delay = mean over late ones, grouped by driver name and route name via `Shipment.route`); driver scorecard sums trips/on-time/distances (haversine of origin↔destination) per driver; cost analysis is flagged `placeholder: true` (fuel $0.42/km + maintenance $85 + $0.06/km est.) until finance data lands; shipment summary buckets daily→weekly for ranges > 60 days. CSV exports are generated in the browser from the loaded rows; the PDF button (Trigger.dev) and PostHog integration are deferred external integrations, consistent with the repo pattern.

---

### Episode 16 — Offline Synchronization

**Business Problem:** Drivers crossing rural Nigeria, the DRC interior, or the Kenyan highlands lose connectivity for hours. If the app stops working without internet, it's useless for the people who need it most.

**Tasks:**
- [x] Upgrade service worker (hand-rolled — Workbox deferred; repo is SW-free so far)
  - [x] Precache driver app shell (HTML pages, manifest, icons) on install
  - [x] Network-first for navigations with cached-shell fallback
  - [x] Stale-while-revalidate for same-origin static assets + `/_next/` chunks
  - [x] Network-first with cache fallback for driver GET APIs (`/api/driver/*`, `/api/portal/*`) so the last known context renders fully offline
  - [x] POST mutations never hit the SW; they go through the IndexedDB queue below
- [x] Build offline action queue
  - [x] Store mutations (status actions, issue reports, POD captures) in IndexedDB
  - [x] Display "pending sync" pill in the Driver PWA
  - [x] Auto-flush queue when connection returns (online event, 30s timer while pending, tab refocus, background-sync wake)
  - [x] Conflict resolution: FIFO replay, last-write-wins with server time as tiebreaker (409 = server already ahead → drop, not fail)
- [x] Build sync status indicator in Driver PWA
  - [x] Online/offline indicator
  - [x] Pending actions count
  - [x] Failed count + tap-to-retry (retryFailed), last sync timestamp
- [x] Handle partial failures (network/5xx/429 aborts flush and retries later; 4xx permanent → marked failed, never blocks the rest of the queue)
- [ ] Test with Chrome DevTools Network Throttling (manual QA — see status note)

**Key Files:**
```
src/lib/offline/db.ts                            — NEW (IndexedDB wrapper: queue + meta stores)
src/lib/offline/queue.ts                         — NEW (in-memory store, enqueue/enqueueTracking/flush/retryFailed, LWW rule)
src/lib/offline/mutations.ts                     — NEW (offlineCapablePost helper used by actions/issue/POD)
src/components/driver/use-offline-sync.ts        — NEW (useSyncExternalStore hook + auto-flush wiring)
src/components/driver/sync-status.tsx            — NEW (floating status pill above bottom nav)
public/driver-sw.js                              — UPDATE (v2: app-shell precache, S-WR static, network-first GET API, background sync)
src/components/driver/register-sw.tsx            — UPDATE (background-sync registration)
src/components/driver/driver-app.tsx             — UPDATE (runAction + IssueDialog → offlineCapablePost)
src/components/driver/pod-capture.tsx            — UPDATE (submit → queue; "Proof queued" done-screen)
src/components/driver/use-driver-tracking.ts     — UPDATE (offline tracking coalesced to latest sample)
src/app/driver/layout.tsx                        — UPDATE (mounts SyncStatus)
```
Note: Pod-capture payloads (base64 photos/signature, ≤1280px + ~2MB cap each, max 4) are stored as-is in IndexedDB and upload on reconnect. Tracking ingest is high-frequency telemetry, so while offline only the latest sample is queued (coalesced) to keep the queue small. Permanent 4xx items land in a `failed` state the pill surfaces; tapping the pill force-flushes pending work immediately.

---

### Episode 17 — Production Hardening

**Business Problem:** A demo app is not a product. Production readiness means handling errors gracefully, protecting against abuse, monitoring health, and deploying with confidence.

**Tasks:**
- [x] Error handling
  - [x] Global error boundary (`src/app/error.tsx`)
  - [x] Root/global error boundary for layout failures (`src/app/global-error.tsx`)
  - [x] tRPC error formatting (friendly message for 500s, hides internals)
  - [ ] Sentry error tracking (**deferred** — external; matches repo pattern)
- [x] Rate limiting
  - [x] Better Auth rate limiting (sign-in/sign-up attempts: 5/min per IP; global 100/min)
  - [x] tRPC rate limiting (300 req/min per IP in front of `/api/trpc`, returns 429 + Retry-After)
  - [x] Portal rate limiting (existing per-(IP, trackingNumber) window, refactored onto the shared limiter)
- [x] Security
  - [x] CORS policy (deliberately same-origin, documented in next.config.ts)
  - [x] Security headers (CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy)
  - [x] Input sanitization (Zod validators already trim/validate; Prisma parameterizes all queries)
- [x] Performance
  - [x] Missing index on `Shipment.assignmentId` (applied via safe migrate-diff workflow)
  - [x] Instant route-switching feedback: `loading.tsx` skeletons for every route segment (root, dashboard, auth, onboarding, portal, driver)
  - [x] Explicit `prefetch` on driver bottom-nav tabs + POD return home
  - [x] Lazy loading for heavy maps (already `next/dynamic` in tracking, route, shipment, portal, driver views — verified)
  - [ ] Bundle analysis (add `@next/bundle-analyzer` when doing a size pass) (**deferred**)
- [x] Monitoring
  - [x] Health check endpoint `/api/health` (DB ping, uptime, latency; 200/503)
  - [ ] Uptime monitoring service (**deferred** — Vercel Cron + UptimeRobot at deploy time)
  - [ ] PostHog dashboards (**deferred**)
- [ ] Deployment (**skipped for now — user asked to hold off**; Vercel setup, env config, preview deploys, prod migrations are documented in README instead)
- [x] Documentation
  - [x] README with real setup instructions (env vars, scripts, key flows, deferred integrations)
  - [ ] Auto-generated tRPC API docs (**deferred** — OpenAPI plugin at a later episode)
  - [ ] Contributing guide (**deferred** — single-maintainer project)

**Key Files:**
```
src/app/api/health/route.ts                      — NEW (liveness/readiness, DB ping)
src/app/error.tsx                                — NEW (segment error boundary)
src/app/global-error.tsx                         — NEW (root-layout error boundary, own <html>)
src/app/{loading,(dashboard)/loading,(auth)/loading,(onboarding)/loading,portal/loading,driver/loading}.tsx — NEW (navigation skeletons)
src/trpc/init.ts                                 — UPDATE (errorFormatter)
src/lib/auth.ts                                  — UPDATE (rateLimit config)
src/server/rate-limit.ts                         — UPDATE (generic checkWindowRateLimit + portal refactor)
src/app/api/trpc/[trpc]/route.ts                 — UPDATE (per-IP limiter, 429)
next.config.ts                                   — UPDATE (security headers + CORS policy)
prisma/schema.prisma                             — UPDATE (Shipment.assignmentId index, applied)
src/components/driver/bottom-nav.tsx             — UPDATE (prefetch tabs)
src/components/driver/pod-capture.tsx            — UPDATE (prefetch home)
README.md                                        — REWRITE (real setup docs)
```
Note: deployed-on-Vercel concerns (env config, preview deployments, production migration strategy, uptime monitors) are deliberately left for when the app actually deploys — the user asked to hold off on deployment this episode.

---

## Database Schema Evolution

Each episode adds to the schema. Here's the full model list by the end:

| Phase | Models Added |
|-------|-------------|
| Setup (done) | `User`, `Session`, `Account`, `Verification`, `TwoFactor` |
| Episode 1 | `Organization`, `Member`, `Invitation` (via Better Auth plugin) |
| Episode 2 | `AuditLog` |
| Episode 4 | `Vehicle` |
| Episode 5 | `Driver` |
| Episode 6 | `VehicleAssignment` |
| Episode 7 | `Shipment`, `ShipmentEvent` |
| Episode 8 | `Route` |
| Episode 9 | `TrackingPoint` |
| Episode 10 | `EtaPrediction` |
| Episode 11 | `Notification`, `NotificationPreference` |
| Episode 14 | `ProofOfDelivery` |

**Total: ~22 models** — manageable, well-normalized, all tenant-scoped via `organizationId`.

---

## Key Patterns to Follow Everywhere

### 1. Every org-scoped query uses `orgProcedure`
Never write a raw `protectedProcedure` that accesses org data without tenant scoping.

### 2. Zod validators are shared
Define once in `src/lib/validators/`, use in both tRPC routers (server) and React Hook Form (client).

### 3. Service layer is pure business logic
`src/server/*.ts` files contain business logic. No `headers()`, no `cookies()` — those stay in tRPC middleware or route handlers.

### 4. Audit log every mutation
Use the `auditedProcedure` middleware. If a mutation changes data, it gets logged.

### 5. Feature flags for progressive rollout
Use simple boolean flags in the organization settings to enable/disable features per tenant (e.g., `enableLiveTracking`, `enableCustomerPortal`).

---

## What We're NOT Building (Scope Guard)

To keep the project focused and completable:

- ❌ **Billing/Payments** — No Stripe integration. Assume all orgs are on a "free" plan.
- ❌ **Mobile native apps** — PWA only. No React Native.
- ❌ **AI/ML predictions** — Simple math-based ETAs, not ML models.
- ❌ **Multi-language i18n** — English only for now. Architecture supports it later.
- ❌ **White-label/custom domains** — Session-based tenancy only.
- ❌ **IoT hardware integration** — GPS comes from the driver's phone, not OBD devices.
- ❌ **Chat/messaging** — Notifications only, no real-time chat between dispatchers and drivers.

---

> **Status:** Phases 1 (Episodes 1–3), Episode 4 (Fleet), Episode 5 (Driver Management), Episode 6 (Vehicle–Driver Assignment), Episode 7 (Shipment Management), Episode 8 (Route Planning), Episode 9 (Live GPS Tracking + SSE), Episode 10 (ETA Prediction), Episode 11 (Notifications), Episode 12 (Customer Portal), Episode 13 (Driver PWA), Episode 14 (Proof of Delivery + QR), Episode 15 (Reports & Analytics), Episode 16 (Offline Synchronization) and Episode 17 (Production Hardening, code-complete) are implemented. Episode 14 was runtime-verified against the live Neon DB (24/24 checks). Episode 15 verified: `tsc`, `eslint` (0 errors), `next build` clean, plus live-DB runtime checks. Episode 16 makes the Driver PWA work offline: an IndexedDB mutation queue (`src/lib/offline/{db,queue,mutations}.ts`) captures status actions, issue reports and POD captures when the device is disconnected, replays them FIFO on reconnect, drops 409s as already-applied LWW, marks permanent 4xx as failed without blocking the queue, and coalesces tracking telemetry to the latest sample; the service worker (`public/driver-sw.js` v2) precaches the app shell, uses stale-while-revalidate for static/`/_next/` chunks and network-first-with-cache-fallback for driver GET APIs; the floating `SyncStatus` pill shows online/offline, pending, failed and last-sync and force-flushes on tap. Episode 17 adds `/api/health` (DB ping), `error.tsx` + `global-error.tsx` boundaries, a tRPC error formatter, Better Auth + tRPC + portal rate limiting, global security headers + documented same-origin CORS policy, the `Shipment.assignmentId` index (applied), navigation-speed skeletons (`loading.tsx` at every route segment) + explicit tab prefetching, and a rewritten README. Episode 17 verified: `tsc` clean, `eslint` 0 errors, `next build` clean, and runtime checks (health 200/db up, security headers on responses, tRPC 401 unsigned with no false 429, index applied to live Neon DB, dev server restarted). Deployment is deliberately NOT done (user asked to hold off). Remaining QA: manual Chrome DevTools Network Throttling pass (Episode 16) and the Episode 18 ship checklist.
> **Next step:** say "let's build Episode 18" (Ship, Test & Polish — deploy + final QA) when ready.

---

## ⏸️ CHECKPOINT — resume here

**State:** Build in progress — Episodes 1–16 implemented, Episode 17 (Production Hardening) code-complete except deployment (held off per user) and deferred external integrations.

**Done & verified:** Episodes 1–17 (org/auth/members, audit, fleet, drivers, vehicle–driver assignment, shipments, route planning, live GPS tracking, ETA prediction, notifications, customer portal, driver PWA, proof of delivery + QR, reports & analytics, offline synchronization, production hardening).
- Episode 11 adds the `Notification` model (organizationId/userId, type, title, body, link, read, channel, createdAt + 3 indexes) and `NotificationPreference` (per-user × per-org toggles: shipmentStatus, vehicleAlert, driverAlert, systemAlert + email/sms channel flags, unique on org×user), a notification service (`src/server/notification.ts`: `notify` with preference gating + 30-min VEHICLE_ALERT dedup, `notifyByPermission`, `getNotificationPreferences`, `upsertNotificationPreferences`), the `notification` tRPC router (list, unreadCount, markRead, markAllRead, preferences, updatePreferences), a topbar bell with unread badge + dropdown (`notification-bell.tsx`, refetches on `eta`/`eta_delayed` SSE), and the `/settings/notifications` preferences page.
- Business events wired: shipment `updateStatus` → `SHIPMENT_STATUS_CHANGE` to every member with `shipment.view` (actor excluded), ETA delay in `recomputeEtasForVehicles` → `VEHICLE_ALERT`, driver create/update with expiring/expired licence → `DRIVER_ALERT`, member invite → `SYSTEM`. Email/SMS channels are opt-in toggles that currently log placeholders (Resend/Africa's Talking not configured yet); Trigger.dev async delivery deferred to the background-jobs phase.
- Runtime-verified via curl: unreadCount/list/markAllRead/markRead/preferences/updatePreferences all 200; shipment status change created a `SHIPMENT_STATUS_CHANGE` notification for member ngozi; ingest on a late shipment broadcast `VEHICLE_ALERT` "running late" to ada + ngozi; a repeated ingest added no duplicate (dedup works).
- Episode 12 adds the fully-public Customer Portal: `getPortalData` in `src/server/portal.ts` aggregates org branding, shipment + route (waypoints/geometry), latest position + vehicle/driver, ETA (reusing `getShipmentEta`) and the event trail by tracking number; the tracking page `/portal/[trackingNumber]` renders that server-side snapshot into `PortalTrackingView` (brand header, pickup/drop-off, `PortalTrackingMap` with route polyline + live truck pulse, ETA card, cargo sidebar, share card) and polls the rate-limited `/api/portal/[trackingNumber]` every 30s to stay live. `/portal` is a search page that redirects to the tracking URL. Sharing: QR generated server-side with the `qrcode` package (`shareUrl` from `getPortalUrl`) + copyable link. Anti-scrape rate limiter (`src/server/rate-limit.ts`, in-memory fixed window, 60 req / 10 min per IP×tracking number, 429 + `Retry-After`). `shipment.create` fires `sendTrackingLinkPlaceholder` (email/SMS placeholder with the portal URL — Resend/Africa's Talking still deferred).

**Currently running:** dev server on port 3000 (launched detached via `start-dev.cmd`; check `Get-NetTCPConnection -LocalPort 3000`). Prisma client generated to `src/generated/prisma` (TS-only).

**Demo data (Lagos org `cmsozwcp3000338u7o9s9qsra`, owner `ada@cargodemo.com`):**
- Drivers: Amara Okafor (SUSPENDED), Old Licence Driver (AVAILABLE, expired licence), Emeka Nwosu (`cmsp2rocf000m0cu7jtz6cg4h`, AVAILABLE/valid)
- Vehicle: KJA 123B (`cmsp0sohw0000ngu7ye3a3w30`, Toyota Hilux, IN_USE)
- 1 active assignment: Emeka ↔ KJA 123B (`cmsp3oz1n000f2cu7bn4802ei`)
- Shipments: `CF-NG-20260812-4F7Y` (Hauwa Traders, DELIVERED, full event trail), `CF-NG-20260812-W7TA` (Dele Motors, IN_TRANSIT now, assigned to Emeka/KJA 123B, linked to Lagos-Oshodi→Ibadan-Ojoo route, ETA card + delay alerts live). Portal smoke-test rows also exist: `CF-NG-20260813-EUFR` and `CF-NG-20260813-MG4A` (Portal Test Customer, PENDING_PICKUP, customer@example.com) — handy unassigned examples for `/portal`.
- Tracking points: several for KJA 123B (Lekki/VI + ETA-episode points) — lights up `/tracking`
- Notifications: SHIPMENT_STATUS_CHANGE (for ngozi) + VEHICLE_ALERT "running late" (ada + ngozi) from the Episode 11 smoke tests; ada's prefs have email+sms enabled
- vamos org `cmsp0990e000n38u799wnhfjs` (owner `chintu@mail.com`, password unknown): 4 seeded drivers

**Auth cookie jars** (in `$env:TEMP`): `cf-cookies.txt` = ada (owner, Lagos), `cf-cookies3.txt` = ngozi (viewer), `cf-cookies4.txt` = chintu (stale). Password to sign in as ada is set in her Account record (hashed); the working session comes from `cf-cookies.txt`.

**RBAC:** viewer gets `/tracking` (tracking.view in matrix). Shipment writes gated `shipment.create`/`shipment.update_status`; route writes `route.manage`; ETA reads `shipment.view`; notifications are personal (any member, org-scoped).

**Prisma DB workflow (safety guard blocks `db push`/`migrate dev` on this demo DB):** additive schema changes go through `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → apply SQL via `@neondatabase/serverless` → `npx prisma generate`, then **restart the dev server** (PrismaClient delegates are built at construction; hot reload won't pick up a new model). Temporary helper scripts + dev.log must be cleaned up afterward.

**Verification commands:** `npx tsc --noEmit`, `npx eslint src` (2 pre-existing warnings about react-hook-form `watch` in `create-org/page.tsx` and `shipment-form.tsx` — benign React Compiler skips). Episode 17 runtime checks (this session): `GET /api/health` → 200 `{status:"ok",db:"up",...}`; security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy) present on every response; `GET /api/trpc/organization.getActive` unsigned → 401 (rate limiter did NOT false-positive); `/driver`, `/dashboard`, `/shipments` all render and stream their auth redirect correctly (200 shell + RSC redirect, standard for streaming); `Shipment.assignmentId` index applied to the live Neon DB via `prisma db execute` (verified "Script executed successfully"), then dev server restarted (PID updated). Still pending from Episode 16: manual Chrome DevTools Network Throttling QA of the offline queue.

**NEXT UP — Episode 18: Ship, Test & Polish** (final episode — launch the demo):
- Runtime QA of Episode 16 offline flow (Chrome DevTools Network Throttling, background-sync wake on a device)
- Vercel deploy: env configuration, preview deployments, production migration strategy (turn off the `db push` guard, run `prisma migrate deploy`)
- Uptime monitoring (UptimeRobot on `/api/health`), bundle analysis pass (`@next/bundle-analyzer`)
- README final polish + episode-series landing touches
