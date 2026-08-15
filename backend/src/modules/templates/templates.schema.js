const { z } = require('zod');

const OCCASIONS = [
  'birthday',
  'tet',
  'giangsinh',
  '8_3',
  '20_10',
  'valentine',
  'promo',
  'welcome',
  'custom',
];
const CHANNELS = ['zalo', 'email', 'sms'];

const createTemplateSchema = {
  body: z
    .object({
      name: z.string().min(1, 'name must not be empty'),
      occasion: z.enum(OCCASIONS),
      channel: z.enum(CHANNELS),
      subject: z.string().min(1, 'subject must not be empty').optional(),
      body: z.string().min(1, 'body must not be empty'),
      is_active: z.boolean().default(true),
    })
    // Email channel requires a subject line; other channels ignore it.
    .superRefine((data, ctx) => {
      if (data.channel === 'email' && !data.subject) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subject'],
          message: 'subject is required when channel is email',
        });
      }
    }),
};

const updateTemplateSchema = {
  body: z
    .object({
      name: z.string().min(1, 'name must not be empty').optional(),
      occasion: z.enum(OCCASIONS).optional(),
      channel: z.enum(CHANNELS).optional(),
      subject: z.string().min(1, 'subject must not be empty').nullish(),
      body: z.string().min(1, 'body must not be empty').optional(),
      is_active: z.boolean().optional(),
    })
    // If channel is being changed to email, a subject must be present
    // (either in this payload or already stored). The service re-checks
    // against stored values; here we only validate the payload-internal case.
    .superRefine((data, ctx) => {
      if (data.channel === 'email' && data.subject === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subject'],
          message: 'subject is required when channel is email',
        });
      }
    }),
};

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
  OCCASIONS,
  CHANNELS,
};
