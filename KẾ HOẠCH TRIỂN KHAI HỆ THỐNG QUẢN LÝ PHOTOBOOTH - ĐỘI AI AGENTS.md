# KẾ HOẠCH TRIỂN KHAI HỆ THỐNG QUẢN LÝ PHOTOBOOTH
## Đội AI Agents Chuyên Nghiệp

> **Mục tiêu:** Xây dựng hệ thống web quản lý photobooth hoàn chỉnh (nhân viên, khách hàng, voucher, bài viết, tin nhắn tự động) với chi phí 0 đồng.
> **Tech Stack:** React + Supabase/Google Sheets + Zalo OA API + Gmail SMTP + Vercel
> **Timeline:** 12-16 tuần

---

## I. TỔ CHỨC ĐỘI AI AGENTS

### 1. Cấu trúc đội

```
                    ┌─────────────────────┐
                    │   PROJECT MANAGER   │
                    │   (Agent điều phối)  │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  AGENT BACKEND   │  │  AGENT FRONTEND  │  │  AGENT DEVOPS   │
│  (API + Logic)   │  │  (UI + UX)       │  │  (Deploy + CI/CD)│
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ AGENT DATABASE   │  │ AGENT AUTOMATION │  │  AGENT QA/TEST  │
│ (Schema + Migration)│  (Cron + Zalo API)│  │  (Test + Debug) │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 2. Phân vai từng Agent

| Agent | Vai trò | Trách nhiệm chính | Tech |
|-------|---------|-------------------|------|
| **PM Agent** | Điều phối | Lên kế hoạch, phân task, theo dõi tiến độ, báo cáo | - |
| **Backend Agent** | API + Logic | Xây dựng REST API, xử lý business logic, authentication | Node.js + Express/NestJS |
| **Frontend Agent** | UI + UX | Thiết kế giao diện dashboard, form, bảng dữ liệu | React + TailwindCSS |
| **Database Agent** | CSDL | Thiết kế schema, migration, tối ưu query | PostgreSQL / Supabase |
| **Automation Agent** | Tự động hóa | Cron job, Zalo OA API, Gmail SMTP, scheduler | Node.js + node-cron |
| **DevOps Agent** | Triển khai | Deploy, CI/CD, environment setup | Vercel + GitHub |
| **QA Agent** | Kiểm thử | Test API, test UI, test automation flow | Jest + Postman |

### 3. Nguyên tắc làm việc của đội

```
1. Tuần tự: Backend → Frontend → Automation → Deploy
2. Mỗi module: Database → API → UI → Test → Deploy
3. Commit code mỗi ngày, review trước khi merge
4. Mỗi agent có task rõ ràng, không chồng chéo
5. Giao tiếp qua API contract (backend định nghĩa API trước)
```

---

## II. KIẾN TRÚC HỆ THỐNG TỔNG THỂ

### 1. Sơ đồ kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Dashboard │  │ Quản lý  │  │ Quản lý  │  │ Quản lý   │    │
│  │ Báo cáo   │  │ Nhân viên│  │ Khách hàng│  │ Voucher   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐      │
│  │ Quản lý   │  │ Quản lý   │  │ Tin nhắn tự động     │      │
│  │ Bài viết  │  │ Lịch lễ  │  │ (Scheduler + Log)    │      │
│  └──────────┘  └──────────┘  └──────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│                  Deploy: Vercel (Free)                        │
│                  Domain: xxx.vercel.app                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                        │
│                  Deploy: Railway/Render (Free)                │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Auth    │  │ Employee│  │ Customer│  │ Voucher │        │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Post    │  │ Holiday │  │ Message │  │ Report  │        │
│  │ Module   │  │ Module   │  │ Module   │  │ Module   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  DATABASE     │  │  AUTOMATION  │  │  EXTERNAL    │
│  PostgreSQL   │  │  Cron Jobs   │  │  APIs        │
│  (Supabase)   │  │              │  │              │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ - employees   │  │ 8:00 AM:    │  │ Zalo OA API  │
│ - customers   │  │  - Check    │  │ (Free)       │
│ - vouchers    │  │    birthday │  │              │
│ - bookings    │  │  - Check    │  │ Gmail SMTP   │
│ - posts       │  │    holiday  │  │ (Free)       │
│ - holidays    │  │  - Send     │  │              │
│ - templates   │  │    messages │  │ Cloudinary   │
│ - logs        │  │  - Log      │  │ (Free tier)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 2. Stack công nghệ chi tiết

| Layer | Công nghệ | Chi phí | Lý do |
|-------|-----------|---------|-------|
| Frontend | React + TailwindCSS | 0đ | Nhanh, component phong phú |
| Backend | Node.js + Express | 0đ | Dễ code, nhiều thư viện |
| Database | Supabase (PostgreSQL) | 0đ (free tier) | 500MB, đủ cho photobooth |
| Hosting FE | Vercel | 0đ (free) | 100GB bandwidth/tháng |
| Hosting BE | Railway / Render | 0đ (free) | 500h/tháng |
| Image storage | Cloudinary | 0đ (free) | 300K operations/tháng |
| Gửi tin nhắn | Zalo OA API | 0đ (gói cơ bản) | 4 tin/khách/tháng |
| Gửi email | Gmail SMTP | 0đ | 500 email/ngày |
| Scheduler | node-cron | 0đ | Chạy trong backend |
| Auth | Supabase Auth | 0đ | Có sẵn, hỗ trợ JWT |
| QR Code | qrcode.js | 0đ | Sinh QR client-side |

---

## III. THIẾT KẾ DATABASE CHI TIẾT

### 1. Sơ đồ thực thể (ERD)

```
┌──────────────────┐       ┌──────────────────────┐
│    employees      │       │      customers        │
├──────────────────┤       ├──────────────────────┤
│ id (PK)          │       │ id (PK)              │
│ full_name        │       │ full_name            │
│ phone            │       │ phone (unique)       │
│ email            │       │ email                │
│ password_hash    │       │ birthday             │
│ role (admin/    │       │ gender               │
│   manager/staff)│       │ zalo_id              │
│ avatar_url       │       │ total_visits         │
│ is_active        │       │ total_spent          │
│ hire_date        │       │ status (active/      │
│ created_at       │       │   inactive/vip)      │
│ updated_at       │       │ registered_at        │
└────────┬─────────┘       │ last_visit_at        │
         │                 │ notes                │
         │                 │ created_at           │
         │                 │ updated_at           │
         │                 └──────────┬───────────┘
         │                            │
         │                            │
