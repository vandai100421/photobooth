const env = require('../config/env');
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const BASE_URL = 'https://openapi.zalo.me/v2.0/oa';

// Zalo OA free tier returns error_code != 0 on failure. Mask sensitive
// fields in logs — never log the full access token.
const maskToken = (token) => {
  if (!token || typeof token !== 'string') return '<none>';
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

// Resolve the OA access token. Priority: settings table (admin can rotate
// via UI) → env ZALO_ACCESS_TOKEN. Throws 500 if neither is configured so
// the dispatcher can fallback to email.
const getAccessToken = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'zalo_access_token')
    .maybeSingle();

  if (error) {
    throw new AppError(
      `Failed to fetch zalo access token from settings: ${error.message}`,
      500,
    );
  }

  const token = (data && data.value) || env.ZALO_ACCESS_TOKEN;
  if (!token) {
    throw new AppError('Zalo access token is not configured', 500);
  }
  return token;
};

// Centralised request helper. Logs method + path + outcome; throws AppError
// (502) when Zalo returns error_code != 0, and 504 on network failure.
const zaloRequest = async (path, options = {}) => {
  const token = await getAccessToken();
  const url = `${BASE_URL}${path}`;
  const method = options.method || 'GET';

  logger.debug(`zalo.service ${method} ${path} token=${maskToken(token)}`);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: token,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    logger.error(`zalo.service network error ${method} ${path}: ${err.message}`);
    throw new AppError(
      `Zalo API network error: ${err.message}`,
      504,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_parseErr) {
    logger.error(
      `zalo.service non-json response ${method} ${path} status=${response.status}`,
    );
    throw new AppError(
      `Zalo API returned non-JSON response (status ${response.status})`,
      502,
    );
  }

  // Zalo OA free tier envelope: { error_code, error_message, data }
  if (!response.ok || (payload && payload.error_code !== 0)) {
    const code = payload && payload.error_code;
    const msg = (payload && payload.error_message) || `HTTP ${response.status}`;
    logger.warn(
      `zalo.service failure ${method} ${path} code=${code} msg=${msg}`,
    );
    throw new AppError(`Zalo API error: ${msg} (code ${code})`, 502);
  }

  return payload;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Send a text message to a single OA follower.
// Returns { success, message_id }.
const sendMessage = async (userId, messageText) => {
  if (!userId) {
    throw new AppError('Zalo sendMessage requires a user_id', 400);
  }
  if (!messageText) {
    throw new AppError('Zalo sendMessage requires message text', 400);
  }

  if (env.MESSAGE_DRY_RUN) {
    logger.info(`zalo.service DRY-RUN sendMessage user=${userId}`);
    return { success: true, message_id: 'dry-run' };
  }

  const payload = await zaloRequest('/message', {
    method: 'POST',
    body: {
      recipient: { user_id: userId },
      message: { text: messageText },
    },
  });

  const data = payload.data || {};
  const messageId = data.message_id || null;
  logger.info(
    `zalo.service sendMessage sent user=${userId} msg_id=${messageId}`,
  );
  return { success: true, message_id: messageId };
};

// Broadcast a text message to many followers. Sequential with a 100ms
// delay between sends to respect the free-tier rate limit.
// Returns an array of { user_id, success, message_id?, error? }.
const sendBroadcast = async (userIds, messageText) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError('sendBroadcast requires a non-empty userIds array', 400);
  }

  const results = [];
  for (const userId of userIds) {
    try {
      const res = await sendMessage(userId, messageText);
      results.push({
        user_id: userId,
        success: true,
        message_id: res.message_id,
      });
    } catch (err) {
      results.push({
        user_id: userId,
        success: false,
        error: err.message,
      });
    }
    await sleep(100);
  }

  const sent = results.filter((r) => r.success).length;
  logger.info(
    `zalo.service sendBroadcast total=${userIds.length} sent=${sent}`,
  );
  return results;
};

// Fetch the OA's follower list (one page, max 50). Returns an array of
// user_id strings.
const getFollowers = async (offset = 0, count = 50) => {
  const payload = await zaloRequest(
    `/getfollowers?offset=${offset}&count=${count}`,
  );
  const followers = (payload.data && payload.data.followers) || [];
  const userIds = followers
    .map((f) => f.user_id)
    .filter((id) => Boolean(id));
  logger.info(
    `zalo.service getFollowers offset=${offset} count=${userIds.length}`,
  );
  return userIds;
};

// Fetch the OA's follow QR code. Returns { qr_url }.
const getQRCode = async () => {
  const payload = await zaloRequest('/qr');
  const data = payload.data || {};
  const qrUrl = data.qr_code || data.image || null;
  if (!qrUrl) {
    throw new AppError('Zalo did not return a QR code URL', 502);
  }
  return { qr_url: qrUrl };
};

// Verify an inbound webhook payload. Zalo signs callbacks with a MAC
// computed over the JSON body using oa_secret; if ZALO_OA_SECRET is not
// configured we accept the payload (verification happens at network edge).
const verifyWebhook = (data, mac) => {
  if (!mac) {
    return true;
  }
  const secret = process.env.ZALO_OA_SECRET;
  if (!secret) {
    return true;
  }
  const crypto = require('crypto');
  const computed = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data || {}))
    .digest('hex');
  return computed === mac;
};

module.exports = {
  sendMessage,
  sendBroadcast,
  getFollowers,
  getQRCode,
  verifyWebhook,
};
