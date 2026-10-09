const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const assertOk = (res, label) => {
  if (res.error) {
    throw new AppError(`Failed to fetch ${label}: ${res.error.message}`, 500);
  }
};

const isValidMonth = (m) =>
  typeof m === 'string' && /^\d{4}-\d{2}$/.test(m) && !Number.isNaN(Date.parse(`${m}-01`));

const assertMonth = (m) => {
  if (!isValidMonth(m)) {
    throw new AppError('"month" must be in YYYY-MM format', 400);
  }
};

// Đầu/cuối tháng theo giờ địa phương → ISO UTC.
const monthBounds = (month) => {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0).toISOString();
  const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
  return { start, end, y, m };
};

const isWeekend = (isoStr) => {
  const day = new Date(isoStr).getDay();
  return day === 0 || day === 6;
};

// Ngưỡng phân loại feedback của KH.
const GOOD_RATING = 4;
const BAD_RATING = 2;

// Dấu của khoản thưởng/phạt do admin quyết định.
const adjustmentSign = (a) => (a.kind === 'penalty' ? -1 : 1);

// Tính thưởng cho 1 nhân viên dựa trên dữ liệu đã gom. Dùng chung cho
// getKpi (chi tiết) và getLeaderboard (tổng hợp).
const computeKpi = ({
  employee,
  monthBookings,
  priorBookings,
  monthShifts,
  monthFeedback,
  monthPosts,
  monthAdjustments,
  rules,
  holidayMDSet,
}) => {
  const ruleBy = (code) => rules.find((r) => r.code === code);
  const completed = monthBookings.filter((b) => b.status === 'completed');

  const weekendHolidayCount = completed.filter(
    (b) =>
      isWeekend(b.booking_date) ||
      holidayMDSet.has(b.booking_date.slice(5, 10)),
  ).length;

  const revenue = completed.reduce(
    (acc, b) => acc + Number(b.amount || 0),
    0,
  );

  // Đi muộn: check_in_time muộn hơn start_time quá 5 phút.
  const LATE_GRACE_MS = 5 * 60 * 1000;
  const lateCount = monthShifts.filter(
    (s) =>
      s.check_in_time &&
      s.start_time &&
      new Date(s.check_in_time) - new Date(s.start_time) > LATE_GRACE_MS,
  ).length;

  // KH quay lại: cùng KH, cùng NV, có booking trước đó trong 30 ngày.
  const priorByCustomer = new Map();
  (priorBookings || []).forEach((b) => {
    if (!b.customer_id) return;
    if (!priorByCustomer.has(b.customer_id)) {
      priorByCustomer.set(b.customer_id, []);
    }
    priorByCustomer.get(b.customer_id).push(new Date(b.booking_date).getTime());
  });
  const returnCount = completed.filter((b) => {
    const prevs = priorByCustomer.get(b.customer_id) || [];
    const t = new Date(b.booking_date).getTime();
    return prevs.some((p) => p < t && t - p <= 30 * 86400_000);
  }).length;

  const ratings = monthFeedback.map((f) => f.rating);
  const avgRating = ratings.length > 0
    ? Number((ratings.reduce((a, r) => a + r, 0) / ratings.length).toFixed(2))
    : null;

  // Feedback tốt (>= GOOD_RATING) và feedback kém (<= BAD_RATING) trong tháng.
  const goodFeedbackCount = monthFeedback.filter(
    (f) => f.rating >= GOOD_RATING,
  ).length;
  const badFeedbackCount = monthFeedback.filter(
    (f) => f.rating <= BAD_RATING,
  ).length;

  // Bài viết NV viết và đã được đăng trong tháng.
  const publishedPosts = monthPosts.filter((p) => p.status === 'published');

  const breakdown = [];
  let total = 0;

  const addLine = (rule, count, amountOverride) => {
    if (!rule) return;
    const per = amountOverride != null ? amountOverride : rule.amount;
    const lineTotal = Number((count * per).toFixed(0));
    breakdown.push({
      code: rule.code,
      name: rule.name,
      count,
      per,
      total: lineTotal,
    });
    total += lineTotal;
  };

  const rBooking = ruleBy('booking_completed');
  addLine(rBooking, completed.length);

  // Cuối tuần/lễ: cộng thêm phần trội (multiplier - 1) × tiền booking cơ bản.
  const rWeekend = ruleBy('weekend_holiday');
  if (rWeekend && rBooking && weekendHolidayCount > 0) {
    const extraPer = Number(
      (rBooking.amount * (Number(rWeekend.multiplier) - 1)).toFixed(0),
    );
    breakdown.push({
      code: rWeekend.code,
      name: rWeekend.name,
      count: weekendHolidayCount,
      per: extraPer,
      total: Number((weekendHolidayCount * extraPer).toFixed(0)),
    });
    total += weekendHolidayCount * extraPer;
  }

  const rReturn = ruleBy('customer_return');
  addLine(rReturn, returnCount);

  const rRating = ruleBy('high_rating');
  if (rRating && avgRating != null && avgRating >= 4.5) {
    breakdown.push({
      code: rRating.code,
      name: rRating.name,
      count: 1,
      per: rRating.amount,
      total: rRating.amount,
    });
    total += rRating.amount;
  }

  const rLate = ruleBy('late_penalty');
  if (rLate && lateCount > 3) {
    const penalized = lateCount - 3;
    breakdown.push({
      code: rLate.code,
      name: rLate.name,
      count: penalized,
      per: rLate.amount,
      total: Number((penalized * rLate.amount).toFixed(0)),
    });
    total += penalized * rLate.amount;
  }

  const rPost = ruleBy('post_published');
  addLine(rPost, publishedPosts.length);

  const rGood = ruleBy('good_feedback');
  addLine(rGood, goodFeedbackCount);

  const rBad = ruleBy('bad_feedback');
  addLine(rBad, badFeedbackCount);

  // Thưởng/phạt thủ công của admin: mỗi khoản 1 dòng để truy vết rõ lý do.
  const adjustmentTotal = (monthAdjustments || []).reduce(
    (acc, a) => acc + adjustmentSign(a) * Number(a.amount || 0),
    0,
  );
  (monthAdjustments || []).forEach((a) => {
    const signed = adjustmentSign(a) * Number(a.amount || 0);
    breakdown.push({
      code: `adjustment:${a.id}`,
      name: `${a.kind === 'penalty' ? 'Phạt' : 'Thưởng'} — ${a.reason}`,
      count: 1,
      per: signed,
      total: signed,
      kind: a.kind,
    });
    total += signed;
  });

  return {
    employee_id: employee.id,
    full_name: employee.full_name,
    phone: employee.phone,
    role: employee.role,
    metrics: {
      completed_bookings: completed.length,
      weekend_holiday_bookings: weekendHolidayCount,
      revenue,
      shifts_count: monthShifts.length,
      late_count: lateCount,
      customer_returns: returnCount,
      feedback_count: ratings.length,
      avg_rating: avgRating,
      good_feedback_count: goodFeedbackCount,
      bad_feedback_count: badFeedbackCount,
      published_posts: publishedPosts.length,
      adjustment_total: Number(adjustmentTotal.toFixed(0)),
    },
    breakdown,
    total_bonus: Number(total.toFixed(0)),
  };
};