┌────────▼─────────┐       ┌──────────▼───────────┐
│    shifts         │       │     bookings          │
├──────────────────┤       ├──────────────────────┤
│ id (PK)          │       │ id (PK)              │
│ employee_id (FK) │──────→│ customer_id (FK)     │
│ date             │       │ employee_id (FK)     │
│ start_time       │       │ booking_date         │
│ end_time         │       │ package_name         │
│ check_in_time    │       │ amount               │
│ check_out_time   │       │ status (completed/   │
│ status (scheduled│       │   cancelled/no-show) │
│   /completed/    │       │ voucher_id (FK, null)│
│   absent)        │       │ photo_count          │
│ notes            │       │ notes                │
│ created_at       │       │ created_at           │
└──────────────────┘       └──────────┬───────────┘
                                      │
          ┌───────────────────────────┘
          │
┌─────────▼────────┐       ┌──────────────────────┐
│    vouchers      │       │  customer_vouchers   │
├──────────────────┤       ├──────────────────────┤
│ id (PK)          │       │ id (PK)              │
│ code (unique)    │       │ customer_id (FK)     │
│ name             │       │ voucher_id (FK)      │
│ type (birthday/  │       │ status (issued/used/ │
│  holiday/promo/  │       │   expired)           │
│  welcome)        │       │ issued_at            │
│ discount_type    │       │ used_at              │
│  (percent/fixed) │       │ expires_at           │
│ value            │       │ booking_id (FK, null)│
│ min_order        │       │ zalo_message_id      │
│ max_discount    │       │ created_at           │
│ total_quantity   │       │ updated_at           │
│ used_count       │       └──────────────────────┘
│ valid_from       │
│ valid_until      │       ┌──────────────────────┐
│ is_active        │       │    message_templates │
│ per_customer     │       ├──────────────────────┤
│ created_by (FK)  │       │ id (PK)              │
│ created_at       │       │ name                 │
│ updated_at       │       │ occasion (birthday/  │
└──────────────────┘       │   tet/giangsinh/     │
                           │   8_3/20_10/valentine│
                           │   /promo/custom)     │
