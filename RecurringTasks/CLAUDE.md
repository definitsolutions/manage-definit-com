# Recurring Tasks

A department-scoped recurring task management service for the Definit platform (apps.definit.com). Enables teams to create task templates with various cadences (daily, weekly, monthly, quarterly, annual), automatically generates task instances on schedule, tracks completion with optional proof-of-work, and maintains a full audit trail. Part of a larger Docker-based microservice ecosystem alongside Portal, Onboarding, Sophos, Backup, and other services.

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 20.x | Server runtime (Alpine Docker image) |
| Framework | Fastify | 4.x | HTTP server with plugin architecture |
| Language | TypeScript | 5.x | Strict mode enabled, ES2022 target, ESM (`"type": "module"`) |
| Frontend | React | 18.x | SPA with React Router 6 |
| Build | Vite | 5.x | Frontend bundler, dev server on port 5178 |
| Database | PostgreSQL | 16.x | Shared `apps_definit_postgres` container |
| ORM | Prisma | 5.x | Schema-first ORM with migration support |
| Scheduling | node-cron | 3.x | Daily task generation (1 AM default) |
| Testing | Vitest | 1.x | Unit tests in `tests/` directory |
| Logging | Pino | 9.x | Structured JSON logging with pino-pretty in dev |
| Screenshots | html2canvas | 1.x | Client-side screenshot capture for bug reports / proof-of-work |

## Quick Start

```bash
# Prerequisites: Node.js 20+, PostgreSQL running (or Docker network with apps_definit_postgres)
# The recurring_tasks database must exist (created by Infrastructure/init-scripts/01-create-databases.sql)

# Install dependencies
cd C:\Docker\RecurringTasks
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database (first time setup)
npm run db:push

# Start development (runs server + client concurrently)
npm run dev
# Server: http://localhost:3008
# Client: http://localhost:5178 (proxies /api to :3008)

# Run tests
npm test

# Production build
npm run build
npm start
```

## Project Structure

```
RecurringTasks/
├── src/
│   ├── server/
│   │   ├── index.ts              # Entry point, starts Fastify + scheduler
│   │   ├── app.ts                # Fastify app setup, plugin/route registration
│   │   ├── config.ts             # Environment config object
│   │   ├── lib/
│   │   │   ├── db.ts             # Prisma client singleton
│   │   │   ├── logger.ts         # Pino logger instance
│   │   │   └── auth.ts           # Portal user extraction from headers, user upsert
│   │   ├── middleware/
│   │   │   └── auth.ts           # Fastify auth plugin (validates portal secret + user)
│   │   ├── routes/
│   │   │   ├── auth.ts           # GET /api/auth/me
│   │   │   ├── departments.ts    # Department listing, members
│   │   │   ├── tasks.ts          # CRUD + complete/reopen task instances
│   │   │   ├── templates.ts      # CRUD for recurring task templates
│   │   │   └── generation.ts     # Manual task generation trigger
│   │   └── services/
│   │       ├── authorization.ts  # Role-based access (member/manager/admin)
│   │       ├── audit.ts          # Field-level change tracking
│   │       ├── recurrence.ts     # Date calculation, business day logic
│   │       ├── task-generation.ts # Template → instance generation (idempotent)
│   │       └── scheduler.ts      # Cron-based daily generation
│   └── client/
│       ├── index.html            # SPA shell, loads branding CSS from Portal
│       ├── main.tsx              # React entry point, detects Portal proxy basename
│       ├── App.tsx               # Router setup, SharedSidebar + SharedHeader layout
│       ├── styles.css            # Global styles with light/dark theme support
│       ├── api/
│       │   └── client.ts         # Fetch wrapper, auto-detects Portal proxy prefix
│       ├── pages/
│       │   ├── Dashboard.tsx     # Department overview with stats
│       │   ├── Tasks.tsx         # Department-scoped task list with create modal
│       │   ├── MyTasks.tsx       # Current user's assigned tasks
│       │   ├── TaskDetail.tsx    # Task detail with audit history
│       │   ├── Templates.tsx     # Template management (manager/admin)
│       │   └── Departments.tsx   # Department and member management
│       └── components/
│           └── shared/
│               ├── SharedHeader.tsx  # Common header: search, theme toggle, user menu
│               └── SharedSidebar.tsx # Common sidebar: nav, app selector, bug report
├── tests/
│   ├── recurrence.test.ts        # Cadence calculation tests (all types + edge cases)
│   ├── authorization.test.ts     # Department membership assertion tests
│   ├── task-generation.test.ts   # Idempotent generation + P2002 skip tests
│   └── completion.test.ts        # AuditService.diff field change detection tests
├── prisma/
│   └── schema.prisma             # Database schema (6 models, 5 enums)
├── Dockerfile                    # Multi-stage build (builder → Alpine production)
├── docker-compose.yml            # Production Docker deployment
├── package.json                  # ESM project config, scripts, dependencies
├── tsconfig.json                 # Client TS config (strict, JSX, DOM libs, noEmit)
├── tsconfig.server.json          # Server TS config (strict, outDir: dist/server)
├── vite.config.ts                # Vite config (root: src/client, proxy /api to :3008)
└── vitest.config.ts              # Test config (environment: node, tests/**/*.test.ts)
```

