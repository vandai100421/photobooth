const { z } = require('zod');

// Vietnamese mobile numbers: 0xx, 10-11 digits total.
const phoneRegex = /^0\d{9,10}$/;

const createCustomerSchema = {
  body: z.object({
    full_name: z.string().min(2, 'full_name must be at least 2 characters'),
    phone: z.string().regex(phoneRegex, 'Invalid Vietnamese phone number'),
    email: z.string().email('Invalid email').optional(),
    birthday: z.string().date('Invalid birthday').optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    zalo_id: z.string().optional(),
    notes: z.string().optional(),
  }),
};

const updateCustomerSchema = {
  body: z.object({
    full_name: z.string().min(2, 'full_name must be at least 2 characters').optional(),
    phone: z.string().regex(phoneRegex, 'Invalid Vietnamese phone number').optional(),
    email: z.string().email('Invalid email').nullish(),
    birthday: z.string().date('Invalid birthday').nullish(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    zalo_id: z.string().nullish(),
    status: z.enum(['active', 'inactive', 'vip']).optional(),
    notes: z.string().nullish(),
  }),
};

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
};
