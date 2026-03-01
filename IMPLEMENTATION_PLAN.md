# Clinic Patient Booking System — Implementation Plan
*Last updated: March 2026 · Reflects actual implemented codebase*

---

## What This System Is

A multi-doctor clinic appointment management system delivered as a Progressive Web App (PWA). Patients get a **queue token** for today — no date/time slot picking. Staff manage the live queue from a dashboard.

| Channel | How It Works |
|---|---|
| **Online** | Patient visits website → picks session (Morning/Evening) → fills form → gets token number |
| **Walk-in** | Receptionist/Doctor books on behalf of patient from staff dashboard |
| **Emergency** | Staff inserts emergency token directly into the active queue |
| **Missed Call** | *(Deferred — infrastructure exists, not yet live)* |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + **TypeScript** |
| Styling | Tailwind CSS (tokens: teal `#0A7B6C`, ink `#0D1117`, bg `#EEF2EF`) |
| PWA | vite-plugin-pwa + Workbox service worker |
| State | Zustand (`bookingStore.ts`) |
| Backend | Node.js 20 + Express.js + **TypeScript** |
| Auth | JWT (jsonwebtoken) + bcrypt cost 12 |
| Database | PostgreSQL 16 — **Neon** (cloud, serverless) |
| DB Client | `pg` (node-postgres) + raw SQL — no ORM |
| SMS | MSG91 API (mock in dev via `SMS_MOCK=true`) |
| Background Jobs | **Vercel Cron** (replaces node-cron) |
| Hosting | **Vercel** (frontend + backend both on Vercel, auto-deploy from GitHub) |
| Timezone | All time logic uses IST (`getIST()` util — safe on UTC servers) |

> **No NGINX, no PM2, no DigitalOcean.** Vercel handles deployment, SSL, and scaling.

---

## Project Structure

```
clinic-patient-booking-system/
├── frontend/                          # React + Vite PWA (TypeScript)
│   ├── index.html                     # Entry: loads /src/main.tsx
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/                     # 192px, 512px, maskable
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                    # React Router routes; LandingPage eager, all other pages React.lazy()
│       ├── index.css                  # Tailwind + global tokens
│       ├── types/index.ts             # Shared TypeScript types
│       ├── pages/
│       │   ├── patient/
│       │   │   ├── LandingPage.tsx        # Clinic info + session preview + channel tabs
│       │   │   ├── SessionPickerPage.tsx  # Pick Morning/Evening session
│       │   │   ├── PatientFormPage.tsx    # Name, phone, gender (req), DOB, email, height, weight, reason, DPDPA consent
│       │   │   ├── ReviewPage.tsx         # Confirm details; re-validates session before submit
│       │   │   ├── ConfirmedPage.tsx      # Token #N + live queue position polling (20s)
│       │   │   ├── PatientDashboard.tsx   # Returning patient: upcoming + past tokens
│       │   │   └── MissedCallHowItWorks.tsx  # (Placeholder — missed call deferred)
│       │   ├── staff/
│       │   │   ├── LoginPage.tsx          # Email + password; stores token, role, userName, doctorId, userPhoto
│       │   │   ├── QueueDashboard.tsx     # 7 status tabs; date range (doctor/admin) or today (receptionist)
│       │   │   ├── WalkInBookingForm.tsx  # Doctor auto-assigns self; duplicate patient warning
│       │   │   ├── MyProfile.tsx          # Profile + password change for all staff roles
│       │   │   └── PatientSearch.tsx
│       │   └── admin/
│       │       ├── ScheduleConfig.tsx     # Weekly sessions per doctor; max tokens per session
│       │       ├── BlockedDates.tsx       # Per-doctor blocked dates
│       │       ├── StaffManagement.tsx    # Admin creates/deactivates staff accounts
│       │       ├── Reports.tsx            # Appointment stats; doctor picker for admin/receptionist
│       │       └── missed-call/
│       │           ├── MCAdminDashboard.tsx
│       │           └── MCBlacklist.tsx
│       ├── components/
│       │   ├── ui/
│       │   │   ├── StatusPill.tsx
│       │   │   └── ProgressBar.tsx
│       │   └── layout/
│       │       ├── PatientShell.tsx       # Step indicator + back nav for booking flow
│       │       ├── StaffShell.tsx         # Sidebar nav; user photo; logout clears all 5 localStorage keys
│       │       └── ProtectedRoute.tsx
│       ├── services/
│       │   └── api.ts                     # Axios instance + all API calls (typed)
│       └── store/
│           └── bookingStore.ts            # Zustand: selectedSession, patientDetails, confirmedAppointment
│
├── backend/                           # Node.js + Express (TypeScript)
│   ├── api/
│   │   └── index.ts                   # Vercel serverless entry point
│   ├── vercel.json                    # Builds + routes + cron schedule
│   └── src/
│       ├── server.ts                  # Express app bootstrap
│       ├── app.ts                     # Express middleware + router mount
│       ├── config/env.ts              # Typed env variable access
│       ├── types/index.ts             # Shared types (Session, Appointment, AuthUser with doctorId)
│       ├── routes/index.ts            # All routes in one file
│       ├── controllers/
│       │   ├── clinic.ts              # GET /clinic/info
│       │   ├── queue.ts               # GET /queue/today, GET /queue/position/:refCode
│       │   ├── appointments.ts        # POST /appointments (patient self-book); initialStatus support
│       │   ├── auth.ts                # OTP send/verify + staff login (no self-register)
│       │   ├── patient.ts             # GET/PATCH /patient/appointments
│       │   ├── staff.ts               # Staff dashboard; walk-in; emergency; profile; notes
│       │   ├── admin.ts               # Schedule, blocked dates, staff mgmt, reports, getDoctors
│       │   └── missedCall.ts          # Webhook + SMS reply handlers (deferred)
│       ├── middleware/
│       │   ├── auth.ts                # verifyToken, requireStaff, requireAdmin, requireDoctorOrAdmin, requirePatient
│       │   ├── rateLimiter.ts         # publicLimiter, otpSendLimiter, loginLimiter
│       │   ├── hmacVerify.ts          # MSG91 webhook HMAC-SHA256
│       │   └── validate.ts            # Joi schemas per endpoint
│       ├── services/
│       │   ├── slotEngine.ts          # Legacy slot generation (kept for slotAvailability checks)
│       │   ├── notification.ts        # Queue + send SMS/reminder logic
│       │   ├── sms.ts                 # MSG91 outbound wrapper (mock-safe)
│       │   └── spamFilter.ts          # Missed-call spam + session expiry
│       ├── utils/
│       │   └── time.ts                # getIST() — IST-aware date/time (critical for Vercel UTC)
│       └── db/
│           ├── pool.ts                # pg Pool singleton
│           └── migrate.ts             # Migration runner
│
└── database/
    ├── migrations/
    │   ├── 001_merged_schema.sql      # Full initial schema
    │   ├── 002_add_patient_vitals.sql # height_cm, weight_kg on patients
    │   ├── 003_clinic_settings.sql    # clinic_settings key/value table
    │   ├── 004_audit_action_enum.sql  # Additional audit_action enum values
    │   └── 005_multi_doctor_roles.sql # arrived_waiting, with_doctor statuses; photo_url; data migration
    └── seeds/
        └── 001_seed_doctor.sql
```

