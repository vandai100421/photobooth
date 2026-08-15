# TASKS — TAP Photobooth Management

> Bảng theo dõi tiến độ. Cập nhật trạng thái sau mỗi task.
> Trạng thái: `[ ]` pending · `[~]` in-progress · `[x]` done · `[!]` blocked

---

## Phase 0 — Chuẩn bị (Tuần 1)

- [x] Tạo GitHub repo structure (monorepo `/frontend`, `/backend`, `/docs`)
- [x] Viết database schema SQL (11 bảng + index + triggers + RLS)
- [x] Viết API contract (OpenAPI/Swagger) cho `/api/v1`
- [x] Tạo Supabase project + chạy migration (ref: hyslmonuaaxnqbmyiqvh, schema + seed OK, admin user created)
- [ ] Đăng ký Zalo OA + lấy OA ID/QR  ← cần user làm thủ công
- [ ] Tạo Gmail App Password  ← cần user làm thủ công
- [ ] Tạo Cloudinary account  ← cần user làm thủ công
- [ ] Tạo Vercel + Railway/Render account  ← cần user làm thủ công

## Phase 1 — Foundation (Tuần 2-4)

### Tuần 2: Database + Auth
- [x] Tạo tất cả bảng DB trên Supabase (schema.sql sẵn sàng)
- [x] Setup Supabase Auth (email/password)
- [x] API POST /auth/login, /auth/me
- [x] API POST /auth/refresh
- [x] Setup Frontend base (React + Tailwind + Router)
- [x] Trang Login + validation
- [x] Test auth flow (smoke test pass)

### Tuần 3: Module Nhân viên
- [x] API CRUD /employees
- [x] API /employees/:id/shifts
- [x] UI danh sách nhân viên (table + pagination + search)
- [x] UI form thêm/sửa nhân viên
- [x] UI ca làm (calendar + check-in/out)
- [x] Phân quyền admin/manager/staff
- [x] Test API + UI nhân viên

### Tuần 4: Module Khách hàng + Booking
- [x] API CRUD /customers
- [x] API /customers/birthdays
- [x] API CRUD /bookings
- [x] Trigger tự động tăng total_visits, total_spent
- [x] UI danh sách khách hàng + filter
- [x] UI form thêm/sửa khách
- [x] UI chi tiết khách (hồ sơ + lịch sử)
- [x] UI booking (tạo + chọn KH + NV)
- [x] Test khách hàng + booking

## Phase 2 — Voucher + Marketing (Tuần 5-7)

### Tuần 5: Module Voucher
- [x] API CRUD /vouchers
- [x] API POST /vouchers/:id/issue
- [x] API GET /vouchers/check?code=XXX
- [x] API GET /vouchers/:id/usage
- [x] UI danh sách voucher + filter by type
- [x] UI form tạo voucher
- [x] UI phát voucher (chọn KH + voucher)
- [x] Test voucher: hết lượt, hết hạn

### Tuần 6: Module Bài viết + Ngày lễ
- [x] API CRUD /posts
- [x] API POST /upload (Cloudinary)
- [x] API POST /posts/:id/publish
- [x] API CRUD /holidays
- [x] UI quản lý bài viết (list + editor + image upload)
- [x] UI ngày lễ (calendar + CRUD)
- [x] Test upload ảnh + recurring holiday

### Tuần 7: Module Tin nhắn (Phần 1)
- [x] API CRUD /templates
- [x] API GET /messages/logs
- [x] API POST /messages/send-now
- [x] UI trang template (editor + preview)
- [x] UI log tin nhắn (table + filter)
- [x] UI form gửi thủ công
- [x] Test template rendering + log

## Phase 3 — Automation (Tuần 8-10)

### Tuần 8: Zalo OA API
- [ ] Đăng ký + xác minh Zalo OA  ← cần user làm thủ công
- [x] Code zalo.service.js (gửi tin)
- [x] Code webhook nhận follow event
- [x] UI cài đặt Zalo (OA ID + QR)
- [ ] Test gửi tin Zalo (SĐT thật)  ← cần credentials thật