// Bảng employee_adjustments có thể chưa được migrate → trả về mảng rỗng
// thay vì làm hỏng cả API KPI.
const isMissingAdjustmentsTable = (error) =>
  error?.code === '42P01' || /employee_adjustments/i.test(error?.message || '');

// Lấy khoản thưởng/phạt thủ công của 1 NV trong tháng.
const getAdjustments = async ({ employee_id, month } = {}) => {
  let query = supabase
    .from('employee_adjustments')
    .select(
      'id, employee_id, kind, amount, reason, source, feedback_id, period_month, created_by, created_at',
    )
    .order('created_at', { ascending: false });
  if (employee_id) query = query.eq('employee_id', employee_id);
  if (month) query = query.eq('period_month', month);

  const { data, error } = await query;
  if (error) {
    if (isMissingAdjustmentsTable(error)) return [];
    throw new AppError(`Failed to fetch adjustments: ${error.message}`, 500);
  }
  return data || [];
};

// Lấy KPI chi tiết cho 1 nhân viên / 1 tháng.
const getKpi = async ({ employee_id, month }) => {
  assertMonth(month);
  const { start, end } = monthBounds(month);

  const [
    empRes,
    bookingsRes,
    priorRes,
    shiftsRes,
    feedbackRes,
    rulesRes,
    holidaysRes,
    postsRes,
    adjustments,
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, phone, role')
      .eq('id', employee_id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('bookings')
      .select('id, customer_id, amount, booking_date, status')
      .eq('employee_id', employee_id)
      .gte('booking_date', start)
      .lte('booking_date', end),
    // 30 ngày trước cuối tháng để phát hiện KH quay lại.
    supabase
      .from('bookings')
      .select('customer_id, booking_date')
      .eq('employee_id', employee_id)
      .eq('status', 'completed')
      .lt('booking_date', end)
      .gte(
        'booking_date',
        new Date(new Date(end).getTime() - 60 * 86400_000).toISOString(),
      ),
    supabase
      .from('shifts')
      .select('start_time, check_in_time, status')
      .eq('employee_id', employee_id)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    supabase
      .from('customer_feedback')
      .select('rating')
      .eq('employee_id', employee_id)
      .gte('created_at', start)
      .lte('created_at', end),
    supabase
      .from('employee_bonus_rules')
      .select('id, code, name, amount, multiplier, is_active')
      .eq('is_active', true),
    supabase
      .from('holidays')
      .select('date')
      .eq('is_active', true),
    // Bài viết NV viết, đăng trong tháng.
    supabase
      .from('posts')
      .select('id, title, status, published_at')
      .eq('author_id', employee_id)
      .is('deleted_at', null)
      .gte('published_at', start)
      .lte('published_at', end),
    getAdjustments({ employee_id, month }),
  ]);

  assertOk(empRes, 'employee');
  if (!empRes.data) {
    throw new AppError('Employee not found', 404);
  }
  assertOk(bookingsRes, 'bookings');
  assertOk(priorRes, 'prior bookings');
  assertOk(shiftsRes, 'shifts');
  assertOk(feedbackRes, 'feedback');
  assertOk(rulesRes, 'bonus rules');
  assertOk(holidaysRes, 'holidays');
  assertOk(postsRes, 'posts');

  return computeKpi({
    employee: empRes.data,
    monthBookings: bookingsRes.data || [],
    priorBookings: priorRes.data || [],
    monthShifts: shiftsRes.data || [],
    monthFeedback: feedbackRes.data || [],
    monthPosts: postsRes.data || [],
    monthAdjustments: adjustments,
    rules: rulesRes.data || [],
    holidayMDSet: new Set((holidaysRes.data || []).map((h) => h.date)),
  });
};

