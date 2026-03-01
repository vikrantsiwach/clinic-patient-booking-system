# Clinic Patient Booking System

A full-stack multi-doctor clinic appointment management system. Patients book a queue token online; staff manage the live queue from a role-based dashboard.

## Features

**Patient side**
- Book a token for today's Morning or Evening session (no time-slot picking)
- Live queue position polling — see how many patients are ahead
- OTP-authenticated patient dashboard (view upcoming + past tokens, cancel)

**Staff dashboard**
- **Receptionist** — today's queue for all doctors, walk-in and emergency bookings, patient search
- **Doctor** — own queue with date-range filtering, add clinical notes, manage own schedule and blocked dates
- **Admin** — everything above plus staff management, clinic settings, reports

**Queue flow**

```
Online booking  →  booked
Walk-in         →  arrived_waiting   (skips booked)
Emergency       →  with_doctor       (skips both)

booked → arrived_waiting → with_doctor → completed
  any stage → cancelled | no_show
```

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| PWA | vite-plugin-pwa + Workbox |
| State | Zustand |
| Backend | Node.js 20 + Express + TypeScript |
| Auth | JWT + bcrypt |
| Database | PostgreSQL 16 (Neon serverless) |
| DB Client | `pg` (raw SQL, no ORM) |
| SMS | MSG91 (mock in dev) |
| Hosting | Vercel (frontend + backend) |
| Cron | Vercel Cron Jobs |

## Project Structure

```
clinic-patient-booking-system/
├── frontend/          # React PWA
├── backend/           # Express API (Vercel serverless)
└── database/
    └── migrations/    # 001–005 SQL migrations
```

## Local Development

### Prerequisites
- Node.js 20+
- Docker (for local PostgreSQL)

### 1. Database

```bash
# Start PostgreSQL in Docker on port 5433
docker run -d \
  --name clinic-db \
  -e POSTGRES_USER=clinic_user \
  -e POSTGRES_PASSWORD=clinic_pass \
  -e POSTGRES_DB=clinic_db \
  -p 5433:5432 \
  postgres:16
```

Run migrations:
```bash
cd backend
npm run db:migrate
npm run db:seed        # creates initial admin + doctor accounts
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET, etc.
npm install
npm run dev            # runs on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # runs on http://localhost:5173
```

## Environment Variables

**Backend `.env`**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://clinic_user:clinic_pass@localhost:5433/clinic_db
JWT_SECRET=<long random string>
JWT_EXPIRY=24h
BCRYPT_COST=10
FRONTEND_ORIGIN=http://localhost:5173
SMS_MOCK=true
MSG91_AUTH_KEY=DEMO_KEY
MSG91_SENDER_ID=CLINIC
MSG91_WEBHOOK_SECRET=demo-secret
CANCELLATION_WINDOW_HOURS=2
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
```

## Deployment (Vercel + Neon)

1. Create a [Neon](https://neon.tech) PostgreSQL database and run the migrations against it.
2. Deploy `backend/` as a Vercel project — set all env vars from above (use Neon's `DATABASE_URL`).
3. Deploy `frontend/` as a separate Vercel project — set `VITE_API_BASE_URL` to the backend URL.
4. Cron jobs are configured in `backend/vercel.json`.

## Staff Roles

| Role | Access |
|---|---|
| admin | Full access — staff management, all doctors' schedules, reports |
| doctor | Own queue, own schedule/blocked dates, clinical notes |
| receptionist | Today's queue for all doctors, walk-in/emergency, patient search |

Staff accounts are created by the admin. There is no self-registration.

## Database Migrations

| File | Description |
|---|---|
| `001_merged_schema.sql` | Full initial schema |
| `002_add_patient_vitals.sql` | `height_cm`, `weight_kg` on patients |
| `003_clinic_settings.sql` | `clinic_settings` key/value table |
| `004_audit_action_enum.sql` | Additional audit enum values |
| `005_multi_doctor_roles.sql` | `arrived_waiting`/`with_doctor` statuses, staff photo, data migration |
