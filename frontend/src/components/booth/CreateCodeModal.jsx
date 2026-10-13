import { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import boothService from '../../services/boothService';
import {
  BOOTH_NOTE_OPTIONS,
  PHOTOBOOTH_CODE_TYPE_OPTIONS,
  SELFBOOTH_CODE_KIND_OPTIONS,
} from '../../utils/constants';

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

function packageLabel(pkg) {
  const name = pkg.name || pkg.title || pkg.package_name || pkg.id;
  const price = pkg.price ?? pkg.price_vnd ?? pkg.value ?? pkg.amount;
  return price != null ? `${name} — ${Number(price).toLocaleString('vi-VN')}đ` : String(name);
}

export default function CreateCodeModal({ open, onClose, system, onCreated }) {
  const isSelfbooth = system === 'selfbooth';

  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageId, setPackageId] = useState('');
  const [kind, setKind] = useState('single');
  const [giftCode, setGiftCode] = useState('');
  const [type, setType] = useState('cash');
  const [value, setValue] = useState('40000');
  const [count, setCount] = useState('1');
  const [note, setNote] = useState(BOOTH_NOTE_OPTIONS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
    setError('');
    try {
      const res = await boothService.packages('selfbooth');
      const list = res?.data ?? [];
      setPackages(Array.isArray(list) ? list : []);
      if (Array.isArray(list) && list.length && !packageId) {
        setPackageId(String(list[0].id ?? list[0].package_id ?? ''));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách gói chụp.'));
    } finally {
      setLoadingPackages(false);
    }
  }, [packageId]);

  useEffect(() => {
    if (open && isSelfbooth) loadPackages();
  }, [open, isSelfbooth, loadPackages]);

  useEffect(() => {
    if (open) {
      setError('');
      setCount('1');
      setNote(BOOTH_NOTE_OPTIONS[0].value);
      setType('cash');
      setValue('40000');
      setKind('single');
      setGiftCode('');
    }
  }, [open]);

  const handleSubmit = async () => {
    setError('');
    const countNum = Number(count) || 1;
    if (isSelfbooth) {
      if (!packageId) {
        setError('Vui lòng chọn gói chụp.');
        return;
      }
    } else {
      const valueNum = Number(value);
      if (!Number.isFinite(valueNum) || valueNum < 0) {
        setError('Giá trị không hợp lệ.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = isSelfbooth
        ? {
            code: giftCode.trim(),
            kind,
            count: countNum,
            note,
            package_id: packageId,
          }
        : {
            count: countNum,
            note,
            type,
            value: Number(value),
            valid_from: '',
            valid_until: '',
          };
      await boothService.createCode(system, payload);
      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được mã chụp.'));
    } finally {
      setSubmitting(false);
    }
  };

  const packageOptions = packages.map((p) => ({
    value: String(p.id ?? p.package_id ?? ''),
    label: packageLabel(p),
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Tạo mã chụp — ${isSelfbooth ? 'Selfbooth' : 'Photobooth'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Tạo mã
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {isSelfbooth ? (
          <div className="space-y-3">
            <Select
              label="Gói chụp"
              name="package_id"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              placeholder={loadingPackages ? 'Đang tải gói...' : 'Chọn gói chụp'}
              options={packageOptions}
              disabled={loadingPackages}
            />
            <Select
              label="Loại mã"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={SELFBOOTH_CODE_KIND_OPTIONS}
            />
            <Input
              label="Mã chụp (tuỳ chọn)"
              name="code"
              placeholder="Bỏ trống để hệ thống tự sinh"
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value)}
            />
          </div>
        ) : (
          <>
            <Select
              label="Loại mã"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={PHOTOBOOTH_CODE_TYPE_OPTIONS}
            />
            <Input
              label="Giá trị (đ)"
              name="value"
              type="number"
              min="0"
              step="1000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </>
        )}

        <Input
          label="Số lượng mã"
          name="count"
          type="number"
          min="1"
          max="100"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />

        <Select
          label="Ghi chú"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          options={BOOTH_NOTE_OPTIONS}
        />
      </div>
    </Modal>
  );
}
