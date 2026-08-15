import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePagination } from '../hooks/usePagination';
import voucherService from '../services/voucherService';
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
import {
  formatDate,
  formatDateTime,
} from '../utils/formatDate';
import { formatCurrency } from '../utils/formatCurrency';
import {
  ROLES,
  VOUCHER_TYPES,
  VOUCHER_TYPE_OPTIONS,
  VOUCHER_TYPE_BADGE_VARIANT,
  VOUCHER_TYPE_LABELS,
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_OPTIONS,
  CUSTOMER_VOUCHER_STATUS_BADGE_VARIANT,
  CUSTOMER_VOUCHER_STATUS_LABELS,
} from '../utils/constants';

const SEARCH_DEBOUNCE_MS = 400;

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả loại voucher' },
  ...VOUCHER_TYPE_OPTIONS,
];

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Đã vô hiệu' },
];

const EMPTY_FORM = {
  code: '',
  name: '',
  type: VOUCHER_TYPES.PROMO,
  discount_type: DISCOUNT_TYPES.PERCENT,
  value: '',
  min_order: '',
  max_discount: '',
  total_quantity: '-1',
  valid_from: '',
  valid_until: '',
  per_customer: '1',
  is_active: 'true',
};

const EMPTY_ISSUE_FORM = {
  customer_id: '',
  expires_at: '',
};

function buildParams({ page, limit, search, type, isActive }) {
  const params = { page, limit };
  if (search) params.search = search;
  if (type) params.type = type;
  if (isActive !== '' && isActive != null) {
    params.is_active = isActive;
  }
  params.sort = 'created_at:desc';
  return params;
}

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

function CopyIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CustomerPicker({
  value,
  onChange,
  label,
  placeholder = 'Tìm khách hàng theo tên / SĐT...',
  error,
  initialCustomer,
  disabled = false,
}) {
  const [selected, setSelected] = useState(initialCustomer || null);
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

function DiscountCell({ row }) {
  const isPercent = row.discount_type === DISCOUNT_TYPES.PERCENT;
  const main = isPercent ? `${row.value}%` : formatCurrency(row.value);
  const subs = [];
  if (row.min_order) subs.push(`Tối thiểu ${formatCurrency(row.min_order)}`);
  if (row.max_discount) {
    subs.push(`Giảm tối đa ${formatCurrency(row.max_discount)}`);
  }
  return (
    <div className="flex flex-col">
      <span className="font-medium text-gray-900">{main}</span>
      {subs.length > 0 && (
        <span className="text-xs text-gray-500">{subs.join(' · ')}</span>
      )}
    </div>
  );
}

function QuantityCell({ row }) {
  const total = row.total_quantity;
  const used = row.used_count ?? 0;
  if (total === -1 || total == null) {
    return (
      <span>
        {used}/<span className="text-gray-400">∞</span>
      </span>
    );
  }
  return <span>{used}/{total}</span>;
}

export default function Vouchers() {
  const { user } = useAuth();
  const { page, limit, setPage, resetPage } = usePagination();

  const isAdmin = user?.role === ROLES.ADMIN;

  const [vouchers, setVouchers] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueVoucher, setIssueVoucher] = useState(null);
  const [issueForm, setIssueForm] = useState(EMPTY_ISSUE_FORM);
  const [issueCustomer, setIssueCustomer] = useState(null);
  const [issueErrors, setIssueErrors] = useState({});
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issuedResult, setIssuedResult] = useState(null);

  const [usageOpen, setUsageOpen] = useState(false);
  const [usageVoucher, setUsageVoucher] = useState(null);
  const [usageList, setUsageList] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');
  const [usagePagination, setUsagePagination] = useState({
    total: 0,
    totalPages: 1,
  });

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState({ message: '', variant: 'info' });

  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const copyToClipboard = useCallback(
    async (text) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Đã sao chép mã.');
      } catch {
        showToast('Không sao chép được.', 'error');
      }
    },
    [showToast],
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

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams({
        page,
        limit,
        search: debouncedSearch,
        type: typeFilter,
        isActive: isActiveFilter,
      });
      const res = await voucherService.list(params);
      setVouchers(res?.data ?? []);
      setPagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách voucher.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, typeFilter, isActiveFilter]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    resetPage();
  };

  const handleActiveFilterChange = (e) => {
    setIsActiveFilter(e.target.value);
    resetPage();
  };

  const openCreateModal = () => {
    setFormMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (voucher) => {
    setFormMode('edit');
    setEditing(voucher);
    setForm({
      code: voucher.code ?? '',
      name: voucher.name ?? '',
      type: voucher.type ?? VOUCHER_TYPES.PROMO,
      discount_type: voucher.discount_type ?? DISCOUNT_TYPES.PERCENT,
      value: voucher.value != null ? String(voucher.value) : '',
      min_order: voucher.min_order != null ? String(voucher.min_order) : '',
      max_discount:
        voucher.max_discount != null ? String(voucher.max_discount) : '',
      total_quantity:
        voucher.total_quantity != null ? String(voucher.total_quantity) : '-1',
      valid_from: voucher.valid_from ?? '',
      valid_until: voucher.valid_until ?? '',
      per_customer:
        voucher.per_customer != null ? String(voucher.per_customer) : '1',
      is_active: voucher.is_active ? 'true' : 'false',
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
    if (!form.name.trim()) next.name = 'Vui lòng nhập tên voucher';
    if (formMode === 'create' && !form.type) {
      next.type = 'Vui lòng chọn loại voucher';
    }
    if (!form.discount_type) {
      next.discount_type = 'Vui lòng chọn kiểu giảm giá';
    }
    const valueNum = Number(form.value);
    if (form.value === '' || form.value == null) {
      next.value = 'Vui lòng nhập giá trị giảm';
    } else if (Number.isNaN(valueNum) || valueNum <= 0) {
      next.value = 'Giá trị giảm phải lớn hơn 0';
    } else if (
      form.discount_type === DISCOUNT_TYPES.PERCENT &&
      valueNum > 100
    ) {
      next.value = 'Phần trăm giảm không được vượt quá 100';
    }
    if (form.min_order !== '' && form.min_order != null) {
      const m = Number(form.min_order);
      if (Number.isNaN(m) || m < 0) {
        next.min_order = 'Đơn tối thiểu phải lớn hơn hoặc bằng 0';
      }
    }
    if (form.max_discount !== '' && form.max_discount != null) {
      const m = Number(form.max_discount);
      if (Number.isNaN(m) || m < 0) {
        next.max_discount = 'Giảm tối đa phải lớn hơn hoặc bằng 0';
      }
    }
    if (form.total_quantity !== '' && form.total_quantity != null) {
      const t = Number(form.total_quantity);
      if (!Number.isInteger(t) || t < -1) {
        next.total_quantity = 'Số lượng là số nguyên, -1 = không giới hạn';
      }
    }
    if (form.per_customer !== '' && form.per_customer != null) {
      const p = Number(form.per_customer);
      if (!Number.isInteger(p) || p < 1) {
        next.per_customer = 'Giới hạn mỗi khách là số nguyên lớn hơn 0';
      }
    }
    if (!form.valid_from) next.valid_from = 'Vui lòng chọn ngày bắt đầu';
    if (!form.valid_until) next.valid_until = 'Vui lòng chọn ngày kết thúc';
    if (
      form.valid_from &&
      form.valid_until &&
      new Date(form.valid_until) < new Date(form.valid_from)
    ) {
      next.valid_until = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validateForm()) return;

    const payload = {
      name: form.name.trim(),
      discount_type: form.discount_type,
      value: Number(form.value),
      valid_from: form.valid_from,
      valid_until: form.valid_until,
      per_customer: Number(form.per_customer) || 1,
      total_quantity: Number(form.total_quantity),
    };
    if (form.min_order !== '' && form.min_order != null) {
      payload.min_order = Number(form.min_order);
    }
    if (form.max_discount !== '' && form.max_discount != null) {
      payload.max_discount = Number(form.max_discount);
    }
    if (formMode === 'create') {
      payload.type = form.type;
      if (form.code.trim()) payload.code = form.code.trim();
    } else {
      payload.is_active = form.is_active === 'true';
    }

    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await voucherService.create(payload);
        showToast('Đã tạo voucher mới.');
      } else {
        await voucherService.update(editing.id, payload);
        showToast('Đã cập nhật voucher.');
      }
      closeFormModal();
      fetchVouchers();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không thể lưu voucher.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await voucherService.remove(confirmDelete.id);
      showToast('Đã xóa voucher.');
      setConfirmDelete(null);
      fetchVouchers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể xóa voucher.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openIssueModal = (voucher) => {
    setIssueVoucher(voucher);
    setIssueForm(EMPTY_ISSUE_FORM);
    setIssueCustomer(null);
    setIssueErrors({});
    setIssueError('');
    setIssuedResult(null);
    setIssueOpen(true);
  };

  const closeIssueModal = () => {
    setIssueOpen(false);
    setIssueVoucher(null);
    setIssueForm(EMPTY_ISSUE_FORM);
    setIssueCustomer(null);
    setIssueErrors({});
    setIssueError('');
    setIssuedResult(null);
  };

  const handleIssueCustomerChange = (id) => {
    setIssueForm((prev) => ({ ...prev, customer_id: id }));
    if (issueErrors.customer_id) {
      setIssueErrors((prev) => ({ ...prev, customer_id: undefined }));
    }
  };

  const handleIssueFormChange = (e) => {
    const { name, value } = e.target;
    setIssueForm((prev) => ({ ...prev, [name]: value }));
    if (issueErrors[name]) {
      setIssueErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateIssueForm = () => {
    const next = {};
    if (!issueForm.customer_id) {
      next.customer_id = 'Vui lòng chọn khách hàng';
    }
    if (issueForm.expires_at) {
      const d = new Date(issueForm.expires_at);
      if (Number.isNaN(d.getTime())) {
        next.expires_at = 'Thời hạn không hợp lệ';
      }
    }
    setIssueErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueVoucher) return;
    setIssueError('');
    if (!validateIssueForm()) return;

    const payload = { customer_id: issueForm.customer_id };
    if (issueForm.expires_at) {
      payload.expires_at = new Date(issueForm.expires_at).toISOString();
    }

    setIssueSubmitting(true);
    try {
      const res = await voucherService.issue(issueVoucher.id, payload);
      const data = res?.data ?? res;
      setIssuedResult({
        code: issueVoucher.code,
        name: issueVoucher.name,
        customerName: issueCustomer?.full_name,
        customerVoucher: data,
      });
      setIssueForm(EMPTY_ISSUE_FORM);
      setIssueCustomer(null);
      showToast('Đã phát voucher cho khách hàng.');
      fetchVouchers();
    } catch (err) {
      setIssueError(getErrorMessage(err, 'Không thể phát voucher.'));
    } finally {
      setIssueSubmitting(false);
    }
  };

  const fetchUsage = useCallback(async (voucherId) => {
    setUsageLoading(true);
    setUsageError('');
    try {
      const res = await voucherService.usage(voucherId, {
        page: 1,
        limit: 50,
      });
      setUsageList(res?.data ?? []);
      setUsagePagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setUsageError(getErrorMessage(err, 'Không thể tải lịch sử phát.'));
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const openUsageModal = (voucher) => {
    setUsageVoucher(voucher);
    setUsageOpen(true);
    setUsageList([]);
    setUsageError('');
    fetchUsage(voucher.id);
  };

  const closeUsageModal = () => {
    setUsageOpen(false);
    setUsageVoucher(null);
    setUsageList([]);
    setUsageError('');
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'code',
        label: 'Mã',
        render: (v) => (
          <div className="flex items-center gap-1">
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">
              {v || '—'}
            </code>
            {v && (
              <button
                type="button"
                onClick={() => copyToClipboard(v)}
                className="text-gray-400 transition hover:text-gray-600"
                aria-label="Sao chép mã"
              >
                <CopyIcon />
              </button>
            )}
          </div>
        ),
      },
      {
        key: 'name',
        label: 'Tên',
        render: (v) => (
          <span className="font-medium text-gray-900">{v || '—'}</span>
        ),
      },
      {
        key: 'type',
        label: 'Loại',
        render: (v) => (
          <Badge variant={VOUCHER_TYPE_BADGE_VARIANT[v] ?? 'default'}>
            {VOUCHER_TYPE_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'discount_type',
        label: 'Giảm giá',
        render: (_v, row) => <DiscountCell row={row} />,
      },
      {
        key: 'total_quantity',
        label: 'Số lượng',
        render: (_v, row) => <QuantityCell row={row} />,
      },
      {
        key: 'valid_from',
        label: 'Hiệu lực',
        render: (_v, row) => {
          const from = row.valid_from ? formatDate(row.valid_from) : '—';
          const until = row.valid_until ? formatDate(row.valid_until) : '—';
          return (
            <span className="text-xs text-gray-600">
              {from} → {until}
            </span>
          );
        },
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
      {
        key: 'actions',
        label: 'Hành động',
        render: (_v, row) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openIssueModal(row)}
            >
              Phát
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openUsageModal(row)}
            >
              Lịch sử
            </Button>
            {isAdmin && (
              <>
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
              </>
            )}
          </div>
        ),
      },
    ];
    return cols;
  }, [isAdmin, copyToClipboard]);

  const formTitle = formMode === 'create' ? 'Tạo voucher' : 'Sửa voucher';

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Voucher</h1>
        {isAdmin && (
          <Button onClick={openCreateModal}>
            <span aria-hidden="true">+</span> Tạo voucher
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          name="search"
          type="search"
          placeholder="Tìm theo mã, tên voucher..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          name="typeFilter"
          options={TYPE_FILTER_OPTIONS}
          value={typeFilter}
          onChange={handleTypeFilterChange}
        />
        <Select
          name="isActiveFilter"
          options={ACTIVE_FILTER_OPTIONS}
          value={isActiveFilter}
          onChange={handleActiveFilterChange}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchVouchers}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={vouchers}
        loading={loading}
        emptyText="Chưa có voucher"
        rowKey="id"
      />

      {!loading && vouchers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Tổng: <strong className="text-gray-700">{pagination.total}</strong>{' '}
            voucher
          </span>
          <Pagination
            page={page}
            totalPages={pagination.totalPages ?? 1}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Form modal (create / edit) */}
      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={formTitle}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="voucher-form"
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
          id="voucher-form"
          onSubmit={handleFormSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          noValidate
        >
          <Input
            label="Mã voucher"
            name="code"
            value={form.code}
            error={formErrors.code}
            onChange={handleFormChange}
            placeholder="Để trống để tự sinh"
            disabled={formMode === 'edit'}
          />
          <Input
            label="Tên voucher"
            name="name"
            value={form.name}
            error={formErrors.name}
            onChange={handleFormChange}
            placeholder="Summer 20% Off"
          />
          <Select
            label="Loại"
            name="type"
            options={VOUCHER_TYPE_OPTIONS}
            value={form.type}
            onChange={handleFormChange}
            error={formErrors.type}
            disabled={formMode === 'edit'}
          />
          <Select
            label="Kiểu giảm giá"
            name="discount_type"
            options={DISCOUNT_TYPE_OPTIONS}
            value={form.discount_type}
            onChange={handleFormChange}
            error={formErrors.discount_type}
          />
          <Input
            label={
              form.discount_type === DISCOUNT_TYPES.PERCENT
                ? 'Giá trị giảm (%)'
                : 'Giá trị giảm (VNĐ)'
            }
            name="value"
            type="number"
            min="0"
            step="any"
            value={form.value}
            error={formErrors.value}
            onChange={handleFormChange}
            placeholder="0"
          />
          <Input
            label="Đơn tối thiểu (VNĐ)"
            name="min_order"
            type="number"
            min="0"
            step="any"
            value={form.min_order}
            error={formErrors.min_order}
            onChange={handleFormChange}
            placeholder="0"
          />
          <Input
            label="Giảm tối đa (VNĐ)"
            name="max_discount"
            type="number"
            min="0"
            step="any"
            value={form.max_discount}
            error={formErrors.max_discount}
            onChange={handleFormChange}
            placeholder="(tùy chọn)"
          />
          <Input
            label="Tổng số lượng"
            name="total_quantity"
            type="number"
            min="-1"
            step="1"
            value={form.total_quantity}
            error={formErrors.total_quantity}
            onChange={handleFormChange}
            placeholder="-1 = không giới hạn"
          />
          <Input
            label="Ngày bắt đầu"
            name="valid_from"
            type="date"
            value={form.valid_from}
            error={formErrors.valid_from}
            onChange={handleFormChange}
          />
          <Input
            label="Ngày kết thúc"
            name="valid_until"
            type="date"
            value={form.valid_until}
            error={formErrors.valid_until}
            onChange={handleFormChange}
          />
          <Input
            label="Giới hạn mỗi khách"
            name="per_customer"
            type="number"
            min="1"
            step="1"
            value={form.per_customer}
            error={formErrors.per_customer}
            onChange={handleFormChange}
            placeholder="1"
          />
          {formMode === 'edit' && (
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
          )}
        </form>
      </Modal>

      {/* Issue modal */}
      <Modal
        open={issueOpen}
        onClose={closeIssueModal}
        title={
          issueVoucher ? `Phát voucher — ${issueVoucher.name}` : 'Phát voucher'
        }
        size="md"
        footer={
          issuedResult ? (
            <Button variant="secondary" onClick={closeIssueModal}>
              Đóng
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeIssueModal}>
                Hủy
              </Button>
              <Button
                type="submit"
                form="voucher-issue-form"
                loading={issueSubmitting}
              >
                Phát voucher
              </Button>
            </>
          )
        }
      >
        {issueVoucher && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Mã:</span>
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-800">
                {issueVoucher.code || '—'}
              </code>
              {issueVoucher.code && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(issueVoucher.code)}
                  className="text-gray-400 transition hover:text-gray-600"
                  aria-label="Sao chép mã"
                >
                  <CopyIcon />
                </button>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Loại: {VOUCHER_TYPE_LABELS[issueVoucher.type] ?? issueVoucher.type}
              {' · '}
              {issueVoucher.discount_type === DISCOUNT_TYPES.PERCENT
                ? `Giảm ${issueVoucher.value}%`
                : `Giảm ${formatCurrency(issueVoucher.value)}`}
              {issueVoucher.valid_until &&
                ` · Hết hạn ${formatDate(issueVoucher.valid_until)}`}
            </div>
          </div>
        )}

        {issuedResult ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <p className="font-medium">Đã phát voucher thành công!</p>
            <div className="mt-2 flex items-center gap-2">
              <span>Mã:</span>
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-800">
                {issuedResult.code || '—'}
              </code>
              {issuedResult.code && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(issuedResult.code)}
                  className="text-green-700 transition hover:text-green-900"
                  aria-label="Sao chép mã"
                >
                  <CopyIcon />
                </button>
              )}
            </div>
            {issuedResult.customerName && (
              <p className="mt-1 text-xs">
                Khách: {issuedResult.customerName}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIssuedResult(null);
                }}
              >
                Phát tiếp
              </Button>
            </div>
          </div>
        ) : (
          <>
            {issueError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {issueError}
              </div>
            )}
            <form
              id="voucher-issue-form"
              onSubmit={handleIssueSubmit}
              className="space-y-3"
              noValidate
            >
              <CustomerPicker
                label="Khách hàng"
                value={issueForm.customer_id}
                onChange={(id, c) => {
                  setIssueCustomer(c);
                  handleIssueCustomerChange(id);
                }}
                error={issueErrors.customer_id}
              />
              <Input
                label="Hạn sử dụng (để trống = theo voucher)"
                name="expires_at"
                type="datetime-local"
                value={issueForm.expires_at}
                error={issueErrors.expires_at}
                onChange={handleIssueFormChange}
              />
            </form>
          </>
        )}
      </Modal>

      {/* Usage modal */}
      <Modal
        open={usageOpen}
        onClose={closeUsageModal}
        title={
          usageVoucher
            ? `Lịch sử phát — ${usageVoucher.name}`
            : 'Lịch sử phát'
        }
        size="lg"
        footer={
          <Button variant="secondary" onClick={closeUsageModal}>
            Đóng
          </Button>
        }
      >
        {usageError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {usageError}
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">
            Danh sách khách đã nhận
          </h4>
          {usageVoucher && (
            <button
              type="button"
              onClick={() => fetchUsage(usageVoucher.id)}
              className="text-xs text-brand-600 hover:underline"
            >
              Tải lại
            </button>
          )}
        </div>

        {usageLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <Spinner size="sm" className="mr-2" />
            Đang tải...
          </div>
        ) : usageList.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Chưa phát voucher cho khách nào.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {usageList.map((cv) => (
              <li
                key={cv.id}
                className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5 text-sm">
                  <div className="font-medium text-gray-800">
                    {cv.customer?.full_name ||
                      cv.customer_name ||
                      cv.customer_id}
                  </div>
                  <div className="text-xs text-gray-500">
                    Phát: {formatDateTime(cv.issued_at)}
                    {cv.expires_at && (
                      <span>
                        {' · Hạn: '}
                        {formatDateTime(cv.expires_at)}
                      </span>
                    )}
                  </div>
                  {cv.used_at && (
                    <div className="text-xs text-gray-500">
                      Dùng: {formatDateTime(cv.used_at)}
                    </div>
                  )}
                </div>
                <Badge
                  variant={
                    CUSTOMER_VOUCHER_STATUS_BADGE_VARIANT[cv.status] ??
                    'default'
                  }
                >
                  {CUSTOMER_VOUCHER_STATUS_LABELS[cv.status] ?? cv.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {!usageLoading && usageList.length > 0 && (
          <div className="mt-3 text-xs text-gray-500">
            Tổng: <strong className="text-gray-700">{usagePagination.total}</strong>{' '}
            lượt phát
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
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
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Xóa
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc muốn xóa voucher{' '}
          <strong className="text-gray-800">
            {confirmDelete?.name || confirmDelete?.code}
          </strong>
          ? Hành động này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}
