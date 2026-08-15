const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const HOLIDAY_SELECT = [
  'id',
  'name',
  'date',
  'is_recurring',
  'specific_year',
  'template_id',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

// 'true' -> true, 'false' -> false, anything else -> undefined (no filter).
const parseBoolean = (val) => {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return undefined;
};

// Holidays are few in number; return all without pagination. Filter by name
// search and active flag; sort by date for stable ordering.
const findAll = async ({ search, is_active } = {}) => {
  let query = supabase.from('holidays').select(HOLIDAY_SELECT);

  if (search && search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }
  const activeFlag = parseBoolean(is_active);
  if (activeFlag !== undefined) {
    query = query.eq('is_active', activeFlag);
  }

  query = query.order('date', { ascending: true });

  const { data, error } = await query;
  if (error) {
    throw new AppError(`Failed to fetch holidays: ${error.message}`, 500);
  }
  return data || [];
};

const findById = async (id) => {
  const { data: holiday, error } = await supabase
    .from('holidays')
    .select(HOLIDAY_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch holiday: ${error.message}`, 500);
  }
  if (!holiday) {
    throw new AppError('Holiday not found', 404);
  }
  return holiday;
};

const insert = async (data) => {
  // Business rule: no two holidays may share the same date + specific_year.
  let dupQuery = supabase
    .from('holidays')
    .select('id')
    .eq('date', data.date);
  if (data.specific_year === undefined || data.specific_year === null) {
    dupQuery = dupQuery.is('specific_year', null);
  } else {
    dupQuery = dupQuery.eq('specific_year', data.specific_year);
  }
  const { data: dup, error: dupErr } = await dupQuery.maybeSingle();
  if (dupErr) {
    throw new AppError(
      `Failed to check holiday uniqueness: ${dupErr.message}`,
      500,
    );
  }
  if (dup) {
    throw new AppError(
      'Holiday with this date and specific_year already exists',
      409,
    );
  }

  const { data: holiday, error } = await supabase
    .from('holidays')
    .insert({
      name: data.name,
      date: data.date,
      is_recurring: data.is_recurring ?? true,
      specific_year: data.specific_year ?? null,
      template_id: data.template_id ?? null,
      is_active: data.is_active ?? true,
    })
    .select(HOLIDAY_SELECT)
    .single();

  if (error) {
    // 23505 = unique_violation (name + date collision from DB constraint).
    if (error.code === '23505') {
      throw new AppError(
        'Holiday with this name and date already exists',
        409,
      );
    }
    throw new AppError(`Failed to create holiday: ${error.message}`, 500);
  }
  return holiday;
};

const update = async (id, data) => {
  const allowedKeys = [
    'name',
    'date',
    'is_recurring',
    'specific_year',
    'template_id',
    'is_active',
  ];
  const updates = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      updates[key] = data[key];
    }
  }

  const { data: holiday, error } = await supabase
    .from('holidays')
    .update(updates)
    .eq('id', id)
    .select(HOLIDAY_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(
        'Holiday with this name and date already exists',
        409,
      );
    }
    throw new AppError(`Failed to update holiday: ${error.message}`, 500);
  }
  if (!holiday) {
    throw new AppError('Holiday not found', 404);
  }
  return holiday;
};

// Hard delete — holidays have no soft-delete column; one-off holidays can be
// removed once passed, and recurring ones when no longer relevant.
const remove = async (id) => {
  const { data: holiday, error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to delete holiday: ${error.message}`, 500);
  }
  if (!holiday) {
    throw new AppError('Holiday not found', 404);
  }
  return holiday;
};

module.exports = {
  findAll,
  findById,
  insert,
  update,
  remove,
};
