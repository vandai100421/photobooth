const env = require('../../config/env');
const logger = require('../../utils/logger');
const { success, error } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const webhooksService = require('./webhooks.service');

// Webhook verification: Zalo sends a challenge token in the query string
// when an admin first registers the webhook URL in the OA console.
// Echo it back so Zalo can confirm ownership.
const verifyZalo = (req, res) => {
  const challenge =
    req.query['hub.challenge'] ||
    req.query.challenge ||
    req.query.verify_token ||
    '';
  return success(res, { verified: true, challenge });
};

// Inbound Zalo OA event (follow / unfollow / message). Public endpoint —
// no auth; signature verification happens inside the service.
const zaloEvent = asyncHandler(async (req, res) => {
  const mac = req.get('x-zalo-mac') || req.headers.mac || null;
  const result = await webhooksService.processZaloEvent(req.body, mac);
  return success(res, result);
});

// Inbound SePay bank-transaction webhook. Public endpoint — SePay's servers
// call it. Auth: SePay sends 'Authorization: Apikey <key>' when the webhook
// is created with API-Key authentication. When SEPAY_WEBHOOK_API_KEY is set
// we require a match; otherwise we accept (test/local only).
const sepayWebhook = asyncHandler(async (req, res) => {
  const expected = env.SEPAY_WEBHOOK_API_KEY;
  if (expected) {
    const authHeader = req.get('authorization') || '';
    const provided = authHeader.replace(/^Apikey\s+/i, '').trim();
    if (provided !== expected) {
      logger.warn('webhooks sepay: invalid or missing API key');
      return error(res, 'Unauthorized', 401);
    }
  } else {
    logger.warn(
      'webhooks sepay: SEPAY_WEBHOOK_API_KEY not set — accepting unauthenticated request',
    );
  }

  const result = await webhooksService.processSepayWebhook(req.body);
  return success(res, result);
});

module.exports = {
  verifyZalo,
  zaloEvent,
  sepayWebhook,
};
