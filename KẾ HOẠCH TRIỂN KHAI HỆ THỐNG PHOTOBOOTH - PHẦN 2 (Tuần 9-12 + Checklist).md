# KẾ HOẠCH TRIỂN KHAI — PHẦN 2

## (Tiếp nối file KẾ HOẠCH TRIỂN KHAI HỆ THỐNG QUẢN LÝ PHOTOBOOTH)

* * *

### Tuần 9 (tiếp): Tích hợp Gmail SMTP + Cron Job

| Task | Agent | Chi tiết |
| --- | --- | --- |
| Logic nhắc khách lâu không quay lại | Automation Agent | Query last_visit_at < 30 ngày + gửi voucher |
| Test cron job | QA Agent | Chạy test với data giả |
| Test Gmail SMTP | QA Agent | Gửi email test |
| Test fallback Zalo → Email | QA Agent | Zalo fail → Email tự động gửi |

**Deliverable Tuần 9:**

```
✅ Cron job chạy tự động mỗi ngày 8:00 AM
✅ Tự động gửi tin sinh nhật qua Zalo OA
✅ Tự động gửi tin chúc lễ/tết
✅ Tự động nhắc khách lâu không quay lại
✅ Fallback sang Email khi Zalo thất bại
```

#### Tuần 10: Dashboard + Báo cáo

| Task | Agent | Chi tiết |
| --- | --- | --- |
| API thống kê dashboard | Backend Agent | GET /dashboard/stats |
| API doanh thu theo tháng | Backend Agent | GET /dashboard/revenue |
| API thống kê voucher | Backend Agent | GET /dashboard/vouchers |
| Trang Dashboard | Frontend Agent | StatCard + biểu đồ |
| Trang Báo cáo | Frontend Agent | Biểu đồ doanh thu, khách, voucher |
| Test dashboard | QA Agent | Data chính xác |

**Deliverable Tuần 10:**

```
✅ Dashboard hiển thị: số khách, số chụp, voucher, doanh thu hôm nay
✅ Biểu đồ doanh thu theo tháng
✅ Danh sách sinh nhật hôm nay + nút gửi tin nhanh
✅ Biểu đồ thống kê voucher đã dùng/còn
```

* * *

### Phase 4: Hoàn thiện & Deploy (Tuần 11-12)

#### Tuần 11: Settings + QR Code + Polish UI

| Task | Agent | Chi tiết |
| --- | --- | --- |
| API cài đặt hệ thống | Backend Agent | GET/PUT /settings |
| Trang cài đặt | Frontend Agent | Form cấu hình Zalo, Gmail, tên quán |
| Tạo QR code Zalo OA | Frontend Agent | Hiển thị QR để in tại quán |
| Responsive UI | Frontend Agent | Mobile + tablet friendly |
| Loading states | Frontend Agent | Skeleton, spinner |
| Error handling | Frontend Agent | Toast notifications |
| Test UI/UX | QA Agent | Tất cả flow |

**Deliverable Tuần 11:**

```
✅ Trang cài đặt: cấu hình Zalo OA ID, Gmail, tên quán
✅ Hiển thị QR code Zalo OA để in tại quán
✅ UI responsive, hoạt động trên mobile
✅ Loading states + error handling
```

#### Tuần 12: Deploy + Go-Live

| Task | Agent | Chi tiết |
| --- | --- | --- |
| Deploy Frontend | DevOps Agent | Vercel: xxx.vercel.app |
| Deploy Backend | DevOps Agent | Railway/Render: api.xxx.com |
| Setup environment variables | DevOps Agent | Production env |
| Setup Supabase production | Database Agent | Production DB + RLS policies |
| Test production | QA Agent | Full test trên production |
| Setup monitoring | DevOps Agent | Error logging (Sentry free) |
| Viết tài liệu HDSD | PM Agent | User manual cho nhân viên |
| Training nhân viên | PM Agent | Hướng dẫn dùng hệ thống |
| Go-live | All Agents | Hệ thống chính thức hoạt động |

**Deliverable Tuần 12:**

```
✅ Hệ thống deploy production
✅ Tất cả API hoạt động
✅ Cron job chạy tự động
✅ Nhân viên biết sử dụng
✅ Khách bắt đầu quét QR follow Zalo OA
```

* * *

## VIII. BẢNG TỔNG HỢP DELIVERABLE THEO TUẦN

| Tuần | Module | Deliverable chính |
| --- | --- | --- |
| 1 | Chuẩn bị | Repo, Supabase, Zalo OA, credentials |
| 2 | Database + Auth | DB schema, đăng nhập/đăng xuất |
| 3 | Nhân viên | CRUD nhân viên, ca làm, phân quyền |
| 4 | Khách hàng + Booking | CRUD khách, booking, sinh nhật hôm nay |
| 5 | Voucher | CRUD voucher, phát voucher, kiểm tra |
| 6 | Bài viết + Ngày lễ | CRUD bài viết, upload ảnh, ngày lễ |
| 7 | Tin nhắn (Phần 1) | Template, log, gửi thủ công |
| 8 | Zalo OA API | Gửi tin Zalo, webhook follow |
| 9 | Gmail + Cron | Cron job, tự động gửi sinh nhật/lễ |
| 10 | Dashboard + Báo cáo | Thống kê, biểu đồ doanh thu |
| 11 | Settings + UI Polish | Cài đặt, QR code, responsive |
| 12 | Deploy + Go-Live | Production, training, go-live |

* * *

## IX. RỦI RO & GIẢI PHÁP