---

## Database Migrations

### `001_merged_schema.sql` — Full initial schema

### Core Tables
| Table | Purpose |
|---|---|
| `users` | Staff, doctor, admin accounts (NOT patients); has `photo_url VARCHAR(500)` |
| `doctors` | Public doctor profile, linked 1:1 to users |
| `schedules` | Weekly sessions per doctor; `sessions_json` array; `max_appointments` fallback |
| `blocked_dates` | Holiday/leave overrides per doctor; full-day or partial time range |
| `patients` | Auto-created from first booking; phone is the unique identifier |
| `appointments` | Core table; `token_number`, `session_index`, `is_emergency`, `status` columns |
| `clinic_settings` | Key/value store for clinic-level config (clinic name, etc.) |
| `notifications` | Full log of every SMS sent or attempted |
| `audit_logs` | Immutable append-only action trail |

### Missed Call Tables (schema exists, feature deferred)
`missed_call_events`, `missed_call_sessions`, `missed_call_rate_limits`, `phone_blacklist`, `missed_call_config`, `missed_call_velocity`

### `002_add_patient_vitals.sql` — Patient vitals columns

```sql
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS height_cm  SMALLINT     CHECK (height_cm > 0 AND height_cm < 300),
  ADD COLUMN IF NOT EXISTS weight_kg  NUMERIC(5,2) CHECK (weight_kg > 0 AND weight_kg < 500);
```

### `003_clinic_settings.sql` — Clinic settings table

```sql
CREATE TABLE IF NOT EXISTS clinic_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);
```

### `004_audit_action_enum.sql` — Additional audit enum values
Adds `clinic_settings_updated`, `doctor_profile_updated`, `staff_details_updated`.

### `005_multi_doctor_roles.sql` — Multi-doctor roles migration

