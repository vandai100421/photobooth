const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./holidays.controller');
const schema = require('./holidays.schema');

router.get('/', auth, ctrl.list);
router.post(
  '/',
  auth,
  rbac('admin'),
  validate(schema.createHolidaySchema),
  ctrl.create,
);
router.get('/:id', auth, ctrl.detail);
router.put(
  '/:id',
  auth,
  rbac('admin'),
  validate(schema.updateHolidaySchema),
  ctrl.update,
);
router.delete('/:id', auth, rbac('admin'), ctrl.remove);

module.exports = router;
