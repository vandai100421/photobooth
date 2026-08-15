# TAP Photobooth Management

Hệ thống web quản lý photobooth "TAP Photobooth" — nhân viên, khách hàng, voucher, booking, bài viết, ngày lễ, tin nhắn tự động (Zalo OA + Gmail SMTP), dashboard báo cáo.

## Mục tiêu
- Chi phí vận hành: **0đ/tháng**
- Timeline: 12 tuần

## Tech Stack
| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| Image | Cloudinary |
| Messaging | Zalo OA API + Gmail SMTP |
| Scheduler | node-cron |
| Hosting FE | Vercel |
| Hosting BE | Railway / Render |

## Cấu trúc monorepo
```
/
├── frontend/          # React app
├── backend/           # Express API
├── docs/              # Tài liệu, ERD, API spec, SQL migration
├── opencode.json
├── PROJECT.md
├── ARCHITECTURE.md
├── CODING_STANDARDS.md
├── DEVELOPMENT_RULES.md
└── TASKS.md
```

## Bắt đầu nhanh

### Backend
```bash
cd backend
cp .env.example .env   # điền env vars
npm install
npm run dev            # http://localhost:5000
```

### Frontend
```bash
cd frontend
cp .env.example .env   # điền VITE_API_URL
npm install
npm run dev            # http://localhost:5173
```

## Tài liệu
- [PROJECT.md](./PROJECT.md) — Tổng quan
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Kiến trúc
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) — Quy tắc code
- [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) — Quy trình phát triển
- [TASKS.md](./TASKS.md) — Theo dõi tiến độ
- [docs/](./docs) — SQL migration, API spec, ERD
