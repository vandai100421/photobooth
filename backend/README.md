# TAP Photobooth — Backend API

REST API backend cho hệ thống quản lý photobooth "TAP Photobooth".

## Tech stack

- Node.js 20+ / Express 4
- Supabase (PostgreSQL + Auth)
- Zod (validation)
- Cloudinary (image storage)
- JWT (authentication)

## Cấu trúc thư mục

```
backend/
├── src/
│   ├── config/          # env, supabase client, cloudinary
│   ├── middleware/      # auth, rbac, validate, errorHandler, notFound
│   ├── modules/         # module theo pattern routes → controller → service
│   │   └── auth/
│   ├── utils/           # response, logger, asyncHandler, AppError
│   ├── app.js           # express app
│   └── server.js        # entry point
├── package.json
└── .env.example
```

## Cài đặt

```bash
cd backend
npm install
cp .env.example .env
# chỉnh sửa giá trị trong .env
```

## Chạy

```bash
# development (nodemon auto-reload)
npm run dev

# production
npm start
```

## Scripts

| Script | Mô tả |
|---|---|
| `npm run dev` | Chạy bằng nodemon (auto-reload) |
| `npm start` | Chạy production |
| `npm run lint` | Kiểm tra ESLint |
| `npm test` | Chạy test Jest |

## API

- Base path: `/api/v1`
- Health check: `GET /health`
- Auth endpoints: `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`

### Response format

```json
{ "success": true, "data": { } }
{ "success": false, "error": "message" }
```

Paginated:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

### Auth

Gửi `Authorization: Bearer <token>` ở mọi request (trừ `/auth/login`).

Roles: `admin`, `manager`, `staff`.
