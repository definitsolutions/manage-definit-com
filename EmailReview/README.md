# Executive Email Review (EER)

Private internal web app for executive email oversight and missed follow-up detection. Connects to Microsoft 365 via Graph API, ingests inbox and sent mail, identifies client conversations, scores risk, and presents a dashboard with AI-enhanced analysis.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Dashboard │  │  Digest  │  │     Config       │  │
│  │   Page    │  │   Page   │  │      Page        │  │
│  └─────┬─────┘  └─────┬────┘  └────────┬────────┘  │
│        │              │                │            │
│  ┌─────┴──────────────┴────────────────┴─────────┐  │
│  │              API Routes (Next.js)              │  │
│  └─────────────────────┬─────────────────────────┘  │
│                        │                            │
│  ┌─────────────────────┴─────────────────────────┐  │
│  │              Services Layer                    │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │  Graph   │ │   Sync   │ │   Thread      │  │  │
│  │  │ Service  │ │  Service │ │  Analysis     │  │  │
│  │  └─────────┘ └──────────┘ └───────────────┘  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │  Rules  │ │    AI    │ │    Digest     │  │  │
│  │  │ Engine  │ │  Service │ │   Service     │  │  │
│  │  └─────────┘ └──────────┘ └───────────────┘  │  │
│  │  ┌─────────┐ ┌──────────┐                    │  │
│  │  │ Config  │ │ Category │                    │  │
│  │  │ Service │ │  Service │                    │  │
│  │  └─────────┘ └──────────┘                    │  │
│  └───────────────────────────────────────────────┘  │
│                        │                            │
│  ┌─────────────────────┴─────────────────────────┐  │
│  │           Prisma ORM + PostgreSQL              │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
        │                              │
   Microsoft Graph               OpenAI API
   (Mail.Read, Mail.ReadWrite)   (gpt-4o)
```

### Key Design Decisions

- **Deterministic rules first, AI second.** The rules engine is the source of truth for threading, timing, client identity, and detection. AI enhances with summarization and classification.
- **Single mailbox V1.** Data model supports multi-user, but V1 targets one user's inbox.
- **Mock mode.** Set `MOCK_MODE=true` to run the full UI with realistic fake data — no Azure or OpenAI credentials needed.
- **No auto-send.** Draft replies are generated in the UI for copy/paste. No emails are sent from this app.

## Stack

- **Next.js 15** (App Router, server actions)
- **TypeScript** (strict mode)
- **Prisma 6** + PostgreSQL 16
- **Microsoft Graph API** (delegated OAuth)
- **OpenAI API** (gpt-4o)
- **Tailwind CSS v4**
- **iron-session** (encrypted cookie sessions)

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (local or Docker)
- Azure Entra ID app registration (for live mode)
- OpenAI API key (for AI features)

### 1. Clone and install

```bash
cd executive-email-review
npm install
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Database

```bash
# Push schema to database
npx prisma db push

# Seed default config, sample client domains, VIP contacts
npx tsx prisma/seed.ts

# (Optional) View database in browser
npx prisma studio
```

### 4. Azure App Registration (live mode only)

1. Go to Azure Portal > Entra ID > App registrations > New registration
2. Name: `Executive Email Review`
3. Supported account types: Single tenant
4. Redirect URI: `http://localhost:3000/api/auth/callback` (Web)
5. Under API permissions, add delegated: `Mail.Read`, `Mail.ReadWrite`, `User.Read`
6. Under Certificates & secrets, create a client secret
7. Copy Client ID, Tenant ID, and Secret into `.env`

### 5. Run

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

### 6. Mock mode (no Azure needed)

Set `MOCK_MODE=true` in `.env` and visit `http://localhost:3000`. Click "Sign in with Microsoft" — it will create a mock session and redirect to the dashboard with realistic sample data.

## Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up -d

