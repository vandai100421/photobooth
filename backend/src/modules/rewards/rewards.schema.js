const { z } = require('zod');

const monthRegex = /^\d{4}-\d{2}$/;

const kpiSchema = {
  query: z.object({
    employee_id: z.string().uuid('Invalid employee_id'),
    month: z.string().regex(monthRegex, 'month must be YYYY-MM'),
  }),
};

const leaderboardSchema = {
  query: z.object({
    month: z.string().regex(monthRegex, 'month must be YYYY-MM'),
  }),
};

const payoutsListSchema = {
  query: z.object({
    month: z.string().regex(monthRegex, 'month must be YYYY-MM').nullish(),
    employee_id: z.string().uuid('Invalid employee_id').nullish(),
    status: z.enum(['pending', 'paid']).nullish(),
  }),
};

const createPayoutSchema = {
  body: z.object({
    employee_id: z.string().uuid('Invalid employee_id'),
    month: z.string().regex(monthRegex, 'month must be YYYY-MM'),
  }),
};

const updatePayoutSchema = {
  body: z.object({
    status: z.enum(['pending', 'paid']).nullish(),
    total_amount: z.number().min(0).nullish(),
    breakdown: z.any().nullish(),
  }),
};

const upsertBonusRulesSchema = {
  body: z.object({
    rules: z
      .array(
        z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          amount: z.number(),
          multiplier: z.number().nullish(),
          is_active: z.boolean().nullish(),
        }),
      )
      .min(1),
  }),
};

const adjustmentsListSchema = {
  query: z.object({
    month: z.string().regex(monthRegex, 'month must be YYYY-MM').nullish(),
    employee_id: z.string().uuid('Invalid employee_id').nullish(),
  }),
};

const createAdjustmentSchema = {
  body: z.object({
    employee_id: z.string().uuid('Invalid employee_id'),
    kind: z.enum(['bonus', 'penalty']),
    amount: z.number().positive('amount must be > 0'),
    reason: z.string().min(1, 'reason is required').max(500),
    feedback_id: z.string().uuid('Invalid feedback_id').nullish(),
    period_month: z.string().regex(monthRegex, 'period_month must be YYYY-MM'),
  }),
};

const createFeedbackSchema = {
  body: z.object({
    booking_id: z.string().uuid('Invalid booking_id'),
    employee_id: z.string().uuid('Invalid employee_id').nullish(),
    customer_id: z.string().uuid('Invalid customer_id').nullish(),
    rating: z.number().int().min(1).max(5),
    note: z.string().nullish(),
  }),
};

module.exports = {
  kpiSchema,
  leaderboardSchema,
  payoutsListSchema,
  createPayoutSchema,
  updatePayoutSchema,
  upsertBonusRulesSchema,
  adjustmentsListSchema,
  createAdjustmentSchema,
  createFeedbackSchema,
};