┌──────────────────┐       │ channel (zalo/email) │
│     posts        │       │ subject              │
├──────────────────┤       │ body (template với   │
│ id (PK)          │       │   {{customer_name}}, │
│ title            │       │   {{voucher_code}})  │
│ slug             │       │ is_active            │
│ content          │       │ created_at           │
│ excerpt          │       │ updated_at           │
│ image_url        │       └──────────────────────┘
│ status (draft/   │
│   pending/       │       ┌──────────────────────┐
│   published)     │       │      holidays        │
│ scheduled_at     │       ├──────────────────────┤
│ published_at     │       │ id (PK)              │
│ author_id (FK)   │       │ name                 │
│ created_at       │       │ date (MM-DD, lặp lại)│
│ updated_at       │       │ is_recurring (bool)  │
└──────────────────┘       │ specific_year (null  │
                           │   nếu lặp hàng năm)  │
┌──────────────────┐       │ template_id (FK)     │
│   message_logs   │       │ is_active            │
├──────────────────┤       │ created_at           │
│ id (PK)          │       └──────────────────────┘
│ customer_id (FK) │
│ template_id (FK) │       ┌──────────────────────┐
│ voucher_id (FK,  │       │    settings          │
│   null)          │       ├──────────────────────┤
│ channel (zalo/   │       │ id (PK)              │
│   email/sms)     │       │ key (unique)         │
│ status (pending/ │       │ value                │
│   sent/failed/   │       │ description          │
│   delivered)     │       │ updated_at           │
│ content_sent     │       └──────────────────────┘
│ error_message    │
│ scheduled_at     │       VD: zalo_oa_id, gmail_address,
│ sent_at          │       gmail_app_password, shop_name,
│ created_at       │       cron_schedule, voucher_expiry_days
└──────────────────┘
```

### 2. Chi tiết các bảng quan trọng

#### Bảng `customers`
```sql
CREATE TABLE customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name   VARCHAR(255) NOT NULL,
    phone       VARCHAR(20) UNIQUE NOT NULL,
    email       VARCHAR(255),
    birthday    DATE,
    gender      VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    zalo_id     VARCHAR(100),
    total_visits    INTEGER DEFAULT 0,
    total_spent     DECIMAL(12,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'vip')),
    registered_at   TIMESTAMPTZ DEFAULT NOW(),
    last_visit_at   TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_birthday ON customers (birthday);
