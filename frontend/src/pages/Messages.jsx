import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePagination } from '../hooks/usePagination';
import messageService from '../services/messageService';
import templateService from '../services/templateService';
import customerService from '../services/customerService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Toast from '../components/ui/Toast';
import Spinner from '../components/ui/Spinner';
import StatCard from '../components/shared/StatCard';
import { formatDateTime } from '../utils/formatDate';
import {
  ROLES,
  MESSAGE_CHANNELS,
  MESSAGE_CHANNEL_OPTIONS,
  MESSAGE_CHANNEL_BADGE_VARIANT,
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_STATUS_OPTIONS,
  MESSAGE_STATUS_BADGE_VARIANT,
  MESSAGE_STATUS_LABELS,
  TEMPLATE_OCCASION_OPTIONS,
  TEMPLATE_OCCASION_BADGE_VARIANT,
  TEMPLATE_OCCASION_LABELS,
  TEMPLATE_VARIABLES,
  TEMPLATE_SAMPLE_VARS,
} from '../utils/constants';

const SEARCH_DEBOUNCE_MS = 400;
const CONTENT_TRUNCATE = 50;

const CHANNEL_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả kênh' },
  ...MESSAGE_CHANNEL_OPTIONS,
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...MESSAGE_STATUS_OPTIONS,
];

const TABS = [
  { value: 'logs', label: 'Tin nhắn' },
  { value: 'templates', label: 'Mẫu tin nhắn' },
  { value: 'stats', label: 'Thống kê' },
];

const EMPTY_SEND_FORM = {
  customer_id: '',
  template_id: '',
  channel: '',
  voucher_id: '',
  scheduled_at: '',
};

const EMPTY_TEMPLATE_FORM = {
  name: '',
  occasion: 'birthday',
  channel: MESSAGE_CHANNELS.ZALO,
  subject: '',
  body: '',
  is_active: 'true',
};

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

function truncate(text, max = CONTENT_TRUNCATE) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function renderTemplate(text, vars = TEMPLATE_SAMPLE_VARS) {
  if (!text) return '';
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    vars[key] != null ? String(vars[key]) : match,
  );
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function getDefaultStatsRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: isoDate(from), to: isoDate(now) };
}

