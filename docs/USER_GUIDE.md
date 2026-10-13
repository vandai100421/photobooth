# Hướng dẫn sử dụng — THE TAP Management

Tài liệu dành cho nhân viên/quản lý quán photobooth. Hướng dẫn từng thao tác trên
hệ thống quản lý **THE TAP**.

> Mọi ảnh chụp màn hình trong tài liệu được đánh dấu `[(screenshot)]`. Khi hệ
> thống chạy thật, thay bằng ảnh chụp thực tế để nhân viên dễ làm quen.

---

## Mục lục

1. [Đăng nhập](#1-đăng-nhập)
2. [Dashboard — xem thống kê](#2-dashboard--xem-thống-kê)
3. [Quản lý khách hàng](#3-quản-lý-khách-hàng)
4. [Tạo booking khi khách chụp ảnh](#4-tạo-booking-khi-khách-chụp-ảnh)
5. [Phát voucher cho khách](#5-phát-voucher-cho-khách)
6. [Danh sách sinh nhật & gửi tin nhắn nhanh](#6-danh-sách-sinh-nhật--gửi-tin-nhắn-nhanh)
7. [Quản lý tin nhắn — gửi thủ công & xem log](#7-quản-lý-tin-nhắn--gửi-thủ-công--xem-log)
8. [Cài đặt (dành cho admin)](#8-cài-đặt-dành-cho-admin)
9. [Quản lý mã chụp — Photobooth/Selfbooth](#9-quản-lý-mã-chụp--photoboothselfbooth)

---

## 1. Đăng nhập

`[(screenshot: trang đăng nhập với ô Email + Mật khẩu + nút Đăng nhập)]`

1. Mở trình duyệt, truy cập địa chỉ hệ thống (VD: `https://tap-photobooth.vercel.app`).
2. Nhập **Email** và **Mật khẩu** do quản lý cấp.
3. Bấm **Đăng nhập**.
   - Nếu sai thông tin sẽ có thông báo lỗi màu đỏ.
   - Đăng nhập thành công → chuyển tới **Dashboard**.
4. Quên mật khẩu: liên hệ quản lý để đặt lại (qua Supabase Auth).

> Phân quyền:
> - **admin** — làm được mọi thứ, kể cả Cài đặt.
> - **manager** — quản lý khách hàng, booking, voucher, tin nhắn.
> - **staff** — xem thông tin, tạo booking, phát voucher.

---

## 2. Dashboard — xem thống kê

`[(screenshot: Dashboard với 4 thẻ số liệu + biểu đồ + danh sách sinh nhật)]`

Dashboard là trang đầu tiên sau khi đăng nhập, hiển thị:

- **Thẻ số liệu (StatCard):** tổng khách hàng, lượt chụp (booking), doanh thu,
  số voucher đã phát.
- **Biểu đồ doanh thu** theo thời gian.
- **Danh sách sinh nhật hôm nay / sắp tới** — có nút **Gửi tin nhanh**.

### Cách xem
- Chọn khoảng thời gian (hôm nay / tuần / tháng) ở bộ lọc phía trên.
- Di chuột lên biểu đồ để xem số liệu chi tiết từng ngày.

---

## 3. Quản lý khách hàng

`[(screenshot: danh sách khách hàng dạng bảng + ô tìm kiếm + nút Thêm khách)]`

Vào menu **Khách hàng** ở thanh bên (Sidebar).

### Tìm kiếm
- Gõ tên / số điện thoại / email vào ô **Tìm kiếm**.
- Dùng bộ lọc theo trạng thái (khách mới, khách quen, không hoạt động).
- Phân trang ở cuối bảng nếu có nhiều khách.

### Thêm khách mới
1. Bấm nút **Thêm khách** (góc phải).
2. Điền form:
   - **Họ tên** *(bắt buộc)*
   - **Số điện thoại** *(bắt buộc, định dạng 0xxxxxxxxx)*
   - **Email**
   - **Ngày sinh** (để hệ thống tự gửi voucher sinh nhật)
   - **Zalo UID** (nếu khách đã follow OA — dùng để gửi tin Zalo)
   - **Ghi chú**
3. Bấm **Lưu**.

`[(screenshot: form Thêm/Sửa khách hàng)]`

### Sửa thông tin
- Bấm vào **tên khách** hoặc icon bút chì → mở form sửa → đổi thông tin → **Lưu**.

### Xem hồ sơ khách
- Bấm vào một khách → trang chi tiết hiện:
  - Thông tin cá nhân.
  - Lịch sử booking (lần chụp, gói, chi phí).
  - Danh sách voucher đang có.
  - Lịch sử tin nhắn đã gửi.

---

## 4. Tạo booking khi khách chụp ảnh

`[(screenshot: form tạo booking với chọn khách, nhân viên, gói, ngày giờ)]`

Vào menu **Booking**.

### Tạo booking
1. Bấm **Tạo booking**.
2. Chọn **khách hàng** (gõ tên/SĐT để tìm nhanh). Nếu khách mới → bấm **Thêm
   khách nhanh**.
3. Chọn **nhân viên** phụ trách.
4. Chọn **gói chụp** và **số lượng ảnh**.
5. Chọn **ngày giờ** chụp.
6. Nhập **số tiền** (nếu khách thanh toán ngay).
7. Bấm **Lưu**.

> Khi booking hoàn tất, hệ thống **tự động** tăng `total_visits` và
> `total_spent` của khách (qua trigger trong database).

### Cập nhật / huỷ booking
- Bấm vào booking → **Sửa** đổi trạng thái (chờ, đã chụp, đã huỷ) hoặc **Xoá**.
- Booking đã huỷ không xoá cứng, vẫn lưu lại để tra cứu.

---

## 5. Phát voucher cho khách

`[(screenshot: danh sách voucher + nút Phát voucher)]`

Vào menu **Voucher**.

### Tạo voucher
1. Bấm **Tạo voucher**.
2. Điền:
   - **Tên voucher** (VD: `GIAM10-THANG10`)
   - **Loại:** `birthday` (sinh nhật) / `promo` (khuyến mãi) / `loyalty` (thân thiết)
   - **Giá trị giảm** (VD: 10% hoặc 50.000đ)
   - **Số lượt dùng tối đa**
   - **Ngày hết hạn**
3. Bấm **Lưu**.

### Phát voucher cho khách
1. Trong danh sách voucher, bấm **Phát** trên voucher muốn gửi.
2. Chọn 1 hoặc nhiều khách hàng (tick vào ô).
3. Bấm **Phát voucher**.
   - Hệ thống tạo bản ghi `customer_vouchers` (mỗi khách 1 mã riêng).
   - Có thể kèm gửi tin nhắn Zalo/Email thông báo (nếu chọn "Gửi kèm tin nhắn").

### Kiểm tra / tra cứu voucher
- Dùng ô **Kiểm tra mã** → nhập mã voucher → xem còn hiệu lực không, đã dùng
  bao nhiêu lượt, ai đang giữ.

`[(screenshot: hộp thoại kiểm tra voucher)]`

---

## 6. Danh sách sinh nhật & gửi tin nhắn nhanh

`[(screenshot: danh sách khách sinh nhật hôm nay + nút Gửi tin nhanh)]`

Hệ thống **tự động gửi** tin chúc mừng sinh nhật mỗi ngày **8:00 sáng** qua cron
job (kèm voucher sinh nhật). Nhưng nhân viên vẫn có thể gửi thủ công:

### Xem danh sách
- Vào **Dashboard** → mục **Sinh nhật hôm nay**, hoặc
- Vào **Khách hàng** → lọc **Sinh nhật tháng này**.

### Gửi nhanh
1. Bấm **Gửi tin nhanh** cạnh tên khách.
2. Hệ thống dùng mẫu tin nhắn `birthday` + voucher sinh nhật → gửi qua Zalo
   (nếu khách follow OA), nếu không thì gửi **Email**.
3. Kết quả ghi vào **Log tin nhắn** (xem mục 7).

---

## 7. Quản lý tin nhắn — gửi thủ công & xem log

`[(screenshot: trang Tin nhắn với 2 tab: Gửi tin + Lịch sử)]`

Vào menu **Tin nhắn**.

### Gửi tin thủ công
1. Chuyển sang tab **Gửi tin**.
2. Chọn **khách nhận** (1 hoặc nhiều).
3. Chọn **mẫu tin nhắn** (template) — VD: `birthday`, `holiday`, `reengage`.
4. Xem **xem trước** (preview) — các biến `{{ten_khach}}`, `{{ma_voucher}}` đã
   được thay bằng giá trị thật.
5. Chọn **kênh gửi:** Zalo / Email / Tự động (Zalo trước, fallback Email).
6. Bấm **Gửi ngay** hoặc **Lên lịch gửi** (chọn ngày giờ).

### Xem log tin nhắn
- Tab **Lịch sử** hiển thị toàn bộ tin đã gửi:
  - Thời gian, khách nhận, kênh, mẫu dùng, trạng thái (thành công / thất bại).
- Lọc theo trạng thái / kênh / ngày.
- Bấm vào 1 dòng để xem nội dung tin đã gửi + lỗi (nếu có).

`[(screenshot: bảng log tin nhắn)]`

> Giới hạn: Gmail SMTP cho phép khoảng **400 email/ngày**. Hệ thống ưu tiên
> Zalo OA để tiết kiệm quota email.

---

## 8. Cài đặt (dành cho admin)

> Chỉ role **admin** mới thấy menu **Cài đặt**.

`[(screenshot: trang Cài đặt với các trường Zalo OA, Gmail, tên quán, QR code)]`

Vào menu **Cài đặt**.

### Thông tin quán
- **Tên quán**, **địa chỉ**, **số điện thoại**, **logo**.
- Dùng trong mẫu tin nhắn và hoá đơn.

### Zalo OA
- Nhập **OA ID** và **Access Token**.
- Mã **QR code Zalo OA** tự sinh — in dán tại quầy để khách quét follow.
- Cấu hình **Webhook URL** để nhận sự kiện khách follow OA (xem
  `docs/DEPLOYMENT.md`).

### Gmail SMTP
- Nhập **Gmail** và **App Password** (không phải mật khẩu đăng nhập thường).
- Bấm **Gửi email test** để kiểm tra kết nối.

### Lịch cron
- Tuỳ chỉnh giờ chạy job tự động (mặc định 8:00 sáng) nếu cần.

### Lưu
- Bấm **Lưu cài đặt** ở cuối trang. Mọi thay đổi áp dụng ngay.

---

## 9. Quản lý mã chụp — Photobooth/Selfbooth

`[(screenshot: trang Mã chụp với 4 tab + StatCards + bộ lọc ngày)]`

Vào menu **Mã chụp 📸**. Trang này gom dữ liệu mã chụp và lượt chụp từ **2 hệ thống
máy** (Photobooth và Selfbooth) để **đối chiếu** mã đã bán với ảnh chụp được và tiền
thực thu.

### Bộ lọc chung (đầu trang)
- **Hệ thống:** chọn `Photobooth` hoặc `Selfbooth`.
- **Từ ngày / Đến ngày.**
- **Đồng bộ:** kéo dữ liệu mới từ API hệ thống về (chỉ thêm mã/lượt chưa có, không
  ghi đè dữ liệu cũ).
- **Tải lại:** đọc lại dữ liệu đã lưu trong hệ thống.
- **Tài khoản API:** mở hộp thoại nhập tài khoản đăng nhập API hệ thống (admin).

### Tab **Đối chiếu**
Tổng hợp theo từng mã chụp: mã có được dùng để chụp không (đã chụp / chưa dùng),
số lượt chụp, tổng số ảnh, và so sánh **tiền mặt máy ghi** với **tiền mặt thực nhận**
(bạn nhập tay). Cột **Chênh lệch** tô đỏ khi hai số không khớp.

### Tab **Mã chụp**
Danh sách mã đã bán: mã, trạng thái (chưa dùng / đã chụp), thời gian tạo. Nút
**Tạo mã chụp** (góc phải) mở form tạo mã mới:
- **Selfbooth:** chọn **gói chụp**.
- **Photobooth:** chọn **loại** (Giảm giá / Tiền mặt) và nhập **giá trị**.
- **Ghi chú:** chọn `Tiền mặt tại quầy` hoặc `Chuyển khoản tại quầy`.
> Mã tạo ra trên hệ thống máy ngay sau khi bấm Tạo.

### Tab **Lượt chụp**
Danh sách các lượt chụp (session) từ máy: mã tương ứng, thời gian, số ảnh.

### Tab **Tiền nhập tay**
Nhập số tiền máy báo và số tiền thực nhận cho từng mã để hệ thống tính chênh lệch.
- Bấm **Thêm** → chọn mã → nhập `Tiền mặt máy ghi` và `Tiền mặt thực nhận` → Lưu.
- Xoá được bản ghi nhập sai.

### Cấu hình tài khoản API (admin)
1. Bấm **Tài khoản API**.
2. Điền cho từng hệ thống: **Base URL**, **Studio ID** (Selfbooth) hoặc **Tenant**
   (Photobooth), **Email đăng nhập**, **Mật khẩu** (hoặc dán **Token** nếu có).
3. Bấm **Lưu**, rồi **Đăng nhập & kiểm tra** để xác nhận kết nối.
4. Bấm **Đồng bộ** ở trang chính để tải dữ liệu.

---

## Lỗi thường gặp

| Tình huống | Cách xử lý |
|---|---|
| Đăng nhập không được | Kiểm tra email/mật khẩu; liên hệ admin đặt lại. |
| Gửi tin Zalo thất bại | Khách chưa follow OA → hệ thống tự fallback Email; hoặc token hết hạn → admin cập nhật lại trong Cài đặt. |
| Voucher báo "hết lượt" | Tạo voucher mới hoặc tăng số lượt dùng trong trang Voucher. |
| Trang loading lâu | F5 lại; nếu vẫn chậm báo admin kiểm tra server. |
| Không thấy menu Cài đặt | Bạn không phải admin — chỉ admin mới truy cập được. |
| Trang Mã chụp báo "Chưa chạy migration" | Admin chạy `docs/schema_booth.sql` trên Supabase. |
| Đồng bộ mã chụp lỗi 401 | Sai/thiếu tài khoản, hoặc token hết hạn → mở "Tài khoản API" nhập lại rồi Đăng nhập & kiểm tra. |

---

*Mọi thắc mắc khác liên hệ quản lý hệ thống.*
