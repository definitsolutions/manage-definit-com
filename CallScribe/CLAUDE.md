# CallScribe — Call Recording, Transcription & Notes

## Purpose

Android app that auto-records phone calls for specific tracked numbers, uploads recordings to a backend service for transcription via Whisper + Claude, emails formatted transcripts, and provides a web UI for viewing transcripts and adding notes.

## Architecture

```
Android App (Pixel/Samsung/etc)
  │  Records calls via AudioRecord
  │  Uploads WAV to backend via HTTPS
  │
  ▼
Cloudflare Access (service token auth)
  │
  ▼
manage.definit.com/callscribe/*
  │
  ▼
Caddy → CallScribe container (:3020)
  │
  ├─ POST /api/recordings    ← Android upload (Bearer auth)
  │    ├─ Save WAV to disk
  │    ├─ OpenAI Whisper → raw transcript
  │    ├─ Claude → formatted transcript (summary + action items)
  │    └─ SMTP → email to r.mcnicholas@definit.com
  │
  ├─ GET /api/recordings     ← Web UI (CF Access auth)
  ├─ GET /api/recordings/:id ← View transcript
  ├─ PATCH /api/recordings/:id/notes ← Add/edit notes
  │
  └─ Static React frontend   ← Web UI at /callscribe/
       ├─ Recordings list (filter by number, search)
       ├─ Transcript viewer (formatted markdown)
       └─ Notes editor (auto-save)
```

## Components

### Backend (this directory)

| Component | Details |
|-----------|---------|
| **Runtime** | Node.js 20, Fastify 5, TypeScript (ES modules) |
| **Database** | PostgreSQL 16 via Prisma ORM |
| **Frontend** | React 18, Vite, React Router, lucide-react icons |
| **Transcription** | OpenAI Whisper API (speech-to-text) → Claude Sonnet (formatting) |
| **Email** | Nodemailer via SMTP2GO (mail.smtp2go.com:2525) |
| **Storage** | Docker volume at `/app/storage/recordings/` |
| **Auth** | Dual: Bearer API key (Android) + Cloudflare Access header (web) |

### Android App (`C:\Users\RobertMcNicholas\Projects\CallScribe\android\`)

| Component | Details |
|-----------|---------|
| **Language** | Kotlin, minSdk 33, targetSdk 35 |
| **UI** | Jetpack Compose, Material 3 |
| **DI** | Hilt |
| **Database** | Room (tracked numbers + recording history) |
| **Upload** | Retrofit + OkHttp, WorkManager (reliable, survives reboots) |
| **Recording** | `CallMonitorService` — foreground service with TelephonyCallback |
| **Audio sources** | Tries in order: VOICE_CALL → VOICE_COMMUNICATION → MIC |
| **Credentials** | EncryptedSharedPreferences |

## Audio Source Behavior by Device

| Device | VOICE_CALL | VOICE_COMMUNICATION | MIC |
|--------|-----------|---------------------|-----|
| Pixel (non-rooted) | Blocked | Near-side only | Near-side only |
| Pixel (rooted/Magisk) | Both sides | Both sides | Near-side |
| Samsung Galaxy | Usually works (both sides) | Sometimes both | Near-side |
| Other OEMs | Varies | Varies | Near-side |

**Rooting requirement:** Pixel devices purchased from Verizon have locked bootloaders and cannot be rooted. Pixels purchased from the Google Store can be rooted via Magisk for full VOICE_CALL access.

## Database Schema

### PostgreSQL (`callscribe` database)

**recordings** table:
- `id` (UUID, PK) — recording identifier
- `phone_number` (text) — E.164 format (+1XXXXXXXXXX)
- `direction` (text) — "incoming" or "outgoing"
- `started_at` (timestamp) — call start time
- `duration_seconds` (int) — call duration
- `audio_file_path` (text) — filename in storage volume
- `audio_file_size` (bigint) — file size in bytes
- `transcript_status` (text) — pending → processing → completed / failed
- `transcript` (text) — formatted markdown transcript
- `transcript_error` (text) — error message if transcription failed
- `email_sent` (boolean) — whether transcript was emailed
- `email_sent_at` (timestamp) — when email was sent
- `email_error` (text) — SMTP error if email failed
- `notes` (text) — user-added notes via web UI
- `created_at`, `updated_at` (timestamps)

**users** table:
- `id` (UUID, PK)
- `email` (text, unique) — from Cloudflare Access header
- `display_name` (text)

### Android Room (`callscribe.db`)

