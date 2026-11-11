# Sweety – Blood Glucose Tracker

Sweety lets a diabetes patient record up to **4 blood-glucose readings a day** (Morning fasting, After breakfast, After lunch, After dinner) and view **daily, month-to-date and monthly reports**.

**Stack:** Node.js + Express API · PostgreSQL · React (Vite) · Tailwind CSS v4 with shadcn-style components · Recharts · Mailgun (email) · Web Push · Redis + BullMQ (optional)

| Dashboard | Reports |
|---|---|
| ![Dashboard](docs/screenshots/02-dashboard.png) | ![Month to date](docs/screenshots/07-report-month-to-date.png) |

More screenshots (login, validation errors, duplicate slot, readings, settings, care team, empty state, mobile, dark-mode doctor view) are in [`docs/screenshots`](docs/screenshots).

## Features

**Required**
- Sign up / log in. Passwords hashed with bcrypt (`bcryptjs`, cost 10); JWT auth; users only ever see their own readings.
- Add, view, edit and delete readings (date, slot, value in mg/dl) with all five validation rules and the exact error messages from the brief, shown inline in the UI **and** enforced by the API.
- Reports – highest, lowest, average (1 decimal) and count, with a friendly empty state:
  - **Daily** – the selected date (plus the list of readings with their slots)
  - **Month to date** – 1st of the month → selected date
  - **Monthly** – the whole previous month

**Bonus (all implemented)**
- Pagination: `GET /api/readings?page=1&limit=20` (+ `date`, `from`, `to`, `tag`, `q` filters)
- Charts: daily-average line chart with the user's own reference band (Recharts)
- Docker: `docker-compose.yml` for PostgreSQL, Redis, API and the client
- Frontend tests with React Testing Library
- Redis cache for reports, invalidated whenever a reading, target range or doctor comment changes
- Background job (BullMQ) that sends reminders to people who haven't logged all four readings
- Doctor role: patients share their data with a verified doctor; doctors see a patient list and the same reports

**Beyond the brief**
- **Per-user timezone.** "Today", the no-future-dates rule, report defaults and reminders all follow the signed-in user's own timezone (set from the browser at sign-up, editable in Settings).
- **Time in range + estimated HbA1c.** Every report shows the share of readings below / in / above range, and an HbA1c estimate (`(avg mg/dl + 46.7) / 28.7`) once there are 10+ readings.
- **Personal target ranges.** Separate fasting and after-meal ranges (defaults 70–130 and 70–180 mg/dl) drive the Low / In range / High labels, time in range and the chart band.
- **Reading tags and notes.** Tag a reading (exercise, big meal, medication, illness, stress, poor sleep, alcohol, travel); filter by tag and search notes.
- **Printable / PDF report** (Print button → "Save as PDF", clean print layout) and **CSV export** of readings.
- **Doctor comments.** A verified doctor can leave a note on a patient's day; the patient sees it on the dashboard and in that day's report, and gets an email and a push notification.
- **Account basics.** Email verification, forgot / reset password, change password, and **verified doctor accounts** (doctors register with a registration number and are approved by an admin before patients can share with them).
- **Real reminders** by email (Mailgun) and/or web push, at the time the user chooses, in their own timezone, only if readings are missing.
- **Installable PWA** with an offline app shell, home-screen icon and push notifications.
- Light / dark mode, responsive layout, toasts, skeleton loaders, rate-limited auth routes.

## Install

Requires **Node.js 20+** and a PostgreSQL 14+ database.

```bash
git clone <this repo> && cd sweety
npm run install:all          # installs server + client dependencies
cp server/.env.example server/.env
```

## Set up the database

Pick one:

**A. Docker (recommended)**
```bash
docker compose up -d db redis     # PostgreSQL on :5432, Redis on :6379
```
Then set `REDIS_URL=redis://localhost:6379` in `server/.env` to turn on report caching and BullMQ (optional).

