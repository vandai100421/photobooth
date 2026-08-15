const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const { render } = require('../../services/template.service');
const { dispatchMessage } = require('../../services/message.dispatcher');
const { CHANNELS } = require('./messages.schema');

const LOG_SELECT = [
  'id',
  'customer_id',
  'template_id',
  'voucher_id',
  'channel',
  'status',
  'content_sent',
  'error_message',
  'scheduled_at',
  'sent_at',
  'created_at',
].join(', ');

// Join with customers (full_name, phone) and templates (name) for log context.
const LOG_SELECT_WITH_RELS = [
  LOG_SELECT,
  'customer:customers(id, full_name, phone)',
  'template:message_templates(id, name)',
].join(', ');

const LOG_STATUSES = ['pending', 'sent', 'failed', 'delivered'];

// Whitelist of sortable columns for logs (append-only, so created_at is the
// primary sort key).
const SORTABLE_FIELDS = [
  'created_at',
  'scheduled_at',
  'sent_at',
  'status',
  'channel',
];

const parsePagination = (page, limit) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  return {
    page: pageNum,
    limit: limitNum,
    from: (pageNum - 1) * limitNum,
    to: (pageNum - 1) * limitNum + limitNum - 1,
  };
};

const parseSort = (sort) => {
  let field = 'created_at';
  let ascending = false;
  if (sort && typeof sort === 'string') {
    const [rawField, dir] = sort.split(':');
    if (SORTABLE_FIELDS.includes(rawField)) {
      field = rawField;
    }
    if (dir === 'asc') ascending = true;
    else if (dir === 'desc') ascending = false;
  }
  return { field, ascending };
};

// Fetch shop_name from settings (single-row key/value table).
const getShopName = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'shop_name')
    .maybeSingle();
  if (error) {
    throw new AppError(
      `Failed to fetch shop_name setting: ${error.message}`,
      500,
    );
  }
  return (data && data.value) || 'TAP Photobooth';
};

// Fetch a customer row by id; 404 if missing or soft-deleted.
const getCustomer = async (id) => {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, zalo_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to fetch customer: ${error.message}`, 500);
  }
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  return customer;
};

// Fetch a template row by id; 404 if missing. Inactive templates are still
// returned — sending is an explicit admin action.
const getTemplate = async (id) => {
  const { data: template, error } = await supabase
    .from('message_templates')
    .select('id, name, occasion, channel, subject, body, is_active')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to fetch template: ${error.message}`, 500);
  }
  if (!template) {
    throw new AppError('Template not found', 404);
  }
  if (!template.is_active) {
    throw new AppError('Template is inactive', 400);
  }
  return template;
};

