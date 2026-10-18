const router = require('express').Router();
const validate = require('../../middleware/validate');
const ctrl = require('./webhooks.controller');
const schema = require('./webhooks.schema');

// Public endpoints — Zalo's / SePay's servers call these, so no auth
// middleware. SePay authenticates via an API key checked in the controller.
router.get('/zalo', ctrl.verifyZalo);
router.post('/zalo', ctrl.zaloEvent);
router.post('/sepay', validate(schema.sepayWebhookSchema), ctrl.sepayWebhook);

module.exports = router;
