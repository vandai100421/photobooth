import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import ErrorBoundary from './components/shared/ErrorBoundary';
import Layout from './components/layout/Layout';
import Spinner from './components/ui/Spinner';
import Skeleton from './components/ui/Skeleton';
import { ToastProvider } from './components/ui/Toast';
import Login from './pages/Login';
import { ROUTES } from './utils/constants';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const Customers = lazy(() => import('./pages/Customers'));
const Vouchers = lazy(() => import('./pages/Vouchers'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Posts = lazy(() => import('./pages/Posts'));
const Holidays = lazy(() => import('./pages/Holidays'));
const Messages = lazy(() => import('./pages/Messages'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Rewards = lazy(() => import('./pages/Rewards'));
const ShootCodes = lazy(() => import('./pages/ShootCodes'));
const PortalRevenue = lazy(() => import('./pages/PortalRevenue'));

function PageFallback() {
  return (
    <div className="space-y-4 py-4">
      <div className="h-8 w-48">
        <Skeleton height={32} lines={1} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24">
            <Skeleton height={96} lines={1} />
          </div>
        ))}
      </div>
      <div className="flex h-full w-full items-center justify-center py-10">
        <Spinner size="lg" className="text-brand-600" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Routes>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<PageFallback />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.EMPLOYEES}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Employees />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.CUSTOMERS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Customers />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.VOUCHERS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Vouchers />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.BOOKINGS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Bookings />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.POSTS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Posts />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.HOLIDAYS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Holidays />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.MESSAGES}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Messages />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.REPORTS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Reports />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.SETTINGS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Settings />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.SCHEDULE}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Schedule />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.REWARDS}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Rewards />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.SHOOT}
              element={
                <Suspense fallback={<PageFallback />}>
                  <ShootCodes />
                </Suspense>
              }
            />
            <Route
              path={ROUTES.PORTAL_REVENUE}
              element={
                <Suspense fallback={<PageFallback />}>
                  <PortalRevenue />
                </Suspense>
              }
            />
          </Route>
            <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          </Routes>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
