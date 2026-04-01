# Team Balancer

Web app that loads players from a Google Spreadsheet (name, ranking, picture) and generates **x** equal teams by skill. Each generation gets a **unique shareable URL** for today’s teams.

## Google Sheet setup

1. Create a sheet with columns (headers can vary; these are detected):
   - **Name** – player name
   - **Ranking** – one of: `S`, `A`, `B`, `C`, or `Unranked` (or leave blank)
   - **Image** – optional; URL of player picture (or use column names: Picture / Photo / Avatar)

2. Share the sheet: **Anyone with the link can view**.

3. Use either:
   - The full sheet URL, or  
   - Just the spreadsheet ID (the long string in the URL: `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).

## Environment variables

Copy `.env.example` to `.env` at the repo root and set:

- **`SUPABASE_URL`** / **`SUPABASE_ANON_KEY`** — used by the API (anon key + user JWT for admin writes; RLS applies).
- **`VITE_SUPABASE_URL`** / **`VITE_SUPABASE_ANON_KEY`** — same project URL and anon key for the React app (Supabase Auth sign-in).

Do **not** put the service role key in production frontends or expose it to the browser. Optional **`SUPABASE_SERVICE_ROLE_KEY`** is only for local scripts if you add them.

## Admin authentication

Admins sign in with **Supabase Auth** (email + password). Only users listed in **`public.app_admins`** (migration `supabase/migrations/005_supabase_auth_rls.sql`) can perform roster and team mutations.

1. Apply the SQL migration in the Supabase SQL editor (or CLI).
2. In the Supabase dashboard, create Auth users for your admins.
3. Insert their `auth.users.id` into `public.app_admins` (see comments in the migration).

## Run locally

```bash
cd team-balancer-app
npm install
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3001  

Use **Players** to manage the roster, **Admin login** on Home / Players / team pages to unlock generate/edit/paid actions, then generate teams and share the `/t/<slug>` link.

## Production build

```bash
npm run build
PORT=3001 npm start
```

Open http://localhost:3001; the app serves the built frontend and API.

## How balancing works

Rankings are converted to points: **S=4, A=3, B=2, C=1, Unranked=0**. Players are sorted by points and distributed in a **snake draft** (e.g. Team1 → Team2 → Team3 → Team3 → Team2 → Team1) so total strength is similar across teams.