- Adds `arrived_waiting`, `with_doctor` to `appointment_status` enum
- Adds `photo_url VARCHAR(500)` to `users` table
- Migrates old statuses: `confirmed → booked`, `arrived → arrived_waiting`
- Drops `confirmed_at` column (confirmation step removed from flow)
- Adds new audit_action values: `appointment_arrived`, `appointment_with_doctor`, `profile_updated`, `password_changed`, `doctor_deactivated_appointments_cancelled`

### Key Schema Details
- `appointments.status` enum: `booked | arrived_waiting | with_doctor | completed | cancelled | no_show`
- `appointments` has `token_number INTEGER`, `session_index SMALLINT`, `is_emergency BOOLEAN`
- `slot_time` / `slot_end_time` are nullable (kept for backward compat, always NULL for new bookings)
- `UNIQUE INDEX uq_appt_token ON appointments(doctor_id, appointment_date, session_index, token_number) WHERE status NOT IN ('cancelled')`
- `schedules.max_appointments` stores `9999` as sentinel when admin leaves session max blank
- Session-level `max` per session in `sessions_json` is the real per-session cap; if null → unlimited

---

## Token Queue System

### How it works
1. Admin configures **sessions** (e.g. Morning 9AM–1PM, Evening 5PM–8PM) per doctor in Schedule Config
2. Each session has an optional token cap; leaving it blank = unlimited
3. Patient picks an open session → fills form → gets **Token #N** (sequential integer)
4. Staff sees queue sorted by `is_emergency DESC, token_number ASC`
5. Emergency tokens (staff-created) jump to the top with "E" prefix
6. Patient polls `/api/queue/position/:refCode` every 20 seconds to see their position

### Appointment Status Flow

```
Online booking  →  booked
Walk-in         →  arrived_waiting   (skips booked)
Emergency       →  with_doctor       (skips booked + arrived_waiting)

booked → arrived_waiting → with_doctor → completed
  any stage → cancelled | no_show  (terminal)
```

### Session State Machine
| State | Condition | Patient Sees |
|---|---|---|
| Not Yet Open | `nowMins < session.from` | "Not Yet Open" badge; disabled card |
| Open | within time window & not full | "Book →" badge; clickable |
| Full | token count ≥ max | "Full" badge; disabled card |
| Ended | `nowMins >= session.to` | "Ended" badge; disabled card |

### IST Timezone (Critical)
Vercel servers run in UTC. Session times are stored in IST. All time comparisons use `getIST()` from `backend/src/utils/time.ts`:
```typescript
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = new Date(Date.now() + IST_OFFSET_MS);
// Read via getUTCHours() / getUTCDay() — never getHours()
```

---

## Complete API

### Public (4)
| Method | Path | Description |
|---|---|---|
| GET | `/api/clinic/info` | Doctor profile, today's sessions, clinic hours |
| GET | `/api/queue/today` | Today's sessions with token counts, open/full/ended state |
| GET | `/api/queue/position/:refCode` | Live queue position; tokensAhead; currentlyServing |
| POST | `/api/appointments` | Create appointment (patient self-book); returns token number |

### Patient Auth (2)
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/patient/otp/send` | Send 6-digit OTP to patient phone |
| POST | `/api/auth/patient/otp/verify` | Verify OTP → return 24h patient JWT |

### Patient — Authenticated (2)
| Method | Path | Description |
|---|---|---|
| GET | `/api/patient/appointments` | Upcoming + past appointments with token numbers |
| PATCH | `/api/patient/appointments/:id/cancel` | Cancel own appointment |

### Staff Auth (1)
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/staff/login` | Email + password → staff JWT with role, doctorId, photoUrl |

> Staff accounts are created by admin only. There is no self-registration endpoint.

### Staff — Authenticated (9)
| Method | Path | Description |
|---|---|---|
| GET | `/api/staff/me` | Get own profile |
| PATCH | `/api/staff/me` | Update own profile (name, email, photo; doctor fields for doctor role) |
| PATCH | `/api/staff/me/password` | Change own password |
| GET | `/api/staff/appointments` | Appointments with filters: `from`, `to`, `doctorId`, `patientName`, `patientPhone` |
| GET | `/api/staff/appointments/check-duplicate` | Check if patient already booked today |
| GET | `/api/staff/appointments/:id` | Single appointment detail |
| PATCH | `/api/staff/appointments/:id/status` | Update status per valid transition |
| PATCH | `/api/staff/appointments/:id/notes` | Add doctor notes (doctor/admin only) |
| POST | `/api/staff/appointments` | Walk-in booking (starts as `arrived_waiting`) |
| POST | `/api/staff/queue/emergency` | Emergency booking (starts as `with_doctor`) |
| GET | `/api/staff/patients/search` | Search by name or phone |

