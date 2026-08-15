const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./vouchers.controller');
const schema = require('./vouchers.schema');

// /check must be declared BEFORE /:id to avoid route shadowing.
router.get('/check', auth, ctrl.check);

router.get('/', auth, ctrl.list);
router.post(
  '/',
  auth,
  rbac('admin'),
  validate(schema.createVoucherSchema),
  ctrl.create,
);
router.get('/:id', auth, ctrl.detail);
router.put(
  '/:id',
  auth,
  rbac('admin'),
  validate(schema.updateVoucherSchema),
  ctrl.update,
);
router.delete('/:id', auth, rbac('admin'), ctrl.remove);

router.post(
  '/:id/issue',
  auth,
  validate(schema.issueVoucherSchema),
  ctrl.issue,
);
router.get('/:id/usage', auth, ctrl.usage);

module.exports = router;
