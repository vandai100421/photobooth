const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./posts.controller');
const schema = require('./posts.schema');

router.get('/', auth, ctrl.list);
router.post(
  '/',
  auth,
  rbac('admin', 'manager'),
  validate(schema.createPostSchema),
  ctrl.create,
);
router.get('/:id', auth, ctrl.detail);
router.put(
  '/:id',
  auth,
  rbac('admin', 'manager'),
  validate(schema.updatePostSchema),
  ctrl.update,
);
router.delete('/:id', auth, rbac('admin', 'manager'), ctrl.remove);
router.post('/:id/publish', auth, rbac('admin', 'manager'), ctrl.publish);

module.exports = router;
