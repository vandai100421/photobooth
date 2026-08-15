const crypto = require('crypto');
const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const VOUCHER_SELECT = [
  'id',
  'code',
  'name',
  'type',
  'discount_type',
  'value',
  'min_order',
  'max_discount',
  'total_quantity',
  'used_count',
  'valid_from',
  'valid_until',
  'is_active',
  'per_customer',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

const CUSTOMER_VOUCHER_SELECT = [
  'id',
  'customer_id',
  'voucher_id',
  'status',
  'issued_at',
  'used_at',
  'expires_at',
  'booking_id',
  'zalo_message_id',
  'created_at',
  'updated_at',
].join(', ');

// Whitelist of sortable columns to prevent arbitrary column injection.
const SORTABLE_FIELDS = [
  'code',
  'name',
  'type',
  'value',
  'total_quantity',
  'used_count',
  'valid_from',
  'valid_until',
  'per_customer',
  'is_active',
  'created_at',
  'updated_at',
];

const VALID_TYPES = ['birthday', 'holiday', 'promo', 'welcome'];

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

// 'true' -> true, 'false' -> false, anything else -> undefined (no filter).
const parseBoolean = (val) => {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return undefined;
};

// Today's date as YYYY-MM-DD for date-range comparisons against valid_from /
// valid_until (both stored as DATE columns).
const todayStr = () => new Date().toISOString().slice(0, 10);

// Count customer_vouchers issued (not expired) for a voucher. This is the
// source of truth for the total_quantity check — the vouchers.used_count
// column is not trigger-maintained, so we compute from customer_vouchers.
const getIssuedCount = async (voucherId) => {
  const { data, error } = await supabase
    .from('customer_vouchers')
    .select('id', { count: 'exact' })
    .eq('voucher_id', voucherId)
    .in('status', ['issued', 'used']);
  if (error) {
    throw new AppError(`Failed to count issued vouchers: ${error.message}`, 500);
  }
  return (data || []).length;
};

// Throws 404 if the voucher does not exist.
const assertVoucherExists = async (id) => {
  const { data, error } = await supabase
    .from('vouchers')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to verify voucher: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError('Voucher not found', 404);
  }
};

// Generate a random voucher code: TAP-XXXXXX (6 uppercase alphanumerics).
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `TAP-${suffix}`;
};

// Retry up to 5 times to avoid the astronomically unlikely code collision.
const generateUniqueCode = async () => {
  for (let i = 0; i < 5; i += 1) {
    const code = generateCode();
    const { data, error } = await supabase
      .from('vouchers')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (error) {
      throw new AppError(`Failed to check code uniqueness: ${error.message}`, 500);
    }
    if (!data) return code;
  }
  throw new AppError('Failed to generate a unique voucher code', 500);
};

