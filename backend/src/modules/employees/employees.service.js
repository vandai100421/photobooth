const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

// Columns returned for every employee read (never expose password_hash).
const EMPLOYEE_SELECT = [
  'id',
  'full_name',
  'phone',
  'email',
  'role',
  'avatar_url',
  'is_active',
  'hire_date',
  'created_at',
].join(', ');

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
].join(', ');

// Whitelist of sortable columns to prevent arbitrary column injection.
const SORTABLE_FIELDS = [
  'full_name',
  'phone',
  'email',
  'role',
  'hire_date',
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

const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return value === true || value === 'true';
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

// Throws 404 if the employee does not exist or has been soft-deleted.
const assertEmployeeExists = async (id) => {
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to verify employee: ${error.message}`, 500);
  }
  if (!data) {
    throw new AppError('Employee not found', 404);
  }
};

const findAll = async ({
  page,
  limit,
  search,
  role,
  is_active,
  sort,
} = {}) => {
  const pg = parsePagination(page, limit);
  const { field, ascending } = parseSort(sort);

  let query = supabase
    .from('employees')
    .select(EMPLOYEE_SELECT, { count: 'exact' })
    .is('deleted_at', null);

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }
  if (role) {
    query = query.eq('role', role);
  }
  const active = parseBoolean(is_active);
  if (active !== null) {
    query = query.eq('is_active', active);
  }

  query = query.order(field, { ascending });

  const { data, count, error } = await query.range(pg.from, pg.to);

  if (error) {
    throw new AppError(`Failed to fetch employees: ${error.message}`, 500);
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
  const { data: employee, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch employee: ${error.message}`, 500);
  }
  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  // 5 most recent shifts for the profile view.
  const { data: shifts, error: shiftErr } = await supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .eq('employee_id', id)
    .order('start_time', { ascending: false })
    .limit(5);

  if (shiftErr) {
    throw new AppError(`Failed to fetch shifts: ${shiftErr.message}`, 500);
  }

  return { ...employee, shifts: shifts || [] };
};

const insert = async (data) => {
  const { password, ...rest } = data;

  // Schema assumption: employees.id = auth.users.id, so a Supabase Auth user
  // must exist for login + RLS (current_employee_role) to work. Email is
  // optional on the row but required by Supabase Auth — synthesize a
  // phone-based address when omitted.
  const authEmail = rest.email && rest.email.trim()
    ? rest.email.trim()
    : `${rest.phone}@phone.tapphotobooth.app`;

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: rest.full_name,
      phone: rest.phone,
      role: rest.role,
    },
  });

  if (authErr || !authUser?.user) {
    const msg = authErr?.message || 'unknown error';
    if (/already registered|already exists|user already/i.test(msg)) {
      throw new AppError('Email already registered', 409);
    }
    throw new AppError(`Failed to create auth user: ${msg}`, 500);
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .insert({
      id: authUser.user.id,
      full_name: rest.full_name,
      phone: rest.phone,
      email: rest.email || null,
      // Real hash lives in Supabase Auth; this sentinel marks that fact.
      password_hash: 'supabase-auth',
      role: rest.role,
      avatar_url: rest.avatar_url || null,
      hire_date: rest.hire_date || null,
    })
    .select(EMPLOYEE_SELECT)
    .single();

  if (error) {
    // Roll back the orphaned auth user to avoid half-created accounts.
    await supabase.auth.admin.deleteUser(authUser.user.id);
    if (error.code === '23505') {
      throw new AppError('Phone already exists', 409);
    }
    throw new AppError(`Failed to create employee: ${error.message}`, 500);
  }

  return employee;
};

const update = async (id, data) => {
  const { password, ...rest } = data;

  // Sync password to Supabase Auth (employees.id = auth.users.id).
  if (password) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(id, {
      password,
    });
    if (authErr) {
      throw new AppError(`Failed to update password: ${authErr.message}`, 500);
    }
  }

  // Skip the DB write entirely if only the password was changed.
  const hasRowFields = Object.keys(rest).length > 0;
  if (!hasRowFields) {
    return findById(id);
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .update(rest)
    .eq('id', id)
    .is('deleted_at', null)
    .select(EMPLOYEE_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('Phone already exists', 409);
    }
    throw new AppError(`Failed to update employee: ${error.message}`, 500);
  }
  if (!employee) {
    throw new AppError('Employee not found', 404);
  }
  return employee;
};

