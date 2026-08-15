import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import settingsService from '../services/settingsService';
import { ROLES } from '../utils/constants';

const SENSITIVE_KEYS = new Set([
  'zalo_access_token',
  'gmail_app_password',
]);

const ZALO_OA_URL = (oaId) => `https://zalo.me/o/${oaId}`;

const EMPTY_FORM = {
  shop_name: '',
  zalo_oa_id: '',
  zalo_access_token: '',
  gmail_address: '',
  gmail_app_password: '',
  cron_schedule: '0 8 * * *',
  voucher_expiry_days: '14',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRON_REGEX = /^(\S+\s+){4}\S+$/;

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

function toFormObject(settingsArray) {
  const obj = { ...EMPTY_FORM };
  if (!Array.isArray(settingsArray)) return obj;
  settingsArray.forEach((item) => {
    if (item && item.key) {
      obj[item.key] = item.value ?? '';
    }
  });
  for (const key of SENSITIVE_KEYS) {
    obj[key] = '';
  }
  return obj;
}

function Section({ title, description, children, footer }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
      {footer && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          {footer}
        </div>
      )}
    </section>
  );
}

function PasswordInput({ label, name, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="w-full">
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-gray-500 hover:text-gray-700"
          aria-label={show ? 'Ẩn' : 'Hiện'}
          tabIndex={-1}
        >
          {show ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === ROLES.ADMIN;

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingSection, setSavingSection] = useState('');

  const [qrLoading, setQrLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrError, setQrError] = useState('');

  const [testingEmail, setTestingEmail] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await settingsService.list();
      setForm(toFormObject(res?.data));
    } catch (err) {
      setError(
        getErrorMessage(err, 'Không thể tải cấu hình. Vui lòng thử lại.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveSection = async (section, keys) => {
    if (!isAdmin) return;
    const payload = {};
    for (const key of keys) {
      const value = form[key];
      if (SENSITIVE_KEYS.has(key) && !value) {
        continue;
      }
      payload[key] = value;
    }
    setSavingSection(section);
    try {
      await settingsService.update(payload);
      toast.success('Đã lưu cài đặt.');
      for (const key of keys) {
        if (SENSITIVE_KEYS.has(key)) {
          setForm((prev) => ({ ...prev, [key]: '' }));
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể lưu cài đặt.'));
    } finally {
      setSavingSection('');
    }
  };

  const handleLoadQR = async () => {
    setQrLoading(true);
    setQrError('');
    setQrUrl('');
    try {
      const res = await settingsService.getZaloQR();
      const remoteUrl = res?.data?.qr_code_url;
      if (remoteUrl) {
        setQrUrl(remoteUrl);
        return;
      }
      await generateLocalQR();
    } catch (err) {
      try {
        await generateLocalQR();
      } catch (genErr) {
        setQrError(
          getErrorMessage(genErr, 'Không thể tạo QR code. Vui lòng nhập OA ID.'),
        );
      }
    } finally {
      setQrLoading(false);
    }
  };

  const generateLocalQR = async () => {
    const oaId = form.zalo_oa_id?.trim();
    if (!oaId) {
      throw new Error('Vui lòng nhập Zalo OA ID để tạo QR.');
    }
    const dataUrl = await QRCode.toDataURL(ZALO_OA_URL(oaId), {
      width: 256,
      margin: 2,
    });
    setQrUrl(dataUrl);
  };

  const handleDownloadQR = async () => {
    let dataUrl = qrUrl;
    if (!dataUrl) return;
    if (!dataUrl.startsWith('data:')) {
      try {
        dataUrl = await QRCode.toDataURL(
          ZALO_OA_URL(form.zalo_oa_id.trim()),
          { width: 512, margin: 2 },
        );
      } catch {
        window.open(qrUrl, '_blank');
        return;
      }
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `zalo-oa-qr-${form.zalo_oa_id || 'tap'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTestEmail = async () => {
    if (!form.gmail_address) {
      toast.warning('Vui lòng nhập địa chỉ Gmail trước khi test.');
      return;
    }
    if (!EMAIL_REGEX.test(form.gmail_address)) {
      toast.warning('Địa chỉ Gmail không hợp lệ.');
      return;
    }
    setTestingEmail(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast.info(
        'Tính năng gửi email test sẽ khả dụng khi cấu hình Gmail hoàn tất.',
      );
    } finally {
      setTestingEmail(false);
    }
  };

  const shopValid = form.shop_name.trim().length > 0;
  const gmailValid =
    !form.gmail_address || EMAIL_REGEX.test(form.gmail_address);
  const cronValid =
    !form.cron_schedule || CRON_REGEX.test(form.cron_schedule.trim());
  const expiryValid =
    form.voucher_expiry_days === '' ||
    (Number.isInteger(Number(form.voucher_expiry_days)) &&
      Number(form.voucher_expiry_days) > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cài đặt</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Quản lý thông tin quán, Zalo OA, Gmail và tự động hóa.
          </p>
        </div>
        {!isAdmin && (
          <Badge variant="warning">Chỉ xem (cần Admin để chỉnh sửa)</Badge>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchSettings}
            className="ml-2 underline hover:text-red-800"
          >
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <Skeleton lines={6} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <Skeleton lines={6} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section
            title="Thông tin quán"
            description="Tên hiển thị của quán photobooth."
            footer={
              <Button
                onClick={() => saveSection('shop', ['shop_name'])}
                loading={savingSection === 'shop'}
                disabled={!isAdmin || !shopValid}
              >
                Lưu
              </Button>
            }
          >
            <Input
              label="Tên quán"
              name="shop_name"
              value={form.shop_name}
              onChange={handleChange}
              placeholder="TAP Photobooth"
              disabled={!isAdmin}
            />
          </Section>

          <Section
            title="Zalo OA"
            description="Cấu hình Official Account để gửi tin nhắn Zalo."
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={handleLoadQR}
                  loading={qrLoading}
                  disabled={!form.zalo_oa_id}
                >
                  Lấy QR code
                </Button>
                <Button
                  onClick={() =>
                    saveSection('zalo', [
                      'zalo_oa_id',
                      'zalo_access_token',
                    ])
                  }
                  loading={savingSection === 'zalo'}
                  disabled={!isAdmin}
                >
                  Lưu
                </Button>
              </>
            }
          >
            <Input
              label="Zalo OA ID"
              name="zalo_oa_id"
              value={form.zalo_oa_id}
              onChange={handleChange}
              placeholder="1234567890"
              disabled={!isAdmin}
            />
            <PasswordInput
              label="Zalo Access Token"
              name="zalo_access_token"
              value={form.zalo_access_token}
              onChange={handleChange}
              placeholder="Để trống nếu không đổi"
            />

            {(qrUrl || qrError || qrLoading) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">
                    QR code Zalo OA
                  </h4>
                  {qrUrl && !qrLoading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadQR}
                    >
                      Tải QR
                    </Button>
                  )}
                </div>
                {qrLoading && (
                  <div className="flex h-64 items-center justify-center">
                    <Skeleton height={256} lines={1} />
                  </div>
                )}
                {qrError && !qrLoading && (
                  <p className="py-8 text-center text-sm text-red-600">
                    {qrError}
                  </p>
                )}
                {qrUrl && !qrLoading && (
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={qrUrl}
                      alt="Zalo OA QR"
                      className="h-64 w-64 rounded-lg border border-gray-200 bg-white object-contain p-2"
                    />
                    <a
                      href={ZALO_OA_URL(form.zalo_oa_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {ZALO_OA_URL(form.zalo_oa_id)}
                    </a>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section
            title="Gmail"
            description="Tài khoản Gmail dùng để gửi email (SMTP)."
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={handleTestEmail}
                  loading={testingEmail}
                >
                  Gửi email test
                </Button>
                <Button
                  onClick={() =>
                    saveSection('gmail', [
                      'gmail_address',
                      'gmail_app_password',
                    ])
                  }
                  loading={savingSection === 'gmail'}
                  disabled={!isAdmin || !gmailValid}
                >
                  Lưu
                </Button>
              </>
            }
          >
            <Input
              label="Địa chỉ Gmail"
              name="gmail_address"
              type="email"
              value={form.gmail_address}
              onChange={handleChange}
              placeholder="tapphotobooth@gmail.com"
              disabled={!isAdmin}
              error={
                form.gmail_address && !gmailValid
                  ? 'Email không hợp lệ'
                  : undefined
              }
            />
            <PasswordInput
              label="Gmail App Password"
              name="gmail_app_password"
              value={form.gmail_app_password}
              onChange={handleChange}
              placeholder="Để trống nếu không đổi"
            />
            {!gmailValid && (
              <p className="text-xs text-red-600">
                Địa chỉ Gmail không hợp lệ.
              </p>
            )}
          </Section>

          <Section
            title="Tự động hóa"
            description="Lịch cron và thông số voucher tự động."
            footer={
              <Button
                onClick={() =>
                  saveSection('automation', [
                    'cron_schedule',
                    'voucher_expiry_days',
                  ])
                }
                loading={savingSection === 'automation'}
                disabled={!isAdmin || !cronValid || !expiryValid}
              >
                Lưu
              </Button>
            }
          >
            <Input
              label="Lịch cron (hàng ngày)"
              name="cron_schedule"
              value={form.cron_schedule}
              onChange={handleChange}
              placeholder="0 8 * * *"
              disabled={!isAdmin}
              error={
                form.cron_schedule && !cronValid
                  ? 'Cú pháp cron không hợp lệ (5 trường)'
                  : undefined
              }
            />
            <p className="text-xs text-gray-500">
              VD: <code className="rounded bg-gray-100 px-1">0 8 * * *</code>{' '}
              = 8h sáng hàng ngày.
            </p>
            <Input
              label="Hạn voucher (ngày)"
              name="voucher_expiry_days"
              type="number"
              min="1"
              value={form.voucher_expiry_days}
              onChange={handleChange}
              placeholder="14"
              disabled={!isAdmin}
              error={
                form.voucher_expiry_days && !expiryValid
                  ? 'Phải là số nguyên dương'
                  : undefined
              }
            />
          </Section>
        </div>
      )}
    </div>
  );
}