// Bảng xếp hạng nhân viên theo tổng thưởng trong tháng.
const getLeaderboard = async ({ month }) => {
  assertMonth(month);
  const { start, end } = monthBounds(month);
  const priorStart = new Date(
    new Date(start).getTime() - 60 * 86400_000,
  ).toISOString();

  const [
    empRes,
    bookingsRes,
    priorRes,
    shiftsRes,
    feedbackRes,
    rulesRes,
    holidaysRes,
    postsRes,
    adjustments,
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, phone, role')
      .is('deleted_at', null)
      .eq('is_active', true),
    supabase
      .from('bookings')
      .select('id, employee_id, customer_id, amount, booking_date, status')
      .gte('booking_date', start)
      .lte('booking_date', end),
    supabase
      .from('bookings')
      .select('employee_id, customer_id, booking_date')
      .eq('status', 'completed')
      .lt('booking_date', end)
      .gte('booking_date', priorStart),
    supabase
      .from('shifts')
      .select('employee_id, start_time, check_in_time, status')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    supabase
      .from('customer_feedback')
      .select('employee_id, rating')
      .gte('created_at', start)
      .lte('created_at', end),
    supabase
      .from('employee_bonus_rules')
      .select('id, code, name, amount, multiplier, is_active')
      .eq('is_active', true),
    supabase
      .from('holidays')
      .select('date')
      .eq('is_active', true),
    supabase
      .from('posts')
      .select('author_id, status')
      .is('deleted_at', null)
      .eq('status', 'published')
      .gte('published_at', start)
      .lte('published_at', end),
    getAdjustments({ month }),
  ]);

  assertOk(empRes, 'employees');
  assertOk(bookingsRes, 'bookings');
  assertOk(priorRes, 'prior bookings');
  assertOk(shiftsRes, 'shifts');
  assertOk(feedbackRes, 'feedback');
  assertOk(rulesRes, 'bonus rules');
  assertOk(holidaysRes, 'holidays');
  assertOk(postsRes, 'posts');

  const holidayMDSet = new Set((holidaysRes.data || []).map((h) => h.date));
  const rules = rulesRes.data || [];

  const groupBy = (rows, key) => {
    const map = new Map();
    rows.forEach((r) => {
      if (!r[key]) return;
      if (!map.has(r[key])) map.set(r[key], []);
      map.get(r[key]).push(r);
    });
    return map;
  };

  const byEmpBookings = groupBy(bookingsRes.data || [], 'employee_id');
  const byEmpPrior = groupBy(priorRes.data || [], 'employee_id');
  const byEmpShifts = groupBy(shiftsRes.data || [], 'employee_id');
  const byEmpFeedback = groupBy(feedbackRes.data || [], 'employee_id');
  const byEmpPosts = groupBy(postsRes.data || [], 'author_id');
  const byEmpAdjustments = groupBy(adjustments, 'employee_id');

  const rows = (empRes.data || []).map((emp) =>
    computeKpi({
      employee: emp,
      monthBookings: byEmpBookings.get(emp.id) || [],
      priorBookings: byEmpPrior.get(emp.id) || [],
      monthShifts: byEmpShifts.get(emp.id) || [],
      monthFeedback: byEmpFeedback.get(emp.id) || [],
      monthPosts: byEmpPosts.get(emp.id) || [],
      monthAdjustments: byEmpAdjustments.get(emp.id) || [],
      rules,
      holidayMDSet,
    }),
  );

  rows.sort((a, b) => b.total_bonus - a.total_bonus);
  return rows.map((row, idx) => ({ rank: idx + 1, ...row }));
};

