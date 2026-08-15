const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./templates.controller');
const schema = require('./templates.schema');

router.get('/', auth, ctrl.list);
router.post(
  '/',
  auth,
  rbac('admin'),
  validate(schema.createTemplateSchema),
  ctrl.create,
);
router.get('/:id', auth, ctrl.detail);
router.put(
  '/:id',
  auth,
  rbac('admin'),
  validate(schema.updateTemplateSchema),
  ctrl.update,
);
router.delete('/:id', auth, rbac('admin'), ctrl.remove);

module.exports = router;
