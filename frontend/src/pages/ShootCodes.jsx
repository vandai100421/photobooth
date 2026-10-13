import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/shared/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import Toast from '../components/ui/Toast';
import BoothAccountModal from '../components/booth/BoothAccountModal';
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
  BOOTH_LEDGER_FILTER_OPTIONS,
  BOOTH_REVENUE_SUMMARY_LABELS,
  PHOTOBOOTH_CODE_TYPE_LABELS,
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

function formatDay(value) {
  if (!value || typeof value !== 'string') return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
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

const TABS = [
  { value: 'codes', label: 'Mã chụp' },
  { value: 'ledger', label: 'Sổ doanh thu' },
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'portal', label: 'Tổng hợp Portal' },
  { value: 'manual', label: 'Tiền nhập tay' },
];

export default function ShootCodes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canSync = ['admin', 'manager'].includes(user?.role);
  const canDeleteRecon = ['admin', 'manager'].includes(user?.role);

  const [system, setSystem] = useState('photobooth');
  const [from, setFrom] = useState(toISODate(new Date()));
  const [to, setTo] = useState(toISODate(new Date()));
  const [tab, setTab] = useState('codes');

  const [summary, setSummary] = useState(null);
  const [codes, setCodes] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);

  const [statusFilters, setStatusFilters] = useState([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const [revenue, setRevenue] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState('');

  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [ledgerStatusFilters, setLedgerStatusFilters] = useState([]);
  const [ledgerSearch, setLedgerSearch] = useState('');

  const [accountOpen, setAccountOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  const [reconDate, setReconDate] = useState(toISODate(new Date()));
  const [machineCash, setMachineCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [reconNote, setReconNote] = useState('');
  const [savingRecon, setSavingRecon] = useState(false);
  const [reconError, setReconError] = useState('');

  const rangeValid = from && to && from <= to;

  const load = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError('');
    try {
      const params = { from, to };
      const [sumRes, codesRes, reconRes] = await Promise.all([
        boothService.summary(system, params),
        boothService.codes(system, params),
        boothService.reconciliations(system, params),
      ]);
      setSummary(sumRes?.data ?? null);
      setCodes(codesRes?.data ?? []);
      setReconciliations(reconRes?.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được dữ liệu.'));
    } finally {
      setLoading(false);
    }
  }, [system, from, to, rangeValid]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRevenue = useCallback(async () => {
    if (!rangeValid) return;
    setRevenueLoading(true);
    setRevenueError('');
    try {
      const res = await boothService.revenue(system, { from, to });
      setRevenue(res?.data ?? null);
    } catch (err) {
      setRevenue(null);
      setRevenueError(getErrorMessage(err, 'Không tải được doanh thu.'));
    } finally {
      setRevenueLoading(false);
    }
  }, [system, from, to, rangeValid]);

  useEffect(() => {
    if (tab === 'revenue') loadRevenue();
  }, [tab, loadRevenue]);

  const loadLedger = useCallback(async () => {
    if (!rangeValid) return;
    setLedgerLoading(true);
    setLedgerError('');
    try {
      const res = await boothService.ledger(system, { from, to });
      setLedger(res?.data ?? null);
    } catch (err) {
      setLedger(null);
      setLedgerError(getErrorMessage(err, 'Không tải được sổ doanh thu.'));
    } finally {
      setLedgerLoading(false);
    }
  }, [system, from, to, rangeValid]);

  useEffect(() => {
    if (tab === 'ledger') loadLedger();
  }, [tab, loadLedger]);

  const handleSync = async () => {
    if (!rangeValid) return;
    setSyncing(true);
    try {
      const res = await boothService.sync(system, { from, to });
      const c = res?.data?.codes ?? {};
      const s = res?.data?.sessions ?? {};
      showToast(
        `Đồng bộ xong: mã +${c.inserted ?? 0} (cập nhật ${c.updated ?? 0}), ` +
          `lượt chụp +${s.inserted ?? 0} (cập nhật ${s.updated ?? 0}).`,
      );
      await load();
      if (tab === 'revenue') await loadRevenue();
      else if (tab === 'ledger') await loadLedger();
    } catch (err) {
      showToast(getErrorMessage(err, 'Đồng bộ thất bại.'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveRecon = async () => {
    setReconError('');
    if (!reconDate) {
      setReconError('Vui lòng chọn ngày.');
      return;
    }
    const machine = Number(machineCash) || 0;
    const actual = Number(actualCash) || 0;
    if (machine < 0 || actual < 0) {
      setReconError('Số tiền không hợp lệ.');
      return;
    }
    setSavingRecon(true);
    try {
      await boothService.saveReconciliation(system, {
        reconciliation_date: reconDate,
        machine_cash: machine,
        actual_cash: actual,
        note: reconNote || null,
      });
      showToast('Đã lưu tiền đối chiếu.');
      setMachineCash('');
      setActualCash('');
      setReconNote('');
      await load();
    } catch (err) {
      setReconError(getErrorMessage(err, 'Không lưu được đối chiếu.'));
    } finally {
      setSavingRecon(false);
    }
  };

  const handleDeleteRecon = async (row) => {
    if (!window.confirm(`Xoá đối chiếu ngày ${formatDay(row.reconciliation_date)}?`)) {
      return;
    }
    try {
      await boothService.removeReconciliation(system, row.id);
      showToast('Đã xoá đối chiếu.');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không xoá được đối chiếu.'), 'error');
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

  const revenueSummary = revenue?.summary ?? {};
  const revenueUses = revenue?.uses ?? [];
  const revenueSummaryKeys = Object.keys(revenueSummary).filter(
    (k) => BOOTH_REVENUE_SUMMARY_LABELS[k],
  );

  const openDetail = useCallback((row) => setDetailRow(row), []);

  const ledgerRows = ledger?.rows ?? [];
  const ledgerTotals = ledger?.totals ?? {};

  const ledgerFilteredRows = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return ledgerRows.filter((r) => {
      if (
        ledgerStatusFilters.length &&
        !ledgerStatusFilters.includes(r.derived_status)
      ) {
        return false;
      }
      if (q) {
        const hay = [
          r.code,
          r.package_name,
          r.machine_name,
          r.review?.staff_reason,
          r.review?.staff_note,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ledgerRows, ledgerStatusFilters, ledgerSearch]);

  const ledgerStatusCounts = useMemo(() => {
    const counts = { '': ledgerRows.length };
    ledgerRows.forEach((r) => {
      counts[r.derived_status] = (counts[r.derived_status] || 0) + 1;
    });
    return counts;
  }, [ledgerRows]);

  const ledgerColumns = useMemo(
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
          if (row.row_type === 'orphan_session') {
            return 'Lượt chụp (mã đã xóa)';
          }
          if (system === 'photobooth') {
            return PHOTOBOOTH_CODE_TYPE_LABELS[row.type] ?? row.type ?? '—';
          }
          return row.package_name || row.code_kind || '—';
        },
      },
      { key: 'machine_name', label: 'Phòng / Máy', render: (v) => v || '—' },
      {
        key: 'value',
        label: 'Giá trị mã',
        render: (v, row) =>
          row.row_type === 'orphan_session' || v == null
            ? '—'
            : formatCurrency(v),
      },
      {
        key: 'paid_amount',
        label: 'Đã thu',
        render: (v, row) =>
          row.row_type === 'orphan_session' || v == null
            ? '—'
            : formatCurrency(v),
      },
      {
        key: 'revenue',
        label: 'Doanh thu lượt',
        render: (v, row) => {
          if (!v) return '—';
          return (
            <span
              className={
                row.is_test ? 'text-gray-400' : 'font-medium text-gray-800'
              }
            >
              {formatCurrency(v)}
              {row.is_test ? ' (test)' : ''}
            </span>
          );
        },
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: (_v, row) => (
          <StatusCell statusKey={row.derived_status} row={row} />
        ),
      },
      {
        key: 'used_at',
        label: 'Thời điểm',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        key: 'note',
        label: 'Ghi chú',
        render: (_v, row) => {
          const r = row.review;
          if (!r || (!r.staff_reason && !r.staff_note)) return '—';
          return (
            <span className="text-xs text-gray-600">
              {[r.staff_reason, r.staff_note].filter(Boolean).join(' — ')}
            </span>
          );
        },
      },
    ],
    [system],
  );

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

  const revenueColumns = useMemo(
    () => [
      {
        key: 'code',
        label: 'Mã',
        render: (v) => (
          <span className="font-mono text-xs font-medium text-gray-900">
            {v || '—'}
          </span>
        ),
      },
      { key: 'package_name', label: 'Gói', render: (v) => v || '—' },
      { key: 'room_name', label: 'Phòng', render: (v) => v || '—' },
      { key: 'device_name', label: 'Thiết bị', render: (v) => v || '—' },
      {
        key: 'price_vnd',
        label: 'Số tiền',
        render: (v) => (v == null ? '—' : formatCurrency(v)),
      },
      {
        key: 'used_at',
        label: 'Thời điểm',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
    ],
    [],
  );

  const reconColumns = useMemo(
    () => [
      {
        key: 'reconciliation_date',
        label: 'Ngày',
        render: (v) => formatDay(v),
      },
      {
        key: 'machine_cash',
        label: 'Máy ghi (đ)',
        render: (v) => formatCurrency(v),
      },
      {
        key: 'actual_cash',
        label: 'Thực nhận (đ)',
        render: (v) => formatCurrency(v),
      },
      {
        key: 'difference',
        label: 'Chênh lệch',
        render: (_v, row) => {
          const diff = (Number(row.actual_cash) || 0) - (Number(row.machine_cash) || 0);
          return (
            <span
              className={
                diff === 0
                  ? 'text-gray-600'
                  : diff > 0
                    ? 'font-medium text-green-600'
                    : 'font-medium text-red-600'
              }
            >
              {formatCurrency(diff)}
            </span>
          );
        },
      },
      { key: 'note', label: 'Ghi chú', render: (v) => v || '—' },
      ...(canDeleteRecon
        ? [
            {
              key: 'actions',
              label: 'Thao tác',
              render: (_v, row) => (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteRecon(row)}
                >
                  Xoá
                </Button>
              ),
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canDeleteRecon],
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
            <Button variant="secondary" onClick={() => setAccountOpen(true)}>
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
            onClick={() => {
              if (tab === 'revenue') loadRevenue();
              else if (tab === 'ledger') loadLedger();
              else load();
            }}
            loading={loading || revenueLoading || ledgerLoading}
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
            Chỉ quản trị viên/quản lý mới được đồng bộ dữ liệu.
          </p>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.value
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && tab !== 'revenue' && tab !== 'ledger' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={load}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      {tab === 'codes' && (
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
      )}

      {tab === 'ledger' && (
        <div className="space-y-4">
          {ledgerError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {ledgerError}
              <button
                type="button"
                onClick={loadLedger}
                className="ml-2 underline hover:text-amber-900"
              >
                Thử lại
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Doanh thu lượt chụp"
              value={formatCurrency(ledgerTotals.session_revenue_total ?? 0)}
              icon={<span aria-hidden="true">💵</span>}
              variant="success"
            />
            <StatCard
              title="Giá trị mã chưa dùng"
              value={formatCurrency(ledgerTotals.value_unused ?? 0)}
              icon={<span aria-hidden="true">⏳</span>}
              variant="warning"
            />
            <StatCard
              title="Tiền đã thu"
              value={formatCurrency(ledgerTotals.paid_amount_total ?? 0)}
              icon={<span aria-hidden="true">🧾</span>}
              variant="info"
            />
            <StatCard
              title="Lượt dùng mã đã xóa"
              value={ledgerTotals.orphan_count ?? 0}
              icon={<span aria-hidden="true">🗑️</span>}
              variant={
                (ledgerTotals.orphan_count ?? 0) > 0 ? 'danger' : 'default'
              }
            />
            <StatCard
              title="Doanh thu mã đã xóa"
              value={formatCurrency(ledgerTotals.orphan_revenue ?? 0)}
              icon={<span aria-hidden="true">⚠️</span>}
              variant={
                (ledgerTotals.orphan_revenue ?? 0) > 0 ? 'danger' : 'default'
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap gap-1">
              {BOOTH_LEDGER_FILTER_OPTIONS.map((opt) => {
                const active = opt.value
                  ? ledgerStatusFilters.includes(opt.value)
                  : ledgerStatusFilters.length === 0;
                const count = ledgerStatusCounts[opt.value] ?? 0;
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
                      setLedgerStatusFilters((prev) => {
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
                name="ledgerSearch"
                placeholder="Tìm mã / gói / ghi chú..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <strong>{systemLabel}</strong> — {ledgerTotals.codes_total ?? 0} mã (
            {ledgerTotals.codes_used ?? 0} đã dùng,{' '}
            {ledgerTotals.codes_unused ?? 0} chưa dùng) ·{' '}
            {ledgerTotals.orphan_count ?? 0} lượt dùng mã đã xóa · tổng giá trị{' '}
            {formatCurrency(ledgerTotals.value_total ?? 0)}.
          </div>

          <Table
            columns={ledgerColumns}
            data={ledgerFilteredRows}
            loading={ledgerLoading}
            emptyText="Chưa có dữ liệu. Bấm Đồng bộ để tải từ API."
            rowKey="key"
          />
        </div>
      )}

      {tab === 'revenue' && (
        <div className="space-y-4">
          {revenueError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {revenueError}
              <button
                type="button"
                onClick={loadRevenue}
                className="ml-2 underline hover:text-amber-900"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {revenueSummaryKeys.map((key) => {
                  const value = revenueSummary[key] ?? 0;
                  return (
                    <StatCard
                      key={key}
                      title={BOOTH_REVENUE_SUMMARY_LABELS[key]}
                      value={
                        key.endsWith('_vnd')
                          ? formatCurrency(value)
                          : Number(value).toLocaleString('vi-VN')
                      }
                      variant={key.endsWith('_vnd') ? 'success' : 'info'}
                    />
                  );
                })}
              </div>

              <div className="text-sm text-gray-500">
                Doanh thu trực tiếp từ API <strong>{systemLabel}</strong> theo
                khoảng ngày đã chọn.
              </div>

              <Table
                columns={revenueColumns}
                data={revenueUses}
                loading={revenueLoading}
                emptyText="Chưa có lượt dùng nào trong khoảng ngày."
                rowKey={(row) => row.id ?? row.code ?? row.used_at}
              />
            </>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">
              Nhập tiền đối chiếu ({systemLabel})
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input
                label="Ngày"
                name="reconciliation_date"
                type="date"
                value={reconDate}
                onChange={(e) => setReconDate(e.target.value)}
              />
              <Input
                label="Tiền mặt máy ghi (đ)"
                name="machine_cash"
                type="number"
                min="0"
                step="1000"
                placeholder="VD: 1200000"
                value={machineCash}
                onChange={(e) => setMachineCash(e.target.value)}
              />
              <Input
                label="Tiền mặt thực nhận (đ)"
                name="actual_cash"
                type="number"
                min="0"
                step="1000"
                placeholder="VD: 1200000"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
              />
              <div className="flex items-end">
                <Button onClick={handleSaveRecon} loading={savingRecon}>
                  Lưu
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <Input
                label="Ghi chú"
                name="recon_note"
                placeholder="VD: Chênh 20k do hoàn tiền khách"
                value={reconNote}
                onChange={(e) => setReconNote(e.target.value)}
              />
            </div>
            {reconError && (
              <p className="mt-2 text-xs text-red-600">{reconError}</p>
            )}
          </div>

          <Table
            columns={reconColumns}
            data={reconciliations}
            loading={loading}
            emptyText="Chưa có dữ liệu đối chiếu"
            rowKey="id"
          />
        </div>
      )}

      <BoothAccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSaved={load}
      />

      <CreateCodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        system={system}
        onCreated={() => {
          showToast('Đã tạo mã chụp.');
          load();
          if (tab === 'revenue') loadRevenue();
          else if (tab === 'ledger') loadLedger();
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
