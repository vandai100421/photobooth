const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

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
  'updated_at',
].join(', ');

// Embed customer + employee summary fields for list/detail views.
const BOOKING_SELECT_WITH_RELATIONS = [
  BOOKING_SELECT,
  'customer:customers(id, full_name, phone)',
  'employee:employees(id, full_name)',
].join(', ');

const SORTABLE_FIELDS = [
  'booking_date',
  'amount',
  'status',
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
  let field = 'booking_date';
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

// Accept pure dates (YYYY-MM-DD) and expand to full-day boundaries so that
// `to=2024-08-12` includes bookings later that day.
const toDatetimeBound = (value, endOfDay) => {
  if (!value) return value;
  if (value.length === 10) {
    return endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`;
  }
  return value;
};

const findAll = async ({
  page,
  limit,
  customer_id,
  employee_id,
  status,
  from,
  to,
  sort,
} = {}) => {
  const pg = parsePagination(page, limit);
  const { field, ascending } = parseSort(sort);

  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT_WITH_RELATIONS, { count: 'exact' });

  if (customer_id) {
    query = query.eq('customer_id', customer_id);
  }
  if (employee_id) {
    query = query.eq('employee_id', employee_id);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (from) {
    query = query.gte('booking_date', toDatetimeBound(from, false));
  }
  if (to) {
    query = query.lte('booking_date', toDatetimeBound(to, true));
  }

  query = query.order(field, { ascending });

  const { data, count, error } = await query.range(pg.from, pg.to);
  if (error) {
    throw new AppError(`Failed to fetch bookings: ${error.message}`, 500);
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
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT_WITH_RELATIONS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch booking: ${error.message}`, 500);
  }
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }
  return booking;
};

// Validate that a customer_voucher is issued and not expired.
const assertVoucherUsable = async (voucherId) => {
  const { data: cv, error } = await supabase
    .from('customer_vouchers')
    .select('id, status, expires_at')
    .eq('id', voucherId)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to verify voucher: ${error.message}`, 500);
  }
  if (!cv) {
    throw new AppError('Voucher not found', 404);
  }
  if (cv.status !== 'issued') {
    throw new AppError(`Voucher is not available (status=${cv.status})`, 400);
  }
  if (cv.expires_at && new Date(cv.expires_at) < new Date()) {
    throw new AppError('Voucher has expired', 400);
  }
};

const insert = async (data) => {
  if (data.voucher_id) {
    await assertVoucherUsable(data.voucher_id);
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: data.customer_id,
      employee_id: data.employee_id || null,
      booking_date: data.booking_date,
      package_name: data.package_name || null,
      amount: data.amount ?? 0,
      status: data.status || 'completed',
      voucher_id: data.voucher_id || null,
      photo_count: data.photo_count ?? 0,
      notes: data.notes || null,
    })
    .select(BOOKING_SELECT_WITH_RELATIONS)
    .single();

  if (error) {
    // 23503 = foreign_key_violation (customer/employee/voucher not found).
    if (error.code === '23503') {
      throw new AppError(
        'Referenced customer, employee, or voucher not found',
        400,
      );
    }
    throw new AppError(`Failed to create booking: ${error.message}`, 500);
  }

  // Mark the voucher as used when the booking is completed. The DB trigger
  // on bookings handles customer stats (total_visits / total_spent).
  if (data.voucher_id && (data.status || 'completed') === 'completed') {
    await supabase
      .from('customer_vouchers')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        booking_id: booking.id,
      })
      .eq('id', data.voucher_id);
  }

  return booking;
};

const update = async (id, data) => {
  const { data: booking, error } = await supabase
    .from('bookings')
    .update(data)
    .eq('id', id)
    .select(BOOKING_SELECT_WITH_RELATIONS)
    .maybeSingle();

  if (error) {
    if (error.code === '23503') {
      throw new AppError(
        'Referenced customer, employee, or voucher not found',
        400,
      );
    }
    throw new AppError(`Failed to update booking: ${error.message}`, 500);
  }
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }
  return booking;
};

const remove = async (id) => {
  const { data: booking, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to cancel booking: ${error.message}`, 500);
  }
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }
  return booking;
};

module.exports = {
  findAll,
  findById,
  insert,
  update,
  delete: remove,
  remove,
};
