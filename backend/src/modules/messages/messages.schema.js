const { z } = require('zod');

const CHANNELS = ['zalo', 'email', 'sms'];

// Timezone-aware ISO 8601 datetime (accepts trailing Z and +07:00 offsets).
const datetimeField = z.string().datetime({
  offset: true,
  message: 'Invalid datetime (expected ISO 8601 with offset)',
});

const sendMessageSchema = {
  body: z.object({
    customer_id: z.string().uuid('Invalid customer_id'),
    template_id: z.string().uuid('Invalid template_id'),
    channel: z.enum(CHANNELS).optional(),
    voucher_id: z.string().uuid('Invalid voucher_id').optional(),
  }),
};

const scheduleMessageSchema = {
  body: z
    .object({
      customer_id: z.string().uuid('Invalid customer_id'),
      template_id: z.string().uuid('Invalid template_id'),
      scheduled_at: datetimeField,
      channel: z.enum(CHANNELS).optional(),
      voucher_id: z.string().uuid('Invalid voucher_id').optional(),
    })
    // Scheduled time must be in the future — a past schedule is a no-op
    // since the cron job only picks up due messages.
    .superRefine((data, ctx) => {
      const scheduled = new Date(data.scheduled_at).getTime();
      if (Number.isNaN(scheduled)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduled_at'],
          message: 'scheduled_at is not a valid datetime',
        });
        return;
      }
      if (scheduled <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduled_at'],
          message: 'scheduled_at must be a future datetime',
        });
      }
    }),
};

module.exports = {
  sendMessageSchema,
  scheduleMessageSchema,
  CHANNELS,
};
