const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const zaloService = require('./zalo.service');
const gmailService = require('./gmail.service');

// Redact customer contact details in logs to avoid leaking PII.
const mask = (value) => {
  if (!value || typeof value !== 'string') return '<none>';
  if (value.length <= 4) return '***';
  return `${value.slice(0, 2)}...${value.slice(-2)}`;
};

// Fetch the contact fields needed to dispatch a message.
const getCustomerForDispatch = async (customerId) => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, zalo_id')
    .eq('id', customerId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to fetch customer: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError('Customer not found', 404);
  }
  return data;
};

// Parse "Subject: ...\n\nbody" envelope produced by messages.service for
// email logs. Falls back to the whole content as body if no envelope.
const splitEmailContent = (contentSent) => {
  if (typeof contentSent !== 'string') {
    return { subject: 'TAP Photobooth', body: String(contentSent || '') };
  }
  const match = contentSent.match(/^Subject:\s*(.+?)\r?\n\r?\n([\s\S]*)$/);
  if (match) {
    return { subject: match[1], body: match[2] };
  }
  return { subject: 'TAP Photobooth', body: contentSent };
};

// Update a message_log row with the dispatch outcome.
const updateLogStatus = async (logId, patch) => {
  const { error } = await supabase
    .from('message_logs')
    .update(patch)
    .eq('id', logId);
  if (error) {
    logger.error(
      `dispatcher failed to update log ${logId}: ${error.message}`,
    );
  }
};

// Dispatch a single message_log row.
//
// Behaviour:
//   channel='zalo'  → send via Zalo. If the customer has no zalo_id or the
//                     Zalo API fails, fallback to email when an address is
//                     available. If email also fails (or no email), throw.
//   channel='email' → send via Gmail SMTP. Throw on failure.
//
// The message_logs row is mutated in-place: status → 'sent'/'failed',
// sent_at set on success, error_message on failure, and channel updated
// to the channel that actually delivered (after a fallback).
//
// Returns { success, channel_used, error? }.
const dispatchMessage = async (messageLog) => {
  if (!messageLog || !messageLog.id) {
    throw new AppError('dispatchMessage requires a message_log row', 400);
  }
  if (!messageLog.customer_id) {
    await updateLogStatus(messageLog.id, {
      status: 'failed',
      error_message: 'Message log has no customer_id',
    });
    throw new AppError('Message log has no customer_id', 400);
  }

  const customer = await getCustomerForDispatch(messageLog.customer_id);
  const contentSent = messageLog.content_sent || '';
  const requestedChannel = messageLog.channel;

  // ---- Zalo channel (with email fallback) ----
  if (requestedChannel === 'zalo') {
    if (customer.zalo_id) {
      try {
        await zaloService.sendMessage(customer.zalo_id, contentSent);
        await updateLogStatus(messageLog.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
        });
        logger.info(
          `dispatcher zalo sent log=${messageLog.id} customer=${mask(customer.phone)}`,
        );
        return { success: true, channel_used: 'zalo' };
      } catch (err) {
        logger.warn(
          `dispatcher zalo failed log=${messageLog.id}: ${err.message} — trying email fallback`,
        );
      }
    } else {
      logger.info(
        `dispatcher log=${messageLog.id} customer has no zalo_id — email fallback`,
      );
    }

    // Fallback to email
    if (customer.email) {
      try {
        const { subject, body } = splitEmailContent(contentSent);
        await gmailService.sendMail(customer.email, subject, body);
        await updateLogStatus(messageLog.id, {
          status: 'sent',
          channel: 'email',
          sent_at: new Date().toISOString(),
          error_message: null,
        });
        logger.info(
          `dispatcher email fallback sent log=${messageLog.id} to=${mask(customer.email)}`,
        );
        return { success: true, channel_used: 'email' };
      } catch (err) {
        await updateLogStatus(messageLog.id, {
          status: 'failed',
          error_message: `zalo+email fallback both failed: ${err.message}`,
        });
        throw new AppError(
          `Zalo failed and email fallback also failed: ${err.message}`,
          502,
        );
      }
    }

    await updateLogStatus(messageLog.id, {
      status: 'failed',
      error_message: 'Customer has no zalo_id and no email for fallback',
    });
    throw new AppError(
      'Customer has no zalo_id and no email for fallback',
      400,
    );
  }

  // ---- Email channel ----
  if (requestedChannel === 'email') {
    if (!customer.email) {
      await updateLogStatus(messageLog.id, {
        status: 'failed',
        error_message: 'Customer has no email address',
      });
      throw new AppError('Customer has no email address', 400);
    }
    try {
      const { subject, body } = splitEmailContent(contentSent);
      await gmailService.sendMail(customer.email, subject, body);
      await updateLogStatus(messageLog.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      });
      logger.info(
        `dispatcher email sent log=${messageLog.id} to=${mask(customer.email)}`,
      );
      return { success: true, channel_used: 'email' };
    } catch (err) {
      await updateLogStatus(messageLog.id, {
        status: 'failed',
        error_message: err.message,
      });
      throw new AppError(`Email dispatch failed: ${err.message}`, 502);
    }
  }

  // SMS channel is not implemented yet (out of scope for Tuần 8-9).
  await updateLogStatus(messageLog.id, {
    status: 'failed',
    error_message: `Channel '${requestedChannel}' is not supported by the dispatcher`,
  });
  throw new AppError(
    `Channel '${requestedChannel}' is not supported by the dispatcher`,
    400,
  );
};

module.exports = {
  dispatchMessage,
};
