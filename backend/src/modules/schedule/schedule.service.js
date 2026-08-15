const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const SHIFT_SELECT = [
  'id',
  'employee_id',
  'date',
  'start_time',
  'end_time',
  'check_in_time',
  'check_out_time',
  'status',
  'notes',
  'location_id',
  'location_name',
  'latitude',
  'longitude',
  'created_at',
  'employee:employees(id, full_name, phone, role)',
  'location:locations(id, name, address)',
].join(', ');

const EMPLOYEE_BRIEF_SELECT = [
  'id',
  'full_name',
  'phone',
  'role',
].join(', ');

const isValidDate = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v));

const assertOk = (res, label) => {
  if (res.error) {
    throw new AppError(`Failed to fetch ${label}: ${res.error.message}`, 500);
  }
};

// Danh sách ca làm trong khoảng ngày, kèm nhân viên + địa điểm.
const findShifts = async ({ from, to, employee_id, location_id } = {}) => {
  if (!isValidDate(from) || !isValidDate(to)) {
    throw new AppError('"from" and "to" must be valid dates (YYYY-MM-DD)', 400);
  }
  if (new Date(from) > new Date(to)) {
    throw new AppError('"from" must be <= "to"', 400);
  }

  let query = supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (employee_id) query = query.eq('employee_id', employee_id);
  if (location_id) query = query.eq('location_id', location_id);

  const res = await query;
  assertOk(res, 'shifts');
  return res.data || [];
};

// Tải công việc (workload) của từng nhân viên trong khoảng ngày:
// số ca + tổng số giờ.
const findWorkload = async ({ from, to } = {}) => {
  if (!isValidDate(from) || !isValidDate(to)) {
    throw new AppError('"from" and "to" must be valid dates (YYYY-MM-DD)', 400);
  }

  const [shiftsRes, employeesRes] = await Promise.all([
    supabase
      .from('shifts')
      .select('employee_id, start_time, end_time, status')
      .gte('date', from)
      .lte('date', to)
      .neq('status', 'absent'),
    supabase
      .from('employees')
      .select('id, full_name, phone, role')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
  ]);

  assertOk(shiftsRes, 'shifts');
  assertOk(employeesRes, 'employees');

  const map = new Map();
  (employeesRes.data || []).forEach((e) => {
    map.set(e.id, {
      employee_id: e.id,
      full_name: e.full_name,
      phone: e.phone,
      role: e.role,
      shift_count: 0,
      total_hours: 0,
    });
  });

  (shiftsRes.data || []).forEach((s) => {
    const entry = map.get(s.employee_id);
    if (!entry) return;
    entry.shift_count += 1;
    const hours =
      (new Date(s.end_time) - new Date(s.start_time)) / 3_600_000;
    entry.total_hours = Number((entry.total_hours + hours).toFixed(2));
  });

  return Array.from(map.values());
};

