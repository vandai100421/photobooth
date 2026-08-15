const { z } = require('zod');

const POST_STATUSES = ['draft', 'pending', 'published'];

// Timezone-aware ISO 8601 datetime (accepts trailing Z and +07:00 offsets).
const datetimeField = z.string().datetime({
  offset: true,
  message: 'Invalid datetime (expected ISO 8601 with offset)',
});

const createPostSchema = {
  body: z.object({
    title: z.string().min(1, 'title must not be empty'),
    content: z.string().min(1, 'content must not be empty'),
    excerpt: z.string().optional(),
    image_url: z.string().url('Invalid image_url').optional(),
    status: z.enum(POST_STATUSES).default('draft'),
    scheduled_at: datetimeField.optional(),
  }),
};

const updatePostSchema = {
  body: z.object({
    title: z.string().min(1, 'title must not be empty').optional(),
    content: z.string().min(1, 'content must not be empty').optional(),
    excerpt: z.string().nullish(),
    image_url: z.string().url('Invalid image_url').nullish(),
    status: z.enum(POST_STATUSES).optional(),
    scheduled_at: datetimeField.nullish(),
  }),
};

module.exports = {
  createPostSchema,
  updatePostSchema,
};
