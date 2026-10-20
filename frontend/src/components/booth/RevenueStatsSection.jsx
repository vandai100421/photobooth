import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../shared/StatCard';
import SettingsGuide from '../shared/SettingsGuide';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import Table from '../ui/Table';
import Toast from '../ui/Toast';
import Skeleton, { SkeletonCard } from '../ui/Skeleton';
import IssueMarkModal from './IssueMarkModal';
import boothService from '../../services/boothService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import {
  BOOTH_SYSTEM_LABELS,
  PORTAL_PAYMENT_METHOD_LABELS,
  PORTAL_PAYMENT_METHOD_BADGE_VARIANT,
} from '../../utils/constants';

function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

// Doanh thu thực nhận 2 hệ máy: máy ghi trừ đi các ca nhân viên đánh dấu "Báo
// lỗi" (chất lượng ảnh / in chưa đạt) + danh sách ca lỗi kèm lý do.
export default function RevenueStatsSection() {
  const [from, setFrom] = useState(toISODate(new Date()));
  const [to, setTo] = useState(toISODate(new Date()));
  const [onlyErrors, setOnlyErrors] = useState(true);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(null);
  const [toast, setToast] = useState({ message: '', variant: 'info' });

  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const rangeValid = Boolean(from && to && from <= to);

  const fetchStats = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError('');
    try {
      const res = await boothService.revenueStats({ from, to });
      setStats(res?.data ?? null);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được doanh thu thực nhận.'));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, rangeValid]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totals = stats?.totals ?? null;
  const sources = stats?.sources ?? {};
  const sourceErrors = Object.entries(sources).filter(
    ([, s]) => s && s.ok === false && s.message,
  );

  const rows = useMemo(() => {
    const list = Array.isArray(stats?.rows) ? stats.rows : [];
    return onlyErrors ? list.filter((r) => r.status === 'error') : list;
  }, [stats, onlyErrors]);

  const columns = useMemo(
    () => [
      {
        key: 'used_at',
        label: 'Thời gian',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        key: 'system',
        label: 'Hệ máy',
        render: (v) => BOOTH_SYSTEM_LABELS[v] ?? v ?? '—',
      },
      {
        key: 'code',
        label: 'Mã chụp',
        render: (v, row) =>
          v ? (
            v
          ) : (
            <span className="text-gray-400">
              Khách trực tiếp{row.machine_name ? ` · ${row.machine_name}` : ''}
            </span>
          ),
      },
      {
        key: 'detail',
        label: 'Phòng / Sự kiện',
        render: (_v, row) => {
          const text = [row.room_name, row.event_name].filter(Boolean).join(' · ');
          return text || '—';
        },
      },
      {
        key: 'payment_method',
        label: 'Thanh toán',
        render: (v) => (
          <Badge variant={PORTAL_PAYMENT_METHOD_BADGE_VARIANT[v] ?? 'default'}>
            {PORTAL_PAYMENT_METHOD_LABELS[v] ?? v ?? '—'}
          </Badge>
        ),
      },
      {
        key: 'amount',
        label: 'Tiền',
        className: 'text-right',
        headerClassName: 'text-right',
        render: (v, row) => (
          <span
            className={
              row.status === 'error'
                ? 'font-semibold text-red-600 line-through'
                : 'font-semibold text-gray-900'
            }
          >
            {formatCurrency(v, '0đ')}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: (_v, row) => (
          <div className="flex flex-wrap items-center gap-1">
            {row.status === 'error' ? (
              <Badge variant="danger">Lỗi</Badge>
            ) : (
              <Badge variant="success">OK</Badge>
            )}
            {row.reason && (
              <span className="text-xs text-gray-600">{row.reason}</span>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'Hành động',
        className: 'text-right',
        headerClassName: 'text-right',
        render: (_v, row) => (
          <Button size="sm" variant="secondary" onClick={() => setMarking(row)}>
            {row.status === 'error' ? 'Sửa lý do' : 'Đánh dấu lỗi'}
          </Button>
        ),
      },
    ],
    [],
  );

  const handleMarked = () => {
    showToast('Đã lưu ghi chú — thống kê doanh thu đã cập nhật.');
    fetchStats();
  };

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Doanh thu thực nhận & ca lỗi
            </h2>
            <p className="text-sm text-gray-500">
              Máy ghi trừ đi các ca bị đánh dấu "Báo lỗi" (chất lượng ảnh / in
              chưa đạt). Ghi lý do ngay tại cột Hành động.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Từ ngày"
            name="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="Đến ngày"
            name="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <label className="flex items-end gap-2 pb-1 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => setOnlyErrors(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Chỉ hiện ca lỗi
          </label>
          <div className="flex items-end">
            <Button
              onClick={fetchStats}
              loading={loading}
              disabled={!rangeValid}
              className="w-full"
            >
              Tải thống kê
            </Button>
          </div>
        </div>
        {!rangeValid && (
          <p className="mt-2 text-xs text-red-600">Khoảng ngày không hợp lệ.</p>
        )}
      </div>

      {sourceErrors.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nguồn chưa lấy được (đang tính 0):{' '}
          {sourceErrors
            .map(([system, s]) => `${BOOTH_SYSTEM_LABELS[system]} — ${s.message}`)
            .join(' · ')}{' '}
          — kiểm tra tài khoản / token trong{' '}
          <SettingsGuide message="bảng" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchStats}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
          {' — '}
          <SettingsGuide message="kiểm tra tài khoản hệ máy tại" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Doanh thu thực nhận"
              value={formatCurrency(totals?.net ?? 0, '0đ')}
              icon={<span aria-hidden="true">✅</span>}
              variant="success"
            />
            <StatCard
              title="Máy đã ghi"
              value={formatCurrency(totals?.gross ?? 0, '0đ')}
              icon={<span aria-hidden="true">💰</span>}
              variant="info"
            />
            <StatCard
              title="Tiền ca lỗi"
              value={formatCurrency(totals?.error_amount ?? 0, '0đ')}
              icon={<span aria-hidden="true">⚠️</span>}
              variant="warning"
            />
            <StatCard
              title="Số ca lỗi"
              value={totals?.error_count ?? 0}
              sub={`${totals?.count ?? 0} lượt chụp có thanh toán`}
              icon={<span aria-hidden="true">🛠️</span>}
              variant="danger"
            />
          </>
        )}
      </div>

      <p className="text-sm text-gray-500">
        Photobooth:{' '}
        <span className="font-semibold text-gray-700">
          {formatCurrency(sources.photobooth?.net ?? 0, '0đ')}
        </span>{' '}
        ({sources.photobooth?.count ?? 0} lượt · lỗi{' '}
        {sources.photobooth?.error_count ?? 0}) · Selfbooth:{' '}
        <span className="font-semibold text-gray-700">
          {formatCurrency(sources.selfbooth?.net ?? 0, '0đ')}
        </span>{' '}
        ({sources.selfbooth?.count ?? 0} lượt · lỗi{' '}
        {sources.selfbooth?.error_count ?? 0})
      </p>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Skeleton lines={6} height={20} />
        </div>
      ) : (
        <Table
          columns={columns}
          data={rows}
          emptyText="Không có ca nào trong khoảng ngày này."
          rowKey={(row) =>
            `${row.system}-${row.session_id || row.code || row.revenue_id || ''}`
          }
        />
      )}

      <IssueMarkModal
        open={Boolean(marking)}
        row={marking}
        onClose={() => setMarking(null)}
        onSaved={handleMarked}
      />
    </div>
  );
}
