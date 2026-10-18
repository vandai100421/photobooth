# SePay Transaction Notifier (Local)

Script này lắng nghe giao dịch tiền vào SePay và thông báo ra loa máy tính.

## Cài đặt
```bash
cd sepay-notifier
npm install
cp config.example.json config.json
```

## Lấy thông tin cấu hình
1. Mở https://my.sepay.vn/transactions → lấy `bank_account_id` từ URL
2. F12 → Application → Cookies → copy toàn bộ Cookie (format key=value; key2=value2;)
3. Trong Network tab, mở request `ajax_transactions_v3` → form data có `csrf_main` → copy giá trị

## Chỉnh sửa config.json
- bank_account_id: ba_...
- cookie: "..." 
- csrf_main: "..."
- interval_sec: 10 (giây)

## Chạy thử (kiểm tra tên field)
```bash
node listener.js --debug
```
Lệnh này in ra response thô để bạn đối chiếu tên field (`amount_in`, `transaction_content`...).

## Chạy
```bash
node listener.js
```

## Lưu ý
- Chạy trên máy tính có loa (máy POS/desktop)
- Cần giữ session đăng nhập hợp lệ. Nếu Cookie hết hạn, cập nhật lại
- Script chỉ thông báo giao dịch "in" (tiền vào)
