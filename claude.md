# HelloFit — Home-Service Yoga & Wellness Platform

Single yoga institute that sends empanelled certified teachers to customers' homes.
Customer books a service for a date + from-time/to-time slot; admin ops runs allocation,
scheduling, money, quality and support. Signature feature: a **two-way internal review
system** (customer reviews teacher publicly, teacher reviews customer internally).

**`project details.odt` in this directory is the functional + technical spec and the source
of truth.** It is an ODT (zip + `content.xml`) — extract text before reading, e.g.:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem, System.Web
$z = [IO.Compression.ZipFile]::OpenRead("$PWD\project details.odt")
$sr = New-Object IO.StreamReader(($z.Entries | ? FullName -eq 'content.xml').Open())
$x = $sr.ReadToEnd(); $sr.Close(); $z.Dispose()
$x = $x -replace '</text:[hp]>', "`n" -replace '<text:list-item>', "`n" -replace '<[^>]+>', ''
[Web.HttpUtility]::HtmlDecode($x) | Out-File -Encoding utf8 details.txt
```

When a question is answered by the spec, read the spec — don't invent product behaviour.

## Current state (as of 31 Oct 2026)

**Still not a git repository.** That means `git worktree` and Claude Code's worktree
isolation are unavailable — run `git init` first if either is wanted.

The admin panel (`React + Vite`) does not exist yet.

### `health_fit_backend/` — working, boots, connected to Postgres

Serves on **http://localhost:3000/api/v1**. `GET /api/v1/health` returns a real `SELECT 1`
round-trip. The Nest CLI's own `AGENTS.md` also sits in there; `claude.md` wins if they
disagree.

Done:

- **Foundation** — validated env (`src/config/env.validation.ts`, fails at boot not at first
  request), `PrismaModule`/`PrismaService`, response-envelope interceptor, global exception
  filter with stable error codes, request-id middleware.
- **Auth** — OTP send/verify (hashed codes, per-mobile and per-IP rate limits), JWT access +
  **rotating refresh with replay detection** (a reused token revokes the whole chain),
  device registration, admin email/password login, and four global guards
  (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` + audience check). Everything is
  protected unless marked `@Public()`.
- **Schema** — three migrations covering Phase 1 identity/RBAC/geography, Phase 2
  catalog/scheduling/booking/session/assignment, Phase 3 payments/wallet/refunds/
  commission/earnings/payouts/settlements/webhooks. ~60 tables.
- **Domain calculators** — pure, dependency-free, **95 unit tests passing**:
  `booking/pricing.calculator.ts`, `booking/refund.calculator.ts`,
  `availability/slot.calculator.ts`, `assignment/matching.calculator.ts`,
  `payout/commission.calculator.ts`.
- **Settings** — `modules/settings/settings.defaults.ts` holds every admin-configurable
  slab, weight, window and buffer, overridden by `app_settings` rows via `SettingsService`.
- **Seed** — `src/database/seed.ts`, idempotent: 84 permissions x 6 roles, super admin,
  policy settings, 3 languages, Pune + 3 areas + branch, 8 categories / 10 services, global
  25% commission rule.

Not yet built: the controller/transaction layer above the calculators — booking creation
with the slot-hold transaction, offer-cascade worker, check-in/out endpoints, payment
webhooks. Those need Redis + BullMQ, which is **not installed yet**.

### `customer_instructor_app/` — Phase 1 structure only, `flutter analyze` clean

Deliberately no invented screens (see the working-order rule above). In place:

- `core/theme/` — spec 5.9 tokens and the Material theme built from them.
- `core/network/` — sealed `ApiResult` mirroring the backend envelope, `ApiClient` (Dio) with
  bearer injection and **single-flight** refresh rotation.
