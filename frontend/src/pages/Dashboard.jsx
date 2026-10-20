import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/shared/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Skeleton, { SkeletonCard } from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import RevenueOverview from '../components/booth/RevenueOverview';
import RevenueStatsSection from '../components/booth/RevenueStatsSection';
import dashboardService from '../services/dashboardService';
import customerService from '../services/customerService';
import messageService from '../services/messageService';
import { formatDate } from '../utils/formatDate';
import {
  ROUTES,
  CUSTOMER_STATUS_BADGE_VARIANT,
  CUSTOMER_STATUS_LABELS,
} from '../utils/constants';

function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function calcAge(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const [birthdays, setBirthdays] = useState([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(true);
  const [birthdaysError, setBirthdaysError] = useState('');

  const [voucherStatus, setVoucherStatus] = useState({});
  const [messageTotal, setMessageTotal] = useState(null);

  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const today = new Date();
  const todayISO = toISODate(today);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const res = await dashboardService.stats();
      setStats(res?.data ?? null);
    } catch (err) {
      setStatsError(getErrorMessage(err, 'Không thể tải thống kê.'));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchBirthdays = useCallback(async () => {
    setBirthdaysLoading(true);
    setBirthdaysError('');
    try {
      const res = await customerService.birthdays('today');
      setBirthdays(res?.data?.customers ?? []);
    } catch (err) {
      setBirthdaysError(getErrorMessage(err, 'Không thể tải sinh nhật.'));
    } finally {
      setBirthdaysLoading(false);
    }
  }, []);

  const fetchMessageTotal = useCallback(async () => {
    try {
      const res = await messageService.stats({
        from: todayISO,
        to: todayISO,
      });
      setMessageTotal(res?.data?.total ?? 0);
    } catch {
      setMessageTotal(null);
    }
  }, [todayISO]);

  useEffect(() => {
    fetchStats();
    fetchBirthdays();
    fetchMessageTotal();
  }, [fetchStats, fetchBirthdays, fetchMessageTotal]);

  useEffect(() => {
    if (!birthdays.length) {
      setVoucherStatus({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        birthdays.map(async (c) => {
          try {
            const res = await customerService.listVouchers(c.id, {
              limit: 1,
            });
            const total = res?.pagination?.total ?? res?.data?.length ?? 0;
            return [c.id, total > 0];
          } catch {
            return [c.id, false];
          }
        }),
      );
      if (!cancelled) setVoucherStatus(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [birthdays]);

  const handleSendGreeting = (customer) => {
    showToast(
      `Chuyển sang trang Tin nhắn để gửi lời chúc tới ${customer.full_name}.`,
      'info',
    );
    navigate(ROUTES.MESSAGES);
  };

  const handleIssueVoucher = (customer) => {
    showToast(
      `Chuyển sang trang Voucher để phát cho ${customer.full_name}.`,
      'info',
    );
    navigate(ROUTES.VOUCHERS);
  };

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-sm text-gray-500">{formatDate(today)}</span>
      </div>

      {statsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {statsError}
          <button
            type="button"
            onClick={fetchStats}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Khách hôm nay"
              value={stats?.customers_today}
              icon={<span aria-hidden="true">👥</span>}
              variant="info"
            />
            <StatCard
              title="Booking hôm nay"
              value={stats?.bookings_today}
              icon={<span aria-hidden="true">📅</span>}
            />
            <StatCard
              title="Voucher đã dùng"
              value={stats?.vouchers_used_today}
              icon={<span aria-hidden="true">🎟️</span>}
              variant="warning"
            />
            <StatCard
              title="Tin nhắn hôm nay"
              value={messageTotal}
              icon={<span aria-hidden="true">💬</span>}
              variant="info"
            />
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Sinh nhật hôm nay
            </h2>
            <span className="text-sm text-gray-500">
              {birthdays.length} khách
            </span>
          </div>

          {birthdaysLoading ? (
            <ul className="divide-y divide-gray-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="py-3">
                  <Skeleton lines={2} />
                </li>
              ))}
            </ul>
          ) : birthdaysError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {birthdaysError}
              <button
                type="button"
                onClick={fetchBirthdays}
                className="ml-2 underline hover:text-red-800"
              >
                Thử lại
              </button>
            </div>
          ) : birthdays.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Hôm nay không có khách sinh nhật.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {birthdays.map((c) => {
                const age = calcAge(c.birthday);
                const hasVoucher = voucherStatus[c.id];
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-lg">
                        <span aria-hidden="true">🎂</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">
                          {c.full_name || '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {age != null ? `${age} tuổi · ` : ''}
                          {c.phone || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          CUSTOMER_STATUS_BADGE_VARIANT[c.status] ??
                          'default'
                        }
                      >
                        {CUSTOMER_STATUS_LABELS[c.status] ?? c.status ?? '—'}
                      </Badge>
                      {hasVoucher === undefined ? (
                        <span className="text-xs text-gray-400">...</span>
                      ) : hasVoucher ? (
                        <Badge variant="success">Đã nhận voucher</Badge>
                      ) : (
                        <Badge variant="default">Chưa nhận voucher</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSendGreeting(c)}
                      >
                        Gửi tin
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleIssueVoucher(c)}
                      >
                        Phát voucher
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      <RevenueStatsSection />
      <RevenueOverview />
    </div>
  );
}
