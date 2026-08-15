const { z } = require('zod');

// Timezone-aware ISO 8601 (accepts both trailing Z and +07:00 offsets).
const datetimeField = z.string().datetime({ offset: true });

const createBookingSchema = {
  body: z.object({
    customer_id: z.string().uuid('Invalid customer_id'),
    employee_id: z.string().uuid('Invalid employee_id'),
    booking_date: datetimeField,
    package_name: z.string(),
    amount: z.number().min(0, 'amount must be >= 0'),
    status: z.enum(['completed', 'cancelled', 'no-show']).default('completed'),
    voucher_id: z.string().uuid('Invalid voucher_id').optional(),
    photo_count: z.number().int().min(0).optional(),
    notes: z.string().optional(),
  }),
};

const updateBookingSchema = {
  body: z.object({
    customer_id: z.string().uuid('Invalid customer_id').optional(),
    employee_id: z.string().uuid('Invalid employee_id').nullish(),
    booking_date: datetimeField.optional(),
    package_name: z.string().nullish(),
    amount: z.number().min(0, 'amount must be >= 0').optional(),
    status: z.enum(['completed', 'cancelled', 'no-show']).optional(),
    voucher_id: z.string().uuid('Invalid voucher_id').nullish(),
    photo_count: z.number().int().min(0).optional(),
    notes: z.string().nullish(),
  }),
};

module.exports = {
  createBookingSchema,
  updateBookingSchema,
};
