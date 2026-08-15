# ARCHITECTURE — TAP Photobooth Management

## 1. Sơ đồ kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│  React SPA — Vercel (xxx.vercel.app)                          │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)               │
│  Railway / Render — api.xxx.com                               │
│                                                               │
│  /api/v1                                                      │
│  ├── /auth          (login, logout, me, refresh)              │
│  ├── /employees     (CRUD + shifts)                           │
│  ├── /customers     (CRUD + birthdays + bookings + vouchers)  │
│  ├── /vouchers      (CRUD + issue + check + usage)            │
│  ├── /bookings      (CRUD)                                    │
│  ├── /posts         (CRUD + publish)                          │
│  ├── /holidays      (CRUD)                                    │
│  ├── /templates     (CRUD)                                    │
│  ├── /messages      (logs + send-now + schedule + stats)      │
│  ├── /dashboard     (stats + revenue + customers + vouchers)  │
│  ├── /settings      (GET + PUT + zalo-qr)                     │
│  └── /upload        (Cloudinary)                              │
│                                                               │
│  Middleware: auth(JWT) → rbac(role) → validate(zod) → router  │
│  Scheduler: node-cron 8:00 AM daily                           │
└──────────────┬──────────────────┬─────────────────┬──────────┘
               │                  │                 │
               ▼                  ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Supabase        │ │  External APIs   │ │  Cloudinary      │
│  PostgreSQL      │ │  - Zalo OA API   │ │  (image storage) │
│  + Auth (JWT)    │ │  - Gmail SMTP    │ │                  │
│  + RLS policies  │ │  (nodemailer)    │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## 2. Cấu trúc thư mục Backend

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js              # validate env vars
│   │   ├── supabase.js         # Supabase client
│   │   └── cloudinary.js       # Cloudinary config
│   ├── middleware/
│   │   ├── auth.js             # verify JWT
│   │   ├── rbac.js             # role-based access
│   │   ├── errorHandler.js     # centralized error
│   │   ├── notFound.js
│   │   └── validate.js         # zod schema validation
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.schema.js
│   │   ├── employees/
│   │   ├── customers/
│   │   ├── vouchers/
│   │   ├── bookings/
│   │   ├── posts/
│   │   ├── holidays/
│   │   ├── templates/
│   │   ├── messages/
│   │   ├── dashboard/
│   │   └── settings/
│   ├── services/
│   │   ├── zalo.service.js     # Zalo OA API
│   │   ├── gmail.service.js    # nodemailer
│   │   ├── cloudinary.service.js
│   │   └── template.service.js # render {{vars}}
│   ├── scheduler/
│   │   ├── cron.js             # node-cron entry
│   │   └── jobs/
│   │       ├── birthday.job.js
│   │       ├── holiday.job.js
│   │       └── reengage.job.js
│   ├── utils/
│   │   ├── response.js         # success() / error()
│   │   ├── logger.js
│   │   └── asyncHandler.js
│   ├── app.js                  # express app
│   └── server.js               # entry point
├── package.json
├── .env.example
└── README.md
```

Mỗi module tuân theo pattern: `routes → controller → service → supabase query`.

## 3. Cấu trúc thư mục Frontend

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Layout.jsx
│   │   ├── ui/
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Pagination.jsx
│   │   │   └── Spinner.jsx
│   │   └── shared/
│   │       ├── StatCard.jsx
│   │       ├── BirthdayReminder.jsx
│   │       └── EmptyState.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Employees.jsx
│   │   ├── Customers.jsx
│   │   ├── Vouchers.jsx
│   │   ├── Bookings.jsx
│   │   ├── Posts.jsx
│   │   ├── Holidays.jsx
│   │   ├── Messages.jsx
│   │   ├── Reports.jsx
│   │   └── Settings.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useApi.js
│   │   └── usePagination.js
│   ├── services/
│   │   ├── api.js              # axios instance + interceptors
│   │   ├── authService.js
│   │   ├── customerService.js
│   │   └── ...
│   ├── utils/
│   │   ├── formatDate.js
│   │   ├── formatCurrency.js
│   │   └── constants.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 4. Luồng tự động hóa (Cron)

```
node-cron 8:00 AM daily
   │
   ├─→ Birthday Job:  query customers WHERE birthday = today
   │                    → tạo voucher (type=birthday)
   │                    → render template
   │                    → send Zalo → fallback Email
   │                    → log vào message_logs
   │
   ├─→ Holiday Job:    query holidays WHERE date = today
   │                    → broadcast cho tất cả KH active
   │                    → render + send + log
   │
   └─→ Reengage Job:   query customers WHERE last_visit_at < now-30d
                        → tạo voucher (type=promo)
                        → render + send + log
```

## 5. Security
- Supabase Auth JWT, refresh token.
- RLS policies trên mọi bảng (admin all, staff read-only cho employees).
- Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE, ZALO_OA_ID, ZALO_ACCESS_TOKEN, GMAIL_USER, GMAIL_APP_PASSWORD, CLOUDINARY_URL, JWT_SECRET.
- CORS whitelist chỉ frontend domain.
- Rate limit: 100 req/phút/IP.

## 6. API Response Convention
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```
Pagination: `{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }`
