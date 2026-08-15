const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const pad2 = (n) => String(n).padStart(2, '0');

// Birthday is stored as YYYY-MM-DD; MM-DD occupies chars 5-9.
const toMonthDay = (date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const isValidDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value));

// Treat input date strings as local calendar dates, then convert to UTC ISO
// so they line up with how the "today" boundaries are computed below.
const dateToStartISO = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
};

const dateToEndISO = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
};

const startOfTodayISO = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
};

const endOfTodayISO = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
};

const startOfMonthISO = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
};

// new Date(year, month+1, 0) yields the last day of "month".
const endOfMonthISO = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
};

const assertRange = (from, to) => {
  if (!from || !to) {
    throw new AppError('Both "from" and "to" query parameters are required', 400);
  }
  if (!isValidDate(from) || !isValidDate(to)) {
    throw new AppError('"from" and "to" must be valid dates in YYYY-MM-DD format', 400);
  }
  if (new Date(from) > new Date(to)) {
    throw new AppError('"from" must be less than or equal to "to"', 400);
  }
};

// ISO 8601 UTC strings compare chronologically under lexicographic ordering.
const inRange = (isoStr, startISO, endISO) =>
  !!isoStr && isoStr >= startISO && isoStr <= endISO;

const monthKey = (isoStr) => (isoStr ? isoStr.slice(0, 7) : null);

