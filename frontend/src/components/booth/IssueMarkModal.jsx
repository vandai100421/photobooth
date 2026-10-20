import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import boothService from '../../services/boothService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import {
  BOOTH_ERROR_REASON_OPTIONS,
  BOOTH_STAFF_STATUS_OPTIONS,
  BOOTH_STAFF_STATUS_BADGE_VARIANT,
  BOOTH_SYSTEM_LABELS,
} from '../../utils/constants';

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

// Đánh dấu 1 lượt chụp là lỗi / bình thường + lý do (chất lượng ảnh, in...).
// Gắn theo session_id nếu có, không có thì theo mã — backend tự gộp khóa.
export default function IssueMarkModal({ open, onClose, row, onSaved }) {
  const [staffStatus, setStaffStatus] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !row) return;
    setError('');
    setStaffStatus(row.staff_status ?? (row.status === 'error' ? 'error' : ''));
    setReason(row.reason ?? '');
    setNote(row.note ?? '');
  }, [open, row]);

  if (!row) return null;

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await boothService.saveReview(row.system, {
        ...(row.mark_target || {}),
        staff_status: staffStatus || null,
        staff_reason: reason || null,
        staff_note: note || null,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Không lưu được ghi chú.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ghi chú xử lý ca chụp"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Lưu ghi chú
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-800">
              {BOOTH_SYSTEM_LABELS[row.system] ?? row.system}
            </span>
            {row.code ? (
              <Badge variant="info">Mã {row.code}</Badge>
            ) : (
              <Badge variant="default">Khách trực tiếp</Badge>
            )}
            {row.status === 'error' && (
              <Badge variant="danger">Đang tính là ca lỗi</Badge>
            )}
          </div>
          <p className="mt-1 text-gray-600">
            {row.used_at ? formatDateTime(row.used_at) : '—'} ·{' '}
            {row.room_name || row.event_name || row.machine_name || '—'} ·{' '}
            {formatCurrency(row.amount, '0đ')}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Ghi chú này áp dụng cho chính ca chụp này (lượt chụp
            {row.session_id ? ` ${row.session_id}` : ''}). Ca bị đánh dấu "Báo
            lỗi" sẽ KHÔNG tính vào doanh thu thực nhận.
          </p>
        </div>

        <Select
          label="Trạng thái xử lý"
          name="staff_status"
          value={staffStatus}
          onChange={(e) => setStaffStatus(e.target.value)}
          options={[
            { value: '', label: '— Chưa đánh dấu —' },
            ...BOOTH_STAFF_STATUS_OPTIONS,
          ]}
        />
        <Select
          label="Lý do"
          name="staff_reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            { value: '', label: '— Chọn lý do —' },
            ...BOOTH_ERROR_REASON_OPTIONS,
          ]}
        />
        <Input
          label="Ghi chú chi tiết"
          name="staff_note"
          placeholder="VD: Ảnh bị noise nhiều, đã chụp bù cho khách"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {row.staff_status && (
          <p className="text-xs text-gray-500">
            Trạng thái hiện tại:{' '}
            {
              BOOTH_STAFF_STATUS_OPTIONS.find(
                (o) => o.value === row.staff_status,
              )?.label
            }{' '}
            {row.reason ? `· ${row.reason}` : ''}
          </p>
        )}
      </div>
    </Modal>
  );
}
