import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import {
  PORTAL_PAYMENT_METHOD_LABELS,
  PORTAL_PAYMENT_METHOD_BADGE_VARIANT,
} from '../../utils/constants';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'transfer', label: 'Chuyển khoản' },
];

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

export default function RevenueDetailModal({
  open,
  onClose,
  row,
  session,
  onSave,
}) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !row) return;
    setError('');
    setForm({
      room_name: row.room_name ?? '',
      print_count: row.print_count ?? 0,
      amount_required: row.amount_required ?? 0,
      cash_received: row.cash_received ?? 0,
      transfer_amount: row.transfer_amount ?? 0,
      voucher_amount: row.voucher_amount ?? 0,
      payment_method: row.payment_method ?? 'cash',
      note: row.note ?? '',
    });
  }, [open, row]);

  if (!row) return null;

  const update = (field) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({
      ...prev,
      [field]:
        field === 'payment_method' ||
        field === 'room_name' ||
        field === 'note'
          ? value
          : Number(value) || 0,
    }));
  };

  const previewUrl = session?.preview_url ?? '';

  const handleSave = () => {
    if (form.print_count < 0) {
      setError('Số lượt in không hợp lệ.');
      return;
    }
    onSave?.(row.revenue_id, form);
    onClose?.();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chi tiết doanh thu — ${row.session_id || '—'}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSave}>Lưu thay đổi</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
            <InfoRow label="Mã giao dịch">
              {row.revenue_id?.slice(0, 12) || '—'}
            </InfoRow>
            <InfoRow label="Phòng">{row.room_name || '—'}</InfoRow>
            <InfoRow label="Sự kiện">{row.event_name || '—'}</InfoRow>
            <InfoRow label="Thời gian">
              {row.recorded_at ? formatDateTime(row.recorded_at) : '—'}
            </InfoRow>
            <InfoRow label="Phương thức">
              <Badge
                variant={
                  PORTAL_PAYMENT_METHOD_BADGE_VARIANT[row.payment_method] ??
                  'default'
                }
              >
                {PORTAL_PAYMENT_METHOD_LABELS[row.payment_method] ??
                  row.payment_method ??
                  '—'}
              </Badge>
            </InfoRow>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-3">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Preview ${row.session_id || ''}`}
                className="max-h-48 w-full rounded-lg border border-gray-200 object-contain"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
                Không có ảnh preview
              </div>
            )}
            {session && (
              <p className="mt-2 text-xs text-gray-500">
                {session.media_count ?? session.raw?.photos_captured ?? 0} ảnh
                trong lượt chụp
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700">
            Chỉnh sửa nội dung chi tiết
          </h4>
          <Input
            label="Tên phòng"
            name="room_name"
            value={form.room_name}
            onChange={update('room_name')}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Số lượt in"
              name="print_count"
              type="number"
              min="0"
              value={form.print_count}
              onChange={update('print_count')}
            />
            <Select
              label="Phương thức thanh toán"
              name="payment_method"
              value={form.payment_method}
              onChange={update('payment_method')}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Tiền phải trả (đ)"
              name="amount_required"
              type="number"
              min="0"
              step="1000"
              value={form.amount_required}
              onChange={update('amount_required')}
            />
            <Input
              label="Tiền mặt (đ)"
              name="cash_received"
              type="number"
              min="0"
              step="1000"
              value={form.cash_received}
              onChange={update('cash_received')}
            />
            <Input
              label="Chuyển khoản (đ)"
              name="transfer_amount"
              type="number"
              min="0"
              step="1000"
              value={form.transfer_amount}
              onChange={update('transfer_amount')}
            />
            <Input
              label="Voucher (đ)"
              name="voucher_amount"
              type="number"
              min="0"
              step="1000"
              value={form.voucher_amount}
              onChange={update('voucher_amount')}
            />
          </div>
          <Input
            label="Ghi chú"
            name="note"
            value={form.note}
            onChange={update('note')}
          />
        </div>

        <p className="text-xs text-gray-400">
          Thay đổi được lưu tạm trên giao diện (chưa đồng bộ về máy chụp).
        </p>
      </div>
    </Modal>
  );
}