- `core/storage/token_store.dart` — tokens in the platform keystore, never SharedPreferences.
- `features/auth/` — models, repository, Riverpod controller, OTP login screen.
- `app/shells.dart` — one `ScaffoldWithBottomNav` over two tab lists (Customer: Home, Book,
  Bookings, Progress, Profile / Instructor: Today, Schedule, Requests, Earnings, Profile),
  plus the "Continue as" chooser. Tab bodies are `Awaiting design` placeholders.
- `main.dart` — auth gate; the role on the token picks the shell.

Phase 1 per the delivery plan is: Flutter shell with both bottom-nav bars + the design
system, NestJS skeleton, DB schema and migrations, OTP auth and RBAC, masters, admin shell,
profiles, document upload/verification, teacher onboarding pipeline.

## Working order — backend first, UI later

**Build the backend completely first. Do not design or build any UI yet.**

The client is supplying the designs for the Flutter app and the admin panel, and they have
not arrived yet. Until then:

- Do **not** invent screens, layouts, component libraries or visual styling.
- Do **not** touch `customer_instructor_app/` beyond what the backend needs.
- The design tokens recorded further down come from the spec's reference prototype; treat
  them as reference only, and let the supplied designs override them when they land.

When the designs do arrive, build the UI against the API that already exists — not the
reverse.

### Backend build order

1. **Foundation** — Prisma + `@nestjs/config` with a validated env schema (missing
   `DATABASE_URL` or JWT secret fails at boot, not at first request), `PrismaModule` with
   lifecycle connect/disconnect, and `src/common/`: response-envelope interceptor, global
   exception filter with stable error codes, whitelisting `ValidationPipe`, request-id
   logger. Everything built later inherits these.
2. **First migration** — spec §7.1 identity tables only: `users`, `roles`, `permissions`,
   `role_permissions`, `devices`, `otp_requests`.
3. **`auth`** — OTP send/verify, JWT issue + rotating refresh, device registration and
   revocation, admin password login + 2FA, and the four guards.
4. Then `users`, `masters`, `customers`, `instructors` — the rest of Phase 1.
5. Then Phase 2 onward per the delivery plan: catalog → availability/slot engine → booking
   → assignment → session.

Swagger is generated from the DTOs as each module lands, so the API contract is ready and
documented before any client work starts.

## Decisions already made (don't re-open without reason)

- **Package manager: npm.** Lockfile is `package-lock.json`.
- **Module system: CJS + Jest**, not ESM + vitest — smoothest path for decorator metadata,
  Prisma, BullMQ and the bulk of NestJS examples. `tsconfig` says `module: nodenext` but
  there is no `"type": "module"`, so output is CommonJS. Keep it that way.
- **`@nestjs/observe` declined** at scaffold time; observability is Winston + Sentry +
  health endpoints per the spec, not a third-party SaaS.
- **PostgreSQL installed natively on the dev machine**, not via Docker Desktop (which costs
  ~2 GB plus a permanently running WSL2 VM). XAMPP is irrelevant here — it ships
  MySQL/MariaDB.
- **Postgres over MongoDB.** Bookings, commission, wallet ledger and payouts need real
  transactions, joins and referential integrity.
- **Architecture: layered modular monolith, SOLID enforced, JWT for auth.** No
  microservices — splitting bookings, payments and sessions across services would turn one
  atomic transaction into a saga with compensating rollbacks, and a half-failed booking
  means money taken with no session. See the architecture section below.
- **Deployment: single VPS, no Kubernetes.** Nginx reverse proxy + TLS via certbot, PM2 or
  a single `docker-compose up`, GitHub Actions deploying on push, nightly `pg_dump` to
  off-server storage, Sentry + uptime monitoring. At 5,000 sessions/month a cluster buys
  nothing and needs a specialist to maintain. The monolith is designed to be split later if
  traffic ever justifies it.

## Planned architecture

