# CRM

A small CRM-style web app for **clients**, **contacts**, and **projects**, built with React, Vite, Tailwind CSS, shadcn/ui, and Supabase (auth + Postgres).

## Requirements

- **Node.js** 20.19+ or 22.12+ (Vite 8 and several dependencies expect a current Node release.)
- A **Supabase** project with the `clients`, `contacts`, and `projects` tables, RLS policies, and email/password auth enabled.

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your Supabase project values (from **Project Settings → API** in the Supabase dashboard):

   ```bash
   cp .env.example .env
   ```

   Set:

   - `VITE_SUPABASE_URL` — project URL (e.g. `https://<ref>.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — the **anon** `public` key (safe for the browser; never put the **service role** key in `.env` used by Vite)

3. In Supabase, run the SQL for your schema (tables, indexes, and RLS) if you have not already. Your plan or migration should match what the app queries (`clients`, `contacts`, `projects` with `user_id` and the expected columns).

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open the URL Vite prints (usually `http://localhost:5173`), sign in with a user created under **Authentication → Users** in Supabase (or via your signup flow).

## Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start Vite in development mode     |
| `npm run build`   | Typecheck and production build     |
| `npm run preview` | Serve the production build locally |
| `npm run lint`    | Run ESLint                         |

## Project layout

- `src/pages/` — route screens (dashboard, clients, contacts, projects, login)
- `src/components/` — shared UI, layout, and shadcn components
- `src/lib/` — auth context, types, helpers
- `src/supabaseClient.ts` — Supabase browser client (reads `VITE_*` env vars)
- `public/favicon.svg` — tab icon

## Security notes

- The app uses the **anon** key in the browser; row-level security in Supabase must restrict data per user.
- Do not commit `.env`; it is listed in `.gitignore`.
