const { z } = require('zod');

const createDailyRevenueSchema = {
  body: z.object({
    revenue_date: z.string().date('revenue_date must be YYYY-MM-DD'),
    amount: z.number().min(0, 'amount must be >= 0'),
    note: z.string().max(500, 'note must be at most 500 characters').optional(),
  }),
};

const updateDailyRevenueSchema = {
  body: z.object({
    revenue_date: z.string().date('revenue_date must be YYYY-MM-DD').optional(),
    amount: z.number().min(0, 'amount must be >= 0').optional(),
    note: z.string().max(500, 'note must be at most 500 characters').nullish(),
  }),
};

const listDailyRevenueSchema = {
  query: z.object({
    from: z.string().date('from must be YYYY-MM-DD').optional(),
    to: z.string().date('to must be YYYY-MM-DD').optional(),
  }),
};

module.exports = {
  createDailyRevenueSchema,
  updateDailyRevenueSchema,
  listDailyRevenueSchema,
};