| Piece | Stack |
|---|---|
| Backend API | Node 20 + NestJS (TypeScript), modular monolith, REST `/api/v1` |
| DB | PostgreSQL 16 + Prisma; UUID PKs, `created_at`/`updated_at`/`deleted_at` everywhere |
| Cache / queues | Redis + BullMQ |
| Realtime | Socket.IO NestJS gateway |
| Admin panel | React + Vite + TypeScript, separate front-end on the same API |
| Mobile | Flutter 3.x — **one** app, Customer mode + Instructor mode |
| Payments | Razorpay + RazorpayX payouts, behind a pluggable gateway interface |
| Notifications | FCM, MSG91/Twilio SMS, SendGrid/SES — template driven, admin-editable |
| Maps | Google Maps (Geocoding, Distance Matrix, Places) |
| Files | S3-compatible storage + CDN; private bucket for KYC |

API is split by audience — `/app/customer/*`, `/app/instructor/*`, `/admin/*` — all sharing
the same services. Modules: auth, users, customers, instructors, catalog, availability,
booking, assignment, session, review, payment, wallet, payout, membership, coupon,
notification, chat, support, cms, report, masters, admin.

## Flutter app conventions

- **Feature-first folders** — `features/<name>/{data,domain,presentation}`.
- **go_router** for navigation and deep links (every push notification deep-links to its
  exact screen), **Riverpod** for state, **Dio** with interceptors, **Hive or Isar** for the
  offline schedule cache, `flutter_localizations` for English + regional languages.
- **Two shells, one widget library.** Role on the JWT picks the shell; two
  `ScaffoldWithBottomNav` implementations share identical cards, chips, calendars and sheets.
  Customer tabs: Home, Book, Bookings, Progress, Profile.
  Instructor tabs: Today, Schedule, Requests, Earnings, Profile.
  Someone with both roles gets a one-time "Continue as" chooser; active mode is remembered.
  A teacher applicant who isn't approved yet gets the Customer shell plus an
  "Application status" card.
- **Offline matters.** Today's and this week's schedule, the customer address and the
  check-in OTP are cached so a weak network at the customer's home can't block check-in;
  check-in/check-out queue and sync on reconnect.
- **Permissions:** notifications (both roles), location (teacher foreground always,
  background only while `EN_ROUTE`; customer only for address picking), camera (QR
  check-in, document upload). Never contacts.

## Design tokens (shared by app, admin panel and website)

Primary orange `#E33E29` · ivory surface `#FFF6EC` · ink `#161614` · muted `#77736D` ·
hairline `#EEE4DA` · success green `#237A55` · page background `#FCFAF7`.
Anton for display headings and big KPI numbers, Poppins 300–800 for UI text.
22px radius on cards and modals, 12px on buttons and inputs,
shadow `0 14px 38px rgba(44,31,20,.07)`.
Status chip colours: Confirmed/Assigned neutral ivory, En route/In progress orange,
Completed green, Cancelled/No-show red tint, Pending amber.
Accessibility: font scaling, 44px touch targets, contrast-checked palette, screen-reader
labels on action buttons.

## Domain rules worth getting right

**Session status machine** — `PENDING_PAYMENT` (slot soft-held 15 min) → `CONFIRMED` →
`ASSIGNED` → `EN_ROUTE` → `IN_PROGRESS` → `COMPLETED`, plus `REASSIGNMENT_NEEDED`,
`RESCHEDULE_REQUESTED`, `CANCELLED_BY_{CUSTOMER,TEACHER,ADMIN}`,
`NO_SHOW_{CUSTOMER,TEACHER}`. Every transition writes `booking_status_history` with actor,
timestamp, reason and remark — support and finance rely on that trail.

**Check-in** is a 4-digit OTP from the customer app (or a customer QR scan) plus a geo-fence
check; a mismatch is allowed with a reason and flagged to ops. Auto-complete 30 minutes
after the to-time if neither side checks out. `COMPLETED` is the trigger for the earning
row, workout history, plan progress and both review prompts.

