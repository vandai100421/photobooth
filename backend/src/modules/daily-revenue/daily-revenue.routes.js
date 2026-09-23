const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./daily-revenue.controller');
const schema = require('./daily-revenue.schema');

router.get('/', auth, validate(schema.listDailyRevenueSchema), ctrl.list);
router.get('/:id', auth, ctrl.detail);
router.post(
  '/',
  auth,
  rbac('admin', 'manager'),
  validate(schema.createDailyRevenueSchema),
  ctrl.create,
);
router.put(
  '/:id',
  auth,
  rbac('admin', 'manager'),
  validate(schema.updateDailyRevenueSchema),
  ctrl.update,
);
router.delete('/:id', auth, rbac('admin', 'manager'), ctrl.remove);

module.exports = router;
