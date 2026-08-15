# DEVELOPMENT_RULES — TAP Photobooth Management

## 1. Nguyên tắc làm việc của đội agent

### Thứ tự triển khai
```
1. Tuần tự theo phase: Database → Backend API → Frontend UI → Automation → Deploy
2. Mỗi module: DB schema → API → UI → Test → (merge)
3. Commit code mỗi khi hoàn thành 1 task, không gộp quá nhiều thay đổi
4. Mỗi agent có task rõ ràng, không chồng chéo
5. Backend định nghĩa API contract TRƯỚC khi Frontend bắt đầu
```

### Phân quyền agent
| Agent | Được làm | Không được làm |
|---|---|---|
| `database` | Tạo migration SQL, RLS, trigger, index | Sửa code backend/frontend |
| `backend` | API routes, controller, service, middleware | Sửa SQL schema, sửa UI |
| `frontend` | React components, pages, services | Sửa backend API logic |
| `automation` | cron jobs, Zalo/Gmail service, template render | Sửa schema DB |
| `devops` | deploy config, env, CI/CD, monitoring | Sửa business logic |
| `qa` | Viết test, chạy test, báo cáo bug | Fix code (chỉ report) |
| `arch` | Review API contract, data model | Không viết code production |

## 2. Quy trình mỗi module

```
Step 1: Database Agent → tạo/tối ưu bảng + index
Step 2: Backend Agent → viết API (routes → controller → service)
Step 3: QA Agent → test API bằng Postman/Jest
Step 4: Frontend Agent → viết UI gọi API
Step 5: QA Agent → test UI flow
Step 6: Lead → review + merge
```

## 3. Quy tắc commit

### Trước khi commit
- Chạy `npm run lint` (backend + frontend)
- Chạy `npm test` (nếu có test)
- Không commit file `.env`, `node_modules/`, `dist/`

### Commit message format
```
<type>(<scope>): <subject>

types: feat|fix|docs|style|refactor|test|chore
scope: auth|employees|customers|vouchers|bookings|posts|holidays|templates|messages|dashboard|settings|upload|automation|devops
```

Ví dụ:
- `feat(customers): thêm API CRUD khách hàng`
- `fix(auth): sửa lỗi refresh token`
- `docs(api): cập nhật OpenAPI spec`

## 4. Quy tắc code

### Bắt buộc
- Dùng 2 spaces indent.
- Single quote cho JS, double quote cho JSX.
- Semicolon cuối câu.
- Trailing comma.
- Max 100 ký tự / dòng.
- Không comment code chết.
- Không hardcode secret/credential trong code.

### Tên file
- React component: `PascalCase.jsx` (VD: `CustomerCard.jsx`)
- JS logic: `camelCase.js` (VD: `customerService.js`)
- Module backend: `kebab-case` cho file (VD: `auth.routes.js`)

### Tên biến/hàm
- camelCase cho biến/hàm.
- PascalCase cho React component / class.
- UPPER_SNAKE_CASE cho constant.

## 5. Quy tắc API

### Response format
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "message" }

// Paginated
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }
```

### HTTP status
- 200: OK (GET, PUT success)
- 201: Created (POST success)
- 204: No Content (DELETE success)
- 400: Bad Request (validate fail)
- 401: Unauthorized (không có token)
- 403: Forbidden (sai role)
- 404: Not Found
- 500: Internal Server Error

### Pagination params
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `search` (tìm kiếm)
- `sort` (VD: `created_at:desc`)

## 6. Quy tắc database

- Mọi bảng có: `id` (UUID), `created_at`, `updated_at`.
- FK dạng `<table_singular>_id`.
- Index trên FK + cột hay query.
- Soft delete bằng `deleted_at` (nếu cần).
- Không xoá cứng dữ liệu khách hàng/booking.
- Enum dùng `CHECK (col IN (...))`.

## 7. Quy tắc testing

### Backend
- Test service layer (Supertest + Jest).
- Mock Supabase client trong unit test.
- Coverage tối thiểu 60% service layer.

### Frontend
- Test component logic (Vitest + Testing Library).
- Test form validation.
- Test flow: login → CRUD → logout.

### Automation
- Test cron job với data giả.
- Test fallback Zalo → Email.
- Test template rendering.

## 8. Quy tắc security

- Không log password, token, secret.
- Password hash bằng bcrypt (nếu không dùng Supabase Auth).
- JWT secret tối thiểu 32 ký tự.
- CORS whitelist chỉ frontend domain.
- Rate limit: 100 req/phút/IP.
- Validate mọi input bằng zod.
- RLS policies trên mọi bảng.

## 9. Quy tắc performance

- Pagination bắt buộc cho list API.
- Index trên cột hay query.
- Lazy load React page.
- Cache data tĩnh (settings, holidays) ở frontend.
- Giới hạn 100 item/request.

## 10. Quy tắc deployment

- `.env.example` liệt kê tất cả env vars.
- Không commit `.env`.
- Deploy backend trước, frontend sau.
- Test production sau deploy.
- Monitoring lỗi bằng Sentry.