const findAll = async ({ page, limit, search, type, is_active, sort } = {}) => {
  const pg = parsePagination(page, limit);
  const { field, ascending } = parseSort(sort);

  if (type && !VALID_TYPES.includes(type)) {
    throw new AppError(
      'type must be one of: birthday, holiday, promo, welcome',
      400,
    );
  }

  let query = supabase
    .from('vouchers')
    .select(VOUCHER_SELECT, { count: 'exact' });

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
  }
  if (type) {
    query = query.eq('type', type);
  }
  const activeFlag = parseBoolean(is_active);
  if (activeFlag !== undefined) {
    query = query.eq('is_active', activeFlag);
  }

  query = query.order(field, { ascending });

  const { data, count, error } = await query.range(pg.from, pg.to);
  if (error) {
    throw new AppError(`Failed to fetch vouchers: ${error.message}`, 500);
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

const findById = async (id) => {
  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select(VOUCHER_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch voucher: ${error.message}`, 500);
  }
  if (!voucher) {
    throw new AppError('Voucher not found', 404);
  }

  // Break down customer_vouchers by status for usage statistics.
  const { data: rows, error: statsErr } = await supabase
    .from('customer_vouchers')
    .select('status')
    .eq('voucher_id', id);

  if (statsErr) {
    throw new AppError(
      `Failed to fetch voucher stats: ${statsErr.message}`,
      500,
    );
  }

  const statusCounts = (rows || []).reduce((acc, cv) => {
    acc[cv.status] = (acc[cv.status] || 0) + 1;
    return acc;
  }, {});

  const issuedCount = (statusCounts.issued || 0) + (statusCounts.used || 0);
  const usedCount = statusCounts.used || 0;
  const remaining =
    voucher.total_quantity === -1
      ? -1
      : Math.max(voucher.total_quantity - issuedCount, 0);

  return {
    ...voucher,
    stats: {
      issued_count: issuedCount,
      used_count: usedCount,
      remaining,
    },
  };
};

const insert = async (data) => {
  const code =
    (data.code && data.code.trim()) || (await generateUniqueCode());

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .insert({
      code,
      name: data.name,
      type: data.type,
      discount_type: data.discount_type,
      value: data.value,
      min_order: data.min_order ?? 0,
      max_discount: data.max_discount ?? null,
      total_quantity: data.total_quantity ?? -1,
      valid_from: data.valid_from,
      valid_until: data.valid_until,
      per_customer: data.per_customer ?? 1,
      is_active: data.is_active ?? true,
      created_by: data.created_by || null,
    })
    .select(VOUCHER_SELECT)
    .single();

  if (error) {
    // 23505 = unique_violation (code already exists).
    if (error.code === '23505') {
      throw new AppError('Voucher code already exists', 409);
    }
    // 23514 = check_violation (e.g. valid_until < valid_from).
    if (error.code === '23514') {
      throw new AppError(
        'valid_until must be on or after valid_from',
        400,
      );
    }
    throw new AppError(`Failed to create voucher: ${error.message}`, 500);
  }
  return voucher;
};

const update = async (id, data) => {
  // When a date is being changed, validate the range against current values
  // so a partial update (only valid_from OR only valid_until) is checked
  // against the existing counterpart.
  if (data.valid_from !== undefined || data.valid_until !== undefined) {
    const { data: current, error: fetchErr } = await supabase
      .from('vouchers')
      .select('valid_from, valid_until')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      throw new AppError(
        `Failed to fetch voucher: ${fetchErr.message}`,
        500,
      );
    }
    if (!current) {
      throw new AppError('Voucher not found', 404);
    }

    const newFrom = data.valid_from !== undefined ? data.valid_from : current.valid_from;
    const newUntil =
      data.valid_until !== undefined ? data.valid_until : current.valid_until;
    if (newUntil < newFrom) {
      throw new AppError(
        'valid_until must be on or after valid_from',
        400,
      );
    }
  }

  // Build the update payload from whitelisted fields only (code excluded —
  // codes are immutable).
  const allowedKeys = [
    'name',
    'discount_type',
    'value',
    'min_order',
    'max_discount',
    'total_quantity',
    'valid_from',
    'valid_until',
    'per_customer',
    'is_active',
  ];
  const updates = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      updates[key] = data[key];
    }
  }

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .update(updates)
    .eq('id', id)
    .select(VOUCHER_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23514') {
      throw new AppError(
        'valid_until must be on or after valid_from',
        400,
      );
    }
    throw new AppError(`Failed to update voucher: ${error.message}`, 500);
  }
  if (!voucher) {
    throw new AppError('Voucher not found', 404);
  }
  return voucher;
};

// Vouchers table has no deleted_at column; deactivation (is_active=false)
// is the soft-delete mechanism, preserving customer_vouchers references.
const remove = async (id) => {
  const { data: voucher, error } = await supabase
    .from('vouchers')
    .update({ is_active: false })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to delete voucher: ${error.message}`, 500);
  }
  if (!voucher) {
    throw new AppError('Voucher not found', 404);
  }
  return voucher;
};

