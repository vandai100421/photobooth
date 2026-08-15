const supabase = require('../../config/supabase');
const zaloService = require('../../services/zalo.service');
const logger = require('../../utils/logger');

// Zalo OA webhook payloads vary between API versions. We normalise the
// relevant fields into a single shape before processing.
const normaliseFollowEvent = (body) => {
  const eventName = body.event_name || body.event || body.eventName;
  const userId =
    body.user_id ||
    (body.follower && body.follower.id) ||
    (body.info && body.info.user_id) ||
    null;
  const info = body.info || body.follower || {};
  const phone = body.phone || info.phone || info.phone_number || null;
  const displayName =
    body.display_name || info.display_name || info.name || null;
  return { eventName, userId, phone, displayName };
};

// Handle a Zalo follow event:
//   1. Find an existing customer by phone → update zalo_id (link account).
//   2. Otherwise create a new active customer (zalo_id + phone + name).
// Idempotent — re-following the OA does not duplicate the customer.
const handleFollow = async ({ userId, phone, displayName }) => {
  if (!userId) {
    logger.warn('webhooks handleFollow: no user_id in payload');
    return { action: 'ignored', reason: 'no user_id' };
  }

  // Try to link an existing customer by phone first.
  if (phone) {
    const { data: existing, error: findErr } = await supabase
      .from('customers')
      .select('id, zalo_id, phone')
      .eq('phone', phone)
      .is('deleted_at', null)
      .maybeSingle();

    if (findErr) {
      logger.error(
        `webhooks handleFollow customer lookup failed: ${findErr.message}`,
      );
      throw findErr;
    }

    if (existing) {
      if (existing.zalo_id !== userId) {
        const { error: updErr } = await supabase
          .from('customers')
          .update({ zalo_id: userId })
          .eq('id', existing.id);
        if (updErr) {
          logger.error(
            `webhooks handleFollow update zalo_id failed: ${updErr.message}`,
          );
          throw updErr;
        }
      }
      logger.info(
        `webhooks handleFollow linked customer=${existing.id} zalo_id=${userId}`,
      );
      return { action: 'linked', customer_id: existing.id };
    }
  }

  // No matching customer — create a new active one.
  const insertPayload = {
    zalo_id: userId,
    full_name: displayName || phone || `Zalo user ${userId.slice(-6)}`,
    phone: phone || `zalo_${userId}`,
    status: 'active',
  };
  const { data: created, error: insErr } = await supabase
    .from('customers')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insErr) {
    // 23505 = unique_violation — race condition; the customer was created
    // by a concurrent request. Treat as already-linked.
    if (insErr.code === '23505') {
      logger.info(
        `webhooks handleFollow race: customer already exists for zalo_id=${userId}`,
      );
      return { action: 'already_existed', reason: insErr.code };
    }
    logger.error(
      `webhooks handleFollow insert failed: ${insErr.message}`,
    );
    throw insErr;
  }

  logger.info(
    `webhooks handleFollow created customer=${created.id} zalo_id=${userId}`,
  );
  return { action: 'created', customer_id: created.id };
};

// Entry point: verify signature, then dispatch by event name.
const processZaloEvent = async (body, mac) => {
  if (!zaloService.verifyWebhook(body, mac)) {
    logger.warn('webhooks zalo signature verification failed');
    return { action: 'rejected', reason: 'invalid signature' };
  }

  const { eventName, userId, phone, displayName } = normaliseFollowEvent(body);

  if (eventName === 'follow') {
    return handleFollow({ userId, phone, displayName });
  }

  // Unhandled event types (unfollow, user_send_text, etc.) are logged but
  // not yet processed — they will be handled in later sprints.
  logger.info(`webhooks zalo event '${eventName}' received, no handler`);
  return { action: 'ignored', event: eventName };
};

module.exports = {
  processZaloEvent,
  normaliseFollowEvent,
};
