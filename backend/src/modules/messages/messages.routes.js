const router = require('express').Router();
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const ctrl = require('./messages.controller');
const schema = require('./messages.schema');

// Static sub-paths must be declared BEFORE any potential /:id routes to
// avoid route shadowing. Messages has no /:id routes today, but we keep
// the static-first ordering for clarity and future-proofing.
router.get('/logs', auth, ctrl.logs);
router.post(
  '/send-now',
  auth,
  validate(schema.sendMessageSchema),
  ctrl.sendNow,
);
router.get('/scheduled', auth, ctrl.scheduled);
router.post(
  '/schedule',
  auth,
  validate(schema.scheduleMessageSchema),
  ctrl.schedule,
);
router.get('/stats', auth, ctrl.stats);

module.exports = router;
