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