## Architecture Overview

This service is one of 12+ microservices in the Definit platform. All traffic enters through **Caddy** (HTTPS reverse proxy) → **Portal** (auth + routing) → individual services. Portal authenticates users via Microsoft Entra ID (OAuth2), then proxies requests to services with user identity in HTTP headers (`x-portal-user-id`, `x-portal-user-email`, `x-portal-user-name`). A shared secret (`PORTAL_SHARED_SECRET` / `x-portal-secret` header) validates that requests originate from Portal. In development, the secret check is skipped.

**Task lifecycle**: Templates define recurring work with a cadence and recurrence rule (JSON). The `SchedulerService` runs a cron job (default: daily at 1 AM) that triggers `TaskGenerationService` to create `TaskInstance` records for a 60-day rolling window. Generation is idempotent — duplicate attempts are caught via a unique constraint on `(templateId, dueDate)` as Prisma P2002 errors and silently skipped. One-off tasks can also be created directly without a template.

**Authorization** is department-scoped with three roles: `member` (view and complete tasks), `manager`/`admin` (also create/edit templates). The `AuthorizationService` enforces role checks on every mutating operation.

```
┌──────────┐    HTTPS    ┌───────────┐  proxy   ┌──────────────────┐
│  Client   │ ─────────▶ │  Caddy    │ ───────▶ │  Portal (:3000)  │
│ (Browser) │            │  (:443)   │          │  Auth + Routing  │
└──────────┘            └───────────┘          └────────┬─────────┘
                                                        │ x-portal-* headers
                                               ┌────────▼─────────┐
                                               │ RecurringTasks   │
                                               │ (:3008)          │
                                               │ ┌──────────────┐ │
                                               │ │ Scheduler    │ │ (node-cron, 1 AM)
                                               │ └──────────────┘ │
                                               └────────┬─────────┘
                                                        │ Prisma
                                               ┌────────▼─────────┐
                                               │ PostgreSQL (:5432)│
                                               │ DB: recurring_tasks│
                                               └──────────────────┘
```

### Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| RecurrenceService | `src/server/services/recurrence.ts` | Calculates due dates from recurrence rules; handles business day adjustments (previous/next/none), nth-weekday-of-month, last-business-day, day-of-month capping |
| TaskGenerationService | `src/server/services/task-generation.ts` | Generates TaskInstances from active templates; idempotent via unique constraint; 60-day default window |
| AuthorizationService | `src/server/services/authorization.ts` | Enforces department membership and role checks (`assertMember`, `assertManagerOrAdmin`) |
| AuditService | `src/server/services/audit.ts` | Records field-level changes with actor, action type, and `diff()` utility for detecting changes |
| SchedulerService | `src/server/services/scheduler.ts` | Wraps node-cron; creates a system user for audit trail; runs initial generation on startup |
| Auth middleware | `src/server/middleware/auth.ts` | Fastify plugin: validates `x-portal-secret`, extracts user from `x-portal-user-*` headers, upserts local User |
| API Client | `src/client/api/client.ts` | Typed fetch wrapper; auto-detects Portal proxy prefix (`/apps/recurring-tasks` vs `/`) |

