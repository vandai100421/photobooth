# PROGRESS — TAP Photobooth Management

> **File này ghi trạng thái hiện tại của dự án.**
> Mở file này đầu tiên mỗi lần làm việc tiếp để biết đang ở đâu, làm tiếp gì.
> Cập nhật sau mỗi session.

Cập nhật lần cuối: 2026-08-13

---

## Trạng thái tổng quan

**Code hoàn thành ~95%.** Toàn bộ 11 module (frontend + backend + automation) đã code xong.
Còn chờ **credentials/thao tác thủ công bên ngoài** (Zalo OA, Gmail, Cloudinary, hosting) để go-live.

---

## Đã làm xong (verified hoạt động)

### Phase 0 — Supabase ✅
- Project ref: `hyslmonuaaxnqbmyiqvh`
- Schema migration đã chạy: 11 bảng + indexes + triggers + RLS policies
- Seed data OK: `settings` (6 rows), `holidays` (10 rows), `message_templates` (4 rows)
- RLS hoạt động đúng: anon bị chặn, service_role đọc được

### Admin user ✅
- Supabase Auth user đã tạo (email đã confirm)
- Row `employees` liên kết (id trùng auth UUID, role='admin')
- Đăng nhập qua `/api/v1/auth/login` thành công (token `demo: false` = auth thật)

| Trường | Giá trị |
|---|---|
| Email | `admin@tapphotobooth.com` |
| Mật khẩu | `Admin@12345` |
| User ID | `3df81072-b470-4002-948d-b83467addac7` |
| Role | admin |

### Hệ thống chạy local ✅
- **Backend:** http://localhost:5000/api/v1 (chạy bằng `node src/server.js`)
- **Frontend:** http://localhost:5173 (chạy bằng `npm run dev`, Vite proxy /api → :5000)
- Login smoke test pass

### Dry-run mode cho tin nhắn ✅
- Env `MESSAGE_DRY_RUN=true` (đang bật)
- Zalo + Gmail service bỏ qua gửi thật, return success giả
- message_log vẫn ghi `status=sent` → test được toàn bộ flow (send-now, cron) không cần credentials thật
- Test `POST /messages/send-now` thành công: zalo fallback → email dry-run → log `sent`
- **Chuyển gửi thật:** set `MESSAGE_DRY_RUN=false` + cấu hình Gmail/Zalo credentials

### Code modules (Phase 1-3) ✅
- Auth: login, me, refresh, logout (Supabase Auth thật + JWT nội bộ)
- Employees + Shifts: CRUD + ca làm + phân quyền admin/manager/staff
- Customers + Bookings: CRUD + trigger tự động tăng total_visits/total_spent
- Vouchers + customer_vouchers: CRUD + issue + check + usage
- Posts: CRUD + publish + upload (Cloudinary)
- Holidays: CRUD + recurring (MM-DD format)
- Templates: CRUD + render {{vars}}
- Messages: logs + send-now + schedule + stats + dispatcher (zalo→email fallback)
- Dashboard: stats + revenue + customers + vouchers
- Settings: GET/PUT + Zalo QR (local generate + remote fetch)
- Webhooks: Zalo follow event → tự tạo/cập nhật customer với zalo_id
- Scheduler: cron 8:00 AM daily — birthday/holiday/reengage jobs + fallback

---

## Còn phải làm (tất cả cần thao tác thủ công bên ngoài)

### 1. Zalo OA — gửi tin thật
- [ ] Đăng ký OA tại https://oa.zalo.me (xác minh doanh nghiệp, chờ duyệt vài ngày)
- [ ] Lấy OA ID + access token từ dashboard OA
- [ ] (Khuyến nghị) Lấy OA secret để verify webhook signature
- [ ] Cấu hình: vào trang Settings UI nhập `zalo_oa_id` + `zalo_access_token` → Save
     HOẶC sửa `backend/.env` thêm `ZALO_OA_ID`, `ZALO_ACCESS_TOKEN`
