# CODING STANDARDS — TAP Photobooth Management

## 1. Quy tắc chung
- Indent: 2 spaces.
- Quote: single quote `'`, JSX double quote `"`.
- Semicolon: luôn dùng.
- Trailing comma: có.
- Max line length: 100 ký tự.
- File naming: `camelCase` cho JS, `PascalCase` cho React component files, `kebab-case` cho URL/route.
- Không comment code chết. Không comment dịch code — chỉ comment lý do business.

## 2. Backend (Node.js + Express)

### Cấu trúc module
Mỗi module có 4 file:
- `*.routes.js` — định nghĩa route, gắn middleware auth/rbac/validate
- `*.controller.js` — nhận request, gọi service, trả response (không chứa business logic)
- `*.service.js` — business logic, query Supabase
- `*.schema.js` — zod schema cho validate input/output

### Ví dụ pattern
```js
// employees.routes.js
const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const { rbac } = require('../../middleware/rbac');
const { validate } = require('../../middleware/validate');
const ctrl = require('./employees.controller');
const schema = require('./employees.schema');

router.get('/', auth, ctrl.list);
router.post('/', auth, rbac('admin'), validate(schema.create), ctrl.create);
router.get('/:id', auth, ctrl.detail);
router.put('/:id', auth, rbac('admin'), validate(schema.update), ctrl.update);
router.delete('/:id', auth, rbac('admin'), ctrl.remove);

module.exports = router;
```

### Response helper
```js
// utils/response.js
const success = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

const error = (res, message, status = 400) =>
  res.status(status).json({ success: false, error: message });

const paginated = (res, data, pagination) =>
  res.json({ success: true, data, pagination });

module.exports = { success, error, paginated };
```

### Error handling
- Dùng `asyncHandler` wrapper cho mọi controller.
- Centralized `errorHandler` ở cuối pipeline.
- Error class tuỳ chỉnh: `AppError(message, statusCode)`.
- Không leak stack trace ở production.

### Naming
- Controller method: `list`, `detail`, `create`, `update`, `remove`.
- Service method: `findAll`, `findById`, `insert`, `update`, `delete`.
- Route path: số ít cho `/:id`, số nhiều cho collection (`/employees`).

## 3. Frontend (React)

### Component
- Function component + hooks.
- Props: destructuring, có default.
- File `.jsx` cho component, `.js` cho logic/service.
- Naming: PascalCase cho component, camelCase cho function/hook.

### State management
- Local state: `useState`.
- Server state: `useQuery` (TanStack Query) hoặc custom hook `useApi`.
- Global auth: React Context `AuthContext`.

### Service pattern
```js
// services/customerService.js
import api from './api';

export const customerService = {
  list: (params) => api.get('/customers', { params }).then(r => r.data),
  detail: (id) => api.get(`/customers/${id}`).then(r => r.data),
  create: (data) => api.post('/customers', data).then(r => r.data),
  update: (id, data) => api.put(`/customers/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/customers/${id}`).then(r => r.data),
};
```

### Styling
- TailwindCSS utility-first.
- Không viết CSS custom trừ khi cần.
- Class naming: `kebab-case` nếu có custom.

### Routing
- `react-router-dom` v6.
- Route bảo vệ: `<ProtectedRoute>` kiểm tra auth.
- Lazy load các page (React.lazy + Suspense).

## 4. Database

### Naming
- Table: số nhiều, snake_case (`customers`, `message_logs`).
- Column: snake_case (`created_at`, `total_visits`).
- PK: `id` (UUID).
- FK: `<table_singular>_id` (`customer_id`, `employee_id`).
- Timestamp: `created_at`, `updated_at` (TIMESTAMPTZ).

### Quy ước
- Mọi bảng có `id` (UUID), `created_at`, `updated_at`.
- Dùng `gen_random_uuid()` cho PK.
- Soft delete: thêm cột `deleted_at` (nếu cần).
- Enum dùng `CHECK (col IN (...))`.
- Index trên FK + cột hay query (phone, birthday, status).

## 5. Git

### Branch
- `main` — production-ready.
- `develop` — tích hợp.
- `feature/<module>` — tính năng mới.
- `fix/<bug>` — sửa lỗi.

### Commit message
```
<type>(<scope>): <subject>

type: feat|fix|docs|style|refactor|test|chore
scope: auth|employees|customers|vouchers|...
subject: mô tả ngắn, imperative mood, tiếng Anh hoặc Việt không dấu
```
VD: `feat(employees): thêm API CRUD nhân viên`

### PR
- Mô tả thay đổi + screenshot (nếu UI).
- Squash merge.

## 6. Testing
- Backend: Jest + Supertest.
- Frontend: Vitest + Testing Library.
- Coverage tối thiểu: 60% cho service layer.

## 7. Linting
- ESLint + Prettier.
- Chạy `npm run lint` trước commit (husky pre-commit).