**B. No Docker** – a real PostgreSQL binary downloaded via `embedded-postgres` (keep it running in its own terminal):
```bash
npm --prefix server run db:embedded
```

**C. Your own PostgreSQL** – create a database and point `DATABASE_URL` in `server/.env` at it.

The schema is applied (and upgraded in place) automatically when the server starts. To apply it by hand: `npm --prefix server run migrate`.

### Seed demo data
```bash
npm run seed
```
Creates (and resets) a demo patient with ~75 days of sample readings (with tags, notes and two doctor comments), a verified doctor the patient has shared with, and a doctor still waiting for approval:

| Role | Email | Password |
|---|---|---|
| Patient | `demo@sweety.app` | `Password123!` |
| Doctor (verified) | `doctor@sweety.app` | `Password123!` |
| Doctor (pending) | `newdoc@sweety.app` | `Password123!` |

Approve the pending doctor (or any doctor who signs up) with the admin command:
```bash
npm --prefix server run verify-doctor -- newdoc@sweety.app            # approve
npm --prefix server run verify-doctor -- newdoc@sweety.app --reject   # reject
```

## Run

```bash
npm run server     # API on http://localhost:4000
npm run client     # UI  on http://localhost:5173 (proxies /api to the API)
```

Or run everything in containers: `docker compose up --build` → UI at http://localhost:8080.

## Email and push

**Email** is sent through the **Mailgun HTTP API** from `sweety@mx.adarsh.run` (the same approach as the Vaakya project). In `server/.env` set:

```
MAILGUN_API_KEY=...            # Mailgun private API key
MAILGUN_BASE_URL=https://api.mailgun.net   # use https://api.eu.mailgun.net for EU accounts
FROM_EMAIL=sweety@mx.adarsh.run            # its domain must be an active sending domain
MAILGUN_SENDER_NAME=Sweety
APP_URL=https://your-app-url               # used for links inside emails
```

Without `MAILGUN_API_KEY` nothing is sent: each email is printed to the API console instead, so locally the verification and password-reset links appear in your terminal.

**Web push** needs a VAPID key pair: run `npm --prefix server run vapid` and put the keys into `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. Users then enable it per device under Settings → Reminders. Browsers only allow push on `https://` (or `localhost`), and Chrome does not support it in incognito windows.

**Reminders** run every 10 minutes: for each patient whose chosen reminder time (in their own timezone) has arrived and who has logged fewer than four readings that day, one reminder is sent per day on the channels they selected. With `REDIS_URL` set this is a BullMQ repeatable job; without it, a plain in-process timer is used.

## Tests

```bash
npm test                         # server + client
npm --prefix server test         # API integration + unit tests
npm --prefix client test         # React Testing Library tests
```

Server integration tests run against a **real PostgreSQL**. By default a throwaway embedded instance is started automatically (no setup). To use your own DB instead set `TEST_DATABASE_URL` (the tests truncate its tables, so use a dedicated database).

What is covered: report date ranges (incl. January→December and leap-year February), stats rounding, every validation rule and its message, the 4-per-day cap (including concurrent requests), edit/delete, user isolation, pagination, all three reports and the empty state; **per-user timezones, target ranges, time in range and A1c, tags/search/CSV (incl. formula-injection safety), email verification, password reset (single-use and expiry), doctor verification and comments, reminder scheduling across timezones, push subscriptions, and the Mailgun request format**. Frontend: the reading form (validation, tags, server-error mapping, submit), target-aware status, timezone-aware dates and the report summary.

## API overview

All routes are under `/api`; send `Authorization: Bearer <token>`.