// Quy tắc thưởng.
const listBonusRules = async () => {
  const { data, error } = await supabase
    .from('employee_bonus_rules')
    .select('id, code, name, amount, multiplier, is_active, updated_at')
    .order('code', { ascending: true });
  assertOk({ error }, 'bonus rules');
  return data || [];
};

const upsertBonusRules = async (rules) => {
  // Upsert theo code (unique). INSERT ... ON CONFLICT (code) DO UPDATE.
  const payload = rules.map((r) => ({
    code: r.code,
    name: r.name,
    amount: r.amount,
    multiplier: r.multiplier ?? 1,
    is_active: r.is_active ?? true,
  }));

  const { data, error } = await supabase
    .from('employee_bonus_rules')
    .upsert(payload, { onConflict: 'code' })
    .select('id, code, name, amount, multiplier, is_active, updated_at')
    .order('code', { ascending: true });

  if (error) {
    throw new AppError(`Failed to save bonus rules: ${error.message}`, 500);
  }
  return data || [];
};

// Payouts.
const listPayouts = async ({ month, employee_id, status } = {}) => {
  let query = supabase
    .from('employee_payouts')
    .select(
      'id, employee_id, period_month, total_amount, breakdown, status, paid_at, created_at, updated_at, employee:employees(id, full_name, phone, role)',
    )
    .order('period_month', { ascending: false })
    .order('created_at', { ascending: false });
  if (month) query = query.eq('period_month', month);
  if (employee_id) query = query.eq('employee_id', employee_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  assertOk({ error }, 'payouts');
  return data || [];
};

// Tạo payout = chốt thù lao tháng cho 1 NV (dựa trên KPI đã tính).
const createPayout = async ({ employee_id, month }) => {
  assertMonth(month);

  const { data: existing } = await supabase
    .from('employee_payouts')
    .select('id')
    .eq('employee_id', employee_id)
    .eq('period_month', month)
    .maybeSingle();
  if (existing) {
    throw new AppError(
      'Payout for this employee/month already exists — update it instead',
      409,
    );
  }

  const kpi = await getKpi({ employee_id, month });

  const { data, error } = await supabase
    .from('employee_payouts')
    .insert({
      employee_id,
      period_month: month,
      total_amount: kpi.total_bonus,
      breakdown: {
        metrics: kpi.metrics,
        lines: kpi.breakdown,
      },
      status: 'pending',
    })
    .select(
      'id, employee_id, period_month, total_amount, breakdown, status, paid_at, created_at, updated_at, employee:employees(id, full_name, phone, role)',
    )
    .single();

  if (error) {
    throw new AppError(`Failed to create payout: ${error.message}`, 500);
  }
  return data;
};

const updatePayout = async (id, data) => {
  const patch = { ...data };
  if (data.status === 'paid') {
    patch.paid_at = new Date().toISOString();
  }
  const { data: payout, error } = await supabase
    .from('employee_payouts')
    .update(patch)
    .eq('id', id)
    .select(
      'id, employee_id, period_month, total_amount, breakdown, status, paid_at, created_at, updated_at, employee:employees(id, full_name, phone, role)',
    )
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to update payout: ${error.message}`, 500);
  }
  if (!payout) {
    throw new AppError('Payout not found', 404);
  }
  return payout;
};

// Thưởng/phạt thủ công (admin).
const listAdjustments = async ({ employee_id, month } = {}) => {
  let query = supabase
    .from('employee_adjustments')
    .select(
      'id, employee_id, kind, amount, reason, source, feedback_id, period_month, created_by, created_at, employee:employees(id, full_name, role)',
    )
    .order('created_at', { ascending: false });
  if (employee_id) query = query.eq('employee_id', employee_id);
  if (month) query = query.eq('period_month', month);

  const { data, error } = await query;
  if (error) {
    if (isMissingAdjustmentsTable(error)) return [];
    throw new AppError(`Failed to fetch adjustments: ${error.message}`, 500);
  }
  return data || [];
};

const createAdjustment = async (data, createdBy) => {
  const { data: adjustment, error } = await supabase
    .from('employee_adjustments')
    .insert({
      employee_id: data.employee_id,
      kind: data.kind,
      amount: data.amount,
      reason: data.reason,
      source: data.feedback_id ? 'feedback' : 'manual',
      feedback_id: data.feedback_id || null,
      period_month: data.period_month,
      created_by: createdBy || null,
    })
    .select(
      'id, employee_id, kind, amount, reason, source, feedback_id, period_month, created_by, created_at, employee:employees(id, full_name, role)',
    )
    .single();

  if (error) {
    if (error.code === '23503') {
      throw new AppError('Referenced employee or feedback not found', 400);
    }
    if (error.code === '23514') {
      throw new AppError('Invalid adjustment values', 400);
    }
    if (isMissingAdjustmentsTable(error)) {
      throw new AppError(
        'Bảng employee_adjustments chưa được tạo — hãy chạy docs/schema_hr_v2.sql',
        500,
      );
    }
    throw new AppError(`Failed to create adjustment: ${error.message}`, 500);
  }
  return adjustment;
};

const removeAdjustment = async (id) => {
  const { error } = await supabase
    .from('employee_adjustments')
    .delete()
    .eq('id', id);

  if (error) {
    throw new AppError(`Failed to delete adjustment: ${error.message}`, 500);
  }
};

// Feedback.
const listFeedback = async ({ employee_id, month } = {}) => {
  let query = supabase
    .from('customer_feedback')
    .select(
      'id, booking_id, employee_id, customer_id, rating, note, created_at, employee:employees(id, full_name), customer:customers(id, full_name)',
    )
    .order('created_at', { ascending: false });
  if (employee_id) query = query.eq('employee_id', employee_id);
  if (month) {
    assertMonth(month);
    const { start, end } = monthBounds(month);
    query = query.gte('created_at', start).lte('created_at', end);
  }
  const { data, error } = await query;
  assertOk({ error }, 'feedback');
  return data || [];
};

const createFeedback = async (data) => {
  const { data: feedback, error } = await supabase
    .from('customer_feedback')
    .insert({
      booking_id: data.booking_id,
      employee_id: data.employee_id || null,
      customer_id: data.customer_id || null,
      rating: data.rating,
      note: data.note || null,
    })
    .select(
      'id, booking_id, employee_id, customer_id, rating, note, created_at',
    )
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('Feedback already exists for this booking', 409);
    }
    if (error.code === '23503') {
      throw new AppError('Referenced booking/employee/customer not found', 400);
    }
    throw new AppError(`Failed to create feedback: ${error.message}`, 500);
  }
  return feedback;
};

module.exports = {
  getKpi,
  getLeaderboard,
  listBonusRules,
  upsertBonusRules,
  listPayouts,
  createPayout,
  updatePayout,
  listAdjustments,
  createAdjustment,
  removeAdjustment,
  listFeedback,
  createFeedback,
};
