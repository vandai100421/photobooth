const { z } = require('zod');

const VOUCHER_TYPES = ['birthday', 'holiday', 'promo', 'welcome'];
const DISCOUNT_TYPES = ['percent', 'fixed'];

// ISO date string (YYYY-MM-DD); lexicographic compare works for range checks.
const dateField = z.string().date('Invalid date (expected YYYY-MM-DD)');

// Timezone-aware ISO 8601 datetime (accepts trailing Z and +07:00 offsets).
const datetimeField = z.string().datetime({
  offset: true,
  message: 'Invalid datetime (expected ISO 8601 with offset)',
});

const createVoucherSchema = {
  body: z
    .object({
      code: z.string().min(1, 'code must not be empty').optional(),
      name: z.string().min(2, 'name must be at least 2 characters'),
      type: z.enum(VOUCHER_TYPES),
      discount_type: z.enum(DISCOUNT_TYPES),
      value: z.number().min(0, 'value must be >= 0'),
      min_order: z.number().min(0, 'min_order must be >= 0').default(0),
      max_discount: z.number().min(0, 'max_discount must be >= 0').optional(),
      total_quantity: z
        .number()
        .int('total_quantity must be an integer')
        .min(-1, 'total_quantity must be >= -1')
        .default(-1),
      valid_from: dateField,
      valid_until: dateField,
      per_customer: z
        .number()
        .int('per_customer must be an integer')
        .min(1, 'per_customer must be >= 1')
        .default(1),
      is_active: z.boolean().default(true),
    })
    .superRefine((data, ctx) => {
      if (data.valid_until < data.valid_from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['valid_until'],
          message: 'valid_until must be on or after valid_from',
        });
      }
    }),
};

// VoucherUpdate follows the OpenAPI VoucherUpdate schema: code and type are
// intentionally excluded (codes are immutable; type defines the voucher's
// purpose and should not change post-creation).
const updateVoucherSchema = {
  body: z
    .object({
      name: z.string().min(2, 'name must be at least 2 characters').optional(),
      discount_type: z.enum(DISCOUNT_TYPES).optional(),
      value: z.number().min(0, 'value must be >= 0').optional(),
      min_order: z.number().min(0, 'min_order must be >= 0').optional(),
      max_discount: z.number().min(0, 'max_discount must be >= 0').nullish(),
      total_quantity: z
        .number()
        .int('total_quantity must be an integer')
        .min(-1, 'total_quantity must be >= -1')
        .optional(),
      valid_from: dateField.optional(),
      valid_until: dateField.optional(),
      per_customer: z
        .number()
        .int('per_customer must be an integer')
        .min(1, 'per_customer must be >= 1')
        .optional(),
      is_active: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      // Only validate range when both dates are present in the payload; the
      // service merges partial updates against current values for the rest.
      if (data.valid_from && data.valid_until && data.valid_until < data.valid_from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['valid_until'],
          message: 'valid_until must be on or after valid_from',
        });
      }
    }),
};

const issueVoucherSchema = {
  body: z.object({
    customer_id: z.string().uuid('Invalid customer_id'),
    expires_at: datetimeField.optional(),
  }),
};

module.exports = {
  createVoucherSchema,
  updateVoucherSchema,
  issueVoucherSchema,
};
