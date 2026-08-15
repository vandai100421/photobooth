const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./settings.controller');
const schema = require('./settings.schema');

router.get('/', auth, ctrl.list);
router.put(
  '/',
  auth,
  rbac('admin'),
  validate(schema.updateSettingsSchema),
  ctrl.update,
);
router.get('/zalo-qr', auth, ctrl.zaloQR);

module.exports = router;