CREATE INDEX idx_customers_phone ON customers (phone);
CREATE INDEX idx_customers_status ON customers (status);
```

#### Bảng `vouchers`
```sql
CREATE TABLE vouchers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('birthday', 'holiday', 'promo', 'welcome')),
    discount_type   VARCHAR(10) NOT NULL
                    CHECK (discount_type IN ('percent', 'fixed')),
    value           DECIMAL(12,2) NOT NULL,
    min_order       DECIMAL(12,2) DEFAULT 0,
    max_discount    DECIMAL(12,2),
    total_quantity  INTEGER DEFAULT -1,
    used_count      INTEGER DEFAULT 0,
    valid_from      DATE NOT NULL,
    valid_until     DATE NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    per_customer    INTEGER DEFAULT 1,
    created_by      UUID REFERENCES employees(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### Bảng `message_logs`
```sql
CREATE TABLE message_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID REFERENCES customers(id),
    template_id     UUID REFERENCES message_templates(id),
    voucher_id      UUID REFERENCES vouchers(id),
    channel         VARCHAR(10) NOT NULL
                    CHECK (channel IN ('zalo', 'email', 'sms')),
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    content_sent    TEXT,
    error_message   TEXT,
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_logs_scheduled ON message_logs (scheduled_at, status);
CREATE INDEX idx_message_logs_customer ON message_logs (customer_id);
```

---

## IV. THIẾT KẾ API CHI TIẾT

### 1. Cấu trúc API tổng quan

```
BASE URL: /api/v1

Authentication:
  POST   /auth/login              → Đăng nhập
  POST   /auth/logout             → Đăng xuất
  GET    /auth/me                 → Thông tin user hiện tại
  POST   /auth/refresh            → Refresh token

Employees:
  GET    /employees               → Danh sách nhân viên
  POST   /employees               → Thêm nhân viên
  GET    /employees/:id           → Chi tiết nhân viên
  PUT    /employees/:id           → Cập nhật
  DELETE /employees/:id           → Xóa (soft delete)
  GET    /employees/:id/shifts    → Ca làm của nhân viên

Customers:
  GET    /customers               → Danh sách khách hàng
  POST   /customers               → Thêm khách hàng
  GET    /customers/:id           → Chi tiết khách hàng
  PUT    /customers/:id           → Cập nhật
  DELETE /customers/:id           → Xóa
  GET    /customers/:id/bookings  → Lịch sử chụp
  GET    /customers/:id/vouchers  → Voucher của khách
  GET    /customers/birthdays     → KH có sinh nhật hôm nay/tuần

Vouchers:
  GET    /vouchers                → Danh sách voucher
  POST   /vouchers                → Tạo voucher
  GET    /vouchers/:id            → Chi tiết voucher
  PUT    /vouchers/:id            → Cập nhật
  DELETE /vouchers/:id            → Xóa
  POST   /vouchers/:id/issue      → Phát voucher cho khách
  GET    /vouchers/:id/usage      → Lịch sử sử dụng

Bookings:
  GET    /bookings                → Danh sách booking
  POST   /bookings                → Tạo booking
  GET    /bookings/:id            → Chi tiết
  PUT    /bookings/:id            → Cập nhật
  DELETE /bookings/:id            → Hủy

Posts:
  GET    /posts                   → Danh sách bài viết
  POST   /posts                   → Tạo bài viết
  GET    /posts/:id               → Chi tiết
  PUT    /posts/:id               → Cập nhật
  DELETE /posts/:id               → Xóa
  POST   /posts/:id/publish       → Đăng ngay

Holidays:
  GET    /holidays                → Danh sách ngày lễ
  POST   /holidays                → Thêm ngày lễ
  PUT    /holidays/:id            → Cập nhật
  DELETE /holidays/:id            → Xóa

Message Templates:
  GET    /templates               → Danh sách template
  POST   /templates               → Tạo template
  PUT    /templates/:id           → Cập nhật
  DELETE /templates/:id           → Xóa

Messages (Automation):
  GET    /messages/logs           → Lịch sử gửi tin
  POST   /messages/send-now       → Gửi tin ngay (thủ công)
  GET    /messages/scheduled      → Tin đã lên lịch
  POST   /messages/schedule       → Lên lịch gửi
  GET    /messages/stats          → Thống kê gửi tin

Dashboard/Reports:
  GET    /dashboard/stats         → Thống kê tổng quan
  GET    /dashboard/revenue       → Doanh thu theo tháng
  GET    /dashboard/customers     → Thống kê khách hàng
  GET    /dashboard/vouchers      → Thống kê voucher

Settings:
  GET    /settings                → Cài đặt hệ thống
  PUT    /settings                → Cập nhật
  GET    /settings/zalo-qr        → Lấy QR code Zalo OA
```

### 2. Ví dụ API response

```json
// GET /api/v1/customers/birthdays?range=today
{
  "success": true,
  "data": {
    "date": "2024-10-15",
    "total": 3,
    "customers": [
      {
        "id": "uuid-1",
        "full_name": "Nguyễn Thị Linh",
        "phone": "0901234567",
        "birthday": "1998-10-15",
        "age": 26,
        "total_visits": 5,
        "zalo_id": "zalo_123",
        "voucher_assigned": false
      }
    ]
  }
}
```

---

## V. THIẾT KẾ FRONTEND (UI/UX)

### 1. Cấu trúc trang

```
┌──────────────────────────────────────────────────────────────┐
│  📸 LỌ LEM PHOTOBOOTH     [Tìm kiếm...]     🔔 👤 Admin     │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│ MENU   │                    CONTENT AREA                     │
│        │                                                     │
│ 📊 Dashboard                                                  │
│ 👥 Nhân viên  │  ┌──────────────────────────────────────┐   │
│ 🧑 Khách hàng │  │  Thống kê hôm nay                     │   │
│ 🎫 Voucher    │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│   │
│ 📅 Đặt lịch   │  │  │  47  │ │  12  │ │  8   │ │ 2.5M ││   │
│ 📝 Bài viết   │  │  │ Khách│ │ Chụp │ │ Voucher│ Doanh││   │
│ 🎉 Ngày lễ    │  │  │ hôm nay│ │ hôm nay│ hôm nay│ thu  ││   │
│ 💬 Tin nhắn   │  │  └──────┘ └──────┘ └──────┘ └──────┘│   │
│ 📊 Báo cáo    │  │                                        │   │
│ ⚙️ Cài đặt    │  │  Sinh nhật hôm nay                     │   │
│        │  │  ┌──────────────────────────────────┐    │   │
│        │  │  │ 👤 Nguyễn Thị Linh (26 tuổi)      │    │   │
│        │  │  │    SĐT: 0901xxx  | Chưa gửi voucher │    │   │
│        │  │  │    [Gửi tin nhắn] [Phát voucher]   │    │   │
│        │  │  └──────────────────────────────────┘    │   │
│        │  └──────────────────────────────────────┘   │
└────────┴─────────────────────────────────────────────────────┘
```

### 2. Danh sách trang (Pages)

| Trang | Route | Chức năng |
|-------|-------|-----------|
| Đăng nhập | /login | Form đăng nhập |
| Dashboard | / | Tổng quan, thống kê |
| Nhân viên | /employees | CRUD + ca làm |
| Khách hàng | /customers | CRUD + lịch sử |
| Voucher | /vouchers | CRUD + phát hành |
| Đặt lịch | /bookings | Tạo/sửa booking |
| Bài viết | /posts | CRUD + lên lịch |
| Ngày lễ | /holidays | CRUD ngày lễ |
| Tin nhắn | /messages | Template + log + gửi |
| Báo cáo | /reports | Doanh thu, khách, voucher |
| Cài đặt | /settings | Zalo OA, Gmail, QR |

### 3. Cấu trúc thư mục Frontend

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── Layout.jsx
│   ├── ui/
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Modal.jsx
│   │   ├── Table.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   └── Pagination.jsx
│   └── shared/
│       ├── StatCard.jsx
│       ├── CustomerCard.jsx
│       ├── VoucherCard.jsx
│       └── BirthdayReminder.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Employees.jsx
│   ├── Customers.jsx
│   ├── Vouchers.jsx
│   ├── Bookings.jsx
│   ├── Posts.jsx
│   ├── Holidays.jsx
│   ├── Messages.jsx
│   ├── Reports.jsx
│   └── Settings.jsx
├── hooks/
│   ├── useAuth.js
│   ├── useCustomers.js
│   ├── useVouchers.js
│   └── useApi.js
├── services/
│   ├── api.js
│   ├── authService.js
│   ├── customerService.js
│   ├── voucherService.js
│   └── messageService.js
├── utils/
│   ├── formatDate.js
│   ├── formatCurrency.js
│   └── constants.js
└── App.jsx
```

---

## VI. MODULE TIN NHẮN TỰ ĐỘNG — CHI TIẾT

### 1. Sơ đồ luồng tự động hóa

```
┌─────────────────────────────────────────────────────────────┐
│                   CRON JOB (Chạy mỗi ngày 8:00 AM)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  1. KIỂM TRA SINH NHẬT  │
              │  Query: customers có     │
              │  birthday = today        │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  2. KIỂM TRA NGÀY LỄ    │
              │  Query: holidays có     │
              │  date = today           │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  3. KIỂM TRA KHÁCH LÂU  │
              │  Query: last_visit_at   │
              │  < 30 ngày trước        │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  4. TẠO TIN NHẮN        │
              │  - Lấy template phù hợp │
              │  - Tạo voucher (nếu có) │
              │  - Thay thế biến:       │
              │    {{customer_name}}    │
              │    {{voucher_code}}     │
              │    {{shop_name}}        │
              │  - Lưu vào message_logs │
              │    (status = pending)   │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  5. GỬI TIN NHẮN        │
              │  - Gọi Zalo OA API     │
              │  - Nếu thất bại →       │
              │    Gửi Email (fallback) │
              │  - Cập nhật status      │
              │  - Ghi sent_at          │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  6. GHI LOG             │
              │  - Cập nhật message_logs│
              │  - Ghi error (nếu có)  │
              └────────────────────────┘
```

### 2. Danh sách template tin nhắn mẫu

#### Template sinh nhật (Zalo)
```
🎂 CHÚC MỪNG SINH NHẬT 🎂

Chào {{customer_name}},

TAP Photobooth chúc bạn một ngày sinh nhật thật ấm áp,
bình an và ngập tràn nụ cười! 🥰

Để ăn mừng sinh nhật của bạn, quán tặng bạn VOUCHER ĐẶC BIỆT:
- Mã: {{voucher_code}}
- Giảm: 50% chụp ảnh
- Hạn sử dụng: 7 ngày từ hôm nay

Hãy đến quán và lưu giữ những khoảnh khắc đẹp nhé! 📸

— TAP Photobooth
```

#### Template Tết Nguyên Đán (Zalo - Broadcast)
```
🧧 CHÚC MỪNG NĂM MỚI 🧧

Kính gửi {{customer_name}},

Năm mới {{year}} sắp đến, TAP Photobooth xin gửi lời chúc:
"An khang thịnh vượng - Vạn sự như ý"

🎁 Ưu đãi đặc biệt dịp Tết:
- Mã: {{voucher_code}}
- Giảm: 30% chụp ảnh Tết
- Áp dụng: 1-15 tháng Giêng

Chúc bạn và gia đình một năm mới rực rỡ! 🎉

— TAP Photobooth
```

#### Template 8/3 (Zalo - Broadcast)
```
💐 CHÚC MỪNG NGÀY QUỐC TẾ PHỤ NỮ 8/3 💐

Chào {{customer_name}},

Nhân ngày 8/3, TAP Photobooth xin gửi lời chúc:
"Phụ nữ là để yêu thương" 💕

🎁 Tặng bạn voucher giảm 40% chụp ảnh hôm nay:
- Mã: {{voucher_code}}
- Chỉ áp dụng: 8/3

Hãy đến chụp ảnh thật đẹp và rạng rỡ nhé! ✨

— TAP Photobooth
```

#### Template nhắc khách quay lại (Zalo)
```
📸 CHÚNG TÔI NHỚ BẠN!

Chào {{customer_name}},

Đã một thời gian kể từ lần chụp ảnh cuối cùng của bạn.
Chúng tôi rất mong được gặp lại bạn! 😊

🎁 Tặng bạn voucher giảm 20% cho lần chụp tiếp theo:
- Mã: {{voucher_code}}
- Hạn sử dụng: 14 ngày

Hẹn gặp lại bạn tại TAP Photobooth! ❤️

— TAP Photobooth
```

### 3. Danh sách ngày lễ Việt Nam (mặc định)

| Ngày | Tên | Loại |
|------|-----|------|
| 01-01 | Tết Dương Lịch | National |
| 01-XX ~ 02-XX (Âm lịch) | Tết Nguyên Đán | Lunar (cần cập nhật theo năm) |
| 02-03 | Thành lập Đảng | National |
| 03-08 | Quốc tế Phụ nữ | National |
| 04-30 | Giải phóng Miền Nam | National |
| 05-01 | Quốc tế Lao động | National |
| 06-01 | Quốc tế Thiếu nhi | National |
| 09-02 | Quốc khánh | National |
| 10-20 | Phụ nữ Việt Nam | National |
| 10-31 | Halloween | International |
| 11-20 | Nhà giáo Việt Nam | National |
| 12-22 | Thành lập Quân đội | National |
| 12-24 ~ 12-25 | Giáng Sinh | International |
| 02-14 | Valentine | International |

---

## VII. LỘ TRÌNH TRIỂN KHAI CHI TIẾT

### Phase 0: Chuẩn bị (Tuần 1)

| Task | Agent phụ trách | Output |
|------|----------------|--------|
| Tạo GitHub repo | DevOps Agent | Repo: photobooth-management |
| Setup project structure | DevOps Agent | Monorepo: /frontend, /backend |
| Tạo Supabase project | Database Agent | Supabase URL + API keys |
| Tạo Zalo OA | PM Agent | OA ID + QR code |
| Tạo Gmail app password | DevOps Agent | Gmail credentials |
| Tạo Cloudinary account | DevOps Agent | Cloudinary credentials |
| Viết API contract | Backend Agent | OpenAPI/Swagger spec |
| Thiết kế database schema | Database Agent | SQL migration files |

### Phase 1: Foundation (Tuần 2-4)

#### Tuần 2: Database + Auth

| Task | Agent | Chi tiết |
|------|-------|----------|
| Tạo tất cả bảng DB | Database Agent | Chạy SQL migration trên Supabase |
| Setup Supabase Auth | Database Agent | Email/password login |
| Tạo API đăng nhập | Backend Agent | POST /auth/login, /auth/me |
| Tạo API refresh token | Backend Agent | POST /auth/refresh |
| Test auth flow | QA Agent | Postman collection |
| Setup Frontend base | Frontend Agent | React + TailwindCSS + Router |
| Tạo trang Login | Frontend Agent | Form + validation |
| Test đăng nhập UI | QA Agent | Login thành công |

**Deliverable Tuần 2:**
```
✅ Database đã tạo trên Supabase
✅ Đăng nhập/đăng xuất hoạt động
✅ JWT token working
✅ Trang login UI hoàn thành
```

#### Tuần 3: Module Nhân viên

| Task | Agent | Chi tiết |
|------|-------|----------|
| API CRUD nhân viên | Backend Agent | GET/POST/PUT/DELETE /employees |
| API ca làm việc | Backend Agent | GET/POST /employees/:id/shifts |
| Trang danh sách NV | Frontend Agent | Table + pagination + search |
| Form thêm/sửa NV | Frontend Agent | Modal form + validation |
| Trang ca làm | Frontend Agent | Calendar view + check-in/out |
| Test API nhân viên | QA Agent | Postman tests |
| Test UI nhân viên | QA Agent | CRUD flow |

**Deliverable Tuần 3:**
```
✅ Quản lý nhân viên: thêm, sửa, xóa, tìm kiếm
✅ Phân quyền: admin, manager, staff
✅ Ca làm việc: tạo ca, check-in/out
```

#### Tuần 4: Module Khách hàng + Booking

| Task | Agent | Chi tiết |
|------|-------|----------|
| API CRUD khách hàng | Backend Agent | GET/POST/PUT/DELETE /customers |
| API booking | Backend Agent | GET/POST/PUT /bookings |
| API sinh nhật hôm nay | Backend Agent | GET /customers/birthdays |
| Trang danh sách KH | Frontend Agent | Table + filter + search |
| Form thêm/sửa KH | Frontend Agent | Modal + phone validation |
| Trang chi tiết KH | Frontend Agent | Hồ sơ + lịch sử chụp |
| Trang booking | Frontend Agent | Tạo booking + chọn KH + NV |
| Test API khách hàng | QA Agent | Edge cases |
| Test UI khách hàng | QA Agent | CRUD + search |

**Deliverable Tuần 4:**
```
✅ Quản lý khách hàng hoàn chỉnh
✅ Tạo booking khi khách chụp ảnh
✅ Tự động tăng total_visits, total_spent
✅ Dashboard hiển thị sinh nhật hôm nay
```

### Phase 2: Voucher + Marketing (Tuần 5-7)

#### Tuần 5: Module Voucher

| Task | Agent | Chi tiết |
|------|-------|----------|
| API CRUD voucher | Backend Agent | GET/POST/PUT/DELETE /vouchers |
| API phát voucher | Backend Agent | POST /vouchers/:id/issue |
| API kiểm tra voucher | Backend Agent | GET /vouchers/check?code=XXX |
| Trang danh sách voucher | Frontend Agent | Table + filter by type |
| Form tạo voucher | Frontend Agent | Type, value, quantity, expiry |
| Trang phát voucher | Frontend Agent | Chọn KH + chọn voucher |
| Test voucher logic | QA Agent | Edge cases: hết lượt, hết hạn |

**Deliverable Tuần 5:**
```
✅ Tạo voucher: birthday, holiday, promo, welcome
✅ Phát voucher cho khách cụ thể
✅ Kiểm tra tính hợp lệ khi sử dụng
✅ Tự động hết hạn
```

#### Tuần 6: Module Bài viết + Ngày lễ

| Task | Agent | Chi tiết |
|------|-------|----------|
| API CRUD bài viết | Backend Agent | GET/POST/PUT/DELETE /posts |
| API upload ảnh | Backend Agent | POST /upload (Cloudinary) |
| API CRUD ngày lễ | Backend Agent | GET/POST/PUT/DELETE /holidays |
| Trang quản lý bài viết | Frontend Agent | List + editor + image upload |
| Trang ngày lễ | Frontend Agent | Calendar + CRUD |
| Test upload ảnh | QA Agent | Cloudinary integration |
| Test ngày lễ | QA Agent | Recurring logic |

**Deliverable Tuần 6:**
```
✅ Tạo bài viết với hình ảnh
✅ Lên lịch đăng bài
✅ Quản lý ngày lễ (recurring + specific)
```

#### Tuần 7: Module Tin nhắn — Phần 1 (Template + Log)

| Task | Agent | Chi tiết |
|------|-------|----------|
| API CRUD template | Backend Agent | GET/POST/PUT/DELETE /templates |
| API message logs | Backend Agent | GET /messages/logs |
| API gửi thủ công | Backend Agent | POST /messages/send-now |
| Trang template | Frontend Agent | Editor + preview |
| Trang log tin nhắn | Frontend Agent | Table + filter by status |
| Form gửi thủ công | Frontend Agent | Chọn KH + template + gửi |

**Deliverable Tuần 7:**
```
✅ Tạo template với biến {{customer_name}}, {{voucher_code}}
✅ Gửi tin thủ công cho khách
✅ Xem log tin nhắn đã gửi
```

### Phase 3: Automation (Tuần 8-10)

#### Tuần 8: Tích hợp Zalo OA API

| Task | Agent | Chi tiết |
|------|-------|----------|
| Đăng ký Zalo OA | PM Agent | Xác minh doanh nghiệp |
| Lấy OA ID + QR | PM Agent | Lưu vào settings |
| Code Zalo API service | Automation Agent | Gửi tin qua Zalo API |
| Code Zalo webhook | Automation Agent | Nhận follow event |
| Test gửi tin Zalo | QA Agent | Gửi test cho SĐT thật |
| Trang cài đặt Zalo | Frontend Agent | Nhập OA ID, hiển thị QR |

**Deliverable Tuần 8:**
```
✅ Zalo OA đã tạo, có QR code
✅ Gửi tin nhắn qua Zalo API thành công
✅ Webhook nhận follow event
```

#### Tuần 9: Tích hợp Gmail SMTP + Cron Job

| Task | Agent | Chi tiết |
|------|-------|----------|
| Code Gmail SMTP service | Automation Agent | nodemailer + Gmail app password |
| Code cron scheduler | Automation Agent | node-cron, chạy 8:00 AM daily |
| Logic sinh nhật | Automation Agent | Query + tạo voucher + gửi tin |
| Logic ngày lễ | Automation Agent | Query + broadcast + voucher |
| Logic nhắc khách l