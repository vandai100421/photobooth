const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const TABLE = 'daily_revenue';

const COLUMNS = [
  'id',
  'revenue_date',
  'amount',
  'note',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

const assertRange = (from, to) => {
  if (from && to && from > to) {
    throw new AppError('"from" must be less than or equal to "to"', 400);
  }
};

// Liệt kê doanh thu nhập tay trong khoảng ngày (nếu có). Sắp theo ngày giảm dần.
const findAll = async ({ from, to } = {}) => {
  assertRange(from, to);

  let query = supabase.from(TABLE).select(COLUMNS);
  if (from) query = query.gte('revenue_date', from);
  if (to) query = query.lte('revenue_date', to);
  query = query.order('revenue_date', { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new AppError(`Failed to fetch daily revenue: ${error.message}`, 500);
  }
  return data || [];
};

const findById = async (id) => {
  const { data: row, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch daily revenue: ${error.message}`, 500);
  }
  if (!row) {
    throw new AppError('Daily revenue entry not found', 404);
  }
  return row;
};

// Tạo HOẶC cập nhật doanh thu theo ngày (1 ngày = 1 dòng).
// Trả về dòng đã lưu để UI hiển thị ngay.
const upsertByDate = async ({ revenue_date, amount, note, created_by }) => {
  let query = supabase
    .from(TABLE)
    .select('id')
    .eq('revenue_date', revenue_date);
  const { data: existing, error: findErr } = await query.maybeSingle();

  if (findErr) {
    throw new AppError(
      `Failed to check daily revenue: ${findErr.message}`,
      500,
    );
  }

  if (existing) {
    const { data: row, error } = await supabase
      .from(TABLE)
      .update({ amount, note: note ?? null })
      .eq('id', existing.id)
      .select(COLUMNS)
      .single();

    if (error) {
      throw new AppError(`Failed to update daily revenue: ${error.message}`, 500);
    }
    return row;
  }

  const { data: row, error } = await supabase
    .from(TABLE)
    .insert({
      revenue_date,
      amount,
      note: note ?? null,
      created_by,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(
        'Daily revenue for this date already exists',
        409,
      );
    }
    throw new AppError(`Failed to create daily revenue: ${error.message}`, 500);
  }
  return row;
};

const update = async (id, { revenue_date, amount, note }) => {
  const updates = {};
  if (revenue_date !== undefined) updates.revenue_date = revenue_date;
  if (amount !== undefined) updates.amount = amount;
  if (note !== undefined) updates.note = note;

  const { data: row, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('Daily revenue for this date already exists', 409);
    }
    throw new AppError(`Failed to update daily revenue: ${error.message}`, 500);
  }
  if (!row) {
    throw new AppError('Daily revenue entry not found', 404);
  }
  return row;
};

const remove = async (id) => {
  const { data: row, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to delete daily revenue: ${error.message}`, 500);
  }
  if (!row) {
    throw new AppError('Daily revenue entry not found', 404);
  }
  return row;
};

module.exports = {
  findAll,
  findById,
  upsertByDate,
  update,
  remove,
};