// Gợi ý nhân viên phù hợp để gán vào một khoảng thời gian.
// Thứ tự ưu tiên: rảnh > đúng kỹ năng > có khu vực > tải thấp.
const autoAssign = async ({
  date,
  start_time,
  end_time,
  location_id,
  skill,
} = {}) => {
  if (!isValidDate(date)) {
    throw new AppError('"date" must be a valid date (YYYY-MM-DD)', 400);
  }
  if (!start_time || !end_time) {
    throw new AppError('"start_time" and "end_time" are required', 400);
  }
  const startISO = new Date(start_time).toISOString();
  const endISO = new Date(end_time).toISOString();
  if (new Date(endISO) <= new Date(startISO)) {
    throw new AppError('end_time must be after start_time', 400);
  }

  // Cửa sổ 7 ngày quanh `date` để tính tải tuần.
  const d = new Date(date);
  const weekFrom = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 3);
  const weekTo = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);

  const locationFetch = location_id
    ? supabase
      .from('locations')
      .select('id, name, address')
      .eq('id', location_id)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [employeesRes, skillsRes, areasRes, busyRes, weekRes, locationRes] =
    await Promise.all([
      supabase
        .from('employees')
        .select(EMPLOYEE_BRIEF_SELECT)
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('full_name', { ascending: true }),
      supabase
        .from('employee_skills')
        .select('employee_id, skill, level'),
      supabase
        .from('employee_areas')
        .select('employee_id, area'),
      // Ca trùng giờ → NV đang bận.
      supabase
        .from('shifts')
        .select('employee_id')
        .lt('start_time', endISO)
        .gt('end_time', startISO)
        .neq('status', 'absent'),
      // Tải tuần (số ca trong 7 ngày quanh `date`).
      supabase
        .from('shifts')
        .select('employee_id')
        .gte('date', weekFrom.toISOString().slice(0, 10))
        .lte('date', weekTo.toISOString().slice(0, 10))
        .neq('status', 'absent'),
      locationFetch,
    ]);

  assertOk(employeesRes, 'employees');
  assertOk(skillsRes, 'skills');
  assertOk(areasRes, 'areas');
  assertOk(busyRes, 'busy shifts');
  assertOk(weekRes, 'week shifts');
  assertOk(locationRes, 'location');

  const busyIds = new Set((busyRes.data || []).map((s) => s.employee_id));
  const weekCount = new Map();
  (weekRes.data || []).forEach((s) => {
    weekCount.set(s.employee_id, (weekCount.get(s.employee_id) || 0) + 1);
  });

  const skillsByEmp = new Map();
  (skillsRes.data || []).forEach((s) => {
    if (!skillsByEmp.has(s.employee_id)) skillsByEmp.set(s.employee_id, []);
    skillsByEmp.get(s.employee_id).push(s);
  });

  const areasByEmp = new Map();
  (areasRes.data || []).forEach((a) => {
    if (!areasByEmp.has(a.employee_id)) areasByEmp.set(a.employee_id, []);
    areasByEmp.get(a.employee_id).push(a.area);
  });

  const location = locationRes.data;

  const candidates = (employeesRes.data || []).map((e) => {
    const skills = skillsByEmp.get(e.id) || [];
    const areas = areasByEmp.get(e.id) || [];
    const workload = weekCount.get(e.id) || 0;
    const is_available = !busyIds.has(e.id);

    let score = 0;
    const reasons = [];
    if (!is_available) {
      reasons.push('Trùng ca');
    } else {
      reasons.push('Rảnh');
      score += 1000;
    }
    if (skill) {
      const has = skills.find((s) => s.skill === skill);
      if (has) {
        score += 500 + has.level * 10;
        reasons.push(`Kỹ năng ${skill} (lv${has.level})`);
      } else {
        reasons.push(`Thiếu kỹ năng ${skill}`);
        score -= 200;
      }
    }
    if (location && areas.length) {
      const match = areas.some((a) =>
        (location.address || '').toLowerCase().includes(a.toLowerCase()),
      );
      if (match) {
        score += 200;
        reasons.push('Khu vực phù hợp');
      }
    }
    // Tải thấp được ưu tiên.
    score -= workload * 20;

    return {
      employee_id: e.id,
      full_name: e.full_name,
      phone: e.phone,
      role: e.role,
      is_available,
      workload,
      skills: skills.map((s) => ({ skill: s.skill, level: s.level })),
      areas,
      score,
      reasons,
    };
  });

  candidates.sort((a, b) => b.score - a.score || a.workload - b.workload);

  return {
    date,
    start_time: startISO,
    end_time: endISO,
    location: location || null,
    requested_skill: skill || null,
    candidates,
  };
};

const assertShiftExists = async (id) => {
  const { data, error } = await supabase
    .from('shifts')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to verify shift: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError('Shift not found', 404);
  }
};

const createShift = async (data) => {
  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      employee_id: data.employee_id,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      location_id: data.location_id || null,
      location_name: data.location_name || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      notes: data.notes ?? null,
    })
    .select(SHIFT_SELECT)
    .single();

  if (error) {
    if (error.code === '23P01' || /time_order/i.test(error.message)) {
      throw new AppError('end_time must be after start_time', 400);
    }
    if (error.code === '23503') {
      throw new AppError('Referenced employee or location not found', 400);
    }
    throw new AppError(`Failed to create shift: ${error.message}`, 500);
  }
  return shift;
};

const updateShift = async (id, data) => {
  const { data: shift, error } = await supabase
    .from('shifts')
    .update(data)
    .eq('id', id)
    .select(SHIFT_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23P01' || /time_order/i.test(error.message)) {
      throw new AppError('end_time must be after start_time', 400);
    }
    if (error.code === '23503') {
      throw new AppError('Referenced employee or location not found', 400);
    }
    throw new AppError(`Failed to update shift: ${error.message}`, 500);
  }
  if (!shift) {
    throw new AppError('Shift not found', 404);
  }
  return shift;
};

const removeShift = async (id) => {
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) {
    throw new AppError(`Failed to delete shift: ${error.message}`, 500);
  }
};

