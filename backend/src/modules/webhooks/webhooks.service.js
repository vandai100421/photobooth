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

// ---- SePay bank transaction webhook ----

// SePay gửi 'YYYY-MM-DD HH:mm:ss' theo giờ Việt Nam (GMT+7) nhưng không kèm
// offset. Gắn '+07:00' để Postgres lưu đúng mốc UTC thay vì hiểu nhầm là UTC.
const normaliseTransactionDate = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}+07:00`;
  }
  return trimmed;
};

// Normalise a SePay webhook payload. SePay sends camelCase, but older docs
// and manual tests use snake_case — accept both.
const normaliseSepayTransaction = (body = {}) => {
  const sepayId = body.id ?? body.sepay_id ?? null;
  const transferType = body.transferType ?? body.transfer_type ?? null;
  const amount = body.transferAmount ?? body.transfer_amount ?? 0;
  return {
    sepay_id: Number(sepayId),
    gateway: body.gateway ?? null,
    transaction_date: normaliseTransactionDate(
      body.transactionDate ?? body.transaction_date,
    ),
    account_number: body.accountNumber ?? body.account_number ?? null,
    sub_account: body.subAccount ?? body.sub_account ?? null,
    code: body.code ?? null,
    content: body.content ?? null,
    transfer_type: transferType,
    transfer_amount: Number(amount) || 0,
    accumulated:
      body.accumulated === null || body.accumulated === undefined
        ? null
        : Number(body.accumulated) || 0,
    reference_code: body.referenceCode ?? body.reference_code ?? null,
    description: body.description ?? null,
    raw_payload: body,
  };
};

// Persist a SePay transaction. Idempotent: SePay retries the same id when
// our endpoint errors, so we upsert on the unique sepay_id column and treat
// an existing row as a no-op duplicate.
const processSepayWebhook = async (body) => {
  const tx = normaliseSepayTransaction(body);

  if (!tx.sepay_id || Number.isNaN(tx.sepay_id)) {
    logger.warn('webhooks sepay: payload missing numeric id');
    return { action: 'ignored', reason: 'missing sepay id' };
  }

  const { data, error } = await supabase
    .from('bank_transactions')
    .upsert(tx, { onConflict: 'sepay_id', ignoreDuplicates: true })
    .select('id, sepay_id')
    .maybeSingle();

  if (error) {
    logger.error(`webhooks sepay upsert failed: ${error.message}`);
    throw error;
  }

  if (!data) {
    logger.info(`webhooks sepay duplicate sepay_id=${tx.sepay_id}`);
    return { action: 'duplicate', sepay_id: tx.sepay_id };
  }

  logger.info(
    `webhooks sepay stored sepay_id=${tx.sepay_id} type=${tx.transfer_type} amount=${tx.transfer_amount}`,
  );
  return { action: 'created', sepay_id: tx.sepay_id, transaction_id: data.id };
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
  processSepayWebhook,
  normaliseSepayTransaction,
};
