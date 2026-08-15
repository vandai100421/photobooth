import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import holidayService from '../services/holidayService';
import templateService from '../services/templateService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import Toast from '../components/ui/Toast';
import {
  ROLES,
  HOLIDAY_RECURRING_LABELS,
  HOLIDAY_RECURRING_BADGE_VARIANT,
} from '../utils/constants';

const DATE_REGEX = /^\d{2}-\d{2}$/;

const EMPTY_FORM = {
  name: '',
  date: '',
  is_recurring: true,
  specific_year: '',
  template_id: '',
  is_active: true,
};

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

export default function Holidays() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  const [holidays, setHolidays] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState({ message: '', variant: 'info' });

  const showToast = useCallback(
    (message, variant = 'success') => setToast({ message, variant }),
    [],
  );

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await holidayService.list({ page: 1, limit: 100 });
      const list = res?.data ?? [];
      setHolidays(
        [...list].sort((a, b) =>
          String(a.date).localeCompare(String(b.date)),
        ),
      );
      setTotal(res?.pagination?.total ?? list.length);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách ngày lễ.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await templateService.list({ page: 1, limit: 100 });
      setTemplates(res?.data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const templateOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Không dùng template' }];
    templates.forEach((t) => {
      opts.push({ value: t.id, label: t.name || t.id });
    });
    return opts;
  }, [templates]);

  const openCreateModal = () => {
    setFormMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
    fetchTemplates();
  };

  const openEditModal = (holiday) => {
    setFormMode('edit');
    setEditing(holiday);
    setForm({
      name: holiday.name ?? '',
      date: holiday.date ?? '',
      is_recurring: holiday.is_recurring !== false,
      specific_year:
        holiday.specific_year != null
          ? String(holiday.specific_year)
          : '',
      template_id: holiday.template_id ?? '',
      is_active: holiday.is_active !== false,
    });
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
    fetchTemplates();
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

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const validateForm = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Vui lòng nhập tên ngày lễ';
    if (!form.date.trim()) {
      next.date = 'Vui lòng nhập ngày (MM-DD)';
    } else if (!DATE_REGEX.test(form.date.trim())) {
      next.date = 'Định dạng ngày không hợp lệ (MM-DD)';
    } else {
      const [mm, dd] = form.date.trim().split('-').map(Number);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
        next.date = 'Ngày/tháng không hợp lệ';
      }
    }
    if (form.specific_year !== '') {
      const y = Number(form.specific_year);
      if (!Number.isInteger(y) || y < 1900 || y > 2100) {
        next.specific_year = 'Năm không hợp lệ';
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
      name: form.name.trim(),
      date: form.date.trim(),
      is_recurring: form.is_recurring,
      is_active: form.is_active,
    };
    if (form.specific_year !== '') {
      payload.specific_year = Number(form.specific_year);
    }
    if (form.template_id) payload.template_id = form.template_id;

    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await holidayService.create(payload);
        showToast('Đã thêm ngày lễ.');
      } else {
        await holidayService.update(editing.id, payload);
        showToast('Đã cập nhật ngày lễ.');
      }
      closeFormModal();
      fetchHolidays();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không thể lưu ngày lễ.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await holidayService.remove(confirmDelete.id);
      showToast('Đã xóa ngày lễ.');
      setConfirmDelete(null);
      fetchHolidays();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể xóa ngày lễ.'), 'error');
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
        key: 'date',
        label: 'Ngày',
        render: (v) => (
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">
            {v || '—'}
          </code>
        ),
      },
      {
        key: 'is_recurring',
        label: 'Lặp lại',
        render: (v) => {
          const recurring = Boolean(v);
          return (
            <Badge
              variant={
                HOLIDAY_RECURRING_BADGE_VARIANT[String(recurring)] ??
                'default'
              }
            >
              {HOLIDAY_RECURRING_LABELS[String(recurring)] ??
                (recurring ? 'Hàng năm' : 'Một lần')}
            </Badge>
          );
        },
      },
      {
        key: 'specific_year',
        label: 'Năm cụ thể',
        render: (v) => (v != null ? v : '—'),
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

  const formTitle = formMode === 'create' ? 'Thêm ngày lễ' : 'Sửa ngày lễ';

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Ngày lễ</h1>
        {isAdmin && (
          <Button onClick={openCreateModal}>
            <span aria-hidden="true">+</span> Thêm ngày lễ
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchHolidays}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={holidays}
        loading={loading}
        emptyText="Chưa có ngày lễ"
        rowKey="id"
      />

      {!loading && holidays.length > 0 && (
        <div className="text-sm text-gray-500">
          Tổng: <strong className="text-gray-700">{total}</strong> ngày lễ
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
              form="holiday-form"
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
          id="holiday-form"
          onSubmit={handleFormSubmit}
          className="space-y-3"
          noValidate
        >
          <Input
            label="Tên ngày lễ"
            name="name"
            value={form.name}
            error={formErrors.name}
            onChange={handleFormChange}
            placeholder="Tết Nguyên Đán"
          />
          <Input
            label="Ngày (MM-DD)"
            name="date"
            value={form.date}
            error={formErrors.date}
            onChange={handleFormChange}
            placeholder="01-01"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Năm cụ thể (tùy chọn)"
              name="specific_year"
              type="number"
              min="1900"
              max="2100"
              step="1"
              value={form.specific_year}
              error={formErrors.specific_year}
              onChange={handleFormChange}
              placeholder="Để trống nếu hàng năm"
            />
            <Select
              label="Template tin nhắn"
              name="template_id"
              options={templateOptions}
              value={form.template_id}
              onChange={handleFormChange}
              error={formErrors.template_id}
              disabled={templatesLoading}
            />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="is_recurring"
                checked={form.is_recurring}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Lặp lại hàng năm
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleCheckboxChange}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Đang hoạt động
            </label>
          </div>
        </form>
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
          Bạn có chắc muốn xóa ngày lễ{' '}
          <strong className="text-gray-800">
            {confirmDelete?.name}
          </strong>
          ? Hành động này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}
