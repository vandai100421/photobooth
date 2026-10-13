import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/shared/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import Table from '../components/ui/Table';
import RevenueDetailModal from '../components/booth/RevenueDetailModal';
import {
  portalRevenueService,
  buildPreviewUrl,
} from '../services/portalRevenueService';
import boothService from '../services/boothService';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateTime } from '../utils/formatDate';
import {
  PORTAL_PAYMENT_METHOD_LABELS,
  PORTAL_PAYMENT_METHOD_BADGE_VARIANT,
} from '../utils/constants';

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

export default function PortalRevenue() {
  const [from, setFrom] = useState('2026-10-02');
  const [to, setTo] = useState('2026-10-12');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sessionMap, setSessionMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Chỉnh sửa tạm theo revenue_id (không đồng bộ về máy).
  const [edits, setEdits] = useState({});
  const [detailId, setDetailId] = useState(null);

  // Selfbooth (boothme.tech): cần access token do nhân viên dán từ trình duyệt.
  const [sbToken, setSbToken] = useState('');
  const [sbLoading, setSbLoading] = useState(false);
  const [sbError, setSbError] = useState('');
  const [sbData, setSbData] = useState(null); // { summary, total }

  const rangeValid = Boolean(from && to && from <= to);

  const fetchData = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError('');
    try {
      // Lượt chụp dùng khoảng rộng hơn 1 ngày để bắt preview của ngày cuối.
      const sessions = await portalRevenueService.mediaSessions({
        from,
        to,
      });
      setSessionMap(sessions);
      const revenue = await portalRevenueService.revenue({ from, to });
      const data = Array.isArray(revenue?.data) ? revenue.data : [];
      setRows(data);
      setSummary(revenue?.summary ?? null);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được dữ liệu doanh thu.'));
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, rangeValid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveEdit = useCallback((revenueId, form) => {
    setEdits((prev) => ({ ...prev, [revenueId]: form }));
  }, []);

  // Gọi revenue Selfbooth qua backend proxy (backend tự gọi boothme.tech).
  // Lưu token vào settings backend trước để backend dùng khi gọi API ngoài.
  const fetchSelfbooth = useCallback(async () => {
    setSbLoading(true);
    setSbError('');
    try {
      // Lưu token nếu người dùng nhập mới.
      if (sbToken.trim()) {
        await boothService.saveAccount('selfbooth', { token: sbToken.trim() });
      }
      const res = await boothService.revenue('selfbooth', { from, to });
      const payload = res?.data ?? res;
      const uses = Array.isArray(payload?.uses) ? payload.uses : [];
      const total = uses.reduce(
        (sum, u) => sum + (Number(u.revenue) || Number(u.amount) || 0),
        0,
      );
      setSbData({
        summary: payload?.summary ?? null,
        count: uses.length,
        total,
      });
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
  }, [sbToken, from, to]);
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
    return {
      total: sum('amount_required'),
      cash: sum('cash_received'),
      voucher: sum('voucher_amount'),
      transfer: sum('transfer_amount'),
      prints: sum('print_count'),
      count: filtered.length,
    };
  }, [filtered]);

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
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-800">
          Tổng hợp doanh thu Portal
        </h1>
        <p className="text-sm text-gray-500">
          Doanh thu theo máy chụp kết hợp ảnh preview từ lượt chụp.
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng doanh thu"
          value={formatCurrency(stats.total, '0đ')}
          icon={<span aria-hidden="true">💰</span>}
          variant="info"
        />
        <StatCard
          title="Tiền mặt"
          value={formatCurrency(stats.cash, '0đ')}
          icon={<span aria-hidden="true">💵</span>}
          variant="success"
        />
        <StatCard
          title="Voucher"
          value={formatCurrency(stats.voucher, '0đ')}
          icon={<span aria-hidden="true">🎟️</span>}
          variant="warning"
        />
        <StatCard
          title="Chuyển khoản"
          value={formatCurrency(stats.transfer, '0đ')}
          icon={<span aria-hidden="true">🏦</span>}
          variant="default"
        />
      </div>

      {summary && (
        <p className="text-sm text-gray-500">
          Tổng số giao dịch (theo API):{' '}
          <span className="font-semibold text-gray-700">
            {summary.record_count ?? 0}
          </span>{' '}
          · Số in:{' '}
          <span className="font-semibold text-gray-700">{stats.prints}</span>
        </p>
      )}

      {/* Doanh thu Selfbooth (boothme.tech) — cần access token */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-800">
            Doanh thu Selfbooth (boothme.tech)
          </h2>
          <p className="text-sm text-gray-500">
            Cần access token. Cách lấy: mở{' '}
            <a
              href="https://boothme.tech/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-600 underline"
            >
              boothme.tech
            </a>{' '}
            (đã đăng nhập) → nhấn F12 → tab <b>Application</b> →{' '}
            <b>Local Storage</b> → tìm key chứa <code>access_token</code> hoặc{' '}
            <code>token</code> → copy giá trị dán vào đây.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              label="Access token Selfbooth"
              name="sbToken"
              placeholder="Dán access_token / cookie phiên từ boothme.tech"
              value={sbToken}
              onChange={(e) => setSbToken(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={fetchSelfbooth}
              loading={sbLoading}
              disabled={!rangeValid}
              className="w-full"
            >
              Lấy doanh thu Selfbooth
            </Button>
          </div>
        </div>

        {sbError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span aria-hidden="true">⚠️</span>
            <span>
              Chưa nhận được doanh thu từ Selfbooth. {sbError}
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

