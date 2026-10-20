# PROGRESS — TAP Photobooth Management

> **File này ghi trạng thái hiện tại của dự án.**
> Mở file này đầu tiên mỗi lần làm việc tiếp để biết đang ở đâu, làm tiếp gì.
> Cập nhật sau mỗi session.

Cập nhật lần cuối: 2026-10-12

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

### Module Mã chụp — Photobooth/Selfbooth 🆕
- Backend module `booth`: `/api/v1/booth/*` (accounts, login, packages, sync, codes, sessions, create-code, summary, reconciliations)
- Service `boothClient.js`: gọi API ngoài (login/fetch/create), xử lý tolerant nhiều shape response
- DB (migration `docs/schema_booth.sql + schema_booth_v2.sql + schema_booth_v3.sql + schema_booth_daily.sql`): `booth_shoot_codes`, `booth_media_sessions`, `booth_reconciliations`, `booth_code_reviews`, `booth_daily_revenue`
- Frontend: trang `ShootCodes` (nav "Mã chụp") — 2 tab Mã chụp (gộp mã + lượt chụp) / Tiền nhập tay 🆕
- **Gộp mã + lượt chụp (2026-10-11):** bảng mã hiển thị kèm lượt chụp liên kết, trạng thái suy diễn
  (`used/unused/error/revoked/missing_session`), lọc theo trạng thái + tìm kiếm, tùy chọn "Hiện lượt lạ".
- **Ghi chú nhân viên (2026-10-11):** modal chi tiết mã cho phép nhập trạng thái xử lý + lý do (chọn sẵn
  hoặc ghi tự do) → lưu vào `booth_code_reviews` qua `PUT /booth/:system/codes/:code/review` (không bị ghi đè khi re-sync).
- **Chuyển Selfbooth sang boothme.tech (2026-10-12):** `boothClient` dùng base `https://boothme.tech` + endpoint
  `/v1/web/*` (`/auth/login`, `/packages`, `/codes`, `/capture-sessions`, `/revenue`). Xác thực bằng **cookie phiên**
  (dán thủ công trong "Tài khoản API") hoặc Bearer — tự nhận diện. Login gửi `{email,password,turnstile_token?}`.
- **Tab Doanh thu (2026-10-12):** `GET /booth/:system/revenue?from&to` lấy trực tiếp từ API (không cache) →
  thẻ tổng hợp (`used_codes`, `code_revenue_vnd`, `single_uses`, `reusable_uses`, `local_uses`) + bảng lượt dùng.
- Frontend `ShootCodes`: 3 tab **Mã chụp | Doanh thu | Tiền nhập tay** (bỏ UI lượt chụp riêng; mã hiển thị
  kèm phòng/máy + ngày tạo). Modal tạo mã Selfbooth thêm chọn loại (`single`/`reusable`) + mã tuỳ chọn.
- **Xử lý Turnstile (2026-10-12):** boothme.tech chặn bot bằng Cloudflare Turnstile và không cho đăng nhập
  tự động (widget không kết nối được với Cloudflare). **Giải pháp hiện tại:** Selfbooth dùng **cookie phiên
  dán thủ công** — modal Tài khoản API chỉ còn các trường cần thiết (Base URL, Studio ID, Cookie/Token phiên,
  nút Lưu); bỏ email/mật khẩu/turnstile/login path. Backend vẫn hỗ trợ `turnstile_token` 1 lần nếu sau này có
  token hợp lệ. Cookie có `=` tự nhận diện là session cookie (header `Cookie`); ngược lại dùng `Authorization: Bearer`.
- **Bỏ server Selfbooth cũ (2026-10-12):** Selfbooth **luôn** gọi `https://boothme.tech` (`/v1/web/*`) — `getConfig`/
  `getAccounts` bỏ qua `selfbooth_api_base`/`selfbooth_login_path` lưu trong DB, `saveAccount` không còn ghi ghi đè
  base/login path cho selfbooth. Đã xoá cấu hình cũ `selfbooth_api_base = selfbooth-api.thientiva.workers.dev` khỏi bảng settings.
