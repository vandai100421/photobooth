const router = require('express').Router();
const ctrl = require('./webhooks.controller');

// Public endpoints — Zalo's servers call these, so no auth middleware.
router.get('/zalo', ctrl.verifyZalo);
router.post('/zalo', ctrl.zaloEvent);

module.exports = router;
