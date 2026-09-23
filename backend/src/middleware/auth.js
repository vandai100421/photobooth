const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const authClient = require('../config/authClient');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const isDemoMode = env.SUPABASE_URL.includes('placeholder');

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim();
};

const auth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  // Demo mode: verify JWT locally only (no Supabase call).
  if (isDemoMode) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return next();
    } catch (_err) {
      return next(new AppError('Invalid or expired token', 401));
    }
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return next();
    } catch (_err) {
      return next(new AppError('Invalid or expired token', 401));
    }
  }

  const authUser = data.user;

  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, email, role, is_active, deleted_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (empErr) {
    return next(new AppError('Authentication failed', 401));
  }

  if (!employee || employee.deleted_at || !employee.is_active) {
    return next(new AppError('Account is inactive or not found', 401));
  }

  req.user = {
    id: employee.id,
    email: employee.email,
    role: employee.role,
  };

  next();
});

module.exports = auth;
