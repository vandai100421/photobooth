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
  BOOTH_CODE_STATUS_LABELS,
  BOOTH_CODE_STATUS_BADGE_VARIANT,
  BOOTH_ERROR_REASON_OPTIONS,
  BOOTH_STAFF_STATUS_OPTIONS,
  BOOTH_STAFF_STATUS_BADGE_VARIANT,
  PHOTOBOOTH_CODE_TYPE_LABELS,
} from '../../utils/constants';

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-800">
        {children}
      </span>
    </div>
  );
}

export default function CodeDetailModal({ open, onClose, system, row, onSaved }) {
  const [staffStatus, setStaffStatus] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setStaffStatus(row?.review?.staff_status ?? '');
    setReason(row?.review?.staff_reason ?? '');
    setNote(row?.review?.staff_note ?? '');
  }, [open, row]);

  if (!row) return null;

  const session = row.session;
  const raw = session?.raw ?? {};
  const statusLabel =
    BOOTH_CODE_STATUS_LABELS[row.derived_status] ?? row.derived_status ?? '—';
  const statusVariant =
    BOOTH_CODE_STATUS_BADGE_VARIANT[row.derived_status] ?? 'default';

  const typeLabel =
    system === 'photobooth'
      ? PHOTOBOOTH_CODE_TYPE_LABELS[row.type] ?? row.type ?? '—'
      : row.code_kind ?? '—';

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await boothService.saveCodeReview(system, row.code, {
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
      title={`Chi tiết mã ${row.code || '—'}`}
      size="lg"
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

        <div className="flex items-center gap-2">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {row.review?.staff_status && (
            <Badge
              variant={
                BOOTH_STAFF_STATUS_BADGE_VARIANT[row.review.staff_status] ??
                'default'
              }
            >
              NV: {BOOTH_STAFF_STATUS_OPTIONS.find(
                (o) => o.value === row.review.staff_status,
              )?.label ?? row.review.staff_status}
            </Badge>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
          <InfoRow label="Loại / Gói">{typeLabel}</InfoRow>
          <InfoRow label="Giá trị">
            {row.value != null ? formatCurrency(row.value) : '—'}
          </InfoRow>
          <InfoRow label="Đã trả">
            {row.paid_amount != null ? formatCurrency(row.paid_amount) : '—'}
          </InfoRow>
          <InfoRow label="Ghi chú máy">{row.note || '—'}</InfoRow>
          <InfoRow label="Tạo lúc">
            {row.external_created_at
              ? formatDateTime(row.external_created_at)
              : '—'}
          </InfoRow>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-700">
            Lượt chụp liên kết
          </h4>
          {session ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
              <InfoRow label="Trạng thái máy">
                {session.status || '—'}
              </InfoRow>
              <InfoRow label="Thiết bị">{session.device_name || '—'}</InfoRow>
              <InfoRow label="Giờ chụp">
                {session.captured_at ? formatDateTime(session.captured_at) : '—'}
              </InfoRow>
              <InfoRow label="Số ảnh">{session.media_count ?? 0}</InfoRow>
              {raw.finish_reason ? (
                <InfoRow label="Kết thúc">{raw.finish_reason}</InfoRow>
              ) : null}
              {raw.failure_message || raw.failure_code ? (
                <InfoRow label="Lỗi máy">
                  {raw.failure_message || raw.failure_code}
                </InfoRow>
              ) : null}
              {Number(raw.had_camera_error) > 0 ? (
                <InfoRow label="Lỗi camera">
                  {raw.camera_error_count || raw.had_camera_error} lần
                </InfoRow>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Không tìm thấy lượt chụp tương ứng cho mã này.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700">
            Ghi chú của nhân viên
          </h4>
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
            placeholder="VD: Khách được chụp bù lượt khác"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