// Validate a voucher code without consuming it. Returns validity, the
// voucher record, remaining issuable quantity, and a reason if invalid.
const checkCode = async (code) => {
  if (!code || typeof code !== 'string' || !code.trim()) {
    throw new AppError('code query parameter is required', 400);
  }

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select(VOUCHER_SELECT)
    .eq('code', code.trim())
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch voucher: ${error.message}`, 500);
  }
  if (!voucher) {
    return {
      valid: false,
      voucher: null,
      remaining: 0,
      reason: 'Voucher not found',
    };
  }

  const issuedCount = await getIssuedCount(voucher.id);
  const remaining =
    voucher.total_quantity === -1
      ? -1
      : Math.max(voucher.total_quantity - issuedCount, 0);

  const today = todayStr();

  if (!voucher.is_active) {
    return { valid: false, voucher, remaining, reason: 'Voucher is inactive' };
  }
  if (today < voucher.valid_from) {
    return {
      valid: false,
      voucher,
      remaining,
      reason: 'Voucher is not yet valid',
    };
  }
  if (today > voucher.valid_until) {
    return { valid: false, voucher, remaining, reason: 'Voucher has expired' };
  }
  if (
    voucher.total_quantity !== -1 &&
    issuedCount >= voucher.total_quantity
  ) {
    return {
      valid: false,
      voucher,
      remaining: 0,
      reason: 'Voucher quantity exhausted',
    };
  }

  return { valid: true, voucher, remaining, reason: null };
};

// Issue a voucher to a customer: creates a customer_voucher (status=issued).
// Enforces voucher validity, total_quantity, and per_customer limits.
const issue = async (id, { customer_id, expires_at } = {}) => {
  if (!customer_id) {
    throw new AppError('customer_id is required', 400);
  }

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select(VOUCHER_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch voucher: ${error.message}`, 500);
  }
  if (!voucher) {
    throw new AppError('Voucher not found', 404);
  }

  // Voucher-level validity checks.
  if (!voucher.is_active) {
    throw new AppError('Voucher is not active', 400);
  }
  const today = todayStr();
  if (today < voucher.valid_from) {
    throw new AppError('Voucher is not yet valid', 400);
  }
  if (today > voucher.valid_until) {
    throw new AppError('Voucher has expired', 400);
  }

  // total_quantity check (computed from customer_vouchers).
  const issuedCount = await getIssuedCount(id);
  if (
    voucher.total_quantity !== -1 &&
    issuedCount >= voucher.total_quantity
  ) {
    throw new AppError('Voucher quantity exhausted', 400);
  }

  // Verify the customer exists and is not soft-deleted.
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customer_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (custErr) {
    throw new AppError(
      `Failed to verify customer: ${custErr.message}`,
      500,
    );
  }
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  // per_customer check: count issued + used customer_vouchers for this
  // customer + voucher combination (expired ones don't count against limit).
  const { data: existing, error: countErr } = await supabase
    .from('customer_vouchers')
    .select('id', { count: 'exact' })
    .eq('voucher_id', id)
    .eq('customer_id', customer_id)
    .in('status', ['issued', 'used']);

  if (countErr) {
    throw new AppError(
      `Failed to check per-customer limit: ${countErr.message}`,
      500,
    );
  }
  const customerIssued = (existing || []).length;
  if (customerIssued >= voucher.per_customer) {
    throw new AppError(
      `Per-customer limit reached (${voucher.per_customer})`,
      400,
    );
  }

  // Fall back to the voucher's valid_until end-of-day when no override given.
  const finalExpiresAt =
    expires_at || `${voucher.valid_until}T23:59:59.999Z`;

  const { data: customerVoucher, error: insErr } = await supabase
    .from('customer_vouchers')
    .insert({
      customer_id,
      voucher_id: id,
      status: 'issued',
      expires_at: finalExpiresAt,
    })
    .select(CUSTOMER_VOUCHER_SELECT)
    .single();

  if (insErr) {
    // 23503 = foreign_key_violation (customer or voucher not found).
    if (insErr.code === '23503') {
      throw new AppError(
        'Referenced customer or voucher not found',
        400,
      );
    }
    throw new AppError(`Failed to issue voucher: ${insErr.message}`, 500);
  }

  return customerVoucher;
};

const findUsage = async (id, { page, limit } = {}) => {
  await assertVoucherExists(id);
  const pg = parsePagination(page, limit);

  const { data, count, error } = await supabase
    .from('customer_vouchers')
    .select(
      `${CUSTOMER_VOUCHER_SELECT}, customer:customers(id, full_name, phone)`,
      { count: 'exact' },
    )
    .eq('voucher_id', id)
    .order('created_at', { ascending: false })
    .range(pg.from, pg.to);

  if (error) {
    throw new AppError(
      `Failed to fetch voucher usage: ${error.message}`,
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

module.exports = {
  findAll,
  findById,
  insert,
  update,
  delete: remove,
  remove,
  checkCode,
  issue,
  findUsage,
};