function CustomerPicker({
  value,
  onChange,
  label,
  placeholder = 'Tìm khách hàng theo tên / SĐT...',
  error,
  disabled = false,
}) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (value && !selected) {
      let cancelled = false;
      customerService
        .detail(value)
        .then((res) => {
          if (!cancelled) setSelected(res?.data ?? null);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!value && selected) setSelected(null);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await customerService.list({ search: q, limit: 20 });
        setResults(res?.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePick = (c) => {
    setSelected(c);
    onChange?.(c.id, c);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleClear = () => {
    setSelected(null);
    onChange?.('', null);
    setQuery('');
    setResults([]);
  };

  const fieldClass = `block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 ${
    error
      ? 'border-red-400 focus:ring-red-500'
      : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
  }`;

  return (
    <div className="w-full" ref={wrapRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      {selected ? (
        <div
          className={`flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm ${
            error ? 'border-red-400' : 'border-gray-300'
          }`}
        >
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">
              {selected.full_name}
            </div>
            <div className="truncate text-xs text-gray-500">
              {selected.phone}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Bỏ chọn"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      ) : disabled ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
          —
        </div>
      ) : (
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={fieldClass}
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                  <Spinner size="sm" /> Đang tìm...
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {query.trim()
                    ? 'Không tìm thấy khách hàng.'
                    : 'Nhập để tìm kiếm khách hàng.'}
                </div>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handlePick(c)}
                    className="block w-full px-3 py-2 text-left text-sm transition hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-800">
                      {c.full_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Textarea({
  label,
  error,
  id,
  className = '',
  rows = 6,
  ...props
}) {
  const fieldId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:ring-red-500'
            : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TabBar({ tab, setTab }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setTab(t.value)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === t.value
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LogsTab() {
  const { user } = useAuth();
  const { page, limit, setPage, resetPage } = usePagination();

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const [sendOpen, setSendOpen] = useState(false);
  const [detailLog, setDetailLog] = useState(null);

  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const prevSearchRef = useRef('');
  useEffect(() => {
    const trimmed = searchInput.trim();
    const timer = setTimeout(() => {
      if (trimmed !== prevSearchRef.current) {
        prevSearchRef.current = trimmed;
        resetPage();
        setDebouncedSearch(trimmed);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, resetPage]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit, sort: 'created_at:desc' };
      if (debouncedSearch) params.search = debouncedSearch;
      if (channelFilter) params.channel = channelFilter;
      if (statusFilter) params.status = statusFilter;
      if (fromFilter) params.from = fromFilter;
      if (toFilter) params.to = toFilter;
      const res = await messageService.logs(params);
      setLogs(res?.data ?? []);
      setPagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách tin nhắn.'));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    channelFilter,
    statusFilter,
    fromFilter,
    toFilter,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleChannelFilterChange = (e) => {
    setChannelFilter(e.target.value);
    resetPage();
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    resetPage();
  };

  const columns = useMemo(() => {
    return [
      {
        key: 'customer',
        label: 'Khách hàng',
        render: (_v, row) => (
          <span className="font-medium text-gray-900">
            {row.customer?.full_name ||
              row.customer_name ||
              row.customer_id ||
              '—'}
          </span>
        ),
      },
      {
        key: 'phone',
        label: 'SĐT',
        render: (_v, row) =>
          row.customer?.phone || row.customer_phone || '—',
      },
      {
        key: 'channel',
        label: 'Kênh',
        render: (v) => (
          <Badge variant={MESSAGE_CHANNEL_BADGE_VARIANT[v] ?? 'default'}>
            {MESSAGE_CHANNEL_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: (v) => (
          <Badge variant={MESSAGE_STATUS_BADGE_VARIANT[v] ?? 'default'}>
            {MESSAGE_STATUS_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'content_sent',
        label: 'Nội dung',
        render: (v) => (
          <span
            title={v || ''}
            className="block max-w-xs truncate text-gray-600"
          >
            {truncate(v) || '—'}
          </span>
        ),
      },
      {
        key: 'scheduled_at',
        label: 'Lên lịch',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        key: 'sent_at',
        label: 'Đã gửi',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        key: 'error_message',
        label: 'Lỗi',
        render: (v) =>
          v ? (
            <span
              title={v}
              className="block max-w-[10rem] truncate text-red-600"
            >
              {truncate(v, 30)}
            </span>
          ) : (
            '—'
          ),
      },
      {
        key: 'actions',
        label: 'Hành động',
        render: (_v, row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailLog(row)}
          >
            Xem chi tiết
          </Button>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-700">
          Lịch sử gửi
        </h2>
        <Button onClick={() => setSendOpen(true)}>
          <span aria-hidden="true">+</span> Gửi tin nhắn
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          name="search"
          type="search"
          placeholder="Tìm theo tên, SĐT..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          name="channelFilter"
          options={CHANNEL_FILTER_OPTIONS}
          value={channelFilter}
          onChange={handleChannelFilterChange}
        />
        <Select
          name="statusFilter"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={handleStatusFilterChange}
        />
        <Input
          name="fromFilter"
          type="date"
          value={fromFilter}
          onChange={(e) => {
            setFromFilter(e.target.value);
            resetPage();
          }}
        />
        <Input
          name="toFilter"
          type="date"
          value={toFilter}
          onChange={(e) => {
            setToFilter(e.target.value);
            resetPage();
          }}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchLogs}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={logs}
        loading={loading}
        emptyText="Chưa có tin nhắn nào"
        rowKey="id"
      />

      {!loading && logs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Tổng:{' '}
            <strong className="text-gray-700">{pagination.total}</strong>{' '}
            tin nhắn
          </span>
          <Pagination
            page={page}
            totalPages={pagination.totalPages ?? 1}
            onPageChange={setPage}
          />
        </div>
      )}

      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={() => {
          setSendOpen(false);
          fetchLogs();
          showToast('Đã gửi tin nhắn.');
        }}
        onScheduled={() => {
          setSendOpen(false);
          fetchLogs();
          showToast('Đã lên lịch gửi tin nhắn.');
        }}
        canManage={!!user}
      />

      <Modal
        open={Boolean(detailLog)}
        onClose={() => setDetailLog(null)}
        title="Chi tiết tin nhắn"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setDetailLog(null)}>
            Đóng
          </Button>
        }
      >
        {detailLog && <LogDetail log={detailLog} />}
      </Modal>
    </div>
  );
}

function LogDetail({ log }) {
  const rows = [
    { label: 'Khách hàng', value: log.customer?.full_name || log.customer_name || log.customer_id },
    { label: 'SĐT', value: log.customer?.phone || log.customer_phone },
    { label: 'Kênh', value: MESSAGE_CHANNEL_LABELS[log.channel] ?? log.channel },
    { label: 'Trạng thái', value: MESSAGE_STATUS_LABELS[log.status] ?? log.status },
    { label: 'Lên lịch', value: log.scheduled_at ? formatDateTime(log.scheduled_at) : '—' },
    { label: 'Đã gửi', value: log.sent_at ? formatDateTime(log.sent_at) : '—' },
    { label: 'Tạo lúc', value: log.created_at ? formatDateTime(log.created_at) : '—' },
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <dt className="text-xs font-medium text-gray-500">
              {r.label}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800">
              {r.value || '—'}
            </dd>
          </div>
        ))}
      </dl>
      {log.error_message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">Lỗi:</p>
          <p className="mt-1 whitespace-pre-wrap">{log.error_message}</p>
        </div>
      )}
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
        <p className="text-xs font-medium text-gray-500">Nội dung gửi</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
          {log.content_sent || '—'}
        </p>
      </div>
    </div>
  );
}

function SendModal({
  open,
  onClose,
  onSent,
  onScheduled,
  canManage,
}) {
  const [form, setForm] = useState(EMPTY_SEND_FORM);
  const [customer, setCustomer] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [mode, setMode] = useState('now');

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [vouchers, setVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await templateService.list({
        page: 1,
        limit: 100,
        is_active: true,
      });
      setTemplates(res?.data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const fetchVouchers = useCallback(async (customerId) => {
    if (!customerId) {
      setVouchers([]);
      return;
    }
    setVouchersLoading(true);
    try {
      const res = await customerService.listVouchers(customerId, {
        page: 1,
        limit: 50,
        status: 'issued',
      });
      setVouchers(res?.data ?? []);
    } catch {
      setVouchers([]);
    } finally {
      setVouchersLoading(false);
    }
  }, []);

  const handleCustomerChange = (id, c) => {
    setCustomer(c);
    setForm((prev) => ({
      ...prev,
      customer_id: id,
      voucher_id: '',
    }));
    if (errors.customer_id) {
      setErrors((prev) => ({ ...prev, customer_id: undefined }));
    }
    fetchVouchers(id);
  };

  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    const tpl = templates.find((t) => t.id === templateId);
    setForm((prev) => ({
      ...prev,
      template_id: templateId,
      channel: tpl ? tpl.channel : prev.channel,
    }));
    if (errors.template_id) {
      setErrors((prev) => ({ ...prev, template_id: undefined }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const closeModal = () => {
    setForm(EMPTY_SEND_FORM);
    setCustomer(null);
    setErrors({});
    setSubmitError('');
    setMode('now');
    setVouchers([]);
    onClose?.();
  };

  const validate = (submitMode) => {
    const next = {};
    if (!form.customer_id) next.customer_id = 'Vui lòng chọn khách hàng';
    if (!form.template_id) next.template_id = 'Vui lòng chọn mẫu tin nhắn';
    if (submitMode === 'schedule') {
      if (!form.scheduled_at) {
        next.scheduled_at = 'Vui lòng chọn thời gian gửi';
      } else if (new Date(form.scheduled_at) <= new Date()) {
        next.scheduled_at = 'Thời gian gửi phải sau hiện tại';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => {
    const payload = {
      customer_id: form.customer_id,
      template_id: form.template_id,
    };
    if (form.channel) payload.channel = form.channel;
    if (form.voucher_id) payload.voucher_id = form.voucher_id;
    return payload;
  };

  const handleSubmit = async (submitMode) => {
    setSubmitError('');
    setMode(submitMode);
    const ok = validate(submitMode);
    if (!ok) return;
    setSubmitting(true);
    try {
      if (submitMode === 'now') {
        await messageService.sendNow(buildPayload());
        onSent?.();
      } else {
        const payload = {
          ...buildPayload(),
          scheduled_at: new Date(form.scheduled_at).toISOString(),
        };
        await messageService.schedule(payload);
        onScheduled?.();
      }
    } catch (err) {
      setSubmitError(
        getErrorMessage(err, 'Không thể gửi tin nhắn.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTemplate = templates.find(
    (t) => t.id === form.template_id,
  );

  const voucherOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Không kèm voucher' }];
    if (!vouchersLoading) {
      vouchers.forEach((cv) => {
        const code = cv.voucher?.code || cv.voucher_code || cv.code;
        const name = cv.voucher?.name || cv.voucher_name;
        opts.push({
          value: cv.voucher_id || cv.id,
          label: name ? `${code || name} — ${name}` : code || cv.id,
        });
      });
    }
    return opts;
  }, [vouchers, vouchersLoading]);

  const previewBody = selectedTemplate
    ? renderTemplate(selectedTemplate.body)
    : '';

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Gửi tin nhắn"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={closeModal}>
            Hủy
          </Button>
          {mode === 'schedule' ? (
            <Button
              loading={submitting}
              onClick={() => handleSubmit('schedule')}
            >
              Lên lịch gửi
            </Button>
          ) : (
            <Button
              loading={submitting}
              onClick={() => handleSubmit('now')}
            >
              Gửi ngay
            </Button>
          )}
        </>
      }
    >
      {submitError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CustomerPicker
            label="Khách hàng"
            value={form.customer_id}
            onChange={handleCustomerChange}
            error={errors.customer_id}
          />
        </div>

        <Select
          label="Mẫu tin nhắn"
          name="template_id"
          options={[
            { value: '', label: templatesLoading ? 'Đang tải...' : '— Chọn mẫu —' },
            ...templates.map((t) => ({
              value: t.id,
              label: `${t.name} (${MESSAGE_CHANNEL_LABELS[t.channel] ?? t.channel})`,
            })),
          ]}
          value={form.template_id}
          onChange={handleTemplateChange}
          error={errors.template_id}
          disabled={!canManage}
        />

        <Select
          label="Kênh"
          name="channel"
          options={MESSAGE_CHANNEL_OPTIONS}
          value={form.channel}
          onChange={handleChange}
        />

        <Select
          label="Voucher (tùy chọn)"
          name="voucher_id"
          options={voucherOptions}
          value={form.voucher_id}
          onChange={handleChange}
          disabled={!form.customer_id}
        />

        <div className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'now' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('now')}
              type="button"
            >
              Gửi ngay
            </Button>
            <Button
              variant={mode === 'schedule' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode('schedule')}
              type="button"
            >
              Lên lịch
            </Button>
          </div>
        </div>

        {mode === 'schedule' && (
          <div className="sm:col-span-2">
            <Input
              label="Thời gian gửi"
              name="scheduled_at"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={handleChange}
              error={errors.scheduled_at}
            />
          </div>
        )}

        {selectedTemplate && (
          <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-500">
              Xem trước nội dung
            </p>
            {selectedTemplate.subject && (
              <p className="mt-1 text-sm font-medium text-gray-800">
                Chủ đề: {renderTemplate(selectedTemplate.subject)}
              </p>
            )}
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
              {previewBody || '(trống)'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TemplatesTab() {
  const { user } = useAuth();
  const { page, limit, setPage, resetPage } = usePagination();

  const isAdmin = user?.role === ROLES.ADMIN;

  const [templates, setTemplates] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [channelFilter, setChannelFilter] = useState('');
  const [occasionFilter, setOccasionFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit, sort: 'created_at:desc' };
      if (channelFilter) params.channel = channelFilter;
      if (occasionFilter) params.occasion = occasionFilter;
      const res = await templateService.list(params);
      setTemplates(res?.data ?? []);
      setPagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách mẫu.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, channelFilter, occasionFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleChannelFilterChange = (e) => {
    setChannelFilter(e.target.value);
    resetPage();
  };

  const handleOccasionFilterChange = (e) => {
    setOccasionFilter(e.target.value);
    resetPage();
  };

  const openCreateModal = () => {
    setFormMode('create');
    setEditing(null);
    setForm(EMPTY_TEMPLATE_FORM);
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (tpl) => {
    setFormMode('edit');
    setEditing(tpl);
    setForm({
      name: tpl.name ?? '',
      occasion: tpl.occasion ?? 'birthday',
      channel: tpl.channel ?? MESSAGE_CHANNELS.ZALO,
      subject: tpl.subject ?? '',
      body: tpl.body ?? '',
      is_active: tpl.is_active ? 'true' : 'false',
    });
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const closeFormModal = () => {
    setFormOpen(false);
    setFormError('');
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Vui lòng nhập tên mẫu';
    if (!form.occasion) next.occasion = 'Vui lòng chọn dịp';
    if (!form.channel) next.channel = 'Vui lòng chọn kênh';
    if (form.channel === MESSAGE_CHANNELS.EMAIL && !form.subject.trim()) {
      next.subject = 'Email yêu cầu chủ đề';
    }
    if (!form.body.trim()) next.body = 'Vui lòng nhập nội dung';
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validateForm()) return;

    const payload = {
      name: form.name.trim(),
      occasion: form.occasion,
      channel: form.channel,
      body: form.body,
    };
    if (form.channel === MESSAGE_CHANNELS.EMAIL) {
      payload.subject = form.subject.trim();
    } else if (form.subject.trim()) {
      payload.subject = form.subject.trim();
    }
    if (formMode === 'edit') {
      payload.is_active = form.is_active === 'true';
    }

    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await templateService.create(payload);
        showToast('Đã tạo mẫu tin nhắn.');
      } else {
        await templateService.update(editing.id, payload);
        showToast('Đã cập nhật mẫu.');
      }
      closeFormModal();
      fetchTemplates();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không thể lưu mẫu.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await templateService.remove(confirmDelete.id);
      showToast('Đã xóa mẫu.');
      setConfirmDelete(null);
      fetchTemplates();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể xóa mẫu.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'name',
        label: 'Tên',
        render: (v) => (
          <span className="font-medium text-gray-900">{v || '—'}</span>
        ),
      },
      {
        key: 'occasion',
        label: 'Dịp',
        render: (v) => (
          <Badge variant={TEMPLATE_OCCASION_BADGE_VARIANT[v] ?? 'default'}>
            {TEMPLATE_OCCASION_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'channel',
        label: 'Kênh',
        render: (v) => (
          <Badge variant={MESSAGE_CHANNEL_BADGE_VARIANT[v] ?? 'default'}>
            {MESSAGE_CHANNEL_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'subject',
        label: 'Chủ đề',
        render: (v) => (
          <span
            title={v || ''}
            className="block max-w-xs truncate text-gray-600"
          >
            {v || '—'}
          </span>
        ),
      },
      {
        key: 'is_active',
        label: 'Trạng thái',
        render: (v) => (
          <Badge variant={v ? 'success' : 'danger'}>
            {v ? 'Đang hoạt động' : 'Đã vô hiệu'}
          </Badge>
        ),
      },
    ];

    if (isAdmin) {
      cols.push({
        key: 'actions',
        label: 'Hành động',
        render: (_v, row) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(row)}
            >
              Sửa
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(row)}
            >
              Xóa
            </Button>
          </div>
        ),
      });
    }
    return cols;
  }, [isAdmin]);

  const occasionFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả dịp' },
      ...TEMPLATE_OCCASION_OPTIONS,
    ],
    [],
  );

  const isEmail = form.channel === MESSAGE_CHANNELS.EMAIL;
  const previewSubject = renderTemplate(form.subject);
  const previewBody = renderTemplate(form.body);

  const formTitle =
    formMode === 'create' ? 'Tạo mẫu tin nhắn' : 'Sửa mẫu tin nhắn';

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-700">
          Mẫu tin nhắn
        </h2>
        {isAdmin && (
          <Button onClick={openCreateModal}>
            <span aria-hidden="true">+</span> Tạo mẫu
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          name="channelFilter"
          options={CHANNEL_FILTER_OPTIONS}
          value={channelFilter}
          onChange={handleChannelFilterChange}
        />
        <Select
          name="occasionFilter"
          options={occasionFilterOptions}
          value={occasionFilter}
          onChange={handleOccasionFilterChange}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchTemplates}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={templates}
        loading={loading}
        emptyText="Chưa có mẫu tin nhắn"
        rowKey="id"
      />

      {!loading && templates.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Tổng:{' '}
            <strong className="text-gray-700">{pagination.total}</strong>{' '}
            mẫu
          </span>
          <Pagination
            page={page}
            totalPages={pagination.totalPages ?? 1}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formTitle}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="template-form"
              loading={formSubmitting}
            >
              {formMode === 'create' ? 'Tạo' : 'Lưu'}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form
          id="template-form"
          onSubmit={handleFormSubmit}
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          noValidate
        >
          <div className="space-y-3">
            <Input
              label="Tên mẫu"
              name="name"
              value={form.name}
              error={formErrors.name}
              onChange={handleFormChange}
              placeholder="Birthday Email"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Dịp"
                name="occasion"
                options={TEMPLATE_OCCASION_OPTIONS}
                value={form.occasion}
                onChange={handleFormChange}
                error={formErrors.occasion}
              />
              <Select
                label="Kênh"
                name="channel"
                options={MESSAGE_CHANNEL_OPTIONS}
                value={form.channel}
                onChange={handleFormChange}
                error={formErrors.channel}
              />
            </div>
            {isEmail && (
              <Input
                label="Chủ đề"
                name="subject"
                value={form.subject}
                error={formErrors.subject}
                onChange={handleFormChange}
                placeholder="Happy Birthday from {{shop_name}}!"
              />
            )}
            <Textarea
              label="Nội dung"
              name="body"
              value={form.body}
              error={formErrors.body}
              onChange={handleFormChange}
              rows={10}
              placeholder="Dear {{customer_name}}, happy birthday! Voucher: {{voucher_code}}"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Select
                label="Trạng thái"
                name="is_active"
                options={[
                  { value: 'true', label: 'Đang hoạt động' },
                  { value: 'false', label: 'Đã vô hiệu' },
                ]}
                value={form.is_active}
                onChange={handleFormChange}
              />
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <p className="font-medium">Biến khả dụng:</p>
              <p className="mt-1 font-mono">
                {TEMPLATE_VARIABLES.join(' · ')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Xem trước
            </p>
            <div className="min-h-[16rem] rounded-lg border border-gray-200 bg-white p-3">
              {isEmail && (
                <div className="mb-2 border-b border-gray-100 pb-2">
                  <p className="text-xs text-gray-400">Chủ đề</p>
                  <p className="text-sm font-medium text-gray-800">
                    {previewSubject || '(trống)'}
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-400">Nội dung</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                {previewBody || '(trống)'}
              </p>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Xác nhận xóa"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={handleDelete}
            >
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc muốn xóa mẫu{' '}
          <strong className="text-gray-800">
            {confirmDelete?.name}
          </strong>
          ? Hành động này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}

function StatsTab() {
  const initial = useMemo(getDefaultStatsRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [toast, setToast] = useState({ message: '', variant: 'info' });
  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const fetchStats = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const res = await messageService.stats({ from, to });
      setStats(res?.data ?? null);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải thống kê.'));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFromChange = (e) => setFrom(e.target.value);
  const handleToChange = (e) => setTo(e.target.value);

  const total = stats?.total ?? 0;
  const sent = stats?.sent ?? 0;
  const failed = stats?.failed ?? 0;
  const delivered = stats?.delivered ?? 0;
  const pending = stats?.pending ?? 0;
  const byChannel = stats?.by_channel ?? {};

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-700">Thống kê</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Từ ngày"
            name="from"
            type="date"
            value={from}
            onChange={handleFromChange}
          />
          <Input
            label="Đến ngày"
            name="to"
            type="date"
            value={to}
            onChange={handleToChange}
          />
          <Button onClick={fetchStats} loading={loading}>
            Tải lại
          </Button>
        </div>
      </div>

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
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-gray-500">
          <Spinner size="sm" className="mr-2" />
          Đang tải...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Tổng số" value={total} variant="info" />
            <StatCard title="Đã gửi" value={sent} variant="success" />
            <StatCard title="Đã nhận" value={delivered} variant="info" />
            <StatCard title="Lỗi" value={failed} variant="danger" />
            <StatCard title="Chờ gửi" value={pending} variant="warning" />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Theo kênh
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MESSAGE_CHANNEL_OPTIONS.map((opt) => {
                const count = byChannel[opt.value] ?? 0;
                return (
                  <div
                    key={opt.value}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <Badge
                      variant={
                        MESSAGE_CHANNEL_BADGE_VARIANT[opt.value] ??
                        'default'
                      }
                    >
                      {opt.label}
                    </Badge>
                    <span className="text-lg font-bold text-gray-900">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Messages() {
  const [tab, setTab] = useState('logs');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Tin nhắn</h1>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'logs' && <LogsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  );
}
