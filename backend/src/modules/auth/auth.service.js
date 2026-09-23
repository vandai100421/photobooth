const jwt = require('jsonwebtoken');
const supabase = require('../../config/supabase');
const authClient = require('../../config/authClient');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

// Demo mode: active when Supabase is not configured (placeholder URL).
// Allows login without a real Supabase project for local preview.
const isDemoMode = env.SUPABASE_URL.includes('placeholder');

const DEMO_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Quản trị viên (Demo)',
    phone: '0900000001',
    email: 'admin@tapphotobooth.com',
    password: 'admin123',
    role: 'admin',
    avatar_url: null,
    is_active: true,
    hire_date: '2024-01-01',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Nhân viên (Demo)',
    phone: '0900000002',
    email: 'staff@tapphotobooth.com',
    password: 'staff123',
    role: 'staff',
    avatar_url: null,
    is_active: true,
    hire_date: '2024-03-15',
    created_at: '2024-03-15T00:00:00Z',
  },
];

const signAccessToken = (user, role) =>
  jwt.sign(
    { sub: user.id, email: user.email, role, demo: isDemoMode },
    env.JWT_SECRET,
    { expiresIn: '8h' },
  );

// Chuẩn hoá SĐT VN: bỏ khoảng trắng, chấp nhận 0xx hoặc +84xx.
const normalizePhone = (raw) => {
  if (!raw) return '';
  let p = String(raw).replace(/\s+/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  return p;
};

const isPhone = (value) =>
  typeof value === 'string' && !value.includes('@');

// Từ SĐT → email dùng cho Supabase Auth. Nếu NV có email thật thì dùng,
// không thì tổng hợp `${phone}@phone.tapphotobooth.app`.
const resolveEmailByPhone = async (phone) => {
  const { data, error } = await supabase
    .from('employees')
    .select('email')
    .eq('phone', phone)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    throw new AppError('Failed to look up account', 500);
  }
  if (!data) {
    throw new AppError('Account not found', 401);
  }
  return data.email && data.email.trim()
    ? data.email.trim()
    : `${phone}@phone.tapphotobooth.app`;
};

const login = async (identifier, password) => {
  if (isDemoMode) {
    const user = DEMO_USERS.find(
      (u) =>
        (u.email === identifier || u.phone === identifier) &&
        u.password === password,
    );
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }
    const { password: _pw, ...safeUser } = user;
    const token = signAccessToken(safeUser, user.role);
    return { token, user: safeUser };
  }

  // Chấp nhận email HOẶC SĐT. Nếu là SĐT → tra cứu email tương ứng.
  const email = isPhone(identifier)
    ? await resolveEmailByPhone(normalizePhone(identifier))
    : identifier.trim();

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.user) {
    throw new AppError('Invalid email or password', 401);
  }

  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, full_name, phone, email, role, avatar_url, is_active, hire_date, deleted_at')
    .eq('id', data.user.id)
    .maybeSingle();

  if (empErr) {
    throw new AppError('Failed to load employee profile', 500);
  }
  if (!employee || employee.deleted_at) {
    throw new AppError('Account not found', 401);
  }
  if (!employee.is_active) {
    throw new AppError('Account is disabled', 401);
  }

  const token = signAccessToken(data.user, employee.role);

  return { token, user: employee };
};

const me = async (userId) => {
  if (isDemoMode) {
    const user = DEMO_USERS.find((u) => u.id === userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const { password: _pw, ...safeUser } = user;
    return { user: safeUser };
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, full_name, phone, email, role, avatar_url, is_active, hire_date, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new AppError('Failed to load profile', 500);
  }
  if (!employee) {
    throw new AppError('User not found', 404);
  }

  return { user: employee };
};

const refresh = async (userId, email, role) => {
  const token = jwt.sign(
    { sub: userId, email, role, demo: isDemoMode },
    env.JWT_SECRET,
    { expiresIn: '8h' },
  );
  return { token };
};

const logout = async (accessToken) => {
  if (isDemoMode || !accessToken) return;
  await authClient.auth.signOut({ accessToken });
};

module.exports = { login, me, refresh, logout, isDemoMode };
