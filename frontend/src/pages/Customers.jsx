import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePagination } from '../hooks/usePagination';
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
import { formatDate, formatDateTime } from '../utils/formatDate';
import { formatCurrency } from '../utils/formatCurrency';
import {
  ROLES,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_STATUS_BADGE_VARIANT,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_GENDER_OPTIONS,
  CUSTOMER_GENDER_LABELS,
  BOOKING_STATUS_BADGE_VARIANT,
  BOOKING_STATUS_LABELS,
  CUSTOMER_VOUCHER_STATUS_BADGE_VARIANT,
  CUSTOMER_VOUCHER_STATUS_LABELS,
} from '../utils/constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9,10}$/;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...CUSTOMER_STATUS_OPTIONS,
];

const GENDER_FORM_OPTIONS = [
  { value: '', label: '— Chọn giới tính —' },
  ...CUSTOMER_GENDER_OPTIONS,
];

const BIRTHDAY_MONTH_OPTIONS = [
  { value: '', label: 'Tất cả tháng' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `Tháng ${i + 1}`,
  })),
];

const EMPTY_FORM = {
  full_name: '',
  phone: '',
  email: '',
  birthday: '',
  gender: '',
  zalo_id: '',
  notes: '',
};

function buildParams({ page, limit, search, status, birthdayMonth }) {
  const params = { page, limit };
  if (search) params.search = search;
  if (status) params.status = status;
  if (birthdayMonth) params.birthday_month = birthdayMonth;
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

export default function Customers() {
  const { user } = useAuth();
  const { page, limit, setPage, resetPage } = usePagination();

  const isAdmin = user?.role === ROLES.ADMIN;

  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailTab, setDetailTab] = useState('bookings');
  const [detailBookings, setDetailBookings] = useState([]);
  const [detailBookingsLoading, setDetailBookingsLoading] = useState(false);
  const [detailBookingsError, setDetailBookingsError] = useState('');
  const [detailVouchers, setDetailVouchers] = useState([]);
  const [detailVouchersLoading, setDetailVouchersLoading] = useState(false);
  const [detailVouchersError, setDetailVouchersError] = useState('');
  const [vouchersLoaded, setVouchersLoaded] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter,
        birthdayMonth: birthdayMonthFilter,
      });
      const res = await customerService.list(params);
      setCustomers(res?.data ?? []);
      setPagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách khách hàng.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, birthdayMonthFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    resetPage();
  };

  const handleBirthdayMonthFilterChange = (e) => {
    setBirthdayMonthFilter(e.target.value);
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

  const openEditModal = (customer) => {
    setFormMode('edit');
    setEditing(customer);
    setForm({
      full_name: customer.full_name ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      birthday: customer.birthday ?? '',
      gender: customer.gender ?? '',
      zalo_id: customer.zalo_id ?? '',
      notes: customer.notes ?? '',
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

  const validateForm = () => {
    const next = {};
    if (!form.full_name.trim()) {
      next.full_name = 'Vui lòng nhập họ tên';
    }
    if (!form.phone.trim()) {
      next.phone = 'Vui lòng nhập số điện thoại';
    } else if (!PHONE_REGEX.test(form.phone.trim())) {
      next.phone = 'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)';
    }
    if (form.email && !EMAIL_REGEX.test(form.email)) {
      next.email = 'Email không hợp lệ';
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validateForm()) return;

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      birthday: form.birthday || undefined,
      gender: form.gender || undefined,
      zalo_id: form.zalo_id.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await customerService.create(payload);
        showToast('Đã thêm khách hàng mới.');
      } else {
        await customerService.update(editing.id, payload);
        showToast('Đã cập nhật khách hàng.');
      }
      closeFormModal();
      fetchCustomers();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không thể lưu khách hàng.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await customerService.remove(confirmDelete.id);
      showToast('Đã xóa khách hàng.');
      setConfirmDelete(null);
      fetchCustomers();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể xóa khách hàng.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const fetchDetailBookings = useCallback(async (customerId) => {
    setDetailBookingsLoading(true);
    setDetailBookingsError('');
    try {
      const res = await customerService.listBookings(customerId, {
        page: 1,
        limit: 20,
        sort: 'booking_date:desc',
      });
      setDetailBookings(res?.data ?? []);
    } catch (err) {
      setDetailBookingsError(
        getErrorMessage(err, 'Không thể tải lịch sử booking.'),
      );
    } finally {
      setDetailBookingsLoading(false);
    }
  }, []);

  const fetchDetailVouchers = useCallback(async (customerId) => {
    setDetailVouchersLoading(true);
    setDetailVouchersError('');
    try {
      const res = await customerService.listVouchers(customerId, {
        page: 1,
        limit: 50,
      });
      setDetailVouchers(res?.data ?? []);
    } catch (err) {
      setDetailVouchersError(
        getErrorMessage(err, 'Không thể tải danh sách voucher.'),
      );
    } finally {
      setDetailVouchersLoading(false);
    }
  }, []);

  const openDetailModal = (customer) => {
    setDetailCustomer(customer);
    setDetailTab('bookings');
    setDetailBookings([]);
    setDetailBookingsError('');
    setDetailVouchers([]);
    setDetailVouchersError('');
    setVouchersLoaded(false);
    fetchDetailBookings(customer.id);
  };

  const closeDetailModal = () => {
    setDetailCustomer(null);
    setDetailBookings([]);
    setDetailVouchers([]);
    setDetailBookingsError('');
    setDetailVouchersError('');
    setVouchersLoaded(false);
  };

  const handleDetailTabChange = (tab) => {
    setDetailTab(tab);
    if (
      tab === 'vouchers' &&
      !vouchersLoaded &&
      detailCustomer
    ) {
      setVouchersLoaded(true);
      fetchDetailVouchers(detailCustomer.id);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'full_name',
        label: 'Tên',
        render: (value, row) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">
              {value || '—'}
            </span>
            {row.zalo_id && (
              <span className="text-xs text-gray-400">Đã liên kết Zalo</span>
            )}
          </div>
        ),
      },
      { key: 'phone', label: 'SĐT', render: (v) => v || '—' },
      { key: 'email', label: 'Email', render: (v) => v || '—' },
      {
        key: 'birthday',
        label: 'Sinh nhật',
        render: (v) => (v ? formatDate(v) : '—'),
      },
      {
        key: 'gender',
        label: 'Giới tính',
        render: (v) => (v ? CUSTOMER_GENDER_LABELS[v] ?? v : '—'),
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: (v) => (
          <Badge variant={CUSTOMER_STATUS_BADGE_VARIANT[v] ?? 'default'}>
            {CUSTOMER_STATUS_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'total_visits',
        label: 'Tổng lần',
        render: (v) => (v ?? 0),
      },
      {
        key: 'total_spent',
        label: 'Tổng chi',
        render: (v) => formatCurrency(v),
      },
      {
        key: 'actions',
        label: 'Hành động',
        render: (_v, row) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openDetailModal(row)}
            >
              Chi tiết
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(row)}
            >
              Sửa
            </Button>
            {isAdmin && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmDelete(row)}
              >
                Xóa
              </Button>
            )}
          </div>
        ),
      },
    ];
    return cols;
  }, [isAdmin]);

  const formTitle = formMode === 'create' ? 'Thêm khách' : 'Sửa khách';

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Khách hàng</h1>
        <Button onClick={openCreateModal}>
          <span aria-hidden="true">+</span> Thêm khách
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          name="search"
          type="search"
          placeholder="Tìm theo tên, SĐT, email..."
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
          name="birthdayMonthFilter"
          options={BIRTHDAY_MONTH_OPTIONS}
          value={birthdayMonthFilter}
          onChange={handleBirthdayMonthFilterChange}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchCustomers}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={customers}
        loading={loading}
        emptyText="Chưa có khách hàng"
        rowKey="id"
      />

      {!loading && customers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Tổng:{' '}
            <strong className="text-gray-700">{pagination.total}</strong>{' '}
            khách hàng
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
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="customer-form"
              loading={formSubmitting}
            >
              {formMode === 'create' ? 'Thêm' : 'Lưu'}
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
          id="customer-form"
          onSubmit={handleFormSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          noValidate
        >
          <div className="sm:col-span-2">
            <Input
              label="Họ tên"
              name="full_name"
              value={form.full_name}
              error={formErrors.full_name}
              onChange={handleFormChange}
              placeholder="Nguyễn Văn A"
            />
          </div>
          <Input
            label="Số điện thoại"
            name="phone"
            type="tel"
            value={form.phone}
            error={formErrors.phone}
            onChange={handleFormChange}
            placeholder="0901234567"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            error={formErrors.email}
            onChange={handleFormChange}
            placeholder="khach@example.com"
          />
          <Input
            label="Sinh nhật"
            name="birthday"
            type="date"
            value={form.birthday}
            error={formErrors.birthday}
            onChange={handleFormChange}
          />
          <Select
            label="Giới tính"
            name="gender"
            options={GENDER_FORM_OPTIONS}
            value={form.gender}
            onChange={handleFormChange}
            error={formErrors.gender}
          />
          <Input
            label="Zalo ID"
            name="zalo_id"
            value={form.zalo_id}
            error={formErrors.zalo_id}
            onChange={handleFormChange}
            placeholder="zalo_12345"
          />
          <div className="sm:col-span-2">
            <Input
              label="Ghi chú"
              name="notes"
              value={form.notes}
              error={formErrors.notes}
              onChange={handleFormChange}
              placeholder="Sở thích, ghi chú phục vụ khách..."
            />
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={Boolean(detailCustomer)}
        onClose={closeDetailModal}
        title={
          detailCustomer
            ? `Khách hàng — ${detailCustomer.full_name}`
            : 'Khách hàng'
        }
        size="lg"
      >
        {detailCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-gray-500">SĐT</div>
                <div className="font-medium text-gray-800">
                  {detailCustomer.phone || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Email</div>
                <div className="font-medium text-gray-800">
                  {detailCustomer.email || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Sinh nhật</div>
                <div className="font-medium text-gray-800">
                  {detailCustomer.birthday
                    ? formatDate(detailCustomer.birthday)
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Giới tính</div>
                <div className="font-medium text-gray-800">
                  {detailCustomer.gender
                    ? CUSTOMER_GENDER_LABELS[detailCustomer.gender] ??
                      detailCustomer.gender
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Trạng thái</div>
                <div>
                  <Badge
                    variant={
                      CUSTOMER_STATUS_BADGE_VARIANT[
                        detailCustomer.status
                      ] ?? 'default'
                    }
                  >
                    {CUSTOMER_STATUS_LABELS[detailCustomer.status] ??
                      detailCustomer.status}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Tổng lần</div>
                <div className="font-medium text-gray-800">
                  {detailCustomer.total_visits ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Tổng chi</div>
                <div className="font-medium text-gray-800">
                  {formatCurrency(detailCustomer.total_spent)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Lần ghé cuối</div>
                <div className="font-medium text-gray-800">
                  {detailCustomer.last_visit_at
                    ? formatDateTime(detailCustomer.last_visit_at)
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Zalo ID</div>
                <div className="font-medium text-gray-800">
                  {detailCustomer.zalo_id || '—'}
                </div>
              </div>
              {detailCustomer.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <div className="text-xs text-gray-500">Ghi chú</div>
                  <div className="text-gray-800">
                    {detailCustomer.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-b border-gray-200">
              <button
                type="button"
                onClick={() => handleDetailTabChange('bookings')}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                  detailTab === 'bookings'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Lịch sử booking
              </button>
              <button
                type="button"
                onClick={() => handleDetailTabChange('vouchers')}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                  detailTab === 'vouchers'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Voucher
              </button>
            </div>

            {detailTab === 'bookings' && (
              <div>
                {detailBookingsLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                    <Spinner size="sm" className="mr-2" />
                    Đang tải...
                  </div>
                ) : detailBookingsError ? (
                  <p className="py-8 text-center text-sm text-red-600">
                    {detailBookingsError}
                  </p>
                ) : detailBookings.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Chưa có booking nào.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {detailBookings.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-0.5 text-sm">
                          <div className="font-medium text-gray-800">
                            {b.package_name || 'Gói không tên'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {b.booking_date
                              ? formatDateTime(b.booking_date)
                              : '—'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <Badge
                              variant={
                                BOOKING_STATUS_BADGE_VARIANT[b.status] ??
                                'default'
                              }
                            >
                              {BOOKING_STATUS_LABELS[b.status] ?? b.status}
                            </Badge>
                            <span>{b.photo_count ?? 0} ảnh</span>
                          </div>
                          {b.notes && (
                            <div className="text-xs text-gray-400">
                              {b.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {formatCurrency(b.amount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {detailTab === 'vouchers' && (
              <div>
                {detailVouchersLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                    <Spinner size="sm" className="mr-2" />
                    Đang tải...
                  </div>
                ) : detailVouchersError ? (
                  <p className="py-8 text-center text-sm text-red-600">
                    {detailVouchersError}
                  </p>
                ) : detailVouchers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Chưa có voucher nào.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {detailVouchers.map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-0.5 text-sm">
                          <div className="font-medium text-gray-800">
                            {v.voucher?.name ||
                              v.voucher?.code ||
                              v.voucher_id}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <Badge
                              variant={
                                CUSTOMER_VOUCHER_STATUS_BADGE_VARIANT[
                                  v.status
                                ] ?? 'default'
                              }
                            >
                              {CUSTOMER_VOUCHER_STATUS_LABELS[v.status] ??
                                v.status}
                            </Badge>
                            {v.issued_at && (
                              <span>
                                Phát: {formatDateTime(v.issued_at)}
                              </span>
                            )}
                            {v.expires_at && (
                              <span>
                                Hạn: {formatDateTime(v.expires_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
          Bạn có chắc muốn xóa khách hàng{' '}
          <strong className="text-gray-800">
            {confirmDelete?.full_name}
          </strong>
          ? Hành động này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}