// Enumerate every YYYY-MM between from and to (inclusive) so charts render
// continuous even for months with no data.
const enumerateMonths = (fromStr, toStr) => {
  const [fy, fm] = fromStr.split('-').map(Number);
  const [ty, tm] = toStr.split('-').map(Number);
  const months = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${pad2(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
};

const assertOk = (result, label) => {
  if (result.error) {
    throw new AppError(`Failed to fetch ${label}: ${result.error.message}`, 500);
  }
};

const sumAmount = (rows) =>
  (rows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

const getStats = async () => {
  const todayStart = startOfTodayISO();
  const todayEnd = endOfTodayISO();
  const monthStart = startOfMonthISO();
  const monthEnd = endOfMonthISO();
  const todayMD = toMonthDay(new Date());

  const [
    customersTodayRes,
    customersTotalRes,
    bookingsTodayRes,
    bookingsTotalRes,
    vouchersUsedTodayRes,
    vouchersActiveRes,
    completedBookingsRes,
    messagesTodayRes,
    birthdaysRes,
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('registered_at', todayStart)
      .lte('registered_at', todayEnd),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('booking_date', todayStart)
      .lte('booking_date', todayEnd),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('customer_vouchers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'used')
      .gte('used_at', todayStart)
      .lte('used_at', todayEnd),
    supabase
      .from('vouchers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    // Single fetch of all completed bookings drives the 3 revenue figures,
    // since PostgREST cannot SUM/GROUP BY without an RPC function.
    supabase
      .from('bookings')
      .select('booking_date, amount')
      .eq('status', 'completed'),
    supabase
      .from('message_logs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'delivered'])
      .gte('sent_at', todayStart)
      .lte('sent_at', todayEnd),
    supabase
      .from('customers')
      .select('birthday')
      .is('deleted_at', null)
      .not('birthday', 'is', null),
  ]);

  assertOk(customersTodayRes, 'customers today');
  assertOk(customersTotalRes, 'customers total');
  assertOk(bookingsTodayRes, 'bookings today');
  assertOk(bookingsTotalRes, 'bookings total');
  assertOk(vouchersUsedTodayRes, 'vouchers used today');
  assertOk(vouchersActiveRes, 'active vouchers');
  assertOk(completedBookingsRes, 'completed bookings');
  assertOk(messagesTodayRes, 'messages today');
  assertOk(birthdaysRes, 'birthdays');

  const completed = completedBookingsRes.data || [];
  const revenueToday = sumAmount(
    completed.filter((b) => inRange(b.booking_date, todayStart, todayEnd)),
  );
  const revenueMonth = sumAmount(
    completed.filter((b) => inRange(b.booking_date, monthStart, monthEnd)),
  );
  const revenueTotal = sumAmount(completed);

  const birthdaysToday = (birthdaysRes.data || []).filter(
    (c) => c.birthday && c.birthday.slice(5, 10) === todayMD,
  ).length;

  return {
    customers_today: customersTodayRes.count || 0,
    customers_total: customersTotalRes.count || 0,
    bookings_today: bookingsTodayRes.count || 0,
    bookings_total: bookingsTotalRes.count || 0,
    vouchers_used_today: vouchersUsedTodayRes.count || 0,
    vouchers_active: vouchersActiveRes.count || 0,
    revenue_today: revenueToday,
    revenue_month: revenueMonth,
    revenue_total: revenueTotal,
    messages_sent_today: messagesTodayRes.count || 0,
    birthdays_today: birthdaysToday,
  };
};

const getRevenue = async ({ from, to }) => {
  assertRange(from, to);
  const startISO = dateToStartISO(from);
  const endISO = dateToEndISO(to);

  const { data, error } = await supabase
    .from('bookings')
    .select('booking_date, amount')
    .eq('status', 'completed')
    .gte('booking_date', startISO)
    .lte('booking_date', endISO)
    .order('booking_date', { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch revenue: ${error.message}`, 500);
  }

  const buckets = new Map();
  (data || []).forEach((b) => {
    const key = monthKey(b.booking_date);
    if (!key) return;
    const entry = buckets.get(key) || { month: key, revenue: 0, bookings_count: 0 };
    entry.revenue += Number(b.amount || 0);
    entry.bookings_count += 1;
    buckets.set(key, entry);
  });

  return enumerateMonths(from, to).map(
    (m) => buckets.get(m) || { month: m, revenue: 0, bookings_count: 0 },
  );
};

const getCustomers = async ({ from, to }) => {
  assertRange(from, to);
  const startISO = dateToStartISO(from);
  const endISO = dateToEndISO(to);

  const [customersRes, bookingsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('registered_at')
      .is('deleted_at', null)
      .gte('registered_at', startISO)
      .lte('registered_at', endISO),
    supabase
      .from('bookings')
      .select('customer_id, booking_date')
      .gte('booking_date', startISO)
      .lte('booking_date', endISO),
  ]);

  if (customersRes.error) {
    throw new AppError(`Failed to fetch customers: ${customersRes.error.message}`, 500);
  }
  if (bookingsRes.error) {
    throw new AppError(`Failed to fetch bookings: ${bookingsRes.error.message}`, 500);
  }

  const months = enumerateMonths(from, to);

  const growthMap = new Map();
  (customersRes.data || []).forEach((c) => {
    const key = monthKey(c.registered_at);
    if (!key) return;
    growthMap.set(key, (growthMap.get(key) || 0) + 1);
  });
  const growth = months.map((m) => ({
    month: m,
    new_customers: growthMap.get(m) || 0,
  }));

  const activeMap = new Map();
  (bookingsRes.data || []).forEach((b) => {
    const key = monthKey(b.booking_date);
    if (!key || !b.customer_id) return;
    if (!activeMap.has(key)) activeMap.set(key, new Set());
    activeMap.get(key).add(b.customer_id);
  });
  const active = months.map((m) => ({
    month: m,
    active_customers: activeMap.has(m) ? activeMap.get(m).size : 0,
  }));

  return { growth, active };
};

const getVouchers = async ({ from, to }) => {
  assertRange(from, to);
  const startISO = dateToStartISO(from);
  const endISO = dateToEndISO(to);

  const { data, error } = await supabase
    .from('customer_vouchers')
    .select('status, issued_at, voucher:vouchers(type)')
    .gte('issued_at', startISO)
    .lte('issued_at', endISO);

  if (error) {
    throw new AppError(`Failed to fetch voucher stats: ${error.message}`, 500);
  }

  let issued = 0;
  let used = 0;
  let expired = 0;
  const byTypeMap = new Map();

  (data || []).forEach((cv) => {
    issued += 1;
    if (cv.status === 'used') used += 1;
    else if (cv.status === 'expired') expired += 1;

    const type = cv.voucher?.type;
    if (type) {
      const entry = byTypeMap.get(type) || { type, issued: 0, used: 0 };
      entry.issued += 1;
      if (cv.status === 'used') entry.used += 1;
      byTypeMap.set(type, entry);
    }
  });

  const VOUCHER_TYPES = ['birthday', 'holiday', 'promo', 'welcome'];
  const by_type = VOUCHER_TYPES.map(
    (t) => byTypeMap.get(t) || { type: t, issued: 0, used: 0 },
  );

  const usage_rate = issued > 0 ? Number((used / issued).toFixed(4)) : 0;

  return {
    summary: { issued, used, expired, usage_rate },
    by_type,
  };
};

module.exports = {
  getStats,
  getRevenue,
  getCustomers,
  getVouchers,
};
