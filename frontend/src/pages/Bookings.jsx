import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePagination } from '../hooks/usePagination';
import bookingService from '../services/bookingService';
import customerService from '../services/customerService';
import employeeService from '../services/employeeService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Toast from '../components/ui/Toast';
import Spinner from '../components/ui/Spinner';
import { formatDateTime, toDatetimeLocalValue } from '../utils/formatDate';
import { formatCurrency } from '../utils/formatCurrency';
import {
  BOOKING_STATUS_OPTIONS,
  BOOKING_STATUS_BADGE_VARIANT,
  BOOKING_STATUS_LABELS,
} from '../utils/constants';

const SEARCH_DEBOUNCE_MS = 400;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...BOOKING_STATUS_OPTIONS,
];

const EMPTY_FORM = {
  customer_id: '',
  employee_id: '',
  booking_date: '',
  package_name: '',
  amount: '',
  photo_count: '',
  voucher_id: '',
  status: 'completed',
  notes: '',
};

function buildParams({
  page,
  limit,
  search,
  status,
  from,
  to,
  customerId,
  employeeId,
}) {
  const params = { page, limit };
  if (search) params.search = search;
  if (status) params.status = status;
  if (from) params.from = from;
  if (to) params.to = to;
  if (customerId) params.customer_id = customerId;
  if (employeeId) params.employee_id = employeeId;
  params.sort = 'booking_date:desc';
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

export default function Bookings() {
  const { page, limit, setPage, resetPage } = usePagination();

  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const [employees, setEmployees] = useState([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [customerVouchers, setCustomerVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);

  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [toast, setToast] = useState({ message: '', variant: 'info' });

  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await employeeService.list({ limit: 100 });
      setEmployees(res?.data ?? []);
    } catch {
      setEmployees([]);
    }
  }, []);

  useEffect(() => {
    if (!employeesLoaded) {
      setEmployeesLoaded(true);
      fetchEmployees();
    }
  }, [employeesLoaded, fetchEmployees]);

  const employeeFilterOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả nhân viên' },
      ...employees.map((e) => ({
        value: e.id,
        label: e.full_name,
      })),
    ],
    [employees],
  );

  const employeeFormOptions = useMemo(
    () => [
      { value: '', label: '— Không phân công —' },
      ...employees.map((e) => ({
        value: e.id,
        label: e.full_name,
      })),
    ],
    [employees],
  );

  const voucherOptions = useMemo(
    () => [
      { value: '', label: 'Không dùng voucher' },
      ...customerVouchers.map((v) => ({
        value: v.voucher_id,
        label:
          v.voucher?.name ||
          v.voucher?.code ||
          v.voucher_id,
      })),
    ],
    [customerVouchers],
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

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter,
        from: fromFilter,
        to: toFilter,
        customerId: customerFilter,
        employeeId: employeeFilter,
      });
      const res = await bookingService.list(params);
      setBookings(res?.data ?? []);
      setPagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách booking.'));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    statusFilter,
    fromFilter,
    toFilter,
    customerFilter,
    employeeFilter,
  ]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    resetPage();
  };

  const handleEmployeeFilterChange = (e) => {
    setEmployeeFilter(e.target.value);
    resetPage();
  };

  const handleCustomerFilterChange = (id) => {
    setCustomerFilter(id);
    resetPage();
  };

  const loadCustomerVouchers = useCallback(async (customerId) => {
    if (!customerId) {
      setCustomerVouchers([]);
      return;
    }
    setVouchersLoading(true);
    try {
      const res = await customerService.listVouchers(customerId, {
        status: 'issued',
        limit: 50,
      });
      setCustomerVouchers(res?.data ?? []);
    } catch {
      setCustomerVouchers([]);
    } finally {
      setVouchersLoading(false);
    }
  }, []);

  const openCreateModal = () => {
    setFormMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setCustomerVouchers([]);
    setFormOpen(true);
  };

  const openEditModal = (booking) => {
    setFormMode('edit');
    setEditing(booking);
    setForm({
      customer_id: booking.customer_id ?? '',
      employee_id: booking.employee_id ?? '',
      booking_date: booking.booking_date
        ? toDatetimeLocalValue(booking.booking_date)
        : '',
      package_name: booking.package_name ?? '',
      amount: booking.amount != null ? String(booking.amount) : '',
      photo_count:
        booking.photo_count != null ? String(booking.photo_count) : '',
      voucher_id: booking.voucher_id ?? '',
      status: booking.status ?? 'completed',
      notes: booking.notes ?? '',
    });
    setFormErrors({});
    setFormError('');
    setCustomerVouchers([]);
    if (booking.customer_id) {
      loadCustomerVouchers(booking.customer_id);
    }
    setFormOpen(true);
  };

  const closeFormModal = () => {
    setFormOpen(false);
    setFormError('');
    setFormErrors({});
    setCustomerVouchers([]);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleFormCustomerChange = (id) => {
    setForm((prev) => ({ ...prev, customer_id: id, voucher_id: '' }));
    if (formErrors.customer_id) {
      setFormErrors((prev) => ({ ...prev, customer_id: undefined }));
    }
    loadCustomerVouchers(id);
  };

  const validateForm = () => {
    const next = {};
    if (!form.customer_id) {
      next.customer_id = 'Vui lòng chọn khách hàng';
    }
    if (!form.booking_date) {
      next.booking_date = 'Vui lòng chọn ngày booking';
    }
    if (form.amount === '' || form.amount == null) {
      next.amount = 'Vui lòng nhập số tiền';
    } else if (
      Number.isNaN(Number(form.amount)) ||
      Number(form.amount) < 0
    ) {
      next.amount = 'Số tiền phải lớn hơn hoặc bằng 0';
    }
    if (form.photo_count !== '' && form.photo_count != null) {
      const pc = Number(form.photo_count);
      if (Number.isNaN(pc) || pc < 0 || !Number.isInteger(pc)) {
        next.photo_count = 'Số ảnh phải là số nguyên không âm';
      }
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validateForm()) return;

    const payload = {
      employee_id: form.employee_id || undefined,
      booking_date: new Date(form.booking_date).toISOString(),
      package_name: form.package_name.trim() || undefined,
      amount: Number(form.amount) || 0,
      photo_count: form.photo_count === '' ? 0 : Number(form.photo_count) || 0,
      voucher_id: form.voucher_id || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };
    if (formMode === 'create') {
      payload.customer_id = form.customer_id;
    }

    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await bookingService.create(payload);
        showToast('Đã tạo booking.');
      } else {
        await bookingService.update(editing.id, payload);
        showToast('Đã cập nhật booking.');
      }
      closeFormModal();
      fetchBookings();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không thể lưu booking.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!confirmCancel) return;
    setCancelling(true);
    try {
      await bookingService.remove(confirmCancel.id);
      showToast('Đã hủy booking.');
      setConfirmCancel(null);
      fetchBookings();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể hủy booking.'), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'customer_id',
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
        key: 'employee_id',
        label: 'Nhân viên',
        render: (_v, row) =>
          row.employee?.full_name ||
          row.employee_name ||
          '—',
      },
      {
        key: 'booking_date',
        label: 'Ngày',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        key: 'package_name',
        label: 'Gói',
        render: (v) => v || '—',
      },
      {
        key: 'amount',
        label: 'Số tiền',
        render: (v) => formatCurrency(v),
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: (v) => (
          <Badge variant={BOOKING_STATUS_BADGE_VARIANT[v] ?? 'default'}>
            {BOOKING_STATUS_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'photo_count',
        label: 'Số ảnh',
        render: (v) => (v ?? 0),
      },
      {
        key: 'voucher_id',
        label: 'Voucher',
        render: (_v, row) => {
          if (!row.voucher_id) return '—';
          return (
            <span className="text-xs text-gray-600">
              {row.voucher?.name ||
                row.voucher?.code ||
                row.voucher_id}
            </span>
          );
        },
      },
      {
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
            {row.status !== 'cancelled' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmCancel(row)}
              >
                Hủy
              </Button>
            )}
          </div>
        ),
      },
    ];
    return cols;
  }, []);

  const formTitle = formMode === 'create' ? 'Tạo booking' : 'Sửa booking';

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Booking</h1>
        <Button onClick={openCreateModal}>
          <span aria-hidden="true">+</span> Tạo booking
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          name="search"
          type="search"
          placeholder="Tìm theo gói, ghi chú..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          name="statusFilter"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={handleStatusFilterChange}
        />
        <Select
          name="employeeFilter"
          options={employeeFilterOptions}
          value={employeeFilter}
          onChange={handleEmployeeFilterChange}
        />
        <Input
          name="fromFilter"
          type="date"
          placeholder="Từ ngày"
          value={fromFilter}
          onChange={(e) => {
            setFromFilter(e.target.value);
            resetPage();
          }}
        />
        <Input
          name="toFilter"
          type="date"
          placeholder="Đến ngày"
          value={toFilter}
          onChange={(e) => {
            setToFilter(e.target.value);
            resetPage();
          }}
        />
        <CustomerPicker
          value={customerFilter}
          onChange={handleCustomerFilterChange}
          placeholder="Lọc theo khách hàng..."
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchBookings}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={bookings}
        loading={loading}
        emptyText="Chưa có booking"
        rowKey="id"
      />

      {!loading && bookings.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Tổng:{' '}
            <strong className="text-gray-700">{pagination.total}</strong>{' '}
            booking
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
              form="booking-form"
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
          id="booking-form"
          onSubmit={handleFormSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          noValidate
        >
          <div className="sm:col-span-2">
            <CustomerPicker
              label="Khách hàng"
              value={form.customer_id}
              onChange={handleFormCustomerChange}
              initialCustomer={editing?.customer}
              error={formErrors.customer_id}
              disabled={formMode === 'edit'}
            />
          </div>
          <Select
            label="Nhân viên"
            name="employee_id"
            options={employeeFormOptions}
            value={form.employee_id}
            onChange={handleFormChange}
            error={formErrors.employee_id}
          />
          <Input
            label="Ngày booking"
            name="booking_date"
            type="datetime-local"
            value={form.booking_date}
            error={formErrors.booking_date}
            onChange={handleFormChange}
          />
          <Input
            label="Gói"
            name="package_name"
            value={form.package_name}
            error={formErrors.package_name}
            onChange={handleFormChange}
            placeholder="Premium Album"
          />
          <Input
            label="Số tiền (VNĐ)"
            name="amount"
            type="number"
            min="0"
            step="1000"
            value={form.amount}
            error={formErrors.amount}
            onChange={handleFormChange}
            placeholder="0"
          />
          <Input
            label="Số ảnh"
            name="photo_count"
            type="number"
            min="0"
            step="1"
            value={form.photo_count}
            error={formErrors.photo_count}
            onChange={handleFormChange}
            placeholder="0"
          />
          <Select
            label="Trạng thái"
            name="status"
            options={BOOKING_STATUS_OPTIONS}
            value={form.status}
            onChange={handleFormChange}
            error={formErrors.status}
          />
          <Select
            label={
              vouchersLoading ? 'Voucher (đang tải...)' : 'Voucher'
            }
            name="voucher_id"
            options={voucherOptions}
            value={form.voucher_id}
            onChange={handleFormChange}
            error={formErrors.voucher_id}
          />
          <div className="sm:col-span-2">
            <Input
              label="Ghi chú"
              name="notes"
              value={form.notes}
              error={formErrors.notes}
              onChange={handleFormChange}
              placeholder="Ghi chú cho booking..."
            />
          </div>
        </form>
      </Modal>

      {/* Cancel confirmation modal */}
      <Modal
        open={Boolean(confirmCancel)}
        onClose={() => setConfirmCancel(null)}
        title="Xác nhận hủy booking"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmCancel(null)}
              disabled={cancelling}
            >
              Đóng
            </Button>
            <Button
              variant="danger"
              loading={cancelling}
              onClick={handleCancelBooking}
            >
              Hủy booking
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc muốn hủy booking{' '}
          <strong className="text-gray-800">
            {confirmCancel?.package_name || confirmCancel?.id}
          </strong>{' '}
          của khách{' '}
          <strong className="text-gray-800">
            {confirmCancel?.customer?.full_name ||
              confirmCancel?.customer_name ||
              confirmCancel?.customer_id}
          </strong>
          ?
        </p>
      </Modal>
    </div>
  );
}