### Tuần 9: Gmail SMTP + Cron Job
- [x] Code gmail.service.js (nodemailer)
- [x] Code cron.js (node-cron 8:00 AM daily)
- [x] Birthday job (query + voucher + gửi)
- [x] Holiday job (broadcast)
- [x] Reengage job (last_visit_at < 30d)
- [x] Fallback Zalo → Email
- [ ] Test cron + Gmail + fallback  ← cần credentials thật

### Tuần 10: Dashboard + Báo cáo
- [x] API GET /dashboard/stats
- [x] API GET /dashboard/revenue
- [x] API GET /dashboard/customers
- [x] API GET /dashboard/vouchers
- [x] UI Dashboard (StatCard + biểu đồ)
- [x] UI Báo cáo (doanh thu, khách, voucher)
- [x] UI danh sách sinh nhật + nút gửi nhanh
- [x] Test dashboard

## Phase 4 — Hoàn thiện & Deploy (Tuần 11-12)

### Tuần 11: Settings + QR + Polish UI
- [x] API GET/PUT /settings
- [x] API GET /settings/zalo-qr
- [x] UI trang cài đặt (Zalo, Gmail, tên quán)
- [x] UI QR code Zalo OA
- [x] Responsive (mobile + tablet)
- [x] Loading states (skeleton, spinner)
- [x] Error handling (toast notifications)
- [x] Test UI/UX full flow

### Tuần 12: Deploy + Go-Live
- [ ] Deploy Frontend → Vercel  ← cần user làm thủ công (vercel.json sẵn sàng)
- [ ] Deploy Backend → Railway/Render  ← cần user làm thủ công (Dockerfile + railway.json sẵn sàng)
- [ ] Setup production env vars  ← cần user làm thủ công (.env.example sẵn sàng)
- [ ] Setup Supabase production + RLS  ← cần user làm thủ công (schema.sql sẵn sàng)
- [ ] Setup monitoring (Sentry)  ← cần user làm thủ công
- [ ] Test production
- [x] Viết tài liệu HDSD (docs/USER_GUIDE.md)
- [ ] Training nhân viên
- [ ] Go-live

---

## Rủi ro & Giải pháp

| Rủi ro | Giải pháp |
|---|---|
| Zalo OA duyệt chậm | Đăng ký ngay tuần 1, dùng Email tạm |
| Supabase free hết limit | Giám sát, nâng cấp ~$25/tháng |
| Railway/Render sleep | cron-job.org ping mỗi 5 phút |
| Gmail SMTP limit | Giới hạn 400 email/ngày |
| Khách không follow OA | Tặng voucher, nhân viên chủ động nhắc |
| Cron job không chạy | Monitoring + cảnh báo email |

---

## Mở rộng — Quản lý nhân sự nâng cao (HR Extension)

> Triển khai thêm theo yêu cầu: lịch công tác, phân bổ vị trí, thưởng/KPI.
> Migration: `docs/schema_hr.sql` (chạy sau `docs/schema.sql`).

### Database
- [x] Bảng `locations`, `employee_skills`, `employee_areas`, `shift_swap_requests`, `employee_bonus_rules`, `customer_feedback`, `employee_payouts`
- [x] Mở rộng `shifts` thêm location_id + tọa độ GPS
- [x] RLS + index + seed 6 quy tắc thưởng mặc định

### Backend API
- [x] Module `schedule`: GET /shifts (calendar), GET /workload, GET /auto-assign, CRUD /shifts, swap-requests (tạo + duyệt), CRUD /locations
- [x] Module `rewards`: GET /kpi, GET /leaderboard, GET/PUT /bonus-rules, CRUD /payouts, /feedback
- [x] Mở rộng module `employees`: skills + areas (GET/POST/DELETE)

### Frontend UI
- [x] Trang `Schedule`: lịch tuần, tạo/sửa/xóa ca, gợi ý NV (auto-assign), duyệt đổi ca, quản lý địa điểm, tải công việc
- [x] Trang `Rewards`: bảng xếp hạng, KPI nhân viên, chốt thù lao, quy tắc thưởng (admin edit)
- [x] Services + constants + nav + routes

### Còn lại
- [ ] Chạy migration `schema_hr.sql` lên Supabase production (cần user làm thủ công)
- [ ] Test thực tế flow: tạo ca → auto-assign → chốt KPI/thưởng cuối tháng
