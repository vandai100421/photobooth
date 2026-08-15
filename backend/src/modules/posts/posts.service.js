const supabase = require('../../config/supabase');
const AppError = require('../../utils/AppError');

const POST_SELECT = [
  'id',
  'title',
  'slug',
  'content',
  'excerpt',
  'image_url',
  'status',
  'scheduled_at',
  'published_at',
  'author_id',
  'deleted_at',
  'created_at',
  'updated_at',
].join(', ');

// Whitelist of sortable columns to prevent arbitrary column injection.
const SORTABLE_FIELDS = [
  'title',
  'slug',
  'status',
  'scheduled_at',
  'published_at',
  'created_at',
  'updated_at',
];

const VALID_STATUSES = ['draft', 'pending', 'published'];

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

// Vietnamese-aware slugify: strip diacritics, lowercase, join words with '-'.
// VD: "Chúc mừng năm mới" -> "chuc-mung-nam-moi".
const slugify = (title) =>
  String(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const findAll = async ({ page, limit, search, status, sort } = {}) => {
  const pg = parsePagination(page, limit);
  const { field, ascending } = parseSort(sort);

  if (status && !VALID_STATUSES.includes(status)) {
    throw new AppError(
      'status must be one of: draft, pending, published',
      400,
    );
  }

  let query = supabase
    .from('posts')
    .select(POST_SELECT, { count: 'exact' })
    .is('deleted_at', null);

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  query = query.order(field, { ascending });

  const { data, count, error } = await query.range(pg.from, pg.to);
  if (error) {
    throw new AppError(`Failed to fetch posts: ${error.message}`, 500);
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
  const { data: post, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch post: ${error.message}`, 500);
  }
  if (!post) {
    throw new AppError('Post not found', 404);
  }
  return post;
};

const insert = async (data, authorId) => {
  const slug = slugify(data.title) || `post-${Date.now()}`;

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      title: data.title,
      slug,
      content: data.content,
      excerpt: data.excerpt || null,
      image_url: data.image_url || null,
      status: data.status || 'draft',
      scheduled_at: data.scheduled_at || null,
      author_id: authorId || null,
    })
    .select(POST_SELECT)
    .single();

  if (error) {
    // 23505 = unique_violation (slug already exists).
    if (error.code === '23505') {
      throw new AppError('Post slug already exists', 409);
    }
    throw new AppError(`Failed to create post: ${error.message}`, 500);
  }
  return post;
};

const update = async (id, data) => {
  const allowedKeys = [
    'title',
    'content',
    'excerpt',
    'image_url',
    'status',
    'scheduled_at',
  ];
  const updates = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      updates[key] = data[key];
    }
  }

  // Regenerate slug when the title changes.
  if (updates.title !== undefined) {
    updates.slug = slugify(updates.title) || `post-${Date.now()}`;
  }

  const { data: post, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('Post slug already exists', 409);
    }
    throw new AppError(`Failed to update post: ${error.message}`, 500);
  }
  if (!post) {
    throw new AppError('Post not found', 404);
  }
  return post;
};

// Soft delete: set deleted_at so the row is excluded from list/detail but
// preserved for referential integrity.
const remove = async (id) => {
  const { data: post, error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to delete post: ${error.message}`, 500);
  }
  if (!post) {
    throw new AppError('Post not found', 404);
  }
  return post;
};

const publish = async (id) => {
  const { data: post, error } = await supabase
    .from('posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to publish post: ${error.message}`, 500);
  }
  if (!post) {
    throw new AppError('Post not found', 404);
  }
  return post;
};

module.exports = {
  findAll,
  findById,
  insert,
  update,
  remove,
  publish,
};