// Fetch a voucher's code by id (used to fill {{voucher_code}} placeholder).
const getVoucherCode = async (id) => {
  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('id, code, is_active')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to fetch voucher: ${error.message}`, 500);
  }
  if (!voucher) {
    throw new AppError('Voucher not found', 404);
  }
  if (!voucher.is_active) {
    throw new AppError('Voucher is not active', 400);
  }
  return voucher.code;
};

// Build the variable map for template rendering from customer, shop_name,
// optional voucher code, and the current year.
const buildVars = ({ customer, shopName, voucherCode }) => {
  const vars = {
    customer_name: customer.full_name,
    shop_name: shopName,
    year: String(new Date().getFullYear()),
  };
  if (voucherCode) {
    vars.voucher_code = voucherCode;
  }
  return vars;
};

// Render both subject (if present) and body of a template.
const renderTemplate = (template, vars) => {
  const renderedBody = render(template.body, vars);
  const renderedSubject = template.subject
    ? render(template.subject, vars)
    : null;
  return { renderedBody, renderedSubject };
};

// Build the content_sent string. For email this combines subject + body so
// the log captures the full message; for zalo/sms only the body matters.
const buildContentSent = ({ renderedSubject, renderedBody, channel }) => {
  if (channel === 'email' && renderedSubject) {
    return `Subject: ${renderedSubject}\n\n${renderedBody}`;
  }
  return renderedBody;
};

// Insert a message_log row.
const insertLog = async (payload) => {
  const { data: log, error } = await supabase
    .from('message_logs')
    .insert(payload)
    .select(LOG_SELECT_WITH_RELS)
    .single();
  if (error) {
    // 23503 = foreign_key_violation (customer/template/voucher not found).
    if (error.code === '23503') {
      throw new AppError(
        'Referenced customer, template, or voucher not found',
        400,
      );
    }
    if (error.code === '23514') {
      throw new AppError('Invalid channel or status value', 400);
    }
    throw new AppError(`Failed to create message log: ${error.message}`, 500);
  }
  return log;
};

const findLogs = async ({
  page,
  limit,
  customer_id,
  channel,
  status,
  from,
  to,
  sort,
} = {}) => {
  const pg = parsePagination(page, limit);
  const { field, ascending } = parseSort(sort);

  if (channel && !CHANNELS.includes(channel)) {
    throw new AppError('channel must be one of: zalo, email, sms', 400);
  }
  if (status && !LOG_STATUSES.includes(status)) {
    throw new AppError(
      'status must be one of: pending, sent, failed, delivered',
      400,
    );
  }

  let query = supabase
    .from('message_logs')
    .select(LOG_SELECT_WITH_RELS, { count: 'exact' });

  if (customer_id) {
    query = query.eq('customer_id', customer_id);
  }
  if (channel) {
    query = query.eq('channel', channel);
  }
  if (status) {
    query = query.eq('status', status);
  }
  // `from`/`to` are YYYY-MM-DD; compare against created_at (TIMESTAMPTZ).
  // Supabase/PostgREST coerces the date string to the column's timezone.
  if (from) {
    query = query.gte('created_at', from);
  }
  if (to) {
    // Inclusive upper bound: end of the `to` day.
    query = query.lt('created_at', `${to}T23:59:59.999Z`);
  }

  query = query.order(field, { ascending });

  const { data, count, error } = await query.range(pg.from, pg.to);
  if (error) {
    throw new AppError(`Failed to fetch message logs: ${error.message}`, 500);
  }

  const total = count || 0;
  return {
    data: data || [],
    pagination: {
      page: pg.page,
      limit: pg.limit,
      total,
      totalPages: Math.ceil(total / pg.limit),
    },
  };
};

// Re-fetch a single log row (with relations) by id.
const findLogById = async (id) => {
  const { data: log, error } = await supabase
    .from('message_logs')
    .select(LOG_SELECT_WITH_RELS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to fetch message log: ${error.message}`, 500);
  }
  return log;
};

// Send a message immediately. Renders the template, records a pending log,
// then dispatches via the real Zalo/Gmail transport (with fallback) and
// flips the log status to 'sent' / 'failed'.
const sendNow = async ({
  customer_id,
  template_id,
  channel,
  voucher_id,
} = {}) => {
  const customer = await getCustomer(customer_id);
  const template = await getTemplate(template_id);
  const finalChannel = channel || template.channel;
  if (!CHANNELS.includes(finalChannel)) {
    throw new AppError('Invalid channel', 400);
  }

  let voucherCode = null;
  if (voucher_id) {
    voucherCode = await getVoucherCode(voucher_id);
  }

  const shopName = await getShopName();
  const vars = buildVars({ customer, shopName, voucherCode });
  const { renderedSubject, renderedBody } = renderTemplate(template, vars);
  const contentSent = buildContentSent({
    renderedSubject,
    renderedBody,
    channel: finalChannel,
  });

  const log = await insertLog({
    customer_id,
    template_id,
    voucher_id: voucher_id || null,
    channel: finalChannel,
    status: 'pending',
    content_sent: contentSent,
  });

  // Dispatch via the real transport. The dispatcher updates the log row's
  // status/sent_at/error_message in-place; if it throws, the controller's
  // asyncHandler surfaces the error to the client (the log is already
  // persisted as 'failed' by the dispatcher).
  try {
    await dispatchMessage(log);
  } catch (_err) {
    // Swallow — the dispatcher has already written 'failed' + error_message
    // to the row. We re-read the log so the response reflects the final
    // state rather than the 'pending' snapshot from insertLog.
  }

  return findLogById(log.id);
};

