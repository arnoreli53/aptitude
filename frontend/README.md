# CBAT Academy Frontend

React single-page application for CBAT Academy.

## Development

Create `.env.local`:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Install and start:

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The database schema is stored in the repository-level `supabase/migrations`
directory and must be run in the connected Supabase project before profile and
score synchronization are available.

## Scripts

- `npm start` - start the local development server
- `npm test -- --watchAll=false` - run tests once
- `npm run build` - create a production build

## Structure

- `src/contexts/AuthContext.js` - account and session state
- `src/pages/AuthPage.js` - create account, sign in, and password recovery
- `src/pages/Account.js` - user profile and cloud status
- `src/services/cloudAttempts.js` - Supabase score synchronization
- `src/constants/modules.js` - module IDs, names, categories, and settings
- `src/modules/` - aptitude modules and shared test components
- `src/utils/storage.js` - local settings, calibration, and score history
