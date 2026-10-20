# KẾ HOẠCH — Quản lý lượt chụp / mã chụp (Photobooth + Selfbooth)

> File này là "nhật ký thi công". Đọc đầu tiên khi tiếp tục để biết đang ở đâu.
> Trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong · `[!]` bị chặn
> Cập nhật sau mỗi session.

Cập nhật lần cuối: 2026-10-12

## Nhật ký thay đổi

- **2026-10-12 — Sửa 2 API lỗi ở trang "Tổng hợp doanh thu"**:
  - `boothClient.js`: đường dẫn Selfbooth đổi sang `/v1/web/*` (đã xác minh 401 = có tồn tại; `/v1/portal/*` trả 404);
    login Selfbooth → `POST /v1/web/auth/login` body `{ email, password, turnstile_token? }`;
    `fetchRevenue` bỏ vòng thử path (path sai làm lỗi 404 che mất lỗi 401) → mỗi hệ đúng 1 path:
    Selfbooth `/v1/web/revenue`, Photobooth `/portal/{tenant}/revenue` (path cũ `/v1/portal/revenue` trả 403).
  - Backend thêm `GET /api/v1/booth/:system/media-sessions` (gọi live, không cache).
  - Frontend `PortalRevenue.jsx` gọi Portal (revenue + media-sessions) qua backend proxy thay vì gọi thẳng
    từ trình duyệt (trước đó 401 vì không kèm token). `portalRevenueService.js` chỉ còn helper preview.
  - `fetchUpstream`: lỗi 401 Selfbooth trả thông báo rõ "phiên hết hạn — dán cookie mới" thay vì "not_found".
  - Đã test: revenue PB 200 (193 dòng, tổng 8.834.000đ), media-sessions PB 200, Selfbooth trả thông báo hết hạn.

---

## 1. Mục tiêu

Quản lý **mã chụp (shoot code / voucher)** và **lượt chụp (media session)** của khách trên 2 hệ thống
**Photobooth** và **Selfbooth**, phục vụ:

1. **Đồng bộ mã** trong ngày từ API ngoài → chỉ thêm mã **chưa có** trong CSDL (dedupe).
2. **Đồng bộ dữ liệu chụp ảnh** (media sessions / sessions) → chỉ thêm bản ghi chưa có.
3. **Tra cứu & đối chiếu**: mã đã bán ↔ ảnh đã chụp khớp chưa (bao nhiêu mã chưa dùng, session không có mã...).
4. **Đối chiếu doanh thu**: tổng tiền theo mã (máy ghi) ↔ **tiền mặt thực tế nhân viên nhập vào**.
5. **Tạo mã chụp mới** cho khách (chọn gói/loại, ghi chú Tiền mặt/Chuyển khoản).

**Bắt buộc đăng nhập** trước khi dùng (đã có `ProtectedRoute` + JWT của hệ thống TAP).
Ngoài ra mỗi API ngoài cần **tài khoản đăng nhập** — quản lý qua modal tài khoản.

---

## 2. API ngoài (external)

Đã xác thực thực tế (với credentials thật):

| Hệ | Base URL | Login endpoint | Login body | Token |
|---|---|---|---|---|
| Selfbooth | `https://boothme.tech/v1/web/auth/login` | `{ email, password }` | `access_token` (Bearer), header bổ sung `x-bootstrap-token` |
| Photobooth | `https://photobooth-api.boothstudio2026.workers.dev` | `POST /auth/login` | `{ email, password, studio_name: "" }` | `session_token` (Bearer), header `x-booth-tenant` |