### Data Model

See @prisma/schema.prisma for the full schema. Six Prisma models with five enums:

- **User** — synced from Portal via `portalUserId`; upserted on first request
- **Department** — organizational unit; users access tasks only in their departments
- **DepartmentMembership** — join with role enum: `member` | `manager` | `admin`
- **TaskTemplate** — recurring task definition with cadence, recurrence rule (JSON), proof requirement, SOP link
- **TaskInstance** — generated occurrence; status: `not_started` | `in_progress` | `blocked` | `done`; unique on `(templateId, dueDate)`
- **AuditLog** — immutable log; entity types: `template` | `task`; actions: `create` | `update` | `delete` | `complete` | `reopen`

### Recurrence Rule JSON Format

The `recurrenceRule` field on TaskTemplate/TaskInstance stores cadence-specific JSON:

- **Daily**: `{ "businessDaysOnly": true }` (default true)
- **Weekly**: `{ "weekday": 0 }` (0=Mon..6=Sun)
- **Monthly**: `{ "dayOfMonth": 15 }` OR `{ "nthWeekday": { "n": 2, "weekday": 1 } }` OR `{ "lastBusinessDay": true }`
- **Quarterly**: same as monthly + optional `{ "months": [3,6,9,12] }` (default quarter-end months)
- **Annual**: `{ "month": 1, "day": 15 }` OR `{ "nthWeekday": { "month": 6, "n": 3, "weekday": 2 } }`
- All types accept optional `"businessDayAdjust": "none" | "previous" | "next"` (default: `"previous"`)

## Development Guidelines

### File Naming
- **Server files**: kebab-case (`task-generation.ts`, `authorization.ts`)
- **Client pages**: PascalCase (`Dashboard.tsx`, `MyTasks.tsx`, `TaskDetail.tsx`)
- **Client shared components**: PascalCase (`SharedHeader.tsx`, `SharedSidebar.tsx`)
- **Client utilities**: camelCase (`client.ts`)
- **Test files**: kebab-case matching the service (`recurrence.test.ts`, `task-generation.test.ts`)

### Code Naming
- **Functions/variables**: camelCase (`getPortalUser`, `selectedDept`, `handleSubmit`)
- **Classes**: PascalCase (`SchedulerService`, `RecurrenceService`)
- **Types/interfaces**: PascalCase (`PortalUser`, `AuditLogParams`, `RecurrenceRule`)
- **React components**: PascalCase, default export (`export default function Dashboard()`)
- **Service singletons**: camelCase instance export alongside class (`export const auditService = new AuditService()`)
- **Enum values (Prisma)**: snake_case (`not_started`, `in_progress`, `blocked`, `done`)
- **Config**: plain object, camelCase keys (`config.portalSharedSecret`)

### Import Conventions
- Server files use `.js` extensions in imports (ESM requirement): `from '../lib/db.js'`
- Client files omit extensions: `from '../api/client'`
- Order: external packages → internal imports → styles
- Prisma types from `@prisma/client`
- No barrel exports; import directly from source files

### Service Pattern
Services are classes exported alongside a singleton instance:
```typescript
export class RecurrenceService {
  // methods
}
export const recurrenceService = new RecurrenceService();
```
Tests instantiate the class directly; route handlers use the singleton.

### Route Pattern
Routes are async functions registered as Fastify plugins with a prefix:
```typescript
export async function taskRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => { /* ... */ });
}
// In app.ts:
await app.register(taskRoutes, { prefix: '/api/tasks' });
```
All routes access `request.user` (attached by auth middleware). Authorization is checked at the start of each handler via `authorizationService.assertMember()` or `assertManagerOrAdmin()`.