**Assignment** applies hard filters (active + KYC verified, offers the service, area/radius
covers the address, availability covers the window, no clash including travel buffer, not on
leave, under the daily cap) then scores: rating 25%, distance 20%, reliability 20%,
language/gender match 15%, load balancing 10%, continuity 10% — all weights
admin-configurable. Offers cascade one teacher at a time on a 10-minute countdown, then land
in the admin assignment queue.

**Reviews are double-blind.** Both sides submit hidden; publishing happens when both have
submitted or the 7-day window closes. States: `PENDING`, `SUBMITTED`, `PUBLISHED`,
`FLAGGED`, `HIDDEN`, `EXPIRED`. Editable for 24 hours. Auto-flag on profanity, phone
numbers, links, or any 1-star review. Teacher-to-customer reviews are **never** public —
other teachers see only a trust band and advisory tags.

**Money** — customer pays at booking; commission comes from the first matching rule
(teacher → service → category → global). Earnings sit `Pending` until the dispute window
closes (default 48h), then `Payable`; a weekly job batches them per teacher, applies TDS,
and finance approves before transfer. Cancellation refunds: >24h 100%, 2–24h 75%, <2h 50%,
after check-in 0%; teacher/admin cancellation is 100% plus goodwill credit. **All slabs,
windows and weights are admin-configurable — read them from settings, never hard-code.**

## Backend architecture pattern — layered modular monolith

