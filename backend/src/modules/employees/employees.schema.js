const { z } = require('zod');

// Vietnamese mobile numbers: 0xx or +84xx, 10 digits total.
const phoneRegex = /^(\+84|0)[3-9][0-9]{8}$/;

// Timezone-aware ISO 8601 (accepts both trailing Z and +07:00 offsets).
const datetimeField = z.string().datetime({ offset: true });

const createEmployeeSchema = {
  body: z.object({
    full_name: z.string().min(2, 'full_name must be at least 2 characters'),
    phone: z.string().regex(phoneRegex, 'Invalid Vietnamese phone number'),
    email: z.string().email('Invalid email').optional(),
    password: z.string().min(6, 'password must be at least 6 characters'),
    role: z.enum(['admin', 'manager', 'staff']),
    hire_date: z.string().date('Invalid hire_date').optional(),
    avatar_url: z.string().url('Invalid avatar_url').optional(),
  }),
};

const updateEmployeeSchema = {
  body: z.object({
    full_name: z.string().min(2, 'full_name must be at least 2 characters').optional(),
    phone: z.string().regex(phoneRegex, 'Invalid Vietnamese phone number').optional(),
    email: z.string().email('Invalid email').nullish(),
    password: z.string().min(6, 'password must be at least 6 characters').optional(),
    role: z.enum(['admin', 'manager', 'staff']).optional(),
    hire_date: z.string().date('Invalid hire_date').nullish(),
    avatar_url: z.string().url('Invalid avatar_url').nullish(),
    is_active: z.boolean().optional(),
  }),
};

const createShiftSchema = {
  body: z.object({
    employee_id: z.string().uuid('Invalid employee_id'),
    date: z.string().date('Invalid date'),
    start_time: datetimeField,
    end_time: datetimeField,
    notes: z.string().optional(),
  }),
};

const updateShiftSchema = {
  body: z.object({
    check_in_time: datetimeField.nullish(),
    check_out_time: datetimeField.nullish(),
    status: z.enum(['scheduled', 'completed', 'absent']).optional(),
    notes: z.string().nullish(),
  }),
};

const upsertSkillSchema = {
  body: z.object({
    skill: z.enum(['photographer', 'setup', 'cskh', 'transport', 'sales']),
    level: z.number().int().min(1).max(5).nullish(),
  }),
};

const upsertAreaSchema = {
  body: z.object({
    area: z.string().min(1, 'area is required').max(100),
  }),
};

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  createShiftSchema,
  updateShiftSchema,
  upsertSkillSchema,
  upsertAreaSchema,
};
