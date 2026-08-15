import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePagination } from '../hooks/usePagination';
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
import { formatDate, formatDateTime } from '../utils/formatDate';
import {
  ROLES,
  ROLE_OPTIONS,
  ROLE_BADGE_VARIANT,
  ROLE_LABELS,
  EMPLOYEE_STATUS_OPTIONS,
  SHIFT_STATUS_OPTIONS,
  SHIFT_STATUS_BADGE_VARIANT,
} from '../utils/constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9,10}$/;
const SEARCH_DEBOUNCE_MS = 400;

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả vai trò' },
  ...ROLE_OPTIONS,
];

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Đã vô hiệu' },
];

const EMPTY_FORM = {
  full_name: '',
  phone: '',
  email: '',
  password: '',
  role: ROLES.STAFF,
  hire_date: '',
  is_active: 'true',
};

const EMPTY_SHIFT_FORM = {
  date: '',
  start_time: '',
  end_time: '',
  notes: '',
};

function buildParams({ page, limit, search, role, isActive }) {
  const params = { page, limit };
  if (search) params.search = search;
  if (role) params.role = role;
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

export default function Employees() {
  const { user } = useAuth();
  const { page, limit, setPage, resetPage } = usePagination();

  const isAdmin = user?.role === ROLES.ADMIN;
  const canManageShifts = isAdmin || user?.role === ROLES.MANAGER;

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [shiftsOpen, setShiftsOpen] = useState(false);
  const [shiftsEmployee, setShiftsEmployee] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT_FORM);
  const [shiftErrors, setShiftErrors] = useState({});
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const [shiftActionId, setShiftActionId] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState({ message: '', variant: 'info' });

  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  // Debounce search input; reset to page 1 whenever the query actually changes
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

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams({
        page,
        limit,
        search: debouncedSearch,
        role: roleFilter,
        isActive: isActiveFilter,
      });
      const res = await employeeService.list(params);
      setEmployees(res?.data ?? []);
      setPagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách nhân viên.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter, isActiveFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleRoleFilterChange = (e) => {
    setRoleFilter(e.target.value);
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

  const openEditModal = (employee) => {
    setFormMode('edit');
    setEditing(employee);
    setForm({
      full_name: employee.full_name ?? '',
      phone: employee.phone ?? '',
      email: employee.email ?? '',
      password: '',
      role: employee.role ?? ROLES.STAFF,
      hire_date: employee.hire_date ?? '',
      is_active: employee.is_active ? 'true' : 'false',
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
    if (formMode === 'create') {
      if (!form.password) {
        next.password = 'Vui lòng nhập mật khẩu';
      } else if (form.password.length < 6) {
        next.password = 'Mật khẩu tối thiểu 6 ký tự';
      }
    } else if (form.password && form.password.length < 6) {
      next.password = 'Mật khẩu tối thiểu 6 ký tự';
    }
    if (!form.role) {
      next.role = 'Vui lòng chọn vai trò';
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
      role: form.role,
      hire_date: form.hire_date || undefined,
    };
    if (form.password) payload.password = form.password;
    if (formMode === 'edit') {
      payload.is_active = form.is_active === 'true';
    }

    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await employeeService.create(payload);
        showToast('Đã thêm nhân viên mới.');
      } else {
        await employeeService.update(editing.id, payload);
        showToast('Đã cập nhật nhân viên.');
      }
      closeFormModal();
      fetchEmployees();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không thể lưu nhân viên.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await employeeService.remove(confirmDelete.id);
      showToast('Đã xóa nhân viên.');
      setConfirmDelete(null);
      fetchEmployees();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể xóa nhân viên.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openShiftsModal = async (employee) => {
    setShiftsEmployee(employee);
    setShiftsOpen(true);
    setShiftForm(EMPTY_SHIFT_FORM);
    setShiftErrors({});
    setShiftError('');
    setShifts([]);
    await fetchShifts(employee.id);
  };

  const closeShiftsModal = () => {
    setShiftsOpen(false);
    setShiftsEmployee(null);
    setShifts([]);
    setShiftError('');
    setShiftErrors({});
  };

  const fetchShifts = async (employeeId) => {
    setShiftsLoading(true);
    setShiftError('');
    try {
      const res = await employeeService.listShifts(employeeId, {
        page: 1,
        limit: 50,
        sort: 'date:desc',
      });
      setShifts(res?.data ?? []);
    } catch (err) {
      setShiftError(getErrorMessage(err, 'Không thể tải ca làm.'));
    } finally {
      setShiftsLoading(false);
    }
  };

  const handleShiftFormChange = (e) => {
    const { name, value } = e.target;
    setShiftForm((prev) => ({ ...prev, [name]: value }));
    if (shiftErrors[name]) {
      setShiftErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateShiftForm = () => {
    const next = {};
    if (!shiftForm.date) next.date = 'Vui lòng chọn ngày';
    if (!shiftForm.start_time) next.start_time = 'Vui lòng chọn giờ bắt đầu';
    if (!shiftForm.end_time) next.end_time = 'Vui lòng chọn giờ kết thúc';
    if (
      shiftForm.start_time &&
      shiftForm.end_time &&
      new Date(shiftForm.end_time) <= new Date(shiftForm.start_time)
    ) {
      next.end_time = 'Giờ kết thúc phải sau giờ bắt đầu';
    }
    setShiftErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    if (!shiftsEmployee) return;
    setShiftError('');
    if (!validateShiftForm()) return;

    // Combine date + time so the API receives a full ISO timestamp.
    const startTime = new Date(shiftForm.start_time).toISOString();
    const endTime = new Date(shiftForm.end_time).toISOString();

    setShiftSubmitting(true);
    try {
      await employeeService.createShift(shiftsEmployee.id, {
        date: shiftForm.date,
        start_time: startTime,
        end_time: endTime,
        notes: shiftForm.notes || undefined,
      });
      setShiftForm(EMPTY_SHIFT_FORM);
      setShiftErrors({});
      showToast('Đã tạo ca làm mới.');
      fetchShifts(shiftsEmployee.id);
    } catch (err) {
      setShiftError(getErrorMessage(err, 'Không thể tạo ca làm.'));
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCheckIn = async (shift) => {
    if (!shiftsEmployee) return;
    setShiftActionId(shift.id);
    try {
      await employeeService.updateShift(shiftsEmployee.id, shift.id, {
        check_in_time: new Date().toISOString(),
      });
      showToast('Đã điểm danh vào ca.');
      fetchShifts(shiftsEmployee.id);
    } catch (err) {
      showToast(getErrorMessage(err, 'Điểm danh thất bại.'), 'error');
    } finally {
      setShiftActionId(null);
    }
  };

  const handleCheckOut = async (shift) => {
    if (!shiftsEmployee) return;
    setShiftActionId(shift.id);
    try {
      await employeeService.updateShift(shiftsEmployee.id, shift.id, {
        check_out_time: new Date().toISOString(),
        status: 'completed',
      });
      showToast('Đã kết thúc ca làm.');
      fetchShifts(shiftsEmployee.id);
    } catch (err) {
      showToast(getErrorMessage(err, 'Kết thúc ca thất bại.'), 'error');
    } finally {
      setShiftActionId(null);
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
            {row.avatar_url && (
              <span className="text-xs text-gray-400">Có ảnh đại diện</span>
            )}
          </div>
        ),
      },
      { key: 'phone', label: 'SĐT', render: (v) => v || '—' },
      { key: 'email', label: 'Email', render: (v) => v || '—' },
      {
        key: 'role',
        label: 'Vai trò',
        render: (v) => (
          <Badge variant={ROLE_BADGE_VARIANT[v] ?? 'default'}>
            {ROLE_LABELS[v] ?? v}
          </Badge>
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
      {
        key: 'hire_date',
        label: 'Ngày vào làm',
        render: (v) => (v ? formatDate(v) : '—'),
      },
    ];

    if (isAdmin || canManageShifts) {
      cols.push({
        key: 'actions',
        label: 'Hành động',
        render: (_v, row) => (
          <div className="flex items-center gap-1.5">
            {canManageShifts && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openShiftsModal(row)}
              >
                Ca làm
              </Button>
            )}
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
      });
    }
    return cols;
  }, [isAdmin, canManageShifts]);

  const formTitle = formMode === 'create' ? 'Thêm nhân viên' : 'Sửa nhân viên';

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Nhân viên</h1>
        {isAdmin && (
          <Button onClick={openCreateModal}>
            <span aria-hidden="true">+</span> Thêm nhân viên
          </Button>
        )}
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
          name="roleFilter"
          options={ROLE_FILTER_OPTIONS}
          value={roleFilter}
          onChange={handleRoleFilterChange}
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
            onClick={fetchEmployees}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={employees}
        loading={loading}
        emptyText="Chưa có nhân viên"
        rowKey="id"
      />

      {!loading && employees.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Tổng: <strong className="text-gray-700">{pagination.total}</strong>{' '}
            nhân viên
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
              form="employee-form"
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
          id="employee-form"
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
            placeholder="nhanvien@tapphotobooth.com"
          />
          <Input
            label={
              formMode === 'create'
                ? 'Mật khẩu'
                : 'Mật khẩu mới (để trống nếu không đổi)'
            }
            name="password"
            type="password"
            value={form.password}
            error={formErrors.password}
            onChange={handleFormChange}
            placeholder="••••••••"
          />
          <Select
            label="Vai trò"
            name="role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={handleFormChange}
            error={formErrors.role}
          />
          <Input
            label="Ngày vào làm"
            name="hire_date"
            type="date"
            value={form.hire_date}
            error={formErrors.hire_date}
            onChange={handleFormChange}
          />
          {formMode === 'edit' && (
            <Select
              label="Trạng thái"
              name="is_active"
              options={EMPLOYEE_STATUS_OPTIONS}
              value={form.is_active}
              onChange={handleFormChange}
            />
          )}
        </form>
      </Modal>

      {/* Shifts modal */}
      <Modal
        open={shiftsOpen}
        onClose={closeShiftsModal}
        title={
          shiftsEmployee
            ? `Ca làm — ${shiftsEmployee.full_name}`
            : 'Ca làm'
        }
        size="lg"
      >
        {canManageShifts && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">
              Tạo ca làm mới
            </h4>
            {shiftError && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {shiftError}
              </div>
            )}
            <form
              onSubmit={handleCreateShift}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              noValidate
            >
              <Input
                label="Ngày"
                name="date"
                type="date"
                value={shiftForm.date}
                error={shiftErrors.date}
                onChange={handleShiftFormChange}
              />
              <Input
                label="Giờ bắt đầu"
                name="start_time"
                type="datetime-local"
                value={shiftForm.start_time}
                error={shiftErrors.start_time}
                onChange={handleShiftFormChange}
              />
              <Input
                label="Giờ kết thúc"
                name="end_time"
                type="datetime-local"
                value={shiftForm.end_time}
                error={shiftErrors.end_time}
                onChange={handleShiftFormChange}
              />
              <Input
                label="Ghi chú"
                name="notes"
                value={shiftForm.notes}
                error={shiftErrors.notes}
                onChange={handleShiftFormChange}
                placeholder="(tùy chọn)"
              />
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" loading={shiftSubmitting}>
                  Tạo ca
                </Button>
              </div>
            </form>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">
              Lịch sử ca làm
            </h4>
            {shiftsEmployee && (
              <button
                type="button"
                onClick={() => fetchShifts(shiftsEmployee.id)}
                className="text-xs text-brand-600 hover:underline"
              >
                Tải lại
              </button>
            )}
          </div>

          {shiftsLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500">
              <Spinner size="sm" className="mr-2" />
              Đang tải...
            </div>
          ) : shifts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Chưa có ca làm nào.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {shifts.map((shift) => (
                <li
                  key={shift.id}
                  className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium text-gray-800">
                      {formatDate(shift.date)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDateTime(shift.start_time)} →{' '}
                      {formatDateTime(shift.end_time)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <Badge
                        variant={
                          SHIFT_STATUS_BADGE_VARIANT[shift.status] ??
                          'default'
                        }
                      >
                        {SHIFT_STATUS_OPTIONS.find(
                          (o) => o.value === shift.status,
                        )?.label ?? shift.status}
                      </Badge>
                      {shift.check_in_time && (
                        <span>
                          Vào: {formatDateTime(shift.check_in_time)}
                        </span>
                      )}
                      {shift.check_out_time && (
                        <span>
                          Ra: {formatDateTime(shift.check_out_time)}
                        </span>
                      )}
                    </div>
                    {shift.notes && (
                      <div className="text-xs text-gray-400">
                        {shift.notes}
                      </div>
                    )}
                  </div>
                  {canManageShifts && (
                    <div className="flex shrink-0 gap-1.5">
                      {!shift.check_in_time && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={shiftActionId === shift.id}
                          onClick={() => handleCheckIn(shift)}
                        >
                          Điểm danh
                        </Button>
                      )}
                      {shift.check_in_time &&
                        !shift.check_out_time && (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={shiftActionId === shift.id}
                            onClick={() => handleCheckOut(shift)}
                          >
                            Kết thúc ca
                          </Button>
                        )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
          Bạn có chắc muốn xóa nhân viên{' '}
          <strong className="text-gray-800">
            {confirmDelete?.full_name}
          </strong>
          ? Hành động này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}