Not MVVM (that's a UI pattern; there is no view on the server) and not microservices. One
deployable, one Postgres, clean module boundaries, and inside every module the same four
layers:

```
src/modules/booking/
  booking.controller.ts        ← HTTP only: route, guards, status codes. No logic.
  dto/create-booking.dto.ts    ← shape + class-validator rules for the payload
  booking.service.ts           ← business rules: pricing, refund slabs, clash checks
  booking.repository.ts        ← Prisma queries only
  booking.module.ts            ← wiring and exports
src/common/                    ← guards, interceptors, filters, decorators, pipes
src/prisma/                    ← PrismaService
```

One module per spec chapter 8. Dependencies point one way only: controller → service →
repository *interface*. That is what keeps slot computation, pricing, matching and
commission logic unit-testable with no HTTP and no database in the way.

### SOLID, applied here

- **S** — controllers do HTTP, services do rules, repositories do Prisma. A service that
  starts formatting responses or building SQL has lost its single responsibility.
- **O / L** — new commission rule types, payment gateways or notification channels arrive as
  new implementations of an existing interface, never as another `if` branch in a service.
- **I** — narrow interfaces (`PaymentGateway`, `SmsSender`, `SlotProvider`), not one fat
  service interface everything depends on.
- **D** — services depend on abstractions injected by Nest's DI container, never on
  concrete classes they construct themselves. This is why swapping Razorpay for Stripe or
  PayU touches one provider binding, as the spec requires.

## Backend conventions

- **Auth is JWT throughout.** Access token 15 minutes, rotating refresh tokens, device
  registration and revocation; mobile login via OTP, admin login via password + optional
  2FA. Role and permission claims ride on the token, and the token's role is also what
  decides which Flutter shell loads.
- Global `ValidationPipe` with whitelist + transform; one DTO per request.
- Guards: `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `OwnershipGuard` (a customer
  reads only their own bookings).
- Response envelope `{ success, data, meta, message }`; global exception filter with stable
  error codes the app localises.
- Pagination: cursor for feeds, page/limit for admin tables.
- Idempotency keys on booking creation and payment verification; webhook events deduplicated
  and signature-verified.
- Customer phone numbers are masked from teachers until assignment; calls go through a
  masking service. Bank details and PAN encrypted at rest. KYC files behind time-limited
  signed URLs. Full before/after audit log on admin actions.
- Unit tests are expected on pricing, slot computation, matching, commission and refund
  logic; e2e on the booking and review flows.

## Commands

Backend (`health_fit_backend/`):

```bash
npm install
npm run start:dev        # watch mode — prefer this over `npm run start`
npm run build
npm run lint             # oxlint --type-aware, not eslint
npm run test             # jest — 95 calculator tests
npm run test:e2e

npm run db:migrate       # prisma migrate dev
npm run db:generate      # re-run after EVERY schema change
npm run db:studio
SEED_ADMIN_PASSWORD=... npm run db:seed
```

The seed creates no admin unless `SEED_ADMIN_PASSWORD` is set, and never resets an existing
admin's password. Local admin is `admin@hellofit.local`.

App (`customer_instructor_app/`):

```bash
flutter pub get
flutter run
flutter analyze          # flutter_lints 6.0 via analysis_options.yaml
flutter test
```

## Next steps, in order

1. **Redis + BullMQ** (`npm i @nestjs/bullmq bullmq ioredis`) — nothing below works without
   the queues: offer timeouts, slot holds, review windows, payout batches.
2. **Booking transaction** — `POST /bookings/quote` then `POST /bookings`: resolve price via
   `pricing.calculator`, generate package occurrences, re-validate the slot *inside* the
   transaction (a Redis hold alone is not sufficient), write `booking_status_history`.
3. **Slot endpoint** — `GET /slots?service&date&address`, wrapping `slot.calculator` over
   availability rules, overrides, leaves, holidays and existing sessions.
4. **Assignment worker** — rank with `matching.calculator`, offer on a 10-minute countdown,
   cascade, then fall into the admin queue. Persist `scoreSnapshot` per offer.
5. **Session day** — start-travel, OTP/QR check-in with geo-fence, check-out, auto-complete
   cron; on `COMPLETED` create the earning via `commission.calculator`.
6. **Payments** — Razorpay orders, signature-verified webhooks into `webhook_events`,
   invoices, wallet ledger, refunds via `refund.calculator`.
7. **Masters + profile CRUD** to finish Phase 1, then the React admin shell.
8. **Flutter screens** — only once the designs land.

## Gotchas already paid for (don't rediscover these)

- **`npm i prisma` installs a release candidate.** npm's `latest` tag for the CLI is
  `8.0.0-rc.*`; stable is under `prev`. Both packages are pinned to **7.10.1** — keep CLI and
  client on the same version.
- **Prisma 8 is a different product shape** (`@prisma/orm-postgres`, Composer, Prisma Cloud)
  and `@prisma/client` has no 8.x release at all. Do not "upgrade" into it.
- **Prisma 7 needs a driver adapter** — `PrismaPg` from `@prisma/adapter-pg`, and the config
  file is `prisma7.config.ts` (not `prisma.config.ts`).
- **The generated client lives in `src/generated/prisma`**, not `node_modules`. It must stay
  under `src/` or `nest build` fails with TS6059 (`rootDir`). Imports are
  `from '../generated/prisma/client'`, never `from '@prisma/client'`.
- **ts-node cannot run anything importing the generated client** (CJS can't resolve its
  `.js`-extension imports). That's why the seed lives in `src/database/` and runs from
  `dist/`.
- **Express 5 rejects `forRoutes('*')`** — use `'{*path}'`.
- **A malformed refresh token used to 500**, because a non-UUID hit a `uuid` column. The id
  half is now UUID-validated before any query. Same trap applies anywhere user input
  reaches a `@db.Uuid` field.
- **Heredocs with apostrophes break in this shell** — write files with the Write tool.
- `flutter_secure_storage` v11 removed `encryptedSharedPreferences` (encryption is now the
  default), and `prefer_initializing_formals` is a false positive for private fields, so it
  is disabled in `analysis_options.yaml`.

## Open points

Section 12 of the spec lists working assumptions awaiting client confirmation — commission
percentage, payout cycle, refund slabs, review window length, gender-preference matching
policy, travel-charge radius and slabs, gateway choice, whether teachers are empanelled or
salaried, which regional languages. Several change the data model. Don't harden any of them
into code without checking.
