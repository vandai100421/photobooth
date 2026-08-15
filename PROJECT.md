# PROJECT — TAP Photobooth Management

## Tổng quan
Hệ thống web quản lý photobooth "TAP Photobooth": nhân viên, khách hàng, voucher, booking, bài viết, ngày lễ, tin nhắn tự động (Zalo OA + Gmail SMTP), dashboard báo cáo.

**Mục tiêu:** Chi phí vận hành 0đ/tháng. Timeline 12 tuần.

## Tech Stack
| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS + React Router |
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| Image | Cloudinary |
| Messaging | Zalo OA API + Gmail SMTP (nodemailer) |
| Scheduler | node-cron |
| Hosting FE | Vercel |
| Hosting BE | Railway / Render |
| QR Code | qrcode.js |
| Monitoring | Sentry (free) |

## Cấu trúc monorepo
```
/
├── frontend/          # React app
├── backend/           # Express API
├── docs/              # Tài liệu, ERD, API spec
├── opencode.json
├── PROJECT.md
├── ARCHITECTURE.md
├── CODING_STANDARDS.md
├── DEVELOPMENT_RULES.md
└── TASKS.md
```

## Module chức năng (11 entity)
employees, shifts, customers, bookings, vouchers, customer_vouchers, posts, holidays, message_templates, message_logs, settings.

## API base
`/api/v1` — REST, JSON response `{ success: boolean, data?: any, error?: string }`.

## Đội agent
- `lead` (primary) — PM điều phối
- `arch` — kiến trúc, API contract
- `backend` — Node.js API
- `frontend` — React UI
- `database` — Supabase
- `automation` — cron, Zalo, Gmail
- `devops` — deploy, CI/CD
- `qa` — test
