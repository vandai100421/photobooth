import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatCard from '../components/shared/StatCard';
import SettingsGuide from '../components/shared/SettingsGuide';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import Toast from '../components/ui/Toast';
import CreateCodeModal from '../components/booth/CreateCodeModal';
import CodeDetailModal from '../components/booth/CodeDetailModal';
import boothService from '../services/boothService';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatCurrency';
import { formatDateTime } from '../utils/formatDate';
import {
  BOOTH_SYSTEM_OPTIONS,
  BOOTH_SYSTEM_LABELS,
  BOOTH_CODE_STATUS_LABELS,
  BOOTH_CODE_STATUS_BADGE_VARIANT,
  BOOTH_CODE_STATUS_FILTER_OPTIONS,
  PHOTOBOOTH_CODE_TYPE_LABELS,
  ROUTES,
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
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

// Suy luận nguyên nhân lỗi từ dữ liệu lượt chụp (raw) để nhân viên hiểu rõ.
function statusErrorDetail(session) {
  if (!session) return '';
  const raw = session.raw || {};
  const parts = [];
  if (raw.failure_message) parts.push(String(raw.failure_message));
  if (raw.failure_code) parts.push(`Mã lỗi: ${raw.failure_code}`);
  if (Number(raw.had_camera_error) > 0) {
    parts.push(
      `Lỗi camera ${raw.camera_error_count || raw.had_camera_error} lần`,
    );
  }
  if (raw.finish_reason) parts.push(`Kết thúc: ${raw.finish_reason}`);
  if (session.status) parts.push(`Trạng thái máy: ${session.status}`);
  return parts.join(' · ');
}

// Ô trạng thái: Badge + dòng mô tả rõ nghĩa (đặc biệt khi là Lỗi).
function StatusCell({ statusKey, row }) {
  const label = BOOTH_CODE_STATUS_LABELS[statusKey] ?? statusKey ?? '—';
  const variant = BOOTH_CODE_STATUS_BADGE_VARIANT[statusKey] ?? 'default';
  const session = row?.session || null;
  const raw = (session && session.raw) || {};

  let detail = '';
  if (statusKey === 'error') {
    detail = statusErrorDetail(session);
    if (!detail) detail = 'Lượt chụp bị lỗi (không rõ nguyên nhân từ máy).';
  } else if (statusKey === 'missing_session') {
    detail = 'Mã đã dùng nhưng không tìm thấy lượt chụp liên kết.';
  } else if (statusKey === 'orphan') {
    detail = 'Lượt chụp không khớp mã nào (mã có thể đã bị xóa).';
  } else if (statusKey === 'revoked') {
    detail = raw.cancelled_by
      ? `Mã đã bị thu hồi bởi ${raw.cancelled_by}.`
      : 'Mã đã bị thu hồi.';
  } else if (statusKey === 'used') {
    detail = session?.is_test
      ? 'Lượt chụp test (không tính doanh thu).'
      : 'Đã dùng bình thường.';
  } else if (statusKey === 'unused') {
    detail = 'Mã chưa được sử dụng.';
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={variant}>{label}</Badge>
      {detail && (
        <span className="text-xs text-gray-500">{detail}</span>
      )}
    </div>
  );
}

// Thẻ trạng thái thu thập dữ liệu của 1 nguồn (Photobooth / Selfbooth).
function DataStatusCard({ item, active, onSelect }) {
  const hasData = (item?.codes ?? 0) + (item?.sessions ?? 0) > 0;
  const badge = !item?.connected
    ? { variant: 'danger', label: 'Chưa kết nối tài khoản' }
    : hasData
      ? { variant: 'success', label: 'Đã thu thập dữ liệu' }
      : { variant: 'warning', label: 'Đã kết nối, chưa có dữ liệu' };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border bg-white p-3 text-left shadow-sm transition ${
        active ? 'border-brand-600 ring-1 ring-brand-600' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">
          {BOOTH_SYSTEM_LABELS[item?.system] ?? item?.system}
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {item?.codes ?? 0} mã · {item?.sessions ?? 0} lượt chụp trong khoảng
        ngày
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {item?.last_synced_at
          ? `Đồng bộ gần nhất: ${formatDateTime(item.last_synced_at)}`
          : 'Chưa từng đồng bộ'}
        {item?.account ? ` · ${item.account}` : ''}
      </p>
      {!item?.connected && (
        <Link
          to={ROUTES.SETTINGS}
          className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
        >
          Cấu hình tài khoản trong Cài đặt →
        </Link>
      )}
    </button>
  );
}

export default function ShootCodes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const canSync = ['admin', 'manager', 'staff'].includes(user?.role);

  const [system, setSystem] = useState('photobooth');
  const [from, setFrom] = useState(toISODate(new Date()));
  const [to, setTo] = useState(toISODate(new Date()));

  const [summary, setSummary] = useState(null);
  const [codes, setCodes] = useState([]);

  const [statusFilters, setStatusFilters] = useState([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [dataStatus, setDataStatus] = useState(null);
  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  const rangeValid = from && to && from <= to;

  const load = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError('');
    try {
      const params = { from, to };
      const [sumRes, codesRes] = await Promise.all([
        boothService.summary(system, params),
        boothService.codes(system, params),
      ]);
      setSummary(sumRes?.data ?? null);
      setCodes(codesRes?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được dữ liệu.'));
    } finally {
      setLoading(false);
    }
  }, [system, from, to, rangeValid]);

  useEffect(() => {
    load();
  }, [load]);

  // Trạng thái thu thập dữ liệu của CẢ 2 nguồn (hiển thị ở banner trên).
  const loadDataStatus = useCallback(async () => {
    if (!rangeValid) return;
    try {
      const res = await boothService.dataStatus({ from, to });
      setDataStatus(res?.data ?? null);
    } catch {
      setDataStatus(null);
    }
  }, [from, to, rangeValid]);

  useEffect(() => {
    loadDataStatus();
  }, [loadDataStatus]);

  const handleSync = async () => {
    if (!rangeValid) return;
    setSyncing(true);
    try {
      const res = await boothService.sync(system, { from, to });
      const c = res?.data?.codes ?? {};
      const s = res?.data?.sessions ?? {};
      const rev = res?.data?.revenue ?? {};
      showToast(
        `Đồng bộ xong: mã +${c.inserted ?? 0} (cập nhật ${c.updated ?? 0}), ` +
          `lượt chụp +${s.inserted ?? 0} (cập nhật ${s.updated ?? 0}), ` +
          `doanh thu ${formatCurrency(rev.total ?? 0, '0đ')}` +
          (rev.days ? ` / ${rev.days} ngày` : '') +
          '.',
      );
      if (rev.error) {
        showToast(`Chưa ghi doanh thu Dashboard: ${rev.error}`, 'error');
      }
      await load();
      await loadDataStatus();
    } catch (err) {
      showToast(getErrorMessage(err, 'Đồng bộ thất bại.'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const baseRows = useMemo(
    () =>
      codes.map((c) => ({
        key: `code-${c.id}`,
        id: c.id,
        ...c,
        _status: c.derived_status || 'unused',
        _search: [
          c.code,
          c.note,
          c.package_name,
          c.machine_name,
          c.package_id,
          c.review?.staff_reason,
          c.review?.staff_note,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      })),
    [codes],
  );

  const statusCounts = useMemo(() => {
    const counts = { '': baseRows.length };
    baseRows.forEach((r) => {
      counts[r._status] = (counts[r._status] || 0) + 1;
    });
    return counts;
  }, [baseRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseRows.filter((r) => {
      if (statusFilters.length && !statusFilters.includes(r._status)) {
        return false;
      }
      if (q && !r._search.includes(q)) return false;
      return true;
    });
  }, [baseRows, statusFilters, search]);

  const counts = summary?.counts ?? {};
  const codeRevenue = summary?.revenue ?? {};

  const openDetail = useCallback((row) => setDetailRow(row), []);

  const codesColumns = useMemo(
    () => [
      {
        key: 'code',
        label: 'Mã',
        render: (_v, row) => (
          <span className="font-mono text-xs font-medium text-gray-900">
            {row.code || '—'}
          </span>
        ),
      },
      {
        key: 'type_kind',
        label: 'Loại / Gói',
        render: (_v, row) => {
          if (system === 'photobooth') {
            return PHOTOBOOTH_CODE_TYPE_LABELS[row.type] ?? row.type ?? '—';
          }
          return row.package_name || row.code_kind || '—';
        },
      },
      {
        key: 'machine_name',
        label: 'Phòng / Máy',
        render: (v) => v || '—',
      },
      {
        key: 'value',
        label: 'Giá trị',
        render: (v) => (v == null ? '—' : formatCurrency(v)),
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: (_v, row) => (
          <StatusCell statusKey={row._status} row={row} />
        ),
      },
      {
        key: 'created',
        label: 'Ngày tạo',
        render: (_v, row) =>
          row.external_created_at ? formatDateTime(row.external_created_at) : '—',
      },
      {
        key: 'review',
        label: 'Lý do / ghi chú',
        render: (_v, row) => {
          const r = row.review;
          if (!r || (!r.staff_reason && !r.staff_note)) return '—';
          const parts = [r.staff_reason, r.staff_note].filter(Boolean);
          return (
            <span className="text-xs text-gray-600">{parts.join(' — ')}</span>
          );
        },
      },
      {
        key: 'actions',
        label: 'Thao tác',
        render: (_v, row) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openDetail(row);
            }}
          >
            Chi tiết
          </Button>
        ),
      },
    ],
    [system, openDetail],
  );

  const systemLabel = BOOTH_SYSTEM_LABELS[system] ?? system;

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Mã chụp</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              variant="secondary"
              onClick={() => navigate(ROUTES.SETTINGS)}
            >
              Tài khoản API
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>+ Tạo mã chụp</Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select
              label="Hệ thống"
              name="system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              options={BOOTH_SYSTEM_OPTIONS}
            />
          </div>
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
          <Button
            variant="secondary"
            onClick={() => {
              const today = toISODate(new Date());
              setFrom(today);
              setTo(today);
            }}
          >
            Hôm nay
          </Button>
          <Button
            onClick={handleSync}
            loading={syncing}
            disabled={!rangeValid || !canSync}
          >
            Đồng bộ
          </Button>
          <Button
            variant="secondary"
            onClick={load}
            loading={loading}
          >
            Tải lại
          </Button>
        </div>
        {!rangeValid && (
          <p className="mt-2 text-xs text-red-600">
            Khoảng ngày không hợp lệ (Từ ngày phải trước hoặc bằng Đến ngày).
          </p>
        )}
        {!canSync && (
          <p className="mt-2 text-xs text-amber-600">
            Bạn không có quyền đồng bộ dữ liệu.
          </p>
        )}
      </div>

      {/* Banner trạng thái thu thập dữ liệu của 2 nguồn */}
      {dataStatus && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BOOTH_SYSTEM_OPTIONS.map((opt) => (
            <DataStatusCard
              key={opt.value}
              item={dataStatus.systems?.[opt.value]}
              active={system === opt.value}
              onSelect={() => setSystem(opt.value)}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={load}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
          {' — '}
          <SettingsGuide message="kiểm tra tài khoản hệ máy tại" />
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Tổng mã"
              value={counts.codes ?? 0}
              icon={<span aria-hidden="true">🎟️</span>}
              variant="info"
            />
            <StatCard
              title="Đã dùng"
              value={counts.codes_used ?? 0}
              icon={<span aria-hidden="true">✅</span>}
              variant="success"
            />
            <StatCard
              title="Chưa dùng"
              value={counts.codes_unused ?? 0}
              icon={<span aria-hidden="true">⏳</span>}
              variant="warning"
            />
            <StatCard
              title="Lỗi"
              value={counts.codes_error ?? 0}
              icon={<span aria-hidden="true">⛔</span>}
              variant={(counts.codes_error ?? 0) > 0 ? 'danger' : 'default'}
            />
            <StatCard
              title="Thiếu lượt chụp"
              value={counts.codes_missing_session ?? 0}
              icon={<span aria-hidden="true">⚠️</span>}
              variant={
                (counts.codes_missing_session ?? 0) > 0 ? 'warning' : 'default'
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap gap-1">
              {BOOTH_CODE_STATUS_FILTER_OPTIONS.map((opt) => {
                const active = opt.value
                  ? statusFilters.includes(opt.value)
                  : statusFilters.length === 0;
                const count = statusCounts[opt.value] ?? 0;
                return (
                  <button
                    key={opt.value || 'all'}
                    type="button"
                    title={
                      opt.value
                        ? 'Bấm để bật/tắt lọc theo trạng thái này'
                        : 'Bỏ lọc, xem tất cả trạng thái'
                    }
                    onClick={() =>
                      setStatusFilters((prev) => {
                        if (!opt.value) return [];
                        return prev.includes(opt.value)
                          ? prev.filter((v) => v !== opt.value)
                          : [...prev, opt.value];
                      })
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                    <span className="ml-1 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="w-56">
              <Input
                name="search"
                placeholder="Tìm mã / gói / ghi chú..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            Đang xem <strong>{systemLabel}</strong> — doanh thu theo mã:{' '}
            {formatCurrency(codeRevenue.codes_value_total ?? 0)} · đã thu:{' '}
            {formatCurrency(codeRevenue.paid_amount_total ?? 0)}.
          </div>

          <Table
            columns={codesColumns}
            data={filteredRows}
            loading={loading}
            emptyText="Chưa có mã chụp. Bấm Đồng bộ để tải từ API."
            rowKey="key"
            onRowClick={openDetail}
          />
        </div>

      <CreateCodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        system={system}
        onCreated={() => {
          showToast('Đã tạo mã chụp.');
          load();
        }}
      />

      <CodeDetailModal
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        system={system}
        row={detailRow}
        onSaved={() => {
          showToast('Đã lưu ghi chú mã chụp.');
          load();
        }}
      />
    </div>
  );
}