### Selfbooth (`studio_id=17`)
- Gói chụp: `GET https://boothme.tech/v1/web/packages`
- Mã chụp: `GET https://boothme.tech/v1/web/codes`
- Doanh thu: `GET https://boothme.tech/v1/web/revenue`
- Tạo mã: `POST https://boothme.tech/v1/web/codes`
  payload: {`code
: 
""
count
: 
1
kind
: 
"single"
note
: 
""
package_id
: 
"6243970a-9819-49f4-978b-fe55068712c3" }`
  - `note`: **Tiền mặt tại quầy** / **Chuyển khoản tại quầy**

### Photobooth (`tenant=thetap@studio.vn`)
- Mã (voucher): `GET /portal/{tenant}/vouchers?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Session/ảnh: `GET /portal/{tenant}/media-sessions?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Tạo mã: `POST /portal/{tenant}/vouchers`
  payload: `{ count: 1, created_by: "thetap@studio.vn", note: "...", type: "cash"|"cash_code", value: number, valid_from: "", valid_until: "" }`
  - `type`: **Giảm giá = `cash`**, **Tiền mặt = `cash_code`**
  - `note`: select giống Selfbooth

> Code xử lý **tolerant**: đọc nhiều shape response, map nhiều tên field, luôn lưu `raw` JSONB.

---

## 3. Database

### Migration hiện có
- `docs/schema_booth.sql` — bảng gốc.
- `docs/schema_booth_v2.sql` — **bổ sung cột theo shape API thật** (idempotent, ALTER TABLE). Chạy sau schema_booth.sql.
- `docs/schema_booth_v3.sql` — `booth_code_reviews` (ghi chú/đánh dấu xử lý mã của nhân viên).
- `docs/schema_booth_daily.sql` — `booth_daily_revenue` (doanh thu theo ngày của máy chụp cho Dashboard).

### Các bảng
1. **`booth_shoot_codes`** — cache mã chụp (UNIQUE `(system, code)`).
   - Phát hiện thêm: `used, used_at, paid_amount, valid_from/until, expires_at, redeemed_session_id, redeemed_hwid, created_via/by, use_count, revoked, cancelled_at, machine_name, minutes/package_minutes, package_prints, shift, phone, branch_id, owner_email, package_key`
2. **`booth_media_sessions`** — cache lượt chụp (UNIQUE `(system, external_id)`).
   - Phát hiện thêm: `code_used`, `code_kind`, `package_name`, `amount`, `revenue`, `total_prints/prints_cut/prints_nocut`, `status`, `hwid`, `device_name`, `ended_at`, `source`, `is_test`, `finish_reason`, `expected_photos`, `cover_image`
3. **`booth_reconciliations`** — tiền nhập tay theo ngày (UNIQUE `(system, reconciliation_date)`).
4. **`booth_code_reviews`** — trạng thái xử lý do nhân viên nhập (UNIQUE `(system, code)`), không bị ghi đè khi sync.
5. **`booth_daily_revenue`** — doanh thu theo ngày của từng hệ máy (UNIQUE `(system, revenue_date)`), ghi khi bấm
   **Đồng bộ**; Dashboard cộng với `daily_revenue` (nhập tay).

**Liên kết đối chiếu thực tế:**
- Photobooth: `booth_shoot_codes.redeemed_session_id` = `booth_media_sessions.session_id` (external_id dạng `session_...`). Session **không** có `code`.
- Selfbooth: `booth_media_sessions.code`/`code_used` = `booth_shoot_codes.code`.

### Settings (bảng `settings`)
- Selfbooth: `selfbooth_api_base, selfbooth_studio_id, selfbooth_login_path, selfbooth_login_email, selfbooth_login_password, selfbooth_token`
- Photobooth: `photobooth_api_base, photobooth_tenant, photobooth_login_path, photobooth_login_email, photobooth_login_password, photobooth_token`

---

## 4. Backend — module `booth`

**Logic summary đã cập nhật:**
- Login Selfbooth gửi `{ email, password }` tới `/v1/web/auth/login` (Turnstile chặn đăng nhập server-side → user dán cookie).
- `normalizeCode`: map đủ field (used/revoked/paid_amount/valid/expires/cancelled/redeemed_*).
- `normalizeSession`: map `photos_captured`, `capture_started_at`, `code_used`, `amount/revenue`, `is_test`.
- `getSummary()` lọc `is_test`, nối khóa đúng (PB: redeemed_session_id ↔ external_id; SB: code_used/code ↔ code).

Files: `boothClient.js`, `booth.service.js`, `booth.controller.js`, `booth.routes.js`, `booth.schema.js`.

---

## 5. Frontend

- Trang `ShootCodes.jsx`: hiển thị trạng thái `Đã dùng/Chưa dùng/Đã huỷ` theo `used/revoked/status`; bảng mã có thêm `Đã trả (paid_amount)`. Bảng session thêm `Thiết bị`, logic match mới. Thẻ thống kê thêm `Tiền đã thu (theo mã)`.
- `CreateCodeModal.jsx`, `BoothAccountModal.jsx`, constants, route: giữ nguyên, đã đồng bộ.

---

## 6. Checklist thi công

### Chuẩn bị
- [x] Dò API ngoài + lấy credentials thật
- [x] Phân tích shape JSON (dump dump files)
- [x] Cập nhật kế hoạch này

### Backend
- [x] Migration `docs/schema_booth.sql`, `docs/schema_booth_v2.sql` (viết)
- [x] `boothClient.js` (login + normalize) — cập nhật theo dữ liệu thật
- [x] `booth.service.js` (match logic + is_test)
- [x] module khác (controller/routes/schema) — không thay đổi nhiều
- [x] Mount `/api/v1/booth`

### Frontend
- [x] `ShootCodes.jsx` — cập nhật cột + logic match + stats

### Kiểm thử
- [x] `npm run lint` backend (pass)
- [x] `npm test` backend (14/14 pass)
- [ ] Chạy migration `docs/schema_booth.sql`, `docs/schema_booth_v2.sql`, `docs/schema_booth_v3.sql`, `docs/schema_booth_daily.sql` lên Supabase SQL Editor
- [ ] Có credentials thật → test login + sync + tạo mã (đã xác nhận API)
- [ ] Đối chiếu số liệu thực tế (PB: vouchers ↔ media-sessions qua `redeemed_session_id`)

---

## 7. Việc cần user cung cấp (để test thật)

- [ ] Chạy migration `docs/schema_booth.sql` và `docs/schema_booth_v2.sql` (+ `schema_booth_v3.sql`, `schema_booth_daily.sql`) trên Supabase SQL Editor.
- [ ] (Tùy chọn) Kiểm tra kết nối token sau khi lưu trong Settings (admin → Tài khoản API).

---

## 8. Giả định & Lưu ý

- Dedupe: `(system, code)` cho codes, `(system, external_id)` cho sessions.
- Session Photobooth thiếu `code` → không tự suy ngược đầy đủ; match dựa trên `redeemed_session_id`. Cần giữ nguyên external_id.
- Selfbooth session có `is_test` → lọc khỏi thống kê đối chiếu.
- Lưu `raw` JSONB đầy đủ để rollback/map lại nếu API thay đổi.
- `pick()` + nhiều key dự phòng vẫn giữ nguyên (tolerant).
- Sync theo ngày, tuần tự tránh rate limit.

(End)
