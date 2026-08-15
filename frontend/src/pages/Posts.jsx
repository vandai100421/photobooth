import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePagination } from '../hooks/usePagination';
import postService from '../services/postService';
import uploadService from '../services/uploadService';
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
import {
  ROLES,
  POST_STATUS,
  POST_STATUS_OPTIONS,
  POST_STATUS_BADGE_VARIANT,
  POST_STATUS_LABELS,
  POST_STATUS_FILTER_OPTIONS,
} from '../utils/constants';

const SEARCH_DEBOUNCE_MS = 400;

const EMPTY_FORM = {
  title: '',
  content: '',
  excerpt: '',
  image_url: '',
  status: POST_STATUS.DRAFT,
  scheduled_at: '',
};

function buildParams({ page, limit, search, status }) {
  const params = { page, limit };
  if (search) params.search = search;
  if (status) params.status = status;
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

function Textarea({ label, error, id, className = '', rows = 4, ...props }) {
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

export default function Posts() {
  const { user } = useAuth();
  const { page, limit, setPage, resetPage } = usePagination();

  const isAdmin = user?.role === ROLES.ADMIN;
  const isManager = user?.role === ROLES.MANAGER;
  const canManage = isAdmin || isManager;

  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');

  const [publishingId, setPublishingId] = useState(null);

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

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter,
      });
      const res = await postService.list(params);
      setPosts(res?.data ?? []);
      setPagination(
        res?.pagination ?? {
          total: res?.data?.length ?? 0,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách bài viết.'));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    resetPage();
  };

  const openCreateModal = () => {
    setFormMode('create');
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setImageError('');
    setFormOpen(true);
  };

  const openEditModal = (post) => {
    setFormMode('edit');
    setEditing(post);
    setForm({
      title: post.title ?? '',
      content: post.content ?? '',
      excerpt: post.excerpt ?? '',
      image_url: post.image_url ?? '',
      status: post.status ?? POST_STATUS.DRAFT,
      scheduled_at: post.scheduled_at
        ? toDatetimeLocalValue(post.scheduled_at)
        : '',
    });
    setFormErrors({});
    setFormError('');
    setImageError('');
    setFormOpen(true);
  };

  const closeFormModal = () => {
    setFormOpen(false);
    setFormError('');
    setFormErrors({});
    setImageError('');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    setImageUploading(true);
    try {
      const res = await uploadService.upload(file);
      const url = res?.data?.url || res?.url;
      if (!url) throw new Error('No url returned');
      setForm((prev) => ({ ...prev, image_url: url }));
      showToast('Đã tải ảnh lên.');
    } catch (err) {
      setImageError(getErrorMessage(err, 'Tải ảnh thất bại.'));
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, image_url: '' }));
  };

  const validateForm = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Vui lòng nhập tiêu đề';
    if (!form.content.trim()) next.content = 'Vui lòng nhập nội dung';
    if (form.scheduled_at) {
      const d = new Date(form.scheduled_at);
      if (Number.isNaN(d.getTime())) {
        next.scheduled_at = 'Thời gian không hợp lệ';
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
      title: form.title.trim(),
      content: form.content.trim(),
      status: form.status,
    };
    if (form.excerpt.trim()) payload.excerpt = form.excerpt.trim();
    if (form.image_url) payload.image_url = form.image_url;
    if (form.scheduled_at) {
      payload.scheduled_at = new Date(form.scheduled_at).toISOString();
    }

    setFormSubmitting(true);
    try {
      if (formMode === 'create') {
        await postService.create(payload);
        showToast('Đã tạo bài viết.');
      } else {
        await postService.update(editing.id, payload);
        showToast('Đã cập nhật bài viết.');
      }
      closeFormModal();
      fetchPosts();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không thể lưu bài viết.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handlePublish = async (post) => {
    setPublishingId(post.id);
    try {
      await postService.publish(post.id);
      showToast('Đã đăng bài viết.');
      fetchPosts();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể đăng bài viết.'), 'error');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await postService.remove(confirmDelete.id);
      showToast('Đã xóa bài viết.');
      setConfirmDelete(null);
      fetchPosts();
    } catch (err) {
      showToast(getErrorMessage(err, 'Không thể xóa bài viết.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'title',
        label: 'Tiêu đề',
        render: (v) => (
          <span className="font-medium text-gray-900">{v || '—'}</span>
        ),
      },
      {
        key: 'slug',
        label: 'Slug',
        render: (v) => (
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
            {v || '—'}
          </code>
        ),
      },
      {
        key: 'excerpt',
        label: 'Trích dẫn',
        render: (v) => (
          <span className="block max-w-xs truncate text-xs text-gray-500">
            {v || '—'}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Trạng thái',
        render: (v) => (
          <Badge variant={POST_STATUS_BADGE_VARIANT[v] ?? 'default'}>
            {POST_STATUS_LABELS[v] ?? v}
          </Badge>
        ),
      },
      {
        key: 'image_url',
        label: 'Ảnh',
        render: (v) =>
          v ? (
            <img
              src={v}
              alt=""
              className="h-10 w-14 rounded border border-gray-200 object-cover"
            />
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
      {
        key: 'published_at',
        label: 'Ngày đăng',
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        key: 'author',
        label: 'Tác giả',
        render: (_v, row) =>
          row.author?.full_name || row.author_name || '—',
      },
    ];

    if (canManage) {
      cols.push({
        key: 'actions',
        label: 'Hành động',
        render: (_v, row) => (
          <div className="flex items-center gap-1.5">
            {row.status !== POST_STATUS.PUBLISHED && (
              <Button
                variant="secondary"
                size="sm"
                loading={publishingId === row.id}
                onClick={() => handlePublish(row)}
              >
                Đăng ngay
              </Button>
            )}
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
  }, [canManage, publishingId]);

  const formTitle = formMode === 'create' ? 'Tạo bài viết' : 'Sửa bài viết';

  return (
    <div className="space-y-4">
      <Toast
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ message: '', variant: 'info' })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Bài viết</h1>
        {canManage && (
          <Button onClick={openCreateModal}>
            <span aria-hidden="true">+</span> Tạo bài viết
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          name="search"
          type="search"
          placeholder="Tìm theo tiêu đề, nội dung..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          name="statusFilter"
          options={POST_STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={handleStatusFilterChange}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchPosts}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={posts}
        loading={loading}
        emptyText="Chưa có bài viết"
        rowKey="id"
      />

      {!loading && posts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Tổng: <strong className="text-gray-700">{pagination.total}</strong>{' '}
            bài viết
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
              form="post-form"
              loading={formSubmitting}
              disabled={imageUploading}
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
          id="post-form"
          onSubmit={handleFormSubmit}
          className="space-y-3"
          noValidate
        >
          <Input
            label="Tiêu đề"
            name="title"
            value={form.title}
            error={formErrors.title}
            onChange={handleFormChange}
            placeholder="Khuyến mãi mùa hè 2024"
          />
          <Textarea
            label="Nội dung"
            name="content"
            rows={8}
            value={form.content}
            error={formErrors.content}
            onChange={handleFormChange}
            placeholder="Nội dung bài viết..."
          />
          <Textarea
            label="Trích dẫn (tùy chọn)"
            name="excerpt"
            rows={3}
            value={form.excerpt}
            error={formErrors.excerpt}
            onChange={handleFormChange}
            placeholder="Tóm tắt ngắn hiển thị ở danh sách..."
          />

          <div className="w-full">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Ảnh bài viết
            </label>
            {form.image_url ? (
              <div className="flex items-center gap-3">
                <img
                  src={form.image_url}
                  alt="preview"
                  className="h-20 w-28 rounded-lg border border-gray-200 object-cover"
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-gray-500">Đã tải lên</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveImage}
                  >
                    Xóa ảnh
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={imageUploading}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                />
                {imageUploading && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <Spinner size="sm" /> Đang tải...
                  </span>
                )}
              </div>
            )}
            {imageError && (
              <p className="mt-1 text-xs text-red-600">{imageError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Trạng thái"
              name="status"
              options={POST_STATUS_OPTIONS}
              value={form.status}
              onChange={handleFormChange}
              error={formErrors.status}
            />
            <Input
              label="Lịch đăng (tùy chọn)"
              name="scheduled_at"
              type="datetime-local"
              value={form.scheduled_at}
              error={formErrors.scheduled_at}
              onChange={handleFormChange}
            />
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
          Bạn có chắc muốn xóa bài viết{' '}
          <strong className="text-gray-800">
            {confirmDelete?.title}
          </strong>
          ? Hành động này không thể hoàn tác.
        </p>
      </Modal>
    </div>
  );
}