- [ ] Setup webhook công khai: `ngrok http 5000` (dev) hoặc deploy (prod) → paste URL vào OA console
- [ ] In QR code OA (nút "Lấy QR code" + "Tải QR" trong trang Settings) → dán tại quầy
- [ ] Khách follow OA → webhook tự lưu zalo_id → hệ thống gửi tin được
- [ ] Set `MESSAGE_DRY_RUN=false` khi test xong
- [ ] Test gửi tin Zalo thật (cần KH đã follow OA)

**Lưu ý Zalo:**
- OA chỉ gửi tin cho người đã FOLLOW — không có cách bypass
- Free tier có rate limit: code đã có `sleep(100)` giữa các tin (sendBroadcast)
- KH chưa follow → fallback email (đã code sẵn trong dispatcher)

### 2. Gmail SMTP — email thật
- [ ] Tạo Gmail App Password (Google Account → Security → 2FA → App Passwords)
- [ ] Sửa `backend/.env`: thêm `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- [ ] Set `MESSAGE_DRY_RUN=false`
- [ ] Test gửi email thật

### 3. Cloudinary — upload ảnh
- [ ] Tạo account Cloudinary + lấy `CLOUDINARY_URL`
- [ ] Sửa `backend/.env` thêm `CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name`
- [ ] Test upload ảnh (POST /upload)

### 4. Deploy production ✅ (đã deploy)
- [x] Deploy Frontend → Vercel: https://tap-photobooth.vercel.app
- [x] Deploy Backend → Vercel Serverless: https://ptb-api-navy.vercel.app
  - Đổi từ Railway/Render sang Vercel Serverless (free, không cần thẻ, không ngủ)
  - Serverless entry: `backend/api/index.js` + `backend/vercel.json` (rewrites + crons)
  - Vercel Cron `0 1 * * *` (8:00 VN) gọi `/api/v1/cron/daily` (bảo vệ bằng CRON_SECRET)
- [x] Setup production env vars qua Vercel CLI (Supabase, JWT_SECRET, CRON_SECRET, FRONTEND_URL, MESSAGE_DRY_RUN=true, VITE_API_URL)
- [ ] Setup Supabase production riêng + RLS (đang dùng chung project dev)
- [ ] Setup monitoring (Sentry)
- [x] Test production: /health ✅, CORS ✅, login ✅, cron dry-run ✅
- [ ] Bổ sung Zalo OA + Gmail SMTP + Cloudinary thật → update env vars trên Vercel → redeploy

---

## Cách khởi động hệ thống local

```bash
# Backend (port 5000)
cd backend && node src/server.js

# Frontend (port 5173)
cd frontend && npm run dev
```

Mở http://localhost:5173 → đăng nhập với admin@tapphotobooth.com / Admin@12345

---

## Luồng Zalo end-to-end (khi go-live)

```
Khách quét QR tại quầy
   → Follow OA
   → Zalo push webhook → /api/v1/webhooks/zalo
   → webhooks.service tạo/cập nhật customer + zalo_id
   → Đến sinh nhật / lễ / 30 ngày không quay lại
   → cron 8:00 AM chạy → dispatcher → zaloService.sendMessage(zalo_id, content)
   → KH nhận tin Zalo thật ✅
   (KH chưa follow → fallback email)
```

---

## File tham chiếu nhanh

| Tài liệu | File |
|---|---|
| Schema DB | `docs/schema.sql` |
| API contract | `docs/api-contract.yaml` |
| Hướng dẫn local | `docs/SETUP_LOCAL.md` |
| Hướng dẫn user | `docs/USER_GUIDE.md` |
| Hướng dẫn deploy | `docs/DEPLOYMENT.md` |
| Danh sách task | `TASKS.md` |
| **Trạng thái hiện tại** | `docs/PROGRESS.md` (file này) |