| Method & path | Purpose |
|---|---|
| `POST /auth/signup` `{name,email,password,role?,timezone?,licenseNumber?}` · `POST /auth/login` · `GET /auth/me` | Auth |
| `POST /auth/verify-email` · `POST /auth/resend-verification` | Email verification |
| `POST /auth/forgot-password` · `POST /auth/reset-password` · `POST /auth/change-password` | Passwords |
| `PATCH /me/settings` | Name, timezone, target ranges, reminder preferences |
| `GET /readings?page&limit&date&from&to&tag&q` | Your readings, newest first, paginated |
| `POST /readings` · `PUT /readings/:id` · `DELETE /readings/:id` | Create / edit / delete (`{date, slot, value, notes?, tags?}`) |
| `GET /readings/export.csv` | CSV export (same filters) |
| `GET /reports/daily \| month-to-date \| monthly?date=YYYY-MM-DD` | Report incl. time in range, estimated A1c, targets and doctor comments (defaults to today in your timezone). Doctors add `&patientId=` |
| `GET/POST /me/doctors` · `DELETE /me/doctors/:id` | Patient shares/revokes access for a verified doctor |
| `GET /me/comments` | Doctor comments for the signed-in patient |
| `GET /doctor/patients` · `GET /doctor/patients/:id/readings` | Doctor views (verified doctors only) |
| `GET/POST /doctor/patients/:id/comments` · `DELETE /doctor/comments/:id` | Doctor comments |
| `GET /push/public-key` · `POST /push/subscribe` · `POST /push/unsubscribe` | Web push subscriptions |

Slots: `morning`, `after_breakfast`, `after_lunch`, `after_dinner`. Errors look like `{"error": {"message", "field", "code"}}`.

## Project layout
```
server/  Express API  (routes → services → pg; lib = dates/stats/targets/validation/cache/mail/push; jobs = reminders)
client/  React app    (pages, components, components/ui = shadcn-style primitives, lib, hooks; public/ = PWA files)
docs/    screenshots
```

## Notes

### Assumptions
- **Timezones:** "today" is computed in each user's own timezone. The browser's timezone is used at sign-up; users can change it in Settings. Dates are plain calendar dates (no time of day is stored).
- **"Previous month"** for the Monthly report is relative to the *selected* date (15 Oct → September), as in the example.
- **Whole numbers only:** decimals such as `100.5` are rejected with "Value must be a whole number between 40 and 600 mg/dl.", out-of-range values with the exact message from the brief.
- **Rule order:** if a day already has 4 readings the "only 4 readings per day" message wins over the "slot already used" one. Since there are exactly 4 slots, the cap is also guaranteed by a unique `(user, date, slot)` constraint; creation is serialised with a per-user-per-day advisory lock so concurrent requests can't bypass it.
- **Doctors:** anyone can register as a doctor, but with a registration number and as *pending*. An admin approves them with `npm run verify-doctor`; there is no automated check of the number against a medical council register. Access is **patient-initiated**: a doctor sees only patients who added their email under *Care team*, and the patient can revoke it any time. Doctors have read access plus the ability to comment.
- **Target ranges** default to common general guidance (fasting 70–130, after meals 70–180 mg/dl) and are editable per user. Morning readings count as "fasting"; the other three slots use the after-meal range. The estimated HbA1c is a rough estimate from average glucose, not a lab result.
- **bcrypt:** uses `bcryptjs` (pure JS, same hash format) to avoid native build problems on Windows.
- **Reminders** are sent once per day within three hours after the chosen time, so a server that was down all evening doesn't nag at midnight.
- Tokens are stored in `localStorage` for simplicity.

### What I'd improve with more time
- Refresh tokens / httpOnly cookies and an automated doctor-registration check; an admin UI instead of a CLI.
- Weekly view, mmol/L display toggle, and richer insights (patterns by time of day or tag).
- SMS / WhatsApp reminders, and per-user quiet hours.
- Code-splitting the client bundle, Playwright end-to-end tests in CI, and an OpenAPI spec for the API.
- Docker images are provided but I could not run `docker compose` on the machine used to build this (Docker Desktop wasn't running); the API and UI themselves were verified locally against a real PostgreSQL.
- Real Mailgun delivery was not exercised from here (no API key available): the request format is unit-tested against the Mailgun API shape and the emails were verified through the console fallback.
