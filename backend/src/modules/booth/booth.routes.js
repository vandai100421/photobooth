const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./booth.controller');
const schema = require('./booth.schema');

// Tài khoản đăng nhập API ngoài — chỉ admin quản lý.
router.get('/accounts', auth, rbac('admin'), ctrl.accounts);
router.put(
  '/accounts/:system',
  auth,
  rbac('admin'),
  validate(schema.saveAccountsSchema),
  ctrl.saveAccounts,
);
router.post(
  '/accounts/:system/login',
  auth,
  rbac('admin'),
  validate(schema.loginSchema),
  ctrl.login,
);

// Gói chụp (chỉ Selfbooth).
router.get(
  '/:system/packages',
  auth,
  validate(schema.systemParamSchema),
  ctrl.packages,
);

// Đồng bộ từ API ngoài.
router.post(
  '/:system/sync',
  auth,
  rbac('admin', 'manager'),
  validate(schema.syncSchema),
  ctrl.sync,
);

// Dữ liệu đã cache.
router.get('/:system/codes', auth, validate(schema.listSchema), ctrl.codes);
router.get(
  '/:system/sessions',
  auth,
  validate(schema.listSchema),
  ctrl.sessions,
);

// Tạo mã chụp mới.
router.post(
  '/:system/codes',
  auth,
  rbac('admin', 'manager', 'staff'),
  validate(schema.createCodeSchema),
  ctrl.createCode,
);

// Ghi chú / trạng thái xử lý mã (nhân viên nhập lý do).
router.put(
  '/:system/codes/:code/review',
  auth,
  rbac('admin', 'manager', 'staff'),
  validate(schema.codeReviewSchema),
  ctrl.saveCodeReview,
);

// Đối chiếu.
router.get('/:system/summary', auth, validate(schema.listSchema), ctrl.summary);
router.get('/:system/revenue', auth, validate(schema.listSchema), ctrl.revenue);
router.get('/:system/ledger', auth, validate(schema.listSchema), ctrl.ledger);
router.get(
  '/:system/reconciliations',
  auth,
  validate(schema.listSchema),
  ctrl.reconciliations,
);
router.post(
  '/:system/reconciliations',
  auth,
  rbac('admin', 'manager', 'staff'),
  validate(schema.reconciliationSchema),
  ctrl.upsertReconciliation,
);
router.delete(
  '/:system/reconciliations/:id',
  auth,
  rbac('admin', 'manager'),
  ctrl.removeReconciliation,
);

module.exports = router;
