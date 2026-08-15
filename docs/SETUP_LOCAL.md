# Local Development Setup — TAP Photobooth Management

How to run the full stack on your machine for development.

---

## 1. Requirements

| Tool | Version | Check |
|---|---|---|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Git | any | `git --version` |

> No local PostgreSQL needed — we use a cloud Supabase project. If you want a
> fully local DB, install the Supabase CLI and run `supabase start` (Docker
> required).

---

## 2. Clone the repository

```bash
git clone <your-repo-url> tap-photobooth
cd tap-photobooth
```

Repo layout:

```
/
├── backend/      # Node.js + Express API
├── frontend/     # React + Vite SPA
├── docs/         # schema.sql, API contract, guides
└── *.md          # project docs
```

---

## 3. Database — Supabase (one-time)

1. Create a free project at https://supabase.com (see
   [`DEPLOYMENT.md`](./DEPLOYMENT.md#2-database--supabase) for details).
2. Open **SQL Editor** → paste the contents of [`docs/schema.sql`](./schema.sql)
   → **RUN**.
3. Create an admin auth user under **Authentication → Users → Add user**
   (auto-confirm ON), then link it to an `employees` row:

```sql
INSERT INTO public.employees (id, full_name, email, phone, role, is_active)
VALUES (
  'PASTE-AUTH-USER-UUID',
  'Dev Admin',
  'dev@tap-photobooth.local',
  '0900000000',
  'admin',
  true
);
```

> **Already done for this project** — Supabase ref `hyslmonuaaxnqbmyiqvh` has
> an admin user ready. Login with `admin@tapphotobooth.com` / `Admin@12345`
> (user id `3df81072-b470-4002-948d-b83467addac7`, role `admin`). See
> [`docs/PROGRESS.md`](./PROGRESS.md) for full status.

4. From **Project Settings → API**, note:
   - `Project URL`
   - `anon public` key
   - `service_role` key

---

## 4. Backend setup

```bash
cd backend
cp .env.example .env
npm install
```

Open `backend/.env` and fill in:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key

JWT_SECRET=replace-with-strong-secret-at-least-32-chars

# Optional for dev (leave blank to skip messaging features)
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
ZALO_OA_ID=
ZALO_ACCESS_TOKEN=
GMAIL_USER=
GMAIL_APP_PASSWORD=

# Dev only: log messages as 'sent' without actually sending (Zalo/Gmail).
# Set to false once real GMAIL_USER/GMAIL_APP_PASSWORD + ZALO_ACCESS_TOKEN are configured.
MESSAGE_DRY_RUN=true
```

### Run the dev server

```bash
npm run dev
```

- Starts with `nodemon` (auto-reload on save).
- Default URL: http://localhost:5000
- Health check: http://localhost:5000/health → `{"success":true,...}`
- API base: http://localhost:5000/api/v1

> On boot, `env.js` validates all env vars via Zod. If a required var is missing
> or `JWT_SECRET` is < 32 chars, the server exits with a clear error.
> Optional vars (`CLOUDINARY_URL`, `ZALO_*`, `GMAIL_*`) may be blank — the
> related features simply skip themselves.

### Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start without reload (production mode) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |

---

## 5. Frontend setup

```bash
cd frontend
cp .env.example .env
npm install
```

`frontend/.env` for local dev (uses Vite proxy → no real backend URL needed):

```env
VITE_API_URL=/api/v1
```

The Vite dev server proxies `/api` → `http://localhost:5000` (see
`vite.config.js`), so the frontend talks to the local backend automatically.

### Run the dev server

```bash
npm run dev
```

- Default URL: http://localhost:5173
- The page hot-reloads on save.

### Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## 6. Run both together

Open two terminals:

**Terminal 1 — backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 and log in with the admin account created in
step 3.

---

## 7. Verifying it works

1. Backend: visit http://localhost:5000/health → JSON `{"success":true,...}`.
2. Frontend: visit http://localhost:5173 → login page renders.
3. Login with the admin email/password → lands on the Dashboard.
4. Try creating a customer in **Khách hàng** → should appear in the list
   (confirms Supabase connectivity).

---

## 8. Common issues

| Symptom | Fix |
|---|---|
| Backend crash on startup: "Environment variable validation failed" | Fill all required vars in `backend/.env`; `JWT_SECRET` ≥ 32 chars. |
| Frontend can't reach API (CORS error in console) | Ensure backend `FRONTEND_URL` matches `http://localhost:5173` and backend is running on port 5000. |
| Login fails with 401 | Confirm the `employees` row UUID matches the Supabase Auth user UUID and `is_active=true`. |
| `npm install` fails | Use Node 20+; delete `node_modules` + `package-lock.json` and retry. |
| Port 5000 already in use | Change `PORT` in `backend/.env` and the proxy `target` in `frontend/vite.config.js`. |
| Cron jobs not firing locally | They run on the server's clock at 8:00 AM; for testing, trigger jobs manually via the messages API or temporarily change the schedule in the `settings` table (`key='cron_schedule'`). |
| Message send fails: "Gmail SMTP credentials are not configured" | Set `MESSAGE_DRY_RUN=true` in `backend/.env` to test flow without real credentials, or fill `GMAIL_USER`/`GMAIL_APP_PASSWORD` for real sends. |

---

## 9. Git workflow (quick reference)

```bash
git checkout -b feature/your-feature
# make changes
npm run lint        # in backend and/or frontend
# commit
git add .
git commit -m "feat(customers): thêm API CRUD khách hàng"
git push
# open PR → main
```

Commit message format: `<type>(<scope>): <subject>`
Types: `feat|fix|docs|style|refactor|test|chore`

---

*See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for production deployment and
[`USER_GUIDE.md`](./USER_GUIDE.md) for end-user instructions.*