const SWAP_SELECT = [
  'id',
  'shift_id',
  'requesting_employee',
  'target_employee_id',
  'reason',
  'status',
  'reviewed_by',
  'reviewed_at',
  'created_at',
  'shift:shifts(id, date, start_time, end_time, status, employee_id)',
  'requester:employees!shift_swap_requests_requesting_employee_fkey(id, full_name)',
  'target:employees!shift_swap_requests_target_employee_id_fkey(id, full_name)',
].join(', ');

const listSwapRequests = async ({ status } = {}) => {
  let query = supabase
    .from('shift_swap_requests')
    .select(SWAP_SELECT)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const res = await query;
  assertOk(res, 'swap requests');
  return res.data || [];
};

const createSwapRequest = async (data, requesterId) => {
  // Đảm bảo shift thuộc về người yêu cầu.
  const { data: shift, error: shiftErr } = await supabase
    .from('shifts')
    .select('id, employee_id, date, start_time, end_time')
    .eq('id', data.shift_id)
    .maybeSingle();
  if (shiftErr) {
    throw new AppError(`Failed to verify shift: ${shiftErr.message}`, 500);
  }
  if (!shift) {
    throw new AppError('Shift not found', 404);
  }
  if (shift.employee_id !== requesterId) {
    throw new AppError('You can only request swap for your own shift', 403);
  }

  const { data: req, error } = await supabase
    .from('shift_swap_requests')
    .insert({
      shift_id: data.shift_id,
      requesting_employee: requesterId,
      target_employee_id: data.target_employee_id || null,
      reason: data.reason || null,
    })
    .select(SWAP_SELECT)
    .single();

  if (error) {
    throw new AppError(`Failed to create swap request: ${error.message}`, 500);
  }
  return req;
};

const reviewSwapRequest = async (id, { status }, reviewerId) => {
  const { data: existing, error: findErr } = await supabase
    .from('shift_swap_requests')
    .select('id, status, shift_id, target_employee_id')
    .eq('id', id)
    .maybeSingle();
  if (findErr) {
    throw new AppError(`Failed to fetch swap request: ${findErr.message}`, 500);
  }
  if (!existing) {
    throw new AppError('Swap request not found', 404);
  }
  if (existing.status !== 'pending') {
    throw new AppError(`Swap request already ${existing.status}`, 400);
  }

  const { data: req, error } = await supabase
    .from('shift_swap_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(SWAP_SELECT)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to review swap request: ${error.message}`, 500);
  }
  if (!req) {
    throw new AppError('Swap request not found', 404);
  }

  // Nếu duyệt đổi ca và có NV nhận → chuyển ca sang NV mới.
  if (status === 'approved' && existing.target_employee_id) {
    await supabase
      .from('shifts')
      .update({ employee_id: existing.target_employee_id })
      .eq('id', existing.shift_id);
  }

  return req;
};

// ===================== Locations =====================
const LOCATION_SELECT = [
  'id',
  'name',
  'address',
  'latitude',
  'longitude',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

const listLocations = async ({ is_active } = {}) => {
  let query = supabase
    .from('locations')
    .select(LOCATION_SELECT)
    .order('name', { ascending: true });
  if (is_active === 'true') query = query.eq('is_active', true);
  if (is_active === 'false') query = query.eq('is_active', false);
  const res = await query;
  assertOk(res, 'locations');
  return res.data || [];
};

const createLocation = async (data) => {
  const { data: loc, error } = await supabase
    .from('locations')
    .insert({
      name: data.name,
      address: data.address || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      is_active: data.is_active ?? true,
    })
    .select(LOCATION_SELECT)
    .single();
  if (error) {
    throw new AppError(`Failed to create location: ${error.message}`, 500);
  }
  return loc;
};

const updateLocation = async (id, data) => {
  const { data: loc, error } = await supabase
    .from('locations')
    .update(data)
    .eq('id', id)
    .select(LOCATION_SELECT)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to update location: ${error.message}`, 500);
  }
  if (!loc) {
    throw new AppError('Location not found', 404);
  }
  return loc;
};

const removeLocation = async (id) => {
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) {
    throw new AppError(`Failed to delete location: ${error.message}`, 500);
  }
};

module.exports = {
  findShifts,
  findWorkload,
  autoAssign,
  createShift,
  updateShift,
  removeShift,
  assertShiftExists,
  listSwapRequests,
  createSwapRequest,
  reviewSwapRequest,
  listLocations,
  createLocation,
  updateLocation,
  removeLocation,
};