### Client Portal Mode
The client detects if it's running behind Portal's proxy by checking `window.location.pathname.startsWith('/apps/recurring-tasks')`. This affects:
- `BrowserRouter` basename in `main.tsx`
- API base URL in `api/client.ts` (`/api/apps/recurring-tasks` vs `/api`)

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server + client concurrently (dev mode) |
| `npm run dev:server` | Start only the Fastify server with tsx watch |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run build` | Build client (Vite) and server (tsc) for production |
| `npm start` | Run production build (`node dist/server/server/index.js`) |
| `npm test` | Run Vitest tests once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:generate` | Regenerate Prisma client from schema |
| `npm run db:push` | Push schema changes directly to database (dev) |
| `npm run db:migrate` | Create and apply a Prisma migration |

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | — |
| `PORT` | No | Server port | `3008` |
| `NODE_ENV` | No | Environment mode | `development` |
| `PORTAL_SHARED_SECRET` | Yes (prod) | Shared secret for Portal→service auth | `dev-internal-secret-change-in-prod` |
| `GENERATION_SCHEDULE` | No | Cron expression for task generation | `0 1 * * *` (daily 1 AM) |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/auth/me` | Yes | Current user info |
| GET | `/api/departments` | Yes | User's departments with counts |
| GET | `/api/departments/:id/members` | Yes | Department members with roles (no dept-membership check — any authenticated user can query any department) |
| GET | `/api/tasks?departmentId=&status=&from=&to=&page=&limit=` | Yes | List tasks by department |
| GET | `/api/tasks/mine?status=&from=&to=&page=&limit=` | Yes | Current user's tasks |
| GET | `/api/tasks/:id` | Yes | Task detail with audit logs |
| POST | `/api/tasks` | Yes | Create one-off task |
| PATCH | `/api/tasks/:id` | Yes | Update task fields |
| POST | `/api/tasks/:id/complete` | Yes | Mark task done (enforces proof if required) |
| POST | `/api/tasks/:id/reopen` | Yes | Reopen completed task |
| GET | `/api/templates?departmentId=` | Yes | List templates |
| POST | `/api/templates` | Manager+ | Create template (triggers generation) |
| PATCH | `/api/templates/:id` | Manager+ | Update template |
| DELETE | `/api/templates/:id` | Manager+ | Delete template + future not_started instances |
| POST | `/api/generate` | Yes | Manual task generation trigger |

## Testing

- **Framework**: Vitest (environment: node)
- **Location**: `tests/*.test.ts`
- **Run**: `npm test` (single run) or `npm run test:watch` (watch mode)
- **Mocking**: Prisma is mocked with `vi.mock('../src/server/lib/db.js')`, logger with `vi.mock('../src/server/lib/logger.js')`
- **Key test areas**: recurrence calculations for all cadence types, business day edge cases, authorization role checks, idempotent generation (P2002 handling), audit field diff detection

## Deployment

The service runs as Docker container `apps_definit_recurring_tasks` on `apps_definit_network`:

```bash
# Shared infrastructure must be running first:
cd C:\Docker\Infrastructure
docker compose up -d   # Starts Caddy + PostgreSQL

# Build and deploy this service:
cd C:\Docker\RecurringTasks
docker compose up -d --build

# View logs:
docker logs apps_definit_recurring_tasks -f
```

The Dockerfile uses a multi-stage build: full dependencies + Prisma generate + Vite/tsc build in a `builder` stage. The production stage starts a fresh `node:20-alpine` image, installs `openssl` (required by Prisma), runs `npm install --omit=dev` and `npx prisma generate` independently, then copies the built `dist/` from the builder. The container connects to `apps_definit_postgres` on the shared Docker network.

## Platform Context

This service is part of the **Definit** platform ecosystem. All services share:
- **Shared PostgreSQL** — each service has its own database on the same server
- **Portal authentication** — Microsoft Entra ID OAuth, user identity passed via `x-portal-*` HTTP headers
- **Docker networking** — `apps_definit_network` bridge, containers reference each other by name (`apps_definit_{service}`)
- **Caddy reverse proxy** — HTTPS termination at `apps.definit.com`, routes all traffic through Portal
- **Standard stack** — Fastify + React + Prisma + Pino + Vitest across all services
- **Shared UI components** — SharedHeader and SharedSidebar copied from Portal for consistent UX
- **Branding** — client loads CSS from Portal's `/api/branding/css` endpoint
