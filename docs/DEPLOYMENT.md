# Deployment Guide — TAP Photobooth Management

Step-by-step guide to deploy the **TAP Photobooth** system to production.

**Target stack:** Supabase (DB + Auth) · Railway/Render (Backend) · Vercel
(Frontend) · Cloudinary (images) · Gmail SMTP + Zalo OA (messaging).

---

## 1. Prerequisites

You need accounts (all have free tiers) for:

| Service | Purpose | URL |
|---|---|---|
| Supabase | PostgreSQL + Auth + RLS | https://supabase.com |
| Vercel | Frontend hosting | https://vercel.com |
| Railway **or** Render | Backend hosting | https://railway.app · https://render.com |
| Cloudinary | Image storage | https://cloudinary.com |
| GitHub | Source code repo | https://github.com |
| Zalo OA | Zalo messaging (official account) | https://oa.zalo.me |
| Gmail | SMTP email (App Password) | https://myaccount.google.com |
| cron-job.org *(optional)* | Keep backend awake if it sleeps | https://cron-job.org |
| Sentry *(optional)* | Error monitoring | https://sentry.io |

### Local tools
- Node.js 20+
- npm
- Git
- Supabase CLI *(optional, for local DB)*

---

## 2. Database — Supabase

1. Go to https://supabase.com → **New project**.
   - Name: `tap-photobooth`
   - Set a strong database password (save it).
   - Region: closest to your users.
2. Wait for provisioning (~2 min).
3. Open **SQL Editor** → **New query**.
4. Upload / paste the contents of [`docs/schema.sql`](./schema.sql).
   - This creates all 11 tables, indexes, triggers, RLS policies, and seed data.
5. Click **RUN**. Verify no errors in the output.
6. Get project credentials from **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE` *(keep secret!)*

### Create the admin user
1. Go to **Authentication → Users → Add user**.
2. Email + a strong password → set **Auto Confirm User = ON**.
3. After creating, copy the user's UUID.
4. Open **SQL Editor** and insert the employee row (roles: `admin`/`manager`/`staff`):

```sql
INSERT INTO public.employees (id, full_name, email, phone, role, is_active)
VALUES (
  'PASTE-USER-UUID-HERE',
  'Nguyen Van Admin',
  'admin@tap-photobooth.com',
  '0900000000',
  'admin',
  true
);
```

> The `employees.id` must match the Supabase Auth user UUID so login attaches the
> correct role.

---

## 3. Backend — Railway (or Render)

The backend ships with a multi-stage `Dockerfile` and a `railway.json`.

### 3.1 Push code to GitHub
- Push the monorepo to GitHub (do **not** commit `.env`).

### 3.2 Create Railway project
1. Go to https://railway.app → **New Project → Deploy from GitHub repo**.
2. Select your repo.
3. Railway auto-detects the `backend/railway.json` and the `Dockerfile`.
   - If it asks for the source directory, set **Root Directory = `backend`**.
4. Railway builds the Docker image and deploys.

### 3.3 Set environment variables
In Railway → your service → **Variables**, add (see
[`backend/.env.example`](../backend/.env.example)):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` *(Railway also injects its own PORT; either works)* |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` *(set after step 4)* |
| `SUPABASE_URL` | from step 2.6 |
| `SUPABASE_ANON_KEY` | from step 2.6 |
| `SUPABASE_SERVICE_ROLE` | from step 2.6 |
| `JWT_SECRET` | random string ≥ 32 chars (e.g. `openssl rand -hex 32`) |
| `CLOUDINARY_URL` | `cloudinary://api_key:api_secret@cloud_name` |
| `ZALO_OA_ID` | your OA ID |
| `ZALO_ACCESS_TOKEN` | your OA long-lived token |
| `GMAIL_USER` | your Gmail address |
| `GMAIL_APP_PASSWORD` | 16-char App Password (not your login password) |

### 3.4 Deploy & verify
1. Railway redeploys automatically when variables change.
2. Open the generated public URL, e.g. `https://tap-photobooth-api.up.railway.app`.
3. Verify health check: visit `/health` → should return:
   ```json
   { "success": true, "data": { "status": "ok" } }
   ```
4. Railway's `railway.json` configures the health check path `/health` so the
   deploy is marked healthy once it responds.

### 3.5 Render alternative
If using Render instead of Railway:
1. **New → Web Service → connect repo**.
2. **Root Directory:** `backend`.
3. **Runtime:** Docker (uses `Dockerfile`).
4. Add the same environment variables in **Environment**.
5. Health Check Path: `/health`.

---

## 4. Frontend — Vercel

### 4.1 Import to Vercel
1. Go to https://vercel.com → **Add New → Project → Import Git Repository**.
2. Select your repo.
3. Vercel auto-detects Vite via `frontend/vercel.json`:
   - **Root Directory:** set to `frontend`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`

### 4.2 Set environment variable
In **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://tap-photobooth-api.up.railway.app/api/v1` *(your backend URL + `/api/v1`)* |

