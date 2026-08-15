const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const { OCCASIONS, CHANNELS } = require('./templates.schema');

const TEMPLATE_SELECT = [
  'id',
  'name',
  'occasion',
  'channel',
  'subject',
  'body',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

// Whitelist of sortable columns to prevent arbitrary column injection.
const SORTABLE_FIELDS = [
  'name',
  'occasion',
  'channel',
  'is_active',
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

// 'true' -> true, 'false' -> false, anything else -> undefined (no filter).
const parseBoolean = (val) => {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return undefined;
};

const findAll = async ({
  page,
  limit,
  search,
  channel,
  occasion,
  is_active,
  sort,
} = {}) => {
  const pg = parsePagination(page, limit);
  const { field, ascending } = parseSort(sort);

  if (channel && !CHANNELS.includes(channel)) {
    throw new AppError(
      'channel must be one of: zalo, email, sms',
      400,
    );
  }
  if (occasion && !OCCASIONS.includes(occasion)) {
    throw new AppError(
      'occasion must be one of: birthday, tet, giangsinh, 8_3, 20_10, valentine, promo, welcome, custom',
      400,
    );
  }

  let query = supabase
    .from('message_templates')
    .select(TEMPLATE_SELECT, { count: 'exact' });

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`name.ilike.%${term}%,body.ilike.%${term}%`);
  }
  if (channel) {
    query = query.eq('channel', channel);
  }
  if (occasion) {
    query = query.eq('occasion', occasion);
  }
  const activeFlag = parseBoolean(is_active);
  if (activeFlag !== undefined) {
    query = query.eq('is_active', activeFlag);
  }

  query = query.order(field, { ascending });

  const { data, count, error } = await query.range(pg.from, pg.to);
  if (error) {
    throw new AppError(`Failed to fetch templates: ${error.message}`, 500);
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
  const { data: template, error } = await supabase
    .from('message_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch template: ${error.message}`, 500);
  }
  if (!template) {
    throw new AppError('Template not found', 404);
  }
  return template;
};

const insert = async (data) => {
  const { data: template, error } = await supabase
    .from('message_templates')
    .insert({
      name: data.name,
      occasion: data.occasion,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      is_active: data.is_active ?? true,
    })
    .select(TEMPLATE_SELECT)
    .single();

  if (error) {
    // 23505 = unique_violation (name + channel collision).
    if (error.code === '23505') {
      throw new AppError(
        'Template with this name and channel already exists',
        409,
      );
    }
    // 23514 = check_violation (invalid occasion/channel enum).
    if (error.code === '23514') {
      throw new AppError('Invalid occasion or channel value', 400);
    }
    throw new AppError(`Failed to create template: ${error.message}`, 500);
  }
  return template;
};

const update = async (id, data) => {
  // If channel is being changed to email, ensure a subject will exist after
  // the merge (either provided in the payload or already stored).
  if (data.channel === 'email' || data.subject !== undefined) {
    const { data: current, error: fetchErr } = await supabase
      .from('message_templates')
      .select('channel, subject')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      throw new AppError(
        `Failed to fetch template: ${fetchErr.message}`,
        500,
      );
    }
    if (!current) {
      throw new AppError('Template not found', 404);
    }

    const finalChannel =
      data.channel !== undefined ? data.channel : current.channel;
    const finalSubject =
      data.subject !== undefined ? data.subject : current.subject;

    if (finalChannel === 'email' && !finalSubject) {
      throw new AppError(
        'subject is required when channel is email',
        400,
      );
    }
  }

  const allowedKeys = [
    'name',
    'occasion',
    'channel',
    'subject',
    'body',
    'is_active',
  ];
  const updates = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      updates[key] = data[key];
    }
  }

  const { data: template, error } = await supabase
    .from('message_templates')
    .update(updates)
    .eq('id', id)
    .select(TEMPLATE_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(
        'Template with this name and channel already exists',
        409,
      );
    }
    if (error.code === '23514') {
      throw new AppError('Invalid occasion or channel value', 400);
    }
    throw new AppError(`Failed to update template: ${error.message}`, 500);
  }
  if (!template) {
    throw new AppError('Template not found', 404);
  }
  return template;
};

// Hard delete — templates have no soft-delete column. message_logs.template_id
// is ON DELETE SET NULL, so logs survive with a NULL template reference.
const remove = async (id) => {
  const { data: template, error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to delete template: ${error.message}`, 500);
  }
  if (!template) {
    throw new AppError('Template not found', 404);
  }
  return template;
};

module.exports = {
  findAll,
  findById,
  insert,
  update,
  remove,
};
