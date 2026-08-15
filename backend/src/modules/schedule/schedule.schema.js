const { z } = require('zod');

const datetimeField = z.string().datetime({ offset: true });

const createShiftSchema = {
  body: z.object({
    employee_id: z.string().uuid('Invalid employee_id'),
    date: z.string().date('Invalid date'),
    start_time: datetimeField,
    end_time: datetimeField,
    location_id: z.string().uuid('Invalid location_id').nullish(),
    location_name: z.string().max(255).nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    notes: z.string().nullish(),
  }),
};

const updateShiftSchema = {
  body: z.object({
    employee_id: z.string().uuid('Invalid employee_id').nullish(),
    date: z.string().date('Invalid date').nullish(),
    start_time: datetimeField.nullish(),
    end_time: datetimeField.nullish(),
    check_in_time: datetimeField.nullish(),
    check_out_time: datetimeField.nullish(),
    status: z.enum(['scheduled', 'completed', 'absent']).nullish(),
    location_id: z.string().uuid('Invalid location_id').nullish(),
    location_name: z.string().max(255).nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    notes: z.string().nullish(),
  }),
};

const autoAssignSchema = {
  query: z.object({
    date: z.string().date('Invalid date'),
    start_time: datetimeField,
    end_time: datetimeField,
    location_id: z.string().uuid('Invalid location_id').nullish(),
    skill: z
      .enum(['photographer', 'setup', 'cskh', 'transport', 'sales'])
      .nullish(),
  }),
};

const createSwapRequestSchema = {
  body: z.object({
    shift_id: z.string().uuid('Invalid shift_id'),
    target_employee_id: z.string().uuid('Invalid target_employee_id').nullish(),
    reason: z.string().nullish(),
  }),
};

const reviewSwapRequestSchema = {
  body: z.object({
    status: z.enum(['approved', 'rejected']),
  }),
};

const createLocationSchema = {
  body: z.object({
    name: z.string().min(1, 'name is required').max(255),
    address: z.string().nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    is_active: z.boolean().nullish(),
  }),
};

const updateLocationSchema = {
  body: z.object({
    name: z.string().min(1).max(255).nullish(),
    address: z.string().nullish(),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    is_active: z.boolean().nullish(),
  }),
};

module.exports = {
  createShiftSchema,
  updateShiftSchema,
  autoAssignSchema,
  createSwapRequestSchema,
  reviewSwapRequestSchema,
  createLocationSchema,
  updateLocationSchema,
};