const remove = async (id) => {
  // Soft delete: preserve the row for referential integrity (shifts,
  // bookings, posts). Also disable login — auth middleware rejects
  // is_active=false accounts.
  const { data: employee, error } = await supabase
    .from('employees')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to delete employee: ${error.message}`, 500);
  }
  if (!employee) {
    throw new AppError('Employee not found', 404);
  }
  return employee;
};

const findShifts = async (employeeId, { page, limit, from, to } = {}) => {
  await assertEmployeeExists(employeeId);
  const pg = parsePagination(page, limit);

  let query = supabase
    .from('shifts')
    .select(SHIFT_SELECT, { count: 'exact' })
    .eq('employee_id', employeeId);

  if (from) {
    query = query.gte('date', from);
  }
  if (to) {
    query = query.lte('date', to);
  }

  query = query.order('start_time', { ascending: false });

  const { data, count, error } = await query.range(pg.from, pg.to);

  if (error) {
    throw new AppError(`Failed to fetch shifts: ${error.message}`, 500);
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

const insertShift = async (employeeId, data) => {
  await assertEmployeeExists(employeeId);

  // employee_id always comes from the URL to prevent cross-user forgery.
  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      employee_id: employeeId,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      notes: data.notes ?? null,
    })
    .select(SHIFT_SELECT)
    .single();

  if (error) {
    // shifts_time_order CHECK constraint: end_time must be after start_time.
    if (error.code === '23P01' || /time_order/i.test(error.message)) {
      throw new AppError('end_time must be after start_time', 400);
    }
    throw new AppError(`Failed to create shift: ${error.message}`, 500);
  }
  return shift;
};

const updateShift = async (shiftId, data) => {
  const { data: shift, error } = await supabase
    .from('shifts')
    .update(data)
    .eq('id', shiftId)
    .select(SHIFT_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23P01' || /time_order/i.test(error.message)) {
      throw new AppError('end_time must be after start_time', 400);
    }
    throw new AppError(`Failed to update shift: ${error.message}`, 500);
  }
  if (!shift) {
    throw new AppError('Shift not found', 404);
  }
  return shift;
};

// ===================== Skills =====================
const findSkills = async (employeeId) => {
  await assertEmployeeExists(employeeId);
  const { data, error } = await supabase
    .from('employee_skills')
    .select('id, employee_id, skill, level, created_at')
    .eq('employee_id', employeeId)
    .order('skill', { ascending: true });
  if (error) {
    throw new AppError(`Failed to fetch skills: ${error.message}`, 500);
  }
  return data || [];
};

const upsertSkill = async (employeeId, { skill, level }) => {
  await assertEmployeeExists(employeeId);
  const { data, error } = await supabase
    .from('employee_skills')
    .upsert(
      { employee_id: employeeId, skill, level: level ?? 1 },
      { onConflict: 'employee_id,skill' },
    )
    .select('id, employee_id, skill, level, created_at')
    .single();
  if (error) {
    throw new AppError(`Failed to save skill: ${error.message}`, 500);
  }
  return data;
};

const removeSkill = async (employeeId, skillId) => {
  const { error } = await supabase
    .from('employee_skills')
    .delete()
    .eq('id', skillId)
    .eq('employee_id', employeeId);
  if (error) {
    throw new AppError(`Failed to delete skill: ${error.message}`, 500);
  }
};

// ===================== Areas =====================
const findAreas = async (employeeId) => {
  await assertEmployeeExists(employeeId);
  const { data, error } = await supabase
    .from('employee_areas')
    .select('id, employee_id, area, created_at')
    .eq('employee_id', employeeId)
    .order('area', { ascending: true });
  if (error) {
    throw new AppError(`Failed to fetch areas: ${error.message}`, 500);
  }
  return data || [];
};

const upsertArea = async (employeeId, { area }) => {
  await assertEmployeeExists(employeeId);
  const { data, error } = await supabase
    .from('employee_areas')
    .upsert(
      { employee_id: employeeId, area: area.trim() },
      { onConflict: 'employee_id,area' },
    )
    .select('id, employee_id, area, created_at')
    .single();
  if (error) {
    throw new AppError(`Failed to save area: ${error.message}`, 500);
  }
  return data;
};

const removeArea = async (employeeId, areaId) => {
  const { error } = await supabase
    .from('employee_areas')
    .delete()
    .eq('id', areaId)
    .eq('employee_id', employeeId);
  if (error) {
    throw new AppError(`Failed to delete area: ${error.message}`, 500);
  }
};

module.exports = {
  findAll,
  findById,
  insert,
  update,
  delete: remove,
  remove,
  findShifts,
  insertShift,
  updateShift,
  findSkills,
  upsertSkill,
  removeSkill,
  findAreas,
  upsertArea,
  removeArea,
};
