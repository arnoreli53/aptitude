# CBAT Academy

CBAT Academy is a web-based aircrew aptitude practice platform. The React
frontend includes the training battery, account access, score history, gamepad
calibration, and estimated role score views.

CBAT Academy is independent practice software and is not affiliated with or
endorsed by the Royal Air Force or Ministry of Defence.

## Architecture

- React and CRACO single-page app in `frontend/`
- Supabase Auth for email accounts and password recovery
- Supabase Postgres for profiles and score attempts
- Row Level Security for user-owned data
- LocalStorage fallback for settings, calibration, and offline score history
- Automatic local/cloud score merging after sign-in

The scaffolded backend directory is not required for the current app.

## Local Setup

Install dependencies:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` from `frontend/.env.example` and enter the
Supabase Project URL and publishable key. Never put a Supabase secret or
`service_role` key in the frontend.

In the Supabase SQL Editor, run:

```text
supabase/migrations/202607280001_accounts_and_attempts.sql
```

In Supabase Authentication URL Configuration, use:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/**
```

Then start the app:

```bash
cd frontend
npm start
```

Open `http://localhost:3000`. New visitors are sent to account creation.

## Main Files

- `frontend/src/App.js` - public and protected routes
- `frontend/src/contexts/AuthContext.js` - Supabase session and profile state
- `frontend/src/pages/AuthPage.js` - account creation, sign-in, and recovery
- `frontend/src/pages/Account.js` - profile and synchronization status
- `frontend/src/services/cloudAttempts.js` - cloud score persistence
- `frontend/src/utils/storage.js` - local persistence and cloud handoff
- `frontend/src/constants/modules.js` - shared module registry
- `supabase/migrations/` - reproducible database schema and RLS policies

## Verification

```bash
cd frontend
npm test -- --watchAll=false
npm run build
```

Before public deployment, add the exact production and preview domains to the
Supabase redirect allow list.

## Deployment & Production

- Production frontend: https://frontend-kg1o0iawn-north-vector.vercel.app
- Canonical custom domain: https://cbat-academy.com

Vercel is configured for this project and the following are already in place:

- `vercel.json` contains a redirect from `www.cbat-academy.com` to `cbat-academy.com`.
- Vercel has issued a TLS certificate for `cbat-academy.com` and the domain is aliased to the current production deployment.

DNS notes (already applied): nameservers set to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.

If you need to host DNS elsewhere you can alternatively point A records to `76.76.21.21` for both the root (`@`) and `www` records.

## Backend deployment

The `backend/` folder is a FastAPI service that connects to MongoDB (configured via `MONGO_URL` and `DB_NAME`). It includes CORS support via the `CORS_ORIGINS` environment variable.

Suggested quick deploy options:

- Render: create a new Python web service pointing at the `backend/` folder. Start command example:
	```
	uvicorn server:app --host 0.0.0.0 --port $PORT
	```
	Add environment variables `MONGO_URL`, `DB_NAME`, and `CORS_ORIGINS`.

- Fly.io: create a `Dockerfile` or use `fly launch` and set environment variables in the Fly dashboard.

## Monitoring & Analytics

- A scheduled GitHub Action (`.github/workflows/uptime-check.yml`) pings the canonical domain daily and will fail if the site is unreachable. You can extend this to send alerts (email/Slack) by adding a notification step on failure.
- For user analytics, add a privacy-compliant analytics provider (Plausible, Fathom, or GA4). Add the snippet to `frontend/public/index.html` or central analytics component.

## Next steps I can take for you

- Configure an automated backend deploy pipeline (Render/Fly/GitHub Actions) — I can add action templates that deploy on push if you provide API keys as repository secrets.
- Add an analytics snippet to the frontend (tell me which provider).
- Configure alerting integrations (Slack, email) for uptime failures.