# Run migrations inside the container
docker exec -it executive_email_review npx prisma db push
docker exec -it executive_email_review npx tsx prisma/seed.ts
```

The app runs on port 3015 by default. Put it behind Caddy or your existing reverse proxy.

## Features

### Dashboard
- KPI cards: Needs Reply, Waiting on Team, Stale Threads, Promises/Follow-ups, VIP/High Priority, Total Flagged
- Filterable thread list sorted by priority score
- Click any thread for full detail view

### Detection (Rules Engine)
- Unread client emails older than configurable threshold
- Threads where last sender was client
- Threads with no internal reply after client message
- Stale threads with no activity for N hours
- Urgency language detection (outage, down, urgent, etc.)
- Commitment/promise detection with follow-up tracking
- VIP contact alerting

### AI Layer (OpenAI)
- Thread summarization
- Classification (needs_action, monitoring, resolved, informational)
- Priority assignment
- Suggested next action
- Draft reply generation
- Flag explanation

### Digest
- Generate on-demand executive digest
- Top N items grouped by urgency
- Plain text version for email forwarding
- Digest history tracking

### Configuration
- Client domains (with company name)
- VIP contacts (with priority levels)
- Ignored domains (filtered from analysis)
- Threshold tuning (stale hours, unread hours, sync depth)
- Urgency keywords and commitment phrases
- Digest schedule settings

### Outlook Integration
- App-defined category labels (EER: Needs Reply, VIP, Reviewed, etc.)
- Category sync to mailbox
- Per-message categorization

## Database Schema

Core models: User, Message, Thread, ClientDomain, VipContact, IgnoredDomain, ThreadFlag, AIAnalysis, DigestRun, AppSetting, AuditLog.

See `prisma/schema.prisma` for the full schema.

## What's Complete vs Stubbed

### Fully Implemented
- Complete Prisma schema with all models
- Microsoft Graph OAuth flow (login, callback, token refresh)
- Mail sync service (inbox + sent items, dedup by stable ID)
- Thread grouping and rebuild from messages
- Full rules engine with 7 flag types
- AI analysis and draft reply generation via OpenAI
- Dashboard with KPI cards and filtered thread list
- Thread detail view with message timeline
- AI summary panel
- Reply draft generation and editing
- Digest generation (structured + plain text)
- Config management UI (domains, VIPs, thresholds)
- Outlook category management
- Mock mode with realistic data
- Audit logging
- Docker deployment setup

### Not Yet Built (V2)
- Cron-based automatic sync (currently manual trigger)
- Keyword/phrase editor in config UI (currently API-only)
- Shared mailbox support
- Outlook draft creation via Graph (currently copy/paste)
- Teams notification alerts
- Halo/PSA ticket integration
- Account-owner assignment per client
- SLA policy enforcement
- Auto-categorization rules in Outlook
- Scheduled email digest send (currently on-demand)
- Multi-tenant / multi-user role support
- Search and date range filtering in thread list
- Bulk thread actions (review/dismiss multiple)
- Webhook-based real-time sync (Graph subscriptions)

## Project Structure

```
executive-email-review/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data for dev
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # OAuth login, callback, session
│   │   │   ├── sync/          # Mail sync trigger
│   │   │   ├── threads/       # Thread CRUD, analyze, draft
│   │   │   ├── digest/        # Digest generation
│   │   │   ├── config/        # Configuration management
│   │   │   └── categories/    # Outlook category management
│   │   ├── dashboard/         # Main dashboard page
│   │   ├── thread/[id]/       # Thread detail page
│   │   ├── digest/            # Digest page
│   │   └── config/            # Config page
│   ├── components/            # React components
│   ├── lib/                   # Prisma client, auth, utilities
│   ├── services/              # Business logic layer
│   ├── types/                 # TypeScript type definitions
│   └── mock/                  # Mock data for dev mode
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Security Notes

- Private internal app — not designed for public internet exposure
- OAuth tokens stored encrypted in database
- Session cookies are HttpOnly, Secure (in production), SameSite=Lax
- No secrets in source code — all via environment variables
- No emails are auto-sent; draft replies are informational only
- Audit log tracks syncs, reviews, config changes, and logins
- Role model assumes single admin user (owner) for V1