| Rủi ro | Khả năng | Tác động | Giải pháp |
| --- | --- | --- | --- |
| Zalo OA duyệt chậm | Cao | Chậm 1-2 tuần | Đăng ký ngay tuần 1, dùng Email tạm |
| Supabase free hết limit | Thấp | DB chậm | Giám sát, nâng cấp gói trả phí (~$25/tháng) |
| Railway/Render sleep | Trung bình | API không phản hồi | Dùng cron-job.org ping mỗi 5 phút |
| Gmail SMTP bị limit | Trung bình | Không gửi được email | Giới hạn 400 email/ngày, dùng nhiều Gmail |
| Khách không follow OA | Cao | Ít dữ liệu KH | Tặng voucher hấp dẫn, nhân viên chủ động nhắc |
| Cron job không chạy | Thấp | Tin nhắn trễ | Monitoring + cảnh báo qua email |

* * *

## X. BƯỚC ĐẦU TIÊN CẦN LÀM NGAY

### Checklist khởi động (Tuần 1):

- [ ] [ ] 

**1. Tạo GitHub repository**

*   Tên: `photobooth-management`
    
*   Structure: `/frontend`, `/backend`, `/docs`
    

- [ ] [ ] 

**2. Tạo Supabase project**

*   Vào: [https://supabase.com](https://supabase.com)
    
*   Tạo project mới (free tier)
    
*   Lưu: Project URL, API Key (anon + service_role)
    

- [ ] [ ] 

**3. Đăng ký Zalo Official Account**

*   Vào: [https://oa.zalo.me](https://oa.zalo.me)
    
*   Đăng ký bằng mã số thuế doanh nghiệp
    
*   Chờ duyệt (1-3 ngày)
    
*   Lấy: OA ID, QR Code
    

- [ ] [ ] 

**4. Tạo Gmail App Password**

*   Dùng tài khoản Gmail của quán
    
*   Bật 2-Step Verification
    
*   Tạo App Password (16 ký tự)
    
*   Lưu lại để dùng cho nodemailer
    

- [ ] [ ] 

**5. Tạo Cloudinary account**

*   Vào: [https://cloudinary.com](https://cloudinary.com)
    
*   Đăng ký (free tier)
    
*   Lưu: Cloud Name, API Key, API Secret
    

- [ ] [ ] 

**6. Tạo Vercel account**

*   Vào: [https://vercel.com](https://vercel.com)
    
*   Đăng ký bằng GitHub
    
*   Sẵn sàng deploy frontend
    

- [ ] [ ] 

**7. Tạo Railway/Render account**

*   Vào: [https://railway.app](https://railway.app) hoặc [https://render.com](https://render.com)
    
*   Đăng ký bằng GitHub
    
*   Sẵn sàng deploy backend
    

- [ ] [ ] 

**8. Viết database schema SQL**

*   Dựa trên ERD ở phần III
    
*   Chạy trên Supabase SQL Editor
    
*   Tạo tất cả bảng + index + relationships
    

* * *

## XI. TỔNG KẾT

### Tổng quan hệ thống:

```
┌──────────────────────────────────────────────┐
│            HỆ THỐNG QUẢN LÝ PHOTOBOOTH        │
├──────────────────────────────────────────────┤
│                                              │
│  📊 Dashboard (thống kê, báo cáo)            │
│  👥 Nhân viên (CRUD, ca làm, phân quyền)      │
│  🧑 Khách hàng (CRUD, lịch sử, sinh nhật)     │
│  🎫 Voucher (CRUD, phát hành, kiểm tra)       │
│  📅 Booking (tạo, cập nhật, hủy)             │
│  📝 Bài viết (CRUD, lên lịch, upload ảnh)     │
│  🎉 Ngày lễ (CRUD, recurring)                │
│  💬 Tin nhắn (template, log, tự động)         │
│  ⚙️ Cài đặt (Zalo, Gmail, QR code)           │
│                                              │
├──────────────────────────────────────────────┤
│  Chi phí: 0 VNĐ/tháng                        │
│  Tech: React + Node.js + Supabase + Vercel   │
│  Tự động: Cron job 8:00 AM hàng ngày          │
│  Kênh: Zalo OA (free) + Gmail SMTP (free)    │
└──────────────────────────────────────────────┘
```

### Kết quả mong đợi sau 12 tuần:

1.  ✅ Hệ thống web quản lý photobooth hoàn chỉnh
    
2.  ✅ Quản lý nhân viên, khách hàng, voucher, bài viết
    
3.  ✅ Tự động gửi tin nhắn sinh nhật, lễ/tết qua Zalo
    
4.  ✅ Tự động gửi email dự phòng
    
5.  ✅ Dashboard báo cáo doanh thu, khách hàng
    
6.  ✅ Chi phí vận hành: **0 đồng/tháng**
    
7.  ✅ Khách quét QR follow → nằm trong hệ thống → nhận tin tự động
    

### Lưu ý quan trọng:

*   **Zalo OA** cần đăng ký ngay tuần đầu tiên vì thời gian duyệt
    
*   **4 tin/khách/tháng** là giới hạn gói miễn phí → cần chiến lược nội dung
    
*   **Supabase free tier** 500MB đủ cho vài nghìn khách
    
*   **Railway/Render free** có thể sleep → cần ping định kỳ
    
*   Khi vượt giới hạn free → chi phí nâng cấp rất rẻ (~200k-500k/tháng)
    

* * *

> **File này là kế hoạch tổng thể. Mỗi tuần sẽ có task chi tiết hơn cho từng Agent.**  
> **Bắt đầu ngay: Checklist Tuần 1 (Phần X).**