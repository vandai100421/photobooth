import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../shared/StatCard';
import SettingsGuide from '../shared/SettingsGuide';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import Table from '../ui/Table';
import RevenueDetailModal from './RevenueDetailModal';
import { buildPreviewUrl, toSessionMap } from '../../services/portalRevenueService';
import boothService from '../../services/boothService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import {
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

const PAYMENT_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả phương thức' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'transfer', label: 'Chuyển khoản' },
];

// Thẻ trạng thái thu thập dữ liệu của 1 nguồn (Photobooth / Selfbooth).
function SourceStatusCard({ title, state, detail, hint }) {
  const badge =
    state === 'loading'
      ? { variant: 'info', label: 'Đang thu thập...' }
      : state === 'ok'
        ? { variant: 'success', label: 'Đã thu thập được dữ liệu' }
        : state === 'error'
          ? { variant: 'danger', label: 'Chưa thu thập được' }
          : { variant: 'default', label: 'Chưa tải' };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {detail && <p className="mt-1 text-xs text-gray-600">{detail}</p>}
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// Tổng hợp doanh thu 2 hệ máy (Photobooth Portal + Selfbooth) — hiển thị trên
// Dashboard. Nguồn nào không trả về dữ liệu sẽ được tính 0.
export default function RevenueOverview() {
  const [from, setFrom] = useState(toISODate(new Date()));
  const [to, setTo] = useState(toISODate(new Date()));
  const [paymentFilter, setPaymentFilter] = useState('');
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sessionMap, setSessionMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [portalStatus, setPortalStatus] = useState({ state: 'idle' });

  // Chỉnh sửa tạm theo revenue_id (không đồng bộ về máy).
  const [edits, setEdits] = useState({});
  const [detailId, setDetailId] = useState(null);

  // Selfbooth (boothme.tech): cookie sb_session lưu tại trang Cài đặt.
  const [sbLoading, setSbLoading] = useState(false);
  const [sbError, setSbError] = useState('');
  const [sbData, setSbData] = useState(null); // { summary, total }

  const rangeValid = Boolean(from && to && from <= to);

  // Gọi revenue Selfbooth qua backend proxy (backend tự gọi boothme.tech).
  const loadSelfbooth = useCallback(async () => {
    const res = await boothService.revenue('selfbooth', { from, to });
    const payload = res?.data ?? res;
    const uses = Array.isArray(payload?.uses) ? payload.uses : [];
    const usesTotal = uses.reduce(
      (sum, u) =>
        sum +
        (Number(u.price_vnd) || Number(u.revenue) || Number(u.amount) || 0),
      0,
    );
    setSbData({
      summary: payload?.summary ?? null,
      count: uses.length,
      total: usesTotal || Number(payload?.summary?.code_revenue_vnd) || 0,
    });
  }, [from, to]);

  // Tải song song Portal + Selfbooth. Nguồn nào lỗi thì phần của nó tính 0,
  // nguồn còn lại vẫn hiển thị bình thường.
  const fetchData = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError('');
    setSbLoading(true);
    setSbError('');
    setPortalStatus({ state: 'loading' });

    // Portal (Photobooth): gọi qua backend để backend gắn token xác thực.
    // Session lỗi thì vẫn giữ bảng (preview "Không ảnh"), revenue lỗi thì hiện lỗi.
    const portalTask = (async () => {
      const [revRes, sessRes] = await Promise.allSettled([
        boothService.revenue('photobooth', { from, to }),
        boothService.mediaSessions('photobooth', { from, to }),
      ]);
      if (revRes.status === 'rejected') throw revRes.reason;
      const payload = revRes.value?.data ?? revRes.value;
      const uses = Array.isArray(payload?.uses) ? payload.uses : [];
      setRows(uses);
      setSummary(payload?.summary ?? null);
      setPortalStatus({
        state: 'ok',
        count: Number(payload?.summary?.record_count) || uses.length,
        total: Number(payload?.summary?.total_required) || 0,
      });
      setSessionMap(
        sessRes.status === 'fulfilled'
          ? toSessionMap(sessRes.value?.data ?? sessRes.value)
          : new Map(),
      );
    })();

    const sbTask = loadSelfbooth().catch((err) => {
      setSbData(null);
      setSbError(
        getErrorMessage(
          err,
          'Chưa nhận được doanh thu từ Selfbooth (thiếu token hoặc API lỗi).',
        ),
      );
    });

    const [portalRes] = await Promise.allSettled([portalTask, sbTask]);
    if (portalRes.status === 'rejected') {
      const message = getErrorMessage(
        portalRes.reason,
        'Không tải được dữ liệu doanh thu.',
      );
      setError(message);
      setRows([]);
      setSummary(null);
      setPortalStatus({ state: 'error', message });
    }
    setLoading(false);
    setSbLoading(false);
  }, [from, to, rangeValid, loadSelfbooth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveEdit = useCallback((revenueId, form) => {
    setEdits((prev) => ({ ...prev, [revenueId]: form }));
  }, []);

  // Nút trong ô Selfbooth: tải lại doanh thu Selfbooth.
  const fetchSelfbooth = useCallback(async () => {
    setSbLoading(true);
    setSbError('');
    try {
      await loadSelfbooth();
    } catch (err) {
      setSbData(null);
      setSbError(
        getErrorMessage(
          err,
          'Chưa nhận được doanh thu từ Selfbooth (thiếu token hoặc API lỗi).',
        ),
      );
    } finally {
      setSbLoading(false);
    }
  }, [loadSelfbooth]);

  // Gộp chỉnh sửa + ảnh preview vào từng hàng.
  const merged = useMemo(
    () =>
      rows.map((row) => {
        const edit = edits[row.revenue_id];
        const mergedRow = edit ? { ...row, ...edit } : row;
        const session = sessionMap.get(row.session_id) ?? null;
        const preview_url = session ? buildPreviewUrl(session) : '';
        return { ...mergedRow, preview_url, _session: session };
      }),
    [rows, edits, sessionMap],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merged.filter((row) => {
      if (paymentFilter && row.payment_method !== paymentFilter) return false;
      if (!q) return true;
      return (
        (row.session_id || '').toLowerCase().includes(q) ||
        (row.room_name || '').toLowerCase().includes(q) ||
        (row.event_name || '').toLowerCase().includes(q) ||
        (row.note || '').toLowerCase().includes(q)
      );
    });
  }, [merged, paymentFilter, search]);

  const stats = useMemo(() => {
    const sum = (field) =>
      filtered.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
    const portalTotal = sum('amount_required');
    const sbTotal = Number(sbData?.total) || 0;
    return {
      portalTotal,
      sbTotal,
      total: portalTotal + sbTotal,
      cash: sum('cash_received'),
      voucher: sum('voucher_amount'),
      transfer: sum('transfer_amount'),
      prints: sum('print_count'),
      count: filtered.length,
    };
  }, [filtered, sbData]);

  const columns = useMemo(
    () => [
      {
        key: 'preview',
        label: 'Ảnh',
        render: (_v, row) =>
          row.preview_url ? (
            <img
              src={row.preview_url}
              alt={`preview ${row.session_id || ''}`}
              className="h-12 w-16 rounded border border-gray-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-16 items-center justify-center rounded border border-dashed border-gray-300 text-[10px] text-gray-400">
              Không ảnh
            </div>
          ),
      },
      {
        key: 'recorded_at',
        label: 'Thời gian',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      { key: 'session_id', label: 'Session' },
      { key: 'room_name', label: 'Phòng' },
      { key: 'event_name', label: 'Sự kiện' },
      { key: 'print_count', label: 'Số in', render: (v) => v ?? 0 },
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
        key: 'amount_required',
        label: 'Doanh thu',
        render: (v) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(v, '0đ')}
          </span>
        ),
      },
      {
        key: 'note',
        label: 'Ghi chú',
        render: (v) => (
          <span title={v || ''} className="block max-w-[240px] truncate">
            {v || '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Hành động',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (_v, row) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDetailId(row.revenue_id)}
          >
            Sửa
          </Button>
        ),
      },
    ],
    [],
  );

  const detailRow = merged.find((r) => r.revenue_id === detailId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Tổng hợp doanh thu (2 hệ máy)
        </h2>
        <p className="text-sm text-gray-500">
          Gộp doanh thu từ Portal (Photobooth) và Selfbooth. Nguồn nào không trả
          về dữ liệu sẽ được tính 0.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          <Select
            label="Phương thức"
            name="paymentFilter"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            options={PAYMENT_FILTER_OPTIONS}
          />
          <Input
            label="Tìm kiếm"
            name="search"
            placeholder="Session, phòng, sự kiện, ghi chú..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-end">
            <Button
              onClick={fetchData}
              loading={loading}
              disabled={!rangeValid}
              className="w-full"
            >
              Tải dữ liệu
            </Button>
          </div>
        </div>
        {!rangeValid && (
          <p className="mt-2 text-xs text-red-600">Khoảng ngày không hợp lệ.</p>
        )}
      </div>

      {/* Banner trạng thái thu thập dữ liệu của 2 nguồn */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SourceStatusCard
          title="Photobooth — Portal (workers.dev)"
          state={portalStatus.state}
          detail={
            portalStatus.state === 'ok'
              ? `Đã thu thập ${portalStatus.count} giao dịch · tổng ${formatCurrency(
                  portalStatus.total,
                  '0đ',
                )}`
              : portalStatus.state === 'error'
                ? portalStatus.message
                : portalStatus.state === 'loading'
                  ? 'Đang gọi API Photobooth...'
                  : ''
          }
        />
        <SourceStatusCard
          title="Selfbooth (boothme.tech)"
          state={sbLoading ? 'loading' : sbError ? 'error' : sbData ? 'ok' : 'idle'}
          detail={
            sbData
              ? `Đã thu thập ${sbData.count} lượt dùng · tổng ${formatCurrency(
                  sbData.total,
                  '0đ',
                )}`
              : sbError
                ? sbError
                : sbLoading
                  ? 'Đang gọi API Selfbooth...'
                  : ''
          }
          hint={
            !sbData && !sbError && !sbLoading
              ? 'Chưa có token Selfbooth — dán token bên dưới rồi bấm Lấy doanh thu.'
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng doanh thu (Portal + Selfbooth)"
          value={formatCurrency(stats.total, '0đ')}
          icon={<span aria-hidden="true">💰</span>}
          variant="info"
        />
        <StatCard
          title="Doanh thu Portal"
          value={formatCurrency(stats.portalTotal, '0đ')}
          icon={<span aria-hidden="true">🖥️</span>}
          variant="default"
        />
        <StatCard
          title="Doanh thu Selfbooth"
          value={formatCurrency(stats.sbTotal, '0đ')}
          icon={<span aria-hidden="true">📷</span>}
          variant="default"
        />
        <StatCard
          title="Tiền mặt (Portal)"
          value={formatCurrency(stats.cash, '0đ')}
          icon={<span aria-hidden="true">💵</span>}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard
          title="Voucher (Portal)"
          value={formatCurrency(stats.voucher, '0đ')}
          icon={<span aria-hidden="true">🎟️</span>}
          variant="warning"
        />
        <StatCard
          title="Chuyển khoản (Portal)"
          value={formatCurrency(stats.transfer, '0đ')}
          icon={<span aria-hidden="true">🏦</span>}
          variant="default"
        />
      </div>

      <p className="text-sm text-gray-500">
        {sbError
          ? 'Selfbooth chưa có dữ liệu (đang tính 0) — '
          : 'Nguồn lỗi được tính 0 — '}
        Tổng = Portal{' '}
        <span className="font-semibold text-gray-700">
          {formatCurrency(stats.portalTotal, '0đ')}
        </span>{' '}
        + Selfbooth{' '}
        <span className="font-semibold text-gray-700">
          {formatCurrency(stats.sbTotal, '0đ')}
        </span>
        {' · '}Số giao dịch Portal:{' '}
        <span className="font-semibold text-gray-700">
          {summary?.record_count ?? stats.count ?? 0}
        </span>{' '}
        · Lượt dùng Selfbooth:{' '}
        <span className="font-semibold text-gray-700">{sbData?.count ?? 0}</span>{' '}
        · Số in:{' '}
        <span className="font-semibold text-gray-700">{stats.prints}</span>
      </p>

      {/* Doanh thu Selfbooth (boothme.tech) — cookie sb_session lưu ở Cài đặt */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              Doanh thu Selfbooth (boothme.tech)
            </h2>
            <p className="text-sm text-gray-500">
              Cookie <code>sb_session</code> được lưu tại trang Cài đặt →
              "Tài khoản hệ thống chụp ảnh".
            </p>
          </div>
          <Button
            onClick={fetchSelfbooth}
            loading={sbLoading}
            disabled={!rangeValid}
          >
            Lấy doanh thu Selfbooth
          </Button>
        </div>

        {sbError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span aria-hidden="true">⚠️</span>
            <span>
              Chưa nhận được doanh thu từ Selfbooth. {sbError} —{' '}
              <SettingsGuide message="Kiểm tra cookie sb_session trong" />
            </span>
          </div>
        ) : sbData ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
              <p className="text-sm text-gray-500">Tổng doanh thu Selfbooth</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(sbData.total, '0đ')}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
              <p className="text-sm text-gray-500">Số lượt dùng</p>
              <p className="text-xl font-bold text-gray-900">
                {sbData.count}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
              <p className="text-sm text-gray-500">Tiền mặt (máy ghi)</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(
                  sbData.summary?.cash ?? sbData.summary?.total_cash,
                  '0đ',
                )}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchData}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Skeleton lines={8} height={20} />
        </div>
      ) : (
        <Table
          columns={columns}
          data={filtered}
          loading={loading}
          emptyText="Không có dữ liệu doanh thu trong khoảng ngày."
          rowKey={(row) => row.revenue_id ?? row.session_id}
        />
      )}

      <RevenueDetailModal
        open={Boolean(detailRow)}
        onClose={() => setDetailId(null)}
        row={detailRow}
        session={detailRow?._session ?? null}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
