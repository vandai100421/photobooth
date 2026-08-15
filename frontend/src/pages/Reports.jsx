import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/shared/StatCard';
import BarChart from '../components/shared/BarChart';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import Table from '../components/ui/Table';
import Toast from '../components/ui/Toast';
import dashboardService from '../services/dashboardService';
import { formatCurrency } from '../utils/formatCurrency';
import { exportCSV } from '../utils/exportCSV';
import { VOUCHER_TYPE_LABELS } from '../utils/constants';

const TABS = [
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'customers', label: 'Khách hàng' },
  { value: 'vouchers', label: 'Voucher' },
];

function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstOfMonthMonthsAgo(n) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return toISODate(d);
}

function lastDayOfPrevMonth() {
  const d = new Date();
  d.setDate(0);
  return toISODate(d);
}

function formatMonthLabel(period) {
  if (!period || typeof period !== 'string') return '';
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  return `${m}/${y.slice(2)}`;
}

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

export default function Reports() {
  const [from, setFrom] = useState(firstOfMonthMonthsAgo(0));
  const [to, setTo] = useState(toISODate(new Date()));
  const [activeTab, setActiveTab] = useState('revenue');

  const [revenueSeries, setRevenueSeries] = useState([]);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState('');

  const [customerSeries, setCustomerSeries] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');

  const [voucherData, setVoucherData] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const rangeValid = from && to && from <= to;

  const fetchRevenue = useCallback(async () => {
    if (!rangeValid) return;
    setRevenueLoading(true);
    setRevenueError('');
    try {
      const res = await dashboardService.revenue({ from, to });
      setRevenueSeries(res?.data?.series ?? []);
    } catch (err) {
      setRevenueError(getErrorMessage(err, 'Không thể tải doanh thu.'));
    } finally {
      setRevenueLoading(false);
    }
  }, [from, to, rangeValid]);

  const fetchCustomers = useCallback(async () => {
    if (!rangeValid) return;
    setCustomerLoading(true);
    setCustomerError('');
    try {
      const res = await dashboardService.customers({ from, to });
      setCustomerSeries(res?.data?.series ?? []);
    } catch (err) {
      setCustomerError(getErrorMessage(err, 'Không thể tải khách hàng.'));
    } finally {
      setCustomerLoading(false);
    }
  }, [from, to, rangeValid]);

  const fetchVouchers = useCallback(async () => {
    if (!rangeValid) return;
    setVoucherLoading(true);
    setVoucherError('');
    try {
      const res = await dashboardService.vouchers({ from, to });
      setVoucherData(res?.data ?? null);
    } catch (err) {
      setVoucherError(getErrorMessage(err, 'Không thể tải voucher.'));
    } finally {
      setVoucherLoading(false);
    }
  }, [from, to, rangeValid]);

  useEffect(() => {
    fetchRevenue();
    fetchCustomers();
    fetchVouchers();
  }, [fetchRevenue, fetchCustomers, fetchVouchers]);

  const presets = useMemo(
    () => [
      {
        label: 'Tháng này',
        from: firstOfMonthMonthsAgo(0),
        to: toISODate(new Date()),
      },
      {
        label: 'Tháng trước',
        from: firstOfMonthMonthsAgo(1),
        to: lastDayOfPrevMonth(),
      },
      {
        label: '3 tháng',
        from: firstOfMonthMonthsAgo(2),
        to: toISODate(new Date()),
      },
      {
        label: '6 tháng',
        from: firstOfMonthMonthsAgo(5),
        to: toISODate(new Date()),
      },
    ],
    [],
  );

  const applyPreset = (preset) => {
    setFrom(preset.from);
    setTo(preset.to);
  };

  const revenueChart = revenueSeries.map((s) => ({
    label: formatMonthLabel(s.period),
    value: Number(s.revenue) || 0,
  }));

  const revenueTotal = revenueSeries.reduce(
    (sum, s) => sum + (Number(s.revenue) || 0),
    0,
  );

  const revenueColumns = [
    {
      key: 'period',
      label: 'Tháng',
      render: (v) => formatMonthLabel(v) || '—',
    },
    {
      key: 'revenue',
      label: 'Doanh thu',
      render: (v) => formatCurrency(v),
    },
  ];

  const handleExportRevenue = () => {
    if (!revenueSeries.length) {
      showToast('Không có dữ liệu để xuất.', 'warning');
      return;
    }
    const rows = revenueSeries.map((s) => [
      formatMonthLabel(s.period),
      Number(s.revenue) || 0,
    ]);
    exportCSV('bao-cao-doanh-thu', ['Tháng', 'Doanh thu'], rows);
    showToast('Đã xuất CSV doanh thu.');
  };

  const customerChart = customerSeries.map((s) => ({
    label: formatMonthLabel(s.period),
    value: Number(s.total_customers) || 0,
  }));

  const totalNewCustomers = customerSeries.reduce(
    (sum, s) => sum + (Number(s.new_customers) || 0),
    0,
  );
  const lastTotal = customerSeries.length
    ? Number(customerSeries[customerSeries.length - 1].total_customers) || 0
    : 0;
  const avgNewPerMonth = customerSeries.length
    ? Math.round(totalNewCustomers / customerSeries.length)
    : 0;

  const customerColumns = [
    {
      key: 'period',
      label: 'Tháng',
      render: (v) => formatMonthLabel(v) || '—',
    },
    {
      key: 'new_customers',
      label: 'Khách mới',
      render: (v) => v ?? 0,
    },
    {
      key: 'total_customers',
      label: 'Tổng khách',
      render: (v) => v ?? 0,
    },
  ];

  const handleExportCustomers = () => {
    if (!customerSeries.length) {
      showToast('Không có dữ liệu để xuất.', 'warning');
      return;
    }
    const rows = customerSeries.map((s) => [
      formatMonthLabel(s.period),
      Number(s.new_customers) || 0,
      Number(s.total_customers) || 0,
    ]);
    exportCSV(
      'bao-cao-khach-hang',
      ['Tháng', 'Khách mới', 'Tổng khách'],
      rows,
    );
    showToast('Đã xuất CSV khách hàng.');
  };

  const totalIssued = voucherData?.total_issued ?? 0;
  const totalUsed = voucherData?.total_used ?? 0;
  const usageRate = voucherData?.usage_rate ?? 0;
  const remaining = Math.max(totalIssued - totalUsed, 0);
  const byType = voucherData?.by_type ?? [];

  const voucherChart = byType.map((item) => ({
    label: VOUCHER_TYPE_LABELS[item.type] ?? item.type,
    value: Number(item.issued) || 0,
  }));

  const voucherColumns = [
    {
      key: 'type',
      label: 'Loại',
      render: (v) => VOUCHER_TYPE_LABELS[v] ?? v ?? '—',
    },
    { key: 'issued', label: 'Đã phát', render: (v) => v ?? 0 },
    { key: 'used', label: 'Đã dùng', render: (v) => v ?? 0 },
    {
      key: 'rate',
      label: 'Tỷ lệ dùng',
      render: (_v, row) => {
        const issued = Number(row.issued) || 0;
        const used = Number(row.used) || 0;
        if (issued <= 0) return '—';
        return `${Math.round((used / issued) * 100)}%`;
      },
    },
  ];

  const handleExportVouchers = () => {
    if (!byType.length) {
      showToast('Không có dữ liệu để xuất.', 'warning');
      return;
    }
    const rows = byType.map((item) => {
      const issued = Number(item.issued) || 0;
      const used = Number(item.used) || 0;
      const rate = issued > 0 ? Math.round((used / issued) * 100) : 0;
      return [VOUCHER_TYPE_LABELS[item.type] ?? item.type, issued, used, `${rate}%`];
    });
    exportCSV(
      'bao-cao-voucher',
      ['Loại', 'Đã phát', 'Đã dùng', 'Tỷ lệ dùng'],
      rows,
    );
    showToast('Đã xuất CSV voucher.');
  };

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Báo cáo</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              label="Từ ngày"
              name="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              label="Đến ngày"
              name="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        {!rangeValid && (
          <p className="mt-2 text-xs text-red-600">
            Khoảng ngày không hợp lệ (Từ ngày phải trước hoặc bằng Đến ngày).
          </p>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setActiveTab(t.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === t.value
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'revenue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Doanh thu theo tháng
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportRevenue}
              disabled={revenueLoading || !revenueSeries.length}
            >
              Xuất CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              title="Tổng doanh thu"
              value={formatCurrency(revenueTotal)}
              icon={<span aria-hidden="true">💰</span>}
              variant="success"
            />
            <StatCard
              title="Trung bình/tháng"
              value={
                revenueSeries.length
                  ? formatCurrency(Math.round(revenueTotal / revenueSeries.length))
                  : '—'
              }
              icon={<span aria-hidden="true">📊</span>}
              variant="info"
            />
            <StatCard
              title="Số tháng"
              value={revenueSeries.length}
              icon={<span aria-hidden="true">📅</span>}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {revenueLoading ? (
              <div className="py-8">
                <Skeleton lines={6} height={20} />
              </div>
            ) : revenueError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {revenueError}
                <button
                  type="button"
                  onClick={fetchRevenue}
                  className="ml-2 underline hover:text-red-800"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <BarChart
                data={revenueChart}
                formatValue={(v) => formatCurrency(v)}
              />
            )}
          </div>

          <Table
            columns={revenueColumns}
            data={revenueSeries}
            loading={revenueLoading}
            emptyText="Không có dữ liệu doanh thu"
            rowKey="period"
          />
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Tăng trưởng khách hàng
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCustomers}
              disabled={customerLoading || !customerSeries.length}
            >
              Xuất CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              title="Tổng khách hàng"
              value={lastTotal}
              icon={<span aria-hidden="true">👥</span>}
              variant="info"
            />
            <StatCard
              title="Khách mới (kỳ)"
              value={totalNewCustomers}
              icon={<span aria-hidden="true">✨</span>}
              variant="success"
            />
            <StatCard
              title="TB mới/tháng"
              value={avgNewPerMonth}
              icon={<span aria-hidden="true">📈</span>}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {customerLoading ? (
              <div className="py-8">
                <Skeleton lines={6} height={20} />
              </div>
            ) : customerError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {customerError}
                <button
                  type="button"
                  onClick={fetchCustomers}
                  className="ml-2 underline hover:text-red-800"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <BarChart data={customerChart} color="bg-blue-500" />
            )}
          </div>

          <Table
            columns={customerColumns}
            data={customerSeries}
            loading={customerLoading}
            emptyText="Không có dữ liệu khách hàng"
            rowKey="period"
          />
        </div>
      )}

      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Thống kê voucher
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportVouchers}
              disabled={voucherLoading || !byType.length}
            >
              Xuất CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Đã phát"
              value={totalIssued}
              icon={<span aria-hidden="true">🎟️</span>}
              variant="info"
            />
            <StatCard
              title="Đã dùng"
              value={totalUsed}
              icon={<span aria-hidden="true">✅</span>}
              variant="success"
            />
            <StatCard
              title="Chưa dùng"
              value={remaining}
              icon={<span aria-hidden="true">⏳</span>}
              variant="warning"
            />
            <StatCard
              title="Tỷ lệ dùng"
              value={`${Math.round(usageRate * 100)}%`}
              icon={<span aria-hidden="true">📊</span>}
              variant="success"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {voucherLoading ? (
              <div className="py-8">
                <Skeleton lines={6} height={20} />
              </div>
            ) : voucherError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {voucherError}
                <button
                  type="button"
                  onClick={fetchVouchers}
                  className="ml-2 underline hover:text-red-800"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <BarChart data={voucherChart} color="bg-green-500" />
            )}
          </div>

          <Table
            columns={voucherColumns}
            data={byType}
            loading={voucherLoading}
            emptyText="Không có dữ liệu voucher"
            rowKey="type"
          />
        </div>
      )}
    </div>
  );
}
