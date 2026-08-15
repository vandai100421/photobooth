const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { render } = require('../services/template.service');
const dispatcher = require('../services/message.dispatcher');

// Fetch a setting value by key, with fallback default.
const getSetting = async (key, defaultValue = null) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    logger.warn(`helpers.getSetting failed key=${key}: ${error.message}`);
    return defaultValue;
  }
  return (data && data.value) || defaultValue;
};

// Generate a unique voucher code. Retries up to 5 times on collision.
// Format: <prefix><XXXX> where XXXX is 4 uppercase alphanumeric chars.
const generateVoucherCode = async (prefix) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.randomBytes(4);
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[bytes[i] % chars.length];
    }
    const code = `${prefix}${suffix}`;
    const { data, error } = await supabase
      .from('vouchers')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (error) {
      logger.warn(
        `helpers.generateVoucherCode uniqueness check failed: ${error.message}`,
      );
      continue;
    }
    if (!data) {
      return code;
    }
  }
  throw new Error(
    `Failed to generate unique voucher code for prefix ${prefix} after 5 attempts`,
  );
};

// Find the first active template matching occasion + channel.
const findTemplate = async (occasion, channel) => {
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('occasion', occasion)
    .eq('channel', channel)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn(`helpers.findTemplate failed: ${error.message}`);
    return null;
  }
  return data;
};

// Fetch a specific template by id (must be active).
const findTemplateById = async (templateId) => {
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    logger.warn(`helpers.findTemplateById failed: ${error.message}`);
    return null;
  }
  return data;
};

// Create a voucher definition (percent discount, unlimited quantity).
// Returns { voucher, expiresAt } where expiresAt is an ISO timestamp
// representing end-of-day on the valid_until date.
const createVoucher = async ({
  prefix,
  name,
  type,
  discountPercent,
  validDays,
}) => {
  const code = await generateVoucherCode(prefix);
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + validDays);

  const validFromStr = today.toISOString().slice(0, 10);
  const validUntilStr = validUntil.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('vouchers')
    .insert({
      code,
      name,
      type,
      discount_type: 'percent',
      value: discountPercent,
      total_quantity: -1,
      valid_from: validFromStr,
      valid_until: validUntilStr,
      is_active: true,
      per_customer: 1,
    })
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to create voucher: ${error.message}`);
  }

  const expiresAt = new Date(`${validUntilStr}T23:59:59Z`).toISOString();
  return { voucher: data, expiresAt };
};

// Issue a voucher to a customer by inserting a customer_voucher row.
const issueVoucher = async (customerId, voucherId, expiresAt) => {
  const { data, error } = await supabase
    .from('customer_vouchers')
    .insert({
      customer_id: customerId,
      voucher_id: voucherId,
      status: 'issued',
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to issue customer_voucher: ${error.message}`);
  }
  return data;
};

// Build content_sent based on channel. Email logs use a "Subject: ...\n\nbody"
// envelope so the dispatcher can split subject and body.
const buildContent = (template, vars) => {
  const body = render(template.body, vars);
  if (template.channel === 'email' && template.subject) {
    return `Subject: ${render(template.subject, vars)}\n\n${body}`;
  }
  return body;
};

// Render the template, create a pending message_log, then dispatch it.
// Returns the dispatcher result: { success, channel_used, error? }.
const renderLogAndDispatch = async ({
  customer,
  template,
  voucherId,
  vars,
}) => {
  const contentSent = buildContent(template, vars);

  const { data: log, error: logErr } = await supabase
    .from('message_logs')
    .insert({
      customer_id: customer.id,
      template_id: template.id,
      voucher_id: voucherId || null,
      channel: template.channel,
      status: 'pending',
      content_sent: contentSent,
    })
    .select()
    .single();
  if (logErr) {
    throw new Error(`Failed to create message_log: ${logErr.message}`);
  }

  return dispatcher.dispatchMessage(log);
};

module.exports = {
  getSetting,
  generateVoucherCode,
  findTemplate,
  findTemplateById,
  createVoucher,
  issueVoucher,
  buildContent,
  renderLogAndDispatch,
};