- **Sửa lỗi bị đăng xuất khi đồng bộ (2026-10-12):** lỗi xác thực từ API ngoài (401/403) trước đây bị trả về
  đúng mã 401 → frontend tưởng hết phiên admin và tự đăng xuất. Nay `boothClient` quy mọi lỗi upstream
  (kể cả 401/403) về **502** kèm thông báo rõ. Thêm `fetchUpstream`: token Photobooth hết hạn sẽ **tự đăng
  nhập lại 1 lần** rồi thử lại (Selfbooth vẫn phải dán cookie). Đã kiểm chứng API thật: login OK, tải 170 mã.
- Modal quản lý tài khoản API (email/password/token, base URL, login path, studio/tenant) + test đăng nhập
- Modal tạo mã chụp (Selfbooth: chọn gói; Photobooth: loại Giảm giá/`cash` — Tiền mặt/`cash_code` + giá trị)
- Đồng bộ chỉ THÊM mã/session mới (dedupe theo `system`+`code`/`external_id`)
- Nhập tay "tiền mặt máy ghi" + "tiền mặt thực nhận" → đối chiếu chênh lệch
- **Đồng bộ doanh thu máy vào Dashboard (2026-10-20):** `POST /booth/:system/sync` ghi thêm doanh thu theo
  **NGÀY** vào bảng mới `booth_daily_revenue` (Photobooth: `data[].amount_required`; Selfbooth: `daily[].revenue_vnd`,
  thiếu thì `uses[].price_vnd`) — Dashboard cộng `daily_revenue` (nhập tay) + bảng này cho doanh thu hôm nay /
  tháng / tổng và biểu đồ 6 tháng. Lỗi ghi doanh thu chỉ báo toast, không làm hỏng đồng bộ mã/lượt.
  Migration: `docs/schema_booth_daily.sql`.
- Kế hoạch chi tiết: `docs/BOOTH_SHOOT_PLAN.md`

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

### 4. Deploy production ✅ (đã deploy)- [x] Deploy Frontend → Vercel: https://tap-photobooth.vercel.app
- [x] Deploy Backend → Vercel Serverless: https://ptb-api-navy.vercel.app
  - Đổi từ Railway/Render sang Vercel Serverless (free, không cần thẻ, không ngủ)
  - Serverless entry: `backend/api/index.js` + `backend/vercel.json` (rewrites + crons)
  - Vercel Cron `0 1 * * *` (8:00 VN) gọi `/api/v1/cron/daily` (bảo vệ bằng CRON_SECRET)
- [x] Setup production env vars qua Vercel CLI (Supabase, JWT_SECRET, CRON_SECRET, FRONTEND_URL, MESSAGE_DRY_RUN=true, VITE_API_URL)
- [ ] Setup Supabase production riêng + RLS (đang dùng chung project dev)
- [ ] Setup monitoring (Sentry)
- [x] Test production: /health ✅, CORS ✅, login ✅, cron dry-run ✅
- [ ] Bổ sung Zalo OA + Gmail SMTP + Cloudinary thật → update env vars trên Vercel → redeploy

### 5. Mã chụp Photobooth/Selfbooth — API ngoài (thủ công)
- [ ] Chạy migration `docs/schema_booth.sql` + `docs/schema_booth_v2.sql` + `docs/schema_booth_v3.sql` (bảng `booth_code_reviews`) + `docs/schema_booth_daily.sql` (bảng `booth_daily_revenue`) trên Supabase SQL Editor
- [ ] **Selfbooth:** vào "Tài khoản API" → mở boothme.tech trên trình duyệt → đăng nhập → F12 → Application → Cookies → copy cookie domain boothme.tech → dán vào ô "Cookie / Token phiên" (chỉ cần Base URL + Studio ID, không cần email/mật khẩu) → Lưu
- [ ] Cung cấp tài khoản Photobooth (email/password hoặc token) → nhập ở nút "Tài khoản API" trong trang Mã chụp
- [ ] Xác nhận đường dẫn login thật nếu khác mặc định (Selfbooth `/v1/web/auth/login`, Photobooth `/auth/login`)
- [ ] Bấm "Đăng nhập & kiểm tra" (Photobooth) → "Đồng bộ" → kiểm tra tab Doanh thu đối chiếu với thực tế

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
