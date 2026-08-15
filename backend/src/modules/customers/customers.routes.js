const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./customers.controller');
const schema = require('./customers.schema');

// birthdays must be declared BEFORE /:id to avoid route shadowing.
router.get('/birthdays', auth, ctrl.birthdays);

router.get('/', auth, ctrl.list);
router.post('/', auth, validate(schema.createCustomerSchema), ctrl.create);
router.get('/:id', auth, ctrl.detail);
router.put(
  '/:id',
  auth,
  validate(schema.updateCustomerSchema),
  ctrl.update,
);
router.delete('/:id', auth, rbac('admin'), ctrl.remove);

router.get('/:id/bookings', auth, ctrl.listBookings);
router.get('/:id/vouchers', auth, ctrl.listVouchers);

module.exports = router;