**tracked_numbers** — phone numbers to auto-record
**recordings** — local recording history + upload status

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/recordings` | Bearer | Upload recording (multipart: audio + metadata) |
| GET | `/api/recordings` | CF Access / Bearer | List recordings (pagination, search, filter by number) |
| GET | `/api/recordings/:id` | CF Access / Bearer | Get recording with full transcript |
| GET | `/api/recordings/:id/status` | Bearer | Check transcription status (mobile polling) |
| PATCH | `/api/recordings/:id/notes` | CF Access | Update notes |
| GET | `/api/recordings-meta/phone-numbers` | CF Access | Unique phone numbers with counts (sidebar) |
| GET | `/api/health` | None | Health check |
| GET | `/api/auth/me` | CF Access | Current user info |

## Web UI

Three-column Zendesk-style layout matching RecurringTasks and Notes:
- **Icon Rail** (48px) — shared across all manage.definit.com apps (Home, RecurringTasks, Notes, CallScribe)
- **Sidebar** (260px) — All Recordings + filter by phone number
- **Main** — recordings list or transcript detail view with notes editor

PhoneCall icon from lucide-react in the icon rail.

## File Structure

```
/opt/docker/CallScribe/
├── CLAUDE.md                           # This file
├── Dockerfile
├── package.json
├── tsconfig.json / tsconfig.server.json
├── vite.config.ts
├── prisma/schema.prisma
├── scripts/start.sh
├── src/
│   ├── client/                         # React frontend (Vite)
│   │   ├── index.html
│   │   ├── main.tsx                    # BrowserRouter basename="/callscribe"
│   │   ├── styles.css
│   │   ├── App.tsx                     # Layout + routing
│   │   ├── api/client.ts              # API_BASE='/callscribe/api'
│   │   ├── components/shared/
│   │   │   └── SharedIconRail.tsx     # Includes CallScribe icon
│   │   └── pages/
│   │       ├── RecordingsView.tsx      # Recording list
│   │       └── RecordingDetail.tsx     # Transcript + notes editor
│   └── server/                         # Fastify backend
│       ├── index.ts                    # Entry point
│       ├── app.ts                      # Fastify setup, static serving, auth
│       ├── config.ts                   # Environment variables
│       ├── middleware/auth.ts          # Dual auth (Bearer + CF Access)
│       ├── routes/
│       │   ├── recordings.ts          # Upload, list, detail, notes, phone-numbers
│       │   ├── auth.ts                # /api/auth/me
│       │   └── health.ts             # /api/health
│       └── services/
│           ├── transcription.ts       # Whisper STT + Claude formatting
│           ├── email.ts               # SMTP2GO email
│           └── storage.ts            # File storage helpers
```

## Cloudflare Access

- **Service Token** for Android app: CF-Access-Client-Id + CF-Access-Client-Secret headers
- **Service Auth policy** on manage.definit.com application allows the "callscribe" service token
- Web UI users authenticate via standard Cloudflare Access (@definit.com email)

## Development

```bash
# Backend local dev
cd /opt/docker/CallScribe
npm run dev:server    # Fastify on :3020
npm run dev:client    # Vite on :5180 (proxies /callscribe/api to :3020)

# Build
npm run build         # Builds client (Vite) + server (tsc)

# Rebuild container
cd /opt/docker && docker compose up -d --build callscribe

# View logs
docker logs manage_callscribe --tail 50 -f

# Database
docker exec -it manage_postgres psql -U callscribe -d callscribe
```

## Android App Build

```bash
# Build (from C:\Users\RobertMcNicholas\Projects\CallScribe\android\)
export ANDROID_HOME="/c/Users/RobertMcNicholas/AppData/Local/Android/Sdk"
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.18.8-hotspot"
./gradlew assembleDebug

# Install via ADB
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Known Issues / Status

- **Verizon Pixel bootloader locked** — VOICE_CALL audio source blocked, near-side recording only. Google Store Pixel 10 XL (unlocked) incoming — will root with Magisk for both-side recording.
- **SMTP** — Using SMTP2GO (mail.smtp2go.com:2525). M365 direct SMTP was rejected.
- **Icon Rail** — CallScribe (PhoneCall icon) added to SharedIconRail in RecurringTasks, Notes, and CallScribe.
- **Transcription pipeline working** — Whisper + Claude produce formatted transcripts with summaries and action items.
- **Upload pipeline working** — Android WorkManager reliably uploads with exponential backoff and CF Access service token auth.

## TODO

- [ ] Root Pixel 10 XL (Google Store, unlocked) with Magisk for VOICE_CALL both-side recording
- [ ] Finish audio source fallback chain (VOICE_CALL → VOICE_COMMUNICATION → MIC)
- [ ] Improve near-side-only transcript prompt (tell Claude it's one-sided)
- [ ] Test SMTP2GO email delivery end-to-end
- [ ] Add recording playback to web UI
- [ ] Add auto-cleanup of old audio files (90-day retention)
