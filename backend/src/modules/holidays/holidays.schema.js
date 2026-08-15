const { z } = require('zod');

// MM-DD format (recurring holidays have no year component).
const dateField = z
  .string()
  .regex(/^\d{2}-\d{2}$/, 'date must be in MM-DD format');

const createHolidaySchema = {
  body: z.object({
    name: z.string().min(1, 'name must not be empty'),
    date: dateField,
    is_recurring: z.boolean().default(true),
    specific_year: z
      .number()
      .int('specific_year must be an integer')
      .min(1900, 'specific_year must be >= 1900')
      .max(2200, 'specific_year must be <= 2200')
      .optional(),
    template_id: z.string().uuid('Invalid template_id').optional(),
    is_active: z.boolean().default(true),
  }),
};

const updateHolidaySchema = {
  body: z.object({
    name: z.string().min(1, 'name must not be empty').optional(),
    date: dateField.optional(),
    is_recurring: z.boolean().optional(),
    specific_year: z
      .number()
      .int('specific_year must be an integer')
      .min(1900, 'specific_year must be >= 1900')
      .max(2200, 'specific_year must be <= 2200')
      .nullish(),
    template_id: z.string().uuid('Invalid template_id').nullish(),
    is_active: z.boolean().optional(),
  }),
};

module.exports = {
  createHolidaySchema,
  updateHolidaySchema,
};
