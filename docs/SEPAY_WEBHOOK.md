# SePay Webhook → Thông báo loa tại quầy

Tích hợp SePay webhook để khi có khách chuyển khoản **tiền vào**, hệ thống tự
động phát tiếng bíp + đọc số tiền ra loa máy tính đang mở tab TAP Photobooth.

## Kiến trúc luồng

```
Khách chuyển khoản
        │
        ▼
   SePay (phát hiện biến động số dư)
        │  POST webhook (HTTPS + API Key)
        ▼
Backend PTB  /api/v1/webhooks/sepay
        │  verify API Key → upsert bank_transactions
        ▼
   Supabase  bảng bank_transactions
        │  frontend poll mỗi 5s
        ▼
Frontend (tab đang mở)  /api/v1/bank-transactions?after_id=...
        │
        ▼
   🔔 Bíp + TTS đọc số tiền ("Nhận 200.000 đồng. Nội dung: ...")
```

Webhook miễn phí trên mọi gói SePay (kể cả gói FREE 0đ, giới hạn 50 GD/tháng).

---

## Bước 1 — Chạy migration database

Mở **Supabase → SQL Editor**, dán và chạy file:

```
docs/schema_bank_transactions.sql
```

File này tạo bảng `bank_transactions` (idempotent, chạy lại an toàn).

---

## Bước 2 — Đặt biến môi trường backend

Thêm vào `.env` (local) và Environment Variables trên Vercel (production):

```
SEPAY_WEBHOOK_API_KEY=<chuỗi bí mật bạn tự đặt>
```

- Đây là **API Key** bạn sẽ nhập khi tạo webhook bên SePay.
- Nếu để trống, endpoint chấp nhận mọi request (chỉ dùng khi test local).

---

## Bước 3 — Tạo webhook trên SePay

1. Đăng nhập [my.sepay.vn](https://my.sepay.vn) → menu **Tích hợp → Webhooks**.
2. Bấm **Thêm Webhook**, điền:

   | Trường | Giá trị |
   |---|---|
   | Tên | `TAP Photobooth - báo tiền vào` |
   | Gọi đến URL | `https://ptb-api-navy.vercel.app/api/v1/webhooks/sepay` |
   | Loại sự kiện | **Tiền vào** (hoặc Cả hai) |
   | Tài khoản ngân hàng | chọn TK nhận thanh toán |
   | Kiểu chứng thực | **API Key** → dán giá trị `SEPAY_WEBHOOK_API_KEY` |
   | Tự động gửi lại | **Bật** (retry khi server lỗi) |

3. Bấm **Gửi thử** để SePay bắn payload mẫu → kiểm tra nhận `HTTP 200`.

> URL local khi test: dùng tunnel (ngrok/cloudflared) trỏ về
> `http://localhost:5000/api/v1/webhooks/sepay`.

---

## Bước 4 — Kiểm tra

1. Chuyển khoản thử một số tiền nhỏ vào tài khoản đã liên kết.
2. Trong vòng vài giây:
   - Backend log: `webhooks sepay stored sepay_id=... type=in amount=...`
   - Tab web đang mở: phát **bíp + đọc số tiền** và hiện toast xanh góc phải.
3. Nút **chuông** ở góc dưới phải màn hình để bật/tắt thông báo (lưu theo trình duyệt).

### Lưu ý trình duyệt
- Trình duyệt chỉ cho phát âm thanh sau khi người dùng đã tương tác với trang.
  Đăng nhập + bấm nút chuông một lần là đủ để "mở khóa" audio.
- Tab ở chế độ nền (background) có thể bị giới hạn tần suất; khi quay lại tab,
  hệ thống tự poll ngay và thông báo các giao dịch đã lỡ.

---

## Payload SePay gửi (tham khảo)

```json
{
  "id": 92704,
  "gateway": "Vietcombank",
  "transactionDate": "2024-07-25 14:02:37",
  "accountNumber": "0123499999",
  "code": null,
  "content": "TAP PHOTO 200k",
  "transferType": "in",
  "transferAmount": 200000,
  "accumulated": 19077000,
  "subAccount": null,
  "referenceCode": "MBVCB.3278907687",
  "description": ""
}
```

- `id` là ID giao dịch phía SePay → backend dùng để **chống ghi trùng** khi retry.
- Chỉ giao dịch `transferType = "in"` được thông báo ra loa.

---

## API liên quan

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/webhooks/sepay` | API Key (SePay) | Nhận webhook |
| GET | `/api/v1/bank-transactions` | JWT | Danh sách giao dịch (lọc `after_id`, `transfer_type`, `limit`) |
| GET | `/api/v1/bank-transactions/latest` | JWT | Giao dịch mới nhất (mốc khởi tạo cho poller) |

---

## Xử lý sự cố

| Vấn đề | Nguyên nhân / cách xử lý |
|---|---|
| SePay báo lỗi webhook | URL sai, backend chưa deploy, hoặc API Key không khớp |
| Backend trả 401 | Kiểu chứng thực phải là **API Key** và khớp `SEPAY_WEBHOOK_API_KEY` |
| Bảng chưa có | Chưa chạy `docs/schema_bank_transactions.sql` |
| Không nghe thấy tiếng | Tab chưa tương tác (bấm nút chuông), hoặc loa máy tính tắt |
| Giao dịch trùng | Không xảy ra — `sepay_id` UNIQUE chặn ghi trùng |
