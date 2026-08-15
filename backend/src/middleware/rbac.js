const AppError = require('../utils/AppError');

// Role-based access control. Usage: rbac('admin') or rbac('admin', 'manager')
const rbac = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Forbidden: insufficient role', 403));
  }
  next();
};

module.exports = rbac;
