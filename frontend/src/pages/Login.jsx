import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../utils/constants';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const PHONE_REGEX = /^(\+84|0)[3-9][0-9]{8}$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const next = {};
    const v = form.email.trim();
    if (!v) {
      next.email = 'Vui lòng nhập email hoặc SĐT';
    } else if (v.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        next.email = 'Email không hợp lệ';
      }
    } else if (!PHONE_REGEX.test(v)) {
      next.email = 'SĐT không hợp lệ (10 số, bắt đầu 0)';
    }
    if (!form.password) {
      next.password = 'Vui lòng nhập mật khẩu';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      const redirect = location.state?.from?.pathname || ROUTES.DASHBOARD;
      navigate(redirect, { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        'Đăng nhập thất bại. Vui lòng thử lại.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-700 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-white">TAP Photobooth</h1>
          <p className="mt-1 text-sm text-brand-100">
            Hệ thống quản lý photobooth
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-xl font-semibold text-gray-800">
            Đăng nhập
          </h2>

          {serverError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email hoặc SĐT"
              type="text"
              name="email"
              placeholder="admin@tapphotobooth.com hoặc 0901234567"
              autoComplete="username"
              value={form.email}
              error={errors.email}
              onChange={handleChange}
            />
            <Input
              label="Mật khẩu"
              type="password"
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={form.password}
              error={errors.password}
              onChange={handleChange}
            />
            <Button
              type="submit"
              loading={submitting}
              className="w-full"
              size="lg"
            >
              Đăng nhập
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-brand-100">
          © {new Date().getFullYear()} TAP Photobooth. All rights reserved.
        </p>
      </div>
    </div>
  );
}