### Admin — Authenticated (11)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/doctors` | List active doctors for dropdowns |
| GET | `/api/admin/reports` | Stats + booking source; doctor filter via `doctorId` query param |
| GET | `/api/admin/schedule` | Get schedule; `doctorId` query param |
| PUT | `/api/admin/schedule` | Replace weekly schedule; `body.doctorId` |
| GET | `/api/admin/blocked-dates` | List blocked dates; `doctorId` query param |
| POST | `/api/admin/blocked-dates` | Block a date or time range; `body.doctorId` |
| DELETE | `/api/admin/blocked-dates/:id` | Unblock a date (doctor: own only) |
| GET | `/api/admin/staff` | List all staff accounts |
| POST | `/api/admin/staff` | Create staff account (admin only) |
| PATCH | `/api/admin/staff/:id` | Update staff details |
| PATCH | `/api/admin/staff/:id/status` | Activate/suspend; deactivating a doctor cascade-cancels future appointments |
| GET | `/api/admin/clinic-settings` | Get clinic settings |
| PATCH | `/api/admin/clinic-settings` | Update clinic settings |

### Missed Call Webhooks — MSG91 (2, deferred)
| Method | Path | Description |
|---|---|---|
| POST | `/api/missed-call/webhook` | MSG91 missed call event (HMAC verified) |
| POST | `/api/missed-call/reply` | MSG91 inbound SMS reply handler |

### Vercel Cron Jobs (3)
| Method | Path | Schedule (IST) | Action |
|---|---|---|---|
| POST | `/api/jobs/send-reminders` | Daily 8 AM | Send pending SMS reminders |
| POST | `/api/jobs/expire-sessions` | Daily 9 AM | Expire stale missed-call sessions |
| POST | `/api/jobs/cleanup-rate-limits` | Daily 3 AM | Delete old rate limit rows |

---

## Booking Flow (Patient)

```
LandingPage  →  SessionPickerPage  →  PatientFormPage  →  ReviewPage  →  ConfirmedPage
   (/)            (/book)             (/book/details)    (/book/review)  (/book/confirmed)
```

1. **LandingPage** — Full-page spinner until `GET /clinic/info` resolves, then renders doctor card + channel tabs + clinic hours at once. Loads eagerly (not lazy).
2. **SessionPickerPage** — Calls `GET /queue/today`; shows session cards with state (open/full/ended/upcoming)
3. **PatientFormPage** — Name (required), Phone (required), Gender (required), DOB, Email, Height (cm), Weight (kg), Reason; DPDPA consent checkbox
4. **ReviewPage** — Shows summary; calls `getTodayQueue()` fresh before submitting to catch stale state
5. **ConfirmedPage** — Shows Token #N; polls `GET /queue/position/:refCode` every 20s

---

## Staff Queue Dashboard

**`QueueDashboard.tsx`** — Single dashboard for all staff roles.

### Status Tabs (7)
`All | Booked | Arrived & Waiting | With Doctor | Completed | Cancelled | No Show`

### Role-Based Behavior
| Role | Date Controls | Doctor Picker |
|---|---|---|
| Receptionist | Today-only (label, no input) | Shown when >1 doctors |
| Doctor | From/To date range inputs | Hidden (sees own appointments only) |
| Admin | From/To date range inputs | Shown when >1 doctors |

### Token Card Actions by Status
| Status | Actions |
|---|---|
| `booked` | Mark Arrived, Cancel, No Show |
| `arrived_waiting` | With Doctor, Cancel, No Show |
| `with_doctor` | Complete ✓, Cancel, No Show |
| `completed` / `cancelled` / `no_show` | No actions |

### Other Features
- Patient name/phone search (client-side filter)
- Inline doctor notes modal (visible to doctor/admin only)
- Emergency tokens shown with red border + "E" prefix
- Queue sorted: `is_emergency DESC, token_number ASC`

---

## Staff Roles & Access

| Role | Can Do |
|---|---|
| **admin** | Everything: manage staff, view all doctors, edit schedule/blocked dates/reports for any doctor |
| **doctor** | Own appointments, own schedule, own blocked dates, add notes, own profile |
| **receptionist** | View all appointments (today only), walk-in/emergency booking, search patients, view reports |

**No self-registration.** Admin creates all staff accounts via `POST /api/admin/staff`.

---

## localStorage Keys (Frontend)

