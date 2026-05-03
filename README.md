# SiteSync (site-notes-hub)

Mobile-first web app for on-site construction workflows: projects, QR-linked drawings, voice notes, team invites, and notifications. Built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Supabase** (auth, Postgres, storage, Edge Functions).

## Requirements

- **Node.js** 18+ (20+ recommended)
- A **Supabase** project with this repo’s schema and policies applied (see [Database](#database))

## Quick start

```bash
npm install
npm run dev
```

The dev server opens **`/auth`** in the browser (sign-in). If it does not, open the URL Vite prints (see `vite.config.ts` for `server.port`; the default in this repo is **5173**).

- Sign-in: `/auth`
- After login, home is `/` (project list).

## Environment variables

Create a **`.env`** file in the project root (never commit real secrets). Vite only exposes variables prefixed with `VITE_`.

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **anon** public key (JWT) |

Optional (if you use it elsewhere):

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_PROJECT_ID` | Project ref string (not required by the generated client) |

Example:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

The Supabase browser client lives in `src/integrations/supabase/client.ts`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest in watch mode |

## Database

SQL migrations are under **`supabase/migrations/`**. Apply them to your Supabase project (for example with the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase db push` or `supabase migration up` against a linked project).

Row Level Security (RLS) is defined in migrations; the app expects tables such as `profiles`, `projects`, `project_members`, `drawings`, `notifications`, etc., matching `src/integrations/supabase/types.ts`.

## Edge Functions

Some flows call Supabase Edge Functions by name:

- **`notify-members`**
- **`transcribe-voice`**

Deploy the implementations from **`supabase/functions/`** to the same Supabase project if you use those features.

## Auth notes

- Email confirmation: if enabled in the Supabase dashboard, new users must confirm email before a session exists; the UI guides them to sign in after confirmation.
- Redirect URLs: add your dev origin (e.g. `http://localhost:5173`) and production URLs under **Authentication → URL configuration** in Supabase.

## Project layout

| Path | Role |
|------|------|
| `src/App.tsx` | Routes and providers |
| `src/pages/` | Screen components |
| `src/auth/` | Auth context, provider, route guard |
| `src/components/` | UI (including shadcn-style components) |
| `src/integrations/supabase/` | Typed Supabase client |
| `supabase/` | Migrations and Edge Functions |

## License

Private / not specified in this repository.
