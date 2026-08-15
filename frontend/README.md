# TAP Photobooth — Frontend

React 18 + Vite + TailwindCSS + React Router.

## Yêu cầu

- Node.js 20+
- Backend API chạy ở `http://localhost:5000` (proxy qua `/api`)

## Cài đặt

```bash
npm install
cp .env.example .env
```

## Chạy dev

```bash
npm run dev
```

Mặc định chạy ở `http://localhost:5173`.

## Build production

```bash
npm run build
npm run preview
```

## Biến môi trường

| Biến | Mô tả | Mặc định |
|---|---|---|
| `VITE_API_URL` | Base URL cho API | `/api/v1` |

## Cấu trúc

```
src/
├── components/
│   ├── layout/      # Sidebar, Header, Layout
│   ├── ui/          # Button, Input, Spinner, Badge
│   └── shared/      # ProtectedRoute
├── context/         # AuthContext
├── hooks/           # useAuth
├── pages/           # Login, Dashboard, ...
├── services/        # api (axios), authService
├── utils/           # constants
├── App.jsx          # Router
├── main.jsx
└── index.css
```

## Auth flow

- Login → `POST /auth/login` → lưu JWT vào `localStorage`.
- Mọi request đi qua axios interceptor tự đính kèm `Authorization: Bearer <token>`.
- Response 401 → xoá token, redirect về `/login`.
- `AuthContext` tự load user từ `GET /auth/me` khi có token.