| Key | Set By | Value |
|---|---|---|
| `token` | LoginPage | JWT string |
| `userRole` | LoginPage | `admin` \| `doctor` \| `receptionist` |
| `userName` | LoginPage / MyProfile | Full name |
| `doctorId` | LoginPage (doctor only) | UUID (empty string for other roles) |
| `userPhoto` | LoginPage / MyProfile | Photo URL or empty string |

All 5 keys cleared on logout and on 401 auto-logout.

---

## Business Rules

| Rule | Enforcement |
|---|---|
| Today-only bookings (patient) | Backend uses `getIST().date` — no date parameter accepted |
| No double token | `UNIQUE INDEX` on `(doctor_id, date, session_index, token_number)` WHERE not cancelled |
| Concurrent booking safety | `MAX(token_number) + 1` inside transaction |
| Session not yet open | Backend returns `SESSION_NOT_OPEN` if `nowMins < session.from` |
| Session ended | Backend returns `SESSION_CLOSED` if `nowMins >= session.to` |
| Session full | Backend returns `SESSION_FULL` if token count ≥ session max |
| 3-layer guard | Frontend disabled → ReviewPage pre-check → Backend validation |
| Unlimited session | Session max left blank → saved as `null` in sessions_json → no cap |
| Walk-in starts arrived_waiting | `initialStatus = 'arrived_waiting'` inserted directly |
| Emergency starts with_doctor | `initialStatus = 'with_doctor'` inserted directly |
| Status transitions | Enforced server-side via `VALID_TRANSITIONS` map — invalid transitions rejected |
| Doctor deactivation | Cascade-cancels all future appointments for that doctor |
| Doctor auto-assign | Doctor role walk-in/emergency: doctorId taken from JWT, no picker shown |
| Duplicate patient check | Walk-in form warns if patient phone already has a booking today |
| Doctor notes privacy | `requireDoctorOrAdmin` on notes endpoint; never returned to patients |
| OTP rate limit | 3 sends per phone per 10 minutes |
| Staff login lockout | 5 failed attempts → 15-minute lock |
| Reference code format | `APT-{YEAR}-{5-digit-sequence}` via PostgreSQL sequence |
| IST timezone | All time math via `getIST()` — works correctly on UTC Vercel servers |

---

## Performance

| Technique | Where | Detail |
|---|---|---|
| Route-level code splitting | `App.tsx` | All pages except `LandingPage` use `React.lazy()` + `<Suspense>`; Vite generates a separate JS chunk per page |
| Atomic page render | `LandingPage.tsx` | Full-page teal spinner shown while `GET /clinic/info` loads; entire page renders in one pass |
| clinicInfo cache | `bookingStore.ts` | `clinicInfo` persisted in Zustand store; repeated visits to `/` skip the loading spinner |

---

## Deployment

```
Patient/Staff Browser
        │
        │ HTTPS (Vercel Edge)
        ▼
   Vercel CDN
        │
        ├── Frontend (React build)  →  static files served from CDN
        └── /api/*  →  Vercel Serverless Functions (Node.js)
                           │
                           ├── Neon PostgreSQL (cloud, serverless)
                           ├── MSG91 API (outbound SMS)
                           └── Vercel Cron (background jobs)
```

- **Frontend:** `clinic-patient-booking-system` Vercel project — auto-deploys from `main` branch
- **Backend:** `clinic-booking-backend` Vercel project — auto-deploys from `main` branch
- **Database:** Neon PostgreSQL — connection via `DATABASE_URL` env var

---

## Environment Variables

```env
# Database (Neon)
DATABASE_URL=postgresql://user:pass@host.neon.tech/neondb?sslmode=require

# Auth
JWT_SECRET=<256-bit random>
JWT_EXPIRY=24h
BCRYPT_COST=12

# MSG91
MSG91_AUTH_KEY=<from MSG91 dashboard>
MSG91_SENDER_ID=CLINIC
MSG91_MISSED_CALL_VMN=<virtual mobile number>
MSG91_WEBHOOK_SECRET=<HMAC secret>
SMS_MOCK=true                          # Set false in production

# Application
NODE_ENV=production
FRONTEND_ORIGIN=https://yourclinic.vercel.app
CANCELLATION_WINDOW_HOURS=2
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
```

---

## What's Deferred

| Feature | Status |
|---|---|
| Missed Call channel (end-to-end) | Schema + controllers exist; MSG91 VMN not provisioned |
| Patient history (persistent notes across visits) | TODO comment in `patient.ts` |
| Patient cancellation window enforcement | Backend cancel endpoint exists; time-window check may need tuning |
| WhatsApp notifications | MSG91 SMS only for now |
| `no_show` missed-call recovery | TODO comment in missedCall controller |
