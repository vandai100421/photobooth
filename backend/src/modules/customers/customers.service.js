const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const CUSTOMER_SELECT = [
  'id',
  'full_name',
  'phone',
  'email',
  'birthday',
  'gender',
  'zalo_id',
  'total_visits',
  'total_spent',
  'status',
  'registered_at',
  'last_visit_at',
  'notes',
  'created_at',
  'updated_at',
].join(', ');

const BOOKING_SELECT = [
  'id',
  'customer_id',
  'employee_id',
  'booking_date',
  'package_name',
  'amount',
  'status',
  'voucher_id',
  'photo_count',
  'notes',
  'created_at',
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
  'full_name',
  'phone',
  'email',
  'birthday',
  'total_visits',
  'total_spent',
  'status',
  'registered_at',
  'last_visit_at',
  'created_at',
  'updated_at',
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

const pad2 = (n) => String(n).padStart(2, '0');

// Birthday is stored as YYYY-MM-DD; MM-DD occupies chars 5-9.
const toMonthDay = (date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// Age the customer turns on their birthday this year.
const computeAge = (birthday) => {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const now = new Date();
  return now.getFullYear() - birth.getFullYear();
};

// Throws 404 if the customer does not exist or has been soft-deleted.
const assertCustomerExists = async (id) => {
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to verify customer: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError('Customer not found', 404);
  }
};

const findAll = async ({
  page,
  limit,
  search,
  status,
  birthday_month,
  sort,
} = {}) => {
  const pg = parsePagination(page, limit);
  const { field, ascending } = parseSort(sort);

  // birthday_month cannot be pushed into PostgREST (EXTRACT needs an RPC),
  // so we fetch candidates and filter in JS, then paginate the slice.
  if (birthday_month !== undefined && birthday_month !== null && birthday_month !== '') {
    const monthNum = Number(birthday_month);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new AppError('birthday_month must be an integer between 1 and 12', 400);
    }
    const targetMonth = pad2(monthNum);

    let query = supabase
      .from('customers')
      .select(CUSTOMER_SELECT)
      .is('deleted_at', null)
      .not('birthday', 'is', null);

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order(field, { ascending });
    if (error) {
      throw new AppError(`Failed to fetch customers: ${error.message}`, 500);
    }

    const filtered = (data || []).filter(
      (c) => c.birthday && c.birthday.slice(5, 7) === targetMonth,
    );
    const total = filtered.length;
    const slice = filtered.slice(pg.from, pg.to + 1);

    return {
      data: slice,
      pagination: {
        page: pg.page,
        limit: pg.limit,
        total,
        totalPages: Math.ceil(total / pg.limit),
      },
    };
  }

  let query = supabase
    .from('customers')
    .select(CUSTOMER_SELECT, { count: 'exact' })
    .is('deleted_at', null);

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }
  if (status) {
    query = query.eq('status', status);
  }

  query = query.order(field, { ascending });

  const { data, count, error } = await query.range(pg.from, pg.to);
  if (error) {
    throw new AppError(`Failed to fetch customers: ${error.message}`, 500);
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
  const { data: customer, error } = await supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch customer: ${error.message}`, 500);
  }
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  const [bookingsRes, vouchersRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('customer_id', id)
      .order('booking_date', { ascending: false })
      .limit(5),
    supabase
      .from('customer_vouchers')
      .select(
        `${CUSTOMER_VOUCHER_SELECT}, voucher:vouchers(id, code, name, type, discount_type, value)`,
      )
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (bookingsRes.error) {
    throw new AppError(`Failed to fetch bookings: ${bookingsRes.error.message}`, 500);
  }
  if (vouchersRes.error) {
    throw new AppError(`Failed to fetch vouchers: ${vouchersRes.error.message}`, 500);
  }

  return {
    ...customer,
    recent_bookings: bookingsRes.data || [],
    vouchers: vouchersRes.data || [],
  };
};

const findBirthdays = async ({ range } = {}) => {
  const validRanges = ['today', 'week', 'month'];
  const rangeType = validRanges.includes(range) ? range : 'today';

  const now = new Date();

  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_SELECT)
    .is('deleted_at', null)
    .not('birthday', 'is', null)
    .order('full_name', { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch birthdays: ${error.message}`, 500);
  }

  // Build the set of MM-DD strings that should match.
  const matchDays = new Set();
  if (rangeType === 'today') {
    matchDays.add(toMonthDay(now));
  } else if (rangeType === 'week') {
    // Next 7 days inclusive of today; Date math handles year-wrap.
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      matchDays.add(toMonthDay(d));
    }
  }

  const currentMonth = pad2(now.getMonth() + 1);

  const filtered = (data || []).filter((c) => {
    if (!c.birthday) return false;
    const md = c.birthday.slice(5, 10);
    if (rangeType === 'month') {
      return md.slice(0, 2) === currentMonth;
    }
    return matchDays.has(md);
  });

  // Enrich with voucher_assigned: has any issued (active) voucher.
  const customerIds = filtered.map((c) => c.id);
  let issuedSet = new Set();
  if (customerIds.length > 0) {
    const { data: vouchers, error: vErr } = await supabase
      .from('customer_vouchers')
      .select('customer_id')
      .in('customer_id', customerIds)
      .eq('status', 'issued');

    if (vErr) {
      throw new AppError(`Failed to fetch vouchers: ${vErr.message}`, 500);
    }
    issuedSet = new Set((vouchers || []).map((v) => v.customer_id));
  }

  const customers = filtered.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    birthday: c.birthday,
    age: computeAge(c.birthday),
    total_visits: c.total_visits,
    zalo_id: c.zalo_id,
    voucher_assigned: issuedSet.has(c.id),
  }));

  return {
    date: now.toISOString().slice(0, 10),
    total: customers.length,
    customers,
  };
};