// List scheduled messages: status=pending AND scheduled_at IS NOT NULL.
// Optional from/to filter on scheduled_at.
const findScheduled = async ({ page, limit, from, to } = {}) => {
  const pg = parsePagination(page, limit);

  let query = supabase
    .from('message_logs')
    .select(LOG_SELECT_WITH_RELS, { count: 'exact' })
    .eq('status', 'pending')
    .not('scheduled_at', 'is', null);

  if (from) {
    query = query.gte('scheduled_at', from);
  }
  if (to) {
    query = query.lte('scheduled_at', to);
  }

  query = query.order('scheduled_at', { ascending: true });

  const { data, count, error } = await query.range(pg.from, pg.to);
  if (error) {
    throw new AppError(
      `Failed to fetch scheduled messages: ${error.message}`,
      500,
    );
  }

  const total = count || 0;
  return {
    data: data || [],
    pagination: {
      page: pg.page,
      limit: pg.limit,
      total,
      totalPages: Math.ceil(total / pg.limit),
    },
  };
};

// Schedule a message: render now (so content is captured for audit), but
// set status='pending' + scheduled_at so the cron job dispatches it later.
const scheduleMessage = async ({
  customer_id,
  template_id,
  scheduled_at,
  channel,
  voucher_id,
} = {}) => {
  const customer = await getCustomer(customer_id);
  const template = await getTemplate(template_id);
  const finalChannel = channel || template.channel;
  if (!CHANNELS.includes(finalChannel)) {
    throw new AppError('Invalid channel', 400);
  }

  let voucherCode = null;
  if (voucher_id) {
    voucherCode = await getVoucherCode(voucher_id);
  }

  const shopName = await getShopName();
  const vars = buildVars({ customer, shopName, voucherCode });
  const { renderedSubject, renderedBody } = renderTemplate(template, vars);
  const contentSent = buildContentSent({
    renderedSubject,
    renderedBody,
    channel: finalChannel,
  });

  const log = await insertLog({
    customer_id,
    template_id,
    voucher_id: voucher_id || null,
    channel: finalChannel,
    status: 'pending',
    content_sent: contentSent,
    scheduled_at,
  });

  return log;
};

// Aggregated stats over a date range (by created_at). Returns counts per
// status and per channel.
const findStats = async ({ from, to } = {}) => {
  if (!from || !to) {
    throw new AppError('from and to query parameters are required', 400);
  }

  let query = supabase
    .from('message_logs')
    .select('status, channel', { count: 'exact' })
    .gte('created_at', from)
    .lt('created_at', `${to}T23:59:59.999Z`);

  const { data, count, error } = await query;
  if (error) {
    throw new AppError(
      `Failed to fetch message stats: ${error.message}`,
      500,
    );
  }

  const rows = data || [];
  const stats = {
    total: count || 0,
    sent: 0,
    failed: 0,
    delivered: 0,
    pending: 0,
    by_channel: { zalo: 0, email: 0, sms: 0 },
  };

  for (const row of rows) {
    if (row.status && stats[row.status] !== undefined) {
      stats[row.status] += 1;
    }
    if (row.channel && stats.by_channel[row.channel] !== undefined) {
      stats.by_channel[row.channel] += 1;
    }
  }

  return stats;
};

module.exports = {
  findLogs,
  sendNow,
  findScheduled,
  scheduleMessage,
  findStats,
};
