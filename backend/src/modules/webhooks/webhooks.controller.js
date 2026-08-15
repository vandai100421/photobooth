const { success } = require('../../utils/response');
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

module.exports = {
  verifyZalo,
  zaloEvent,
};