const insert = async (data) => {
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      full_name: data.full_name,
      phone: data.phone,
      email: data.email || null,
      birthday: data.birthday || null,
      gender: data.gender || null,
      zalo_id: data.zalo_id || null,
      notes: data.notes || null,
    })
    .select(CUSTOMER_SELECT)
    .single();

  if (error) {
    // 23505 = unique_violation (phone already exists).
    if (error.code === '23505') {
      throw new AppError('Phone already exists', 409);
    }
    throw new AppError(`Failed to create customer: ${error.message}`, 500);
  }
  return customer;
};

const update = async (id, data) => {
  const { data: customer, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .is('deleted_at', null)
    .select(CUSTOMER_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('Phone already exists', 409);
    }
    throw new AppError(`Failed to update customer: ${error.message}`, 500);
  }
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  return customer;
};

const remove = async (id) => {
  const { data: customer, error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to delete customer: ${error.message}`, 500);
  }
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }
  return customer;
};

const findBookings = async (customerId, { page, limit } = {}) => {
  await assertCustomerExists(customerId);
  const pg = parsePagination(page, limit);

  const { data, count, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT, { count: 'exact' })
    .eq('customer_id', customerId)
    .order('booking_date', { ascending: false })
    .range(pg.from, pg.to);

  if (error) {
    throw new AppError(`Failed to fetch customer bookings: ${error.message}`, 500);
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

const findVouchers = async (customerId, { page, limit } = {}) => {
  await assertCustomerExists(customerId);
  const pg = parsePagination(page, limit);

  const { data, count, error } = await supabase
    .from('customer_vouchers')
    .select(
      `${CUSTOMER_VOUCHER_SELECT}, voucher:vouchers(id, code, name, type, discount_type, value)`,
      { count: 'exact' },
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(pg.from, pg.to);

  if (error) {
    throw new AppError(`Failed to fetch customer vouchers: ${error.message}`, 500);
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
  findBirthdays,
  insert,
  update,
  delete: remove,
  remove,
  findBookings,
  findVouchers,
};
