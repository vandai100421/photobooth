import { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import boothService from '../../services/boothService';
import { BOOTH_SYSTEM_OPTIONS } from '../../utils/constants';

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    fallback ||
    'Đã có lỗi xảy ra.'
  );
}

const EMPTY = {
  baseUrl: '',
  loginPath: '',
  studioId: '',
  tenant: '',
  email: '',
  password: '',
  token: '',
};

export default function BoothAccountModal({ open, onClose, onSaved }) {
  const [forms, setForms] = useState({ photobooth: EMPTY, selfbooth: EMPTY });
  const [loading, setLoading] = useState(false);
  const [savingSystem, setSavingSystem] = useState('');
  const [testingSystem, setTestingSystem] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await boothService.accounts();
      const data = res?.data ?? {};
      setForms({
        photobooth: { ...EMPTY, ...(data.photobooth || {}) },
        selfbooth: { ...EMPTY, ...(data.selfbooth || {}) },
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được cấu hình tài khoản.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMessage('');
      setError('');
      load();
    }
  }, [open, load]);

  const update = (system, key, value) => {
    setForms((prev) => ({
      ...prev,
      [system]: { ...prev[system], [key]: value },
    }));
  };

  const handleSave = async (system) => {
    setSavingSystem(system);
    setError('');
    setMessage('');
    try {
      const f = forms[system];
      const payload =
        system === 'selfbooth'
          ? {
              baseUrl: f.baseUrl || undefined,
              studioId: f.studioId || undefined,
              token: f.token || undefined,
            }
          : {
              baseUrl: f.baseUrl || undefined,
              loginPath: f.loginPath || undefined,
              tenant: f.tenant || undefined,
              email: f.email || undefined,
              password: f.password || undefined,
              token: f.token || undefined,
            };
      await boothService.saveAccount(system, payload);
      setMessage(`Đã lưu cấu hình ${system}.`);
      await load();
      onSaved?.();
    } catch (err) {
      setError(getErrorMessage(err, `Không lưu được cấu hình ${system}.`));
    } finally {
      setSavingSystem('');
    }
  };

  const handleLogin = async (system) => {
    setTestingSystem(system);
    setError('');
    setMessage('');
    try {
      await boothService.login(system);
      setMessage(`Đăng nhập ${system} thành công.`);
      await load();
      onSaved?.();
    } catch (err) {
      setError(getErrorMessage(err, `Đăng nhập ${system} thất bại.`));
    } finally {
      setTestingSystem('');
    }
  };

  const renderSection = (system) => {
    const f = forms[system];
    const label = system === 'selfbooth' ? 'Selfbooth' : 'Photobooth';
    const busy = savingSystem === system || testingSystem === system;

    if (system === 'selfbooth') {
      return (
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
            <span
              className={`text-xs font-medium ${
                f.connected ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {f.connected ? '● Đã kết nối' : '○ Chưa kết nối'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Base URL"
                name={`${system}-baseUrl`}
                value={f.baseUrl || ''}
                onChange={(e) => update(system, 'baseUrl', e.target.value)}
                placeholder="https://boothme.tech"
              />
            </div>
            <Input
              label="Studio ID"
              name={`${system}-studioId`}
              value={f.studioId || ''}
              onChange={(e) => update(system, 'studioId', e.target.value)}
              placeholder="17"
            />
            <div className="sm:col-span-2">
              <Input
                label="Cookie / Token phiên (dán thủ công)"
                name={`${system}-token`}
                value={f.token || ''}
                onChange={(e) => update(system, 'token', e.target.value)}
                placeholder="vd: sb_session=...; sb_token=..."
              />
              <p className="mt-1 text-xs text-gray-400">
                boothme.tech chặn đăng nhập tự động bằng Cloudflare Turnstile nên
                phải lấy cookie thủ công. Mở boothme.tech trong trình duyệt → đăng
                nhập → F12 → Application → Cookies, copy tất cả cookie của domain
                boothme.tech dán vào đây → bấm Lưu.
              </p>
            </div>
          </div>

          <div className="mt-3">
            <Button
              size="sm"
              onClick={() => handleSave(system)}
              loading={savingSystem === system}
              disabled={busy}
            >
              Lưu
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
          <span
            className={`text-xs font-medium ${
              f.connected ? 'text-green-600' : 'text-gray-400'
            }`}
          >
            {f.connected ? '● Đã kết nối' : '○ Chưa kết nối'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Base URL"
              name={`${system}-baseUrl`}
              value={f.baseUrl || ''}
              onChange={(e) => update(system, 'baseUrl', e.target.value)}
              placeholder="https://photobooth-api.boothstudio2026.workers.dev"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Đường dẫn đăng nhập (nâng cao)"
              name={`${system}-loginPath`}
              value={f.loginPath || ''}
              onChange={(e) => update(system, 'loginPath', e.target.value)}
              placeholder="/auth/login"
            />
            <p className="mt-1 text-xs text-gray-400">
              Bỏ trống để dùng mặc định. Chỉ đổi khi API dùng đường dẫn khác.
            </p>
          </div>
          <Input
            label="Tenant"
            name={`${system}-tenant`}
            value={f.tenant || ''}
            onChange={(e) => update(system, 'tenant', e.target.value)}
            placeholder="thetap@studio.vn"
          />
          <Input
            label="Email đăng nhập"
            name={`${system}-email`}
            type="email"
            autoComplete="off"
            value={f.email || ''}
            onChange={(e) => update(system, 'email', e.target.value)}
          />
          <Input
            label="Mật khẩu"
            name={`${system}-password`}
            type="password"
            autoComplete="new-password"
            value={f.password || ''}
            onChange={(e) => update(system, 'password', e.target.value)}
            placeholder="••••••"
          />
          <Input
            label="Token tĩnh (nếu có)"
            name={`${system}-token`}
            value={f.token || ''}
            onChange={(e) => update(system, 'token', e.target.value)}
            placeholder="Dán token nếu không dùng đăng nhập"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleSave(system)}
            loading={savingSystem === system}
            disabled={busy}
          >
            Lưu
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleLogin(system)}
            loading={testingSystem === system}
            disabled={busy}
          >
            Đăng nhập &amp; kiểm tra
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tài khoản API Photobooth / Selfbooth"
      size="lg"
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">Đang tải...</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Tài khoản dùng để lấy dữ liệu mã chụp / lượt chụp từ API ngoài. Mật khẩu
            và token được lưu bảo mật và không hiển thị lại.
          </p>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}
          {BOOTH_SYSTEM_OPTIONS.map((s) => (
            <div key={s.value}>{renderSection(s.value)}</div>
          ))}
        </div>
      )}
    </Modal>
  );
}