### 4.3 Deploy
1. Click **Deploy**.
2. Wait for build to finish → get URL, e.g. `https://tap-photobooth.vercel.app`.
3. Go back to the **backend** Railway/Render variables and set
   `FRONTEND_URL` to this exact URL (so CORS allows the frontend). Redeploy
   backend if needed.

### 4.4 Custom domain *(optional)*
- Vercel → **Settings → Domains** → add `app.tap-photobooth.com`.
- Update DNS as instructed. Update `FRONTEND_URL` + `VITE_API_URL` accordingly.

---

## 5. Post-deploy

### 5.1 Smoke tests
1. **API health:** `GET https://api.xxx.com/health` → `{"success":true,...}`.
2. **Login:** open frontend → login with the admin account created in step 2.
3. **CRUD flow:** create a customer → create a booking → issue a voucher.
4. **Upload:** upload an image via Posts to confirm Cloudinary works.
5. **Messaging:** send a manual message (Messages → Send now) and check the log.

### 5.2 Zalo OA webhook
- In Zalo OA manager, set the **callback / webhook URL** to:
  ```
  https://api.xxx.com/api/v1/webhooks/zalo
  ```
- This lets the backend receive `follow` events and store the customer's Zalo UID
  for messaging.

### 5.3 Keep-alive (only if backend sleeps)
- Railway free / Render free may sleep on idle.
- Create a job at https://cron-job.org hitting
  `https://api.xxx.com/health` **every 5 minutes**.
- This prevents cold-starts and keeps the cron scheduler warm.
  > Note: node-cron runs **inside** the backend process, so keeping the process
  > alive is required for the 8:00 AM birthday/holiday/reengage jobs to fire.

### 5.4 Gmail sending limits
- Gmail SMTP allows ~400–500 emails/day.
- The system prioritizes Zalo OA; email is the fallback.
- If you exceed the limit, consider a paid SMTP (SendGrid/Mailgun) later.

---

## 6. Monitoring (optional, recommended)

### Sentry
1. Create a project at https://sentry.io (free tier).
2. Get the DSN.
3. Add `SENTRY_DSN` to backend env vars.
4. Instrument `src/app.js` with `@sentry/node` init *(code task for backend
   agent)* — or follow Sentry's onboarding wizard.

### Logs
- Railway: **Deployments → Logs** (runtime + build).
- Vercel: **Project → Functions/Deployments logs**.
- Backend also writes structured JSON logs via `winston`
  (`src/utils/logger.js`).

---

## 7. Rollback & backups

- **Supabase backups:** free tier keeps daily backups for 7 days. For
  production, consider PITR (Point-in-Time Recovery) add-on.
- **Railway:** redeploy a previous deployment from the **Deployments** list.
- **Vercel:** every deploy is immutable — **Instant Rollback** to any previous
  deployment in the dashboard.
- **Database:** never hard-delete customers/bookings — use soft delete
  (`deleted_at`). Schema already enforces this convention.

---

## 8. Environment variable cheat sheet

| Where | Variable | Example |
|---|---|---|
| Backend | `PORT` | `5000` |
| Backend | `NODE_ENV` | `production` |
| Backend | `FRONTEND_URL` | `https://tap-photobooth.vercel.app` |
| Backend | `SUPABASE_URL` | `https://xyz.supabase.co` |
| Backend | `SUPABASE_ANON_KEY` | `eyJhbGci...` |
| Backend | `SUPABASE_SERVICE_ROLE` | `eyJhbGci...` |
| Backend | `JWT_SECRET` | `openssl rand -hex 32` |
| Backend | `CLOUDINARY_URL` | `cloudinary://key:secret@cloud` |
| Backend | `ZALO_OA_ID` | `1234567890` |
| Backend | `ZALO_ACCESS_TOKEN` | `...` |
| Backend | `GMAIL_USER` | `you@gmail.com` |
| Backend | `GMAIL_APP_PASSWORD` | `abcd efgh ijkl mnop` |
| Frontend | `VITE_API_URL` | `https://api.xxx.com/api/v1` |

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows blank / network error | Check `VITE_API_URL` is correct + backend CORS `FRONTEND_URL` matches frontend URL. |
| Login 401 | Verify `employees` row exists with the Auth user UUID and `is_active=true`. |
| `JWT_SECRET` validation error on boot | Must be ≥ 32 characters. |
| Zalo messages fail | Token expired — refresh in OA manager → update `ZALO_ACCESS_TOKEN`. |
| Email not sent | Check `GMAIL_APP_PASSWORD` is a 16-char App Password, not your login password. |
| Cron jobs don't run | Backend likely slept — set up cron-job.org ping (step 5.3). |
| Build fails on Vercel | Ensure `VITE_API_URL` is set for Production environment in Vercel settings. |

---

*Last updated: see git history. Maintained by the DevOps agent.*